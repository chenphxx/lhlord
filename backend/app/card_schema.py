"""Category-level custom field and custom relationship schemas."""

from dataclasses import dataclass
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.catalog import get_entity_type
from app.models import (
    Card,
    CardRelation,
    CustomFieldDefinition,
    CustomRelationDefinition
)
from app.schemas import (
    CardTypeSchemaOut,
    CustomFieldDefinitionOut,
    CustomRelationDefinitionOut
)


@dataclass
class PreparedCardFields:
    """Normalized fields for one card plus propagation metadata."""

    fields: list[dict[str, str]]
    new_keys: list[str]
    affected_cards: int


@dataclass
class RemovedSchemaEntries:
    """Counts produced when removing category schema entries."""

    removed_definitions: int
    affected_cards: int
    removed_relations: int = 0


def _validate_card_type(card_type: str) -> None:
    """
    @brief Ensure a schema request uses a known card type

    @return None
    """

    if get_entity_type(card_type) is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="未知对象类型"
        )


def _field_key(field: dict[str, object]) -> str:
    """
    @brief Read and trim a custom field key

    @return Normalized key
    """

    value = field.get("key")
    return value.strip() if isinstance(value, str) else ""


def _field_value(field: dict[str, object]) -> str:
    """
    @brief Read a custom field value

    @return Normalized value
    """

    value = field.get("value")
    return value.strip() if isinstance(value, str) else ""


def _field_definitions(
    session: Session,
    card_type: str
) -> list[CustomFieldDefinition]:
    """
    @brief Load field definitions in display order

    @return Ordered definitions
    """

    return list(
        session.scalars(
            select(CustomFieldDefinition)
            .where(CustomFieldDefinition.card_type == card_type)
            .order_by(CustomFieldDefinition.position.asc())
        ).all()
    )


def _relation_definitions(
    session: Session,
    card_type: str
) -> list[CustomRelationDefinition]:
    """
    @brief Load custom relationship definitions in display order

    @return Ordered definitions
    """

    return list(
        session.scalars(
            select(CustomRelationDefinition)
            .where(CustomRelationDefinition.card_type == card_type)
            .order_by(CustomRelationDefinition.position.asc())
        ).all()
    )


def get_card_type_schema(
    session: Session,
    card_type: str
) -> CardTypeSchemaOut:
    """
    @brief Return shared schema entries, including legacy card values

    @return Category schema
    """

    _validate_card_type(card_type)
    field_definitions = _field_definitions(session, card_type)
    field_keys = [
        definition.field_key
        for definition in field_definitions
    ]
    known_fields = set(field_keys)
    cards = session.scalars(
        select(Card)
        .where(Card.card_type == card_type)
        .order_by(Card.created_at.asc())
    ).all()
    for card in cards:
        for field in card.custom_fields:
            key = _field_key(field)
            if key and key not in known_fields:
                field_keys.append(key)
                known_fields.add(key)

    relation_definitions = _relation_definitions(session, card_type)
    relation_pairs = [
        (
            definition.forward_label,
            definition.inverse_label
        )
        for definition in relation_definitions
    ]
    known_relations = set(relation_pairs)
    existing_relations = session.execute(
        select(
            CardRelation.forward_label,
            CardRelation.inverse_label
        )
        .join(Card, Card.id == CardRelation.source_card_id)
        .where(
            Card.card_type == card_type,
            CardRelation.preset_key.is_(None)
        )
        .order_by(CardRelation.created_at.asc())
    ).all()
    for forward_label, inverse_label in existing_relations:
        pair = (forward_label, inverse_label)
        if pair not in known_relations:
            relation_pairs.append(pair)
            known_relations.add(pair)

    return CardTypeSchemaOut(
        card_type=card_type,
        custom_fields=[
            CustomFieldDefinitionOut(
                key=key,
                position=position
            )
            for position, key in enumerate(field_keys)
        ],
        custom_relations=[
            CustomRelationDefinitionOut(
                forward_label=forward_label,
                inverse_label=inverse_label,
                position=position
            )
            for position, (forward_label, inverse_label) in enumerate(
                relation_pairs
            )
        ]
    )


def _ensure_field_definitions(
    session: Session,
    card_type: str,
    cards: list[Card]
) -> list[CustomFieldDefinition]:
    """
    @brief Persist definitions discovered from legacy card fields

    @return Ordered field definitions
    """

    definitions = _field_definitions(session, card_type)
    known_keys = {
        definition.field_key
        for definition in definitions
    }
    next_position = len(definitions)
    for card in cards:
        for field in card.custom_fields:
            key = _field_key(field)
            if key and key not in known_keys:
                definition = CustomFieldDefinition(
                    card_type=card_type,
                    field_key=key,
                    position=next_position
                )
                session.add(definition)
                definitions.append(definition)
                known_keys.add(key)
                next_position += 1
    if next_position != len(_field_definitions(session, card_type)):
        session.flush()
    return definitions


def sync_card_fields(
    session: Session,
    card_type: str,
    current_card_id: UUID | None,
    incoming_fields: list[dict[str, str]]
) -> PreparedCardFields:
    """
    @brief Normalize shared fields and add newly introduced keys to peers

    @return Normalized current-card fields and propagation metadata
    """

    _validate_card_type(card_type)
    incoming_values: dict[str, str] = {}
    for field in incoming_fields:
        key = field["key"].strip()
        if key in incoming_values:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"自定义字段名称重复: {key}"
            )
        incoming_values[key] = field["value"].strip()

    cards = list(
        session.scalars(
            select(Card)
            .where(Card.card_type == card_type)
            .order_by(Card.created_at.asc())
        ).all()
    )
    definitions = _ensure_field_definitions(
        session=session,
        card_type=card_type,
        cards=cards
    )
    known_keys = {
        definition.field_key
        for definition in definitions
    }
    new_keys = [
        key
        for key in incoming_values
        if key not in known_keys
    ]
    next_position = len(definitions)
    for key in new_keys:
        definition = CustomFieldDefinition(
            card_type=card_type,
            field_key=key,
            position=next_position
        )
        session.add(definition)
        definitions.append(definition)
        next_position += 1
    session.flush()

    definition_keys = [
        definition.field_key
        for definition in definitions
    ]
    current_fields = [
        {
            "key": key,
            "value": incoming_values.get(key, "")
        }
        for key in definition_keys
    ]

    affected_cards = 0
    for card in cards:
        if current_card_id is not None and card.id == current_card_id:
            continue
        existing_values = {
            _field_key(field): _field_value(field)
            for field in card.custom_fields
            if _field_key(field)
        }
        normalized_fields = [
            {
                "key": key,
                "value": existing_values.get(key, "")
            }
            for key in definition_keys
        ]
        if normalized_fields != card.custom_fields:
            card.custom_fields = normalized_fields
            affected_cards += 1

    return PreparedCardFields(
        fields=current_fields,
        new_keys=new_keys,
        affected_cards=affected_cards
    )


def sync_custom_relation_definitions(
    session: Session,
    card_type: str
) -> None:
    """
    @brief Persist definitions for custom relationships on a card type

    @return None
    """

    definitions = _relation_definitions(session, card_type)
    known_pairs = {
        (
            definition.forward_label,
            definition.inverse_label
        )
        for definition in definitions
    }
    next_position = len(definitions)
    relations = session.execute(
        select(
            CardRelation.forward_label,
            CardRelation.inverse_label,
            CardRelation.created_at
        )
        .join(Card, Card.id == CardRelation.source_card_id)
        .where(
            Card.card_type == card_type,
            CardRelation.preset_key.is_(None)
        )
        .order_by(CardRelation.created_at.asc())
    ).all()
    for forward_label, inverse_label, _created_at in relations:
        pair = (forward_label, inverse_label)
        if pair in known_pairs:
            continue
        session.add(
            CustomRelationDefinition(
                card_type=card_type,
                forward_label=forward_label,
                inverse_label=inverse_label,
                position=next_position
            )
        )
        known_pairs.add(pair)
        next_position += 1
    session.flush()


def remove_category_fields(
    session: Session,
    card_type: str,
    field_keys: list[str]
) -> RemovedSchemaEntries:
    """
    @brief Remove shared fields from every card of one category

    @return Removal summary
    """

    normalized_keys = {
        key.strip()
        for key in field_keys
        if key.strip()
    }
    if not normalized_keys:
        return RemovedSchemaEntries(
            removed_definitions=0,
            affected_cards=0
        )

    definitions = [
        definition
        for definition in _field_definitions(session, card_type)
        if definition.field_key in normalized_keys
    ]
    known_keys = {
        definition.field_key
        for definition in definitions
    }
    cards = session.scalars(
        select(Card).where(Card.card_type == card_type)
    ).all()
    affected_cards = 0
    for card in cards:
        filtered_fields = [
            field
            for field in card.custom_fields
            if _field_key(field) not in normalized_keys
        ]
        if filtered_fields != card.custom_fields:
            card.custom_fields = filtered_fields
            affected_cards += 1
    for definition in definitions:
        session.delete(definition)
    session.flush()
    return RemovedSchemaEntries(
        removed_definitions=len(known_keys),
        affected_cards=affected_cards
    )


def remove_custom_relation_definitions(
    session: Session,
    card_type: str,
    relation_pairs: list[tuple[str, str]]
) -> RemovedSchemaEntries:
    """
    @brief Remove shared relationship definitions and their actual links

    @return Removal summary
    """

    normalized_pairs = {
        (
            forward_label.strip(),
            inverse_label.strip()
        )
        for forward_label, inverse_label in relation_pairs
        if forward_label.strip() and inverse_label.strip()
    }
    if not normalized_pairs:
        return RemovedSchemaEntries(
            removed_definitions=0,
            affected_cards=0
        )

    definitions = [
        definition
        for definition in _relation_definitions(session, card_type)
        if (
            definition.forward_label,
            definition.inverse_label
        ) in normalized_pairs
    ]
    joined_relations = session.execute(
        select(CardRelation, Card.id)
        .join(Card, Card.id == CardRelation.source_card_id)
        .where(
            Card.card_type == card_type,
            CardRelation.preset_key.is_(None)
        )
    ).all()
    affected_cards: set[UUID] = set()
    removed_relations = 0
    for relation, source_card_id in joined_relations:
        if (
            relation.forward_label,
            relation.inverse_label
        ) not in normalized_pairs:
            continue
        affected_cards.add(source_card_id)
        session.delete(relation)
        removed_relations += 1
    for definition in definitions:
        session.delete(definition)
    session.flush()
    return RemovedSchemaEntries(
        removed_definitions=len(definitions),
        affected_cards=len(affected_cards),
        removed_relations=removed_relations
    )
