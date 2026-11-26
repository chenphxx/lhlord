"""Card persistence, relationship validation, and response mapping."""

from collections.abc import Iterable
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session, aliased, joinedload, selectinload

from app.analytics import record_operation
from app.card_schema import (
    remove_category_fields,
    remove_custom_relation_definitions,
    sync_card_fields,
    sync_custom_relation_definitions
)
from app.catalog import get_entity_type, get_relation_preset
from app.models import Card, CardRelation
from app.schemas import (
    CardCreate,
    CardOut,
    CardRelationOut,
    CardUpdate,
    CustomField,
    LinkedCardInput,
    RelatedCard,
    RelationInput
)


def _field_value_map(
    fields: list[dict[str, str]]
) -> dict[str, str]:
    """
    @brief Build a custom-field value map

    @return Field values keyed by name
    """

    return {
        field.get("key", ""): field.get("value", "")
        for field in fields
        if field.get("key")
    }


def _basic_changes(
    before: dict[str, str],
    after: dict[str, str]
) -> list[dict[str, str | None]]:
    """
    @brief Build field-level changes for standard card attributes

    @return Change descriptors
    """

    changes: list[dict[str, str | None]] = []
    labels = {
        "name": "名称",
        "icon": "图标",
        "summary": "简介"
    }
    for key, label in labels.items():
        before_value = before.get(key, "")
        after_value = after.get(key, "")
        if before_value == after_value:
            continue
        changes.append(
            {
                "field": label,
                "before": before_value,
                "after": after_value
            }
        )
    return changes


def _custom_field_changes(
    before: dict[str, str],
    after: dict[str, str]
) -> list[dict[str, str | None]]:
    """
    @brief Build field-level changes for custom fields

    @return Change descriptors
    """

    changes: list[dict[str, str | None]] = []
    ordered_keys = list(after)
    ordered_keys.extend(
        key
        for key in before
        if key not in after
    )
    for key in ordered_keys:
        before_value = before.get(key) if key in before else None
        after_value = after.get(key) if key in after else None
        if before_value == after_value:
            continue
        changes.append(
            {
                "field": f"自定义字段「{key}」",
                "before": before_value,
                "after": after_value
            }
        )
    return changes


def _schema_field_changes(
    new_keys: list[str],
    affected_cards: int
) -> list[dict[str, str]]:
    """
    @brief Describe category field definitions introduced by a card change

    @return Change descriptors
    """

    return [
        {
            "field": f"类别字段「{key}」",
            "before": "未定义",
            "after": f"已新增并同步到 {affected_cards} 张同类卡片"
        }
        for key in new_keys
    ]


def _relation_values(
    session: Session,
    card_id: UUID
) -> list[dict[str, str]]:
    """
    @brief Load human-readable outgoing relationship values

    @return Relationship descriptors
    """

    target_card = aliased(Card)
    rows = session.execute(
        select(
            CardRelation.preset_key,
            CardRelation.forward_label,
            target_card.name
        )
        .join(
            target_card,
            target_card.id == CardRelation.target_card_id
        )
        .where(CardRelation.source_card_id == card_id)
        .order_by(CardRelation.position.asc())
    ).all()
    return [
        {
            "preset_key": preset_key or "",
            "label": forward_label,
            "target": target_name
        }
        for preset_key, forward_label, target_name in rows
    ]


def _relation_changes(
    before: list[dict[str, str]],
    after: list[dict[str, str]]
) -> list[dict[str, str]]:
    """
    @brief Compare outgoing relationship display values

    @return Relationship changes
    """

    def identity(relation: dict[str, str]) -> tuple[str, str, str]:
        return (
            relation["preset_key"],
            relation["label"],
            relation["target"]
        )

    before_map = {
        identity(relation): relation
        for relation in before
    }
    after_map = {
        identity(relation): relation
        for relation in after
    }
    changes: list[dict[str, str]] = []
    for relation_id, relation in before_map.items():
        if relation_id in after_map:
            continue
        changes.append(
            {
                "field": f"关联「{relation['label']}」",
                "before": relation["target"],
                "after": "未关联"
            }
        )
    for relation_id, relation in after_map.items():
        if relation_id in before_map:
            continue
        changes.append(
            {
                "field": f"关联「{relation['label']}」",
                "before": "未关联",
                "after": relation["target"]
            }
        )
    return changes


def _normalize_custom_fields(
    fields: Iterable[CustomField]
) -> list[dict[str, str]]:
    """
    @brief Remove blank custom fields while preserving input order

    @param fields Custom field inputs

    @return Normalized custom field dictionaries
    """

    normalized_fields: list[dict[str, str]] = []
    for field in fields:
        key = field.key.strip()
        value = field.value.strip()
        if not key and not value:
            continue
        if not key:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="自定义字段名称不能为空"
            )
        normalized_fields.append(
            {
                "key": key,
                "value": value
            }
        )

    return normalized_fields


def _validate_type_and_icon(card_type: str, icon: str) -> None:
    """
    @brief Ensure a card uses a known type and allowed icon

    @param card_type Entity type identifier
    @param icon Canonical icon path

    @return None
    """

    entity_type = get_entity_type(card_type)
    if entity_type is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"未知对象类型: {card_type}"
        )
    if icon not in entity_type.icons:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"图标不属于对象类型: {entity_type.name}"
        )


def _build_card(
    card_type: str,
    name: str,
    icon: str,
    summary: str,
    custom_fields: Iterable[CustomField]
) -> Card:
    """
    @brief Validate and construct a new card model

    @return Unsaved card model
    """

    card_type = card_type.strip()
    name = name.strip()
    icon = icon.strip()
    summary = summary.strip()

    if not name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="对象名称不能为空"
        )
    _validate_type_and_icon(
        card_type=card_type,
        icon=icon
    )

    return Card(
        card_type=card_type,
        name=name,
        icon=icon,
        summary=summary,
        custom_fields=_normalize_custom_fields(custom_fields)
    )


def _build_linked_card(new_target: LinkedCardInput) -> Card:
    """
    @brief Construct a related card inside the parent transaction

    @param new_target Related card draft

    @return Unsaved related card
    """

    return _build_card(
        card_type=new_target.card_type,
        name=new_target.name,
        icon=new_target.icon,
        summary=new_target.summary,
        custom_fields=new_target.custom_fields
    )


def _resolve_related_card(
    session: Session,
    relation_input: RelationInput
) -> Card:
    """
    @brief Resolve an existing target or create a new target in the transaction

    @return Target card model
    """

    if relation_input.target_card_id is not None:
        target = session.get(
            Card,
            relation_input.target_card_id
        )
        if target is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="选择的关联对象不存在"
            )
        return target

    if relation_input.new_target is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="缺少关联对象"
        )

    target = _build_linked_card(relation_input.new_target)
    session.add(target)
    session.flush()
    field_sync = sync_card_fields(
        session=session,
        card_type=target.card_type,
        current_card_id=target.id,
        incoming_fields=target.custom_fields
    )
    target.custom_fields = field_sync.fields
    entity_type = get_entity_type(target.card_type)
    record_operation(
        session=session,
        action="create",
        entity_type=target.card_type,
        entity_id=target.id,
        summary=(
            f"新建{entity_type.name}「{target.name}」"
            if entity_type
            else f"新建对象「{target.name}」"
        ),
        details={
            "changes": [
                *_basic_changes(
                    {},
                    {
                        "name": target.name,
                        "icon": target.icon,
                        "summary": target.summary
                    }
                ),
                *_custom_field_changes(
                    {},
                    _field_value_map(target.custom_fields)
                ),
                *_schema_field_changes(
                    field_sync.new_keys,
                    field_sync.affected_cards
                )
            ],
            "new_category_fields": field_sync.new_keys,
            "affected_cards": field_sync.affected_cards,
            "relation_count": 0
        }
    )
    return target


def _make_relation(
    source_card: Card,
    relation_input: RelationInput,
    position: int,
    seen_relations: set[tuple[str, str, str]],
    preset_counts: dict[str, int]
) -> CardRelation:
    """
    @brief Validate one relation and construct its model

    @return Unsaved relationship model
    """

    if relation_input.preset_key:
        preset = get_relation_preset(relation_input.preset_key)
        if preset is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"未知关联类型: {relation_input.preset_key}"
            )
        if preset.source_type != source_card.card_type:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="该关联关系不能从当前对象类型发起"
            )

        expected_type = preset.target_type
        if relation_input.new_target:
            target_type = relation_input.new_target.card_type
        else:
            target_type = relation_input.target_type

        if target_type and target_type != expected_type:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="关联对象类型与预设关系不匹配"
            )

        preset_counts[preset.key] = preset_counts.get(preset.key, 0) + 1
        if preset.cardinality == "one" and preset_counts[preset.key] > 1:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"{preset.label}只能关联一个对象"
            )

        identity = (
            preset.key,
            str(
                relation_input.target_card_id
                or relation_input.new_target.name
            ),
            ""
        )
        if identity in seen_relations:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="不能重复添加同一关联"
            )
        seen_relations.add(identity)

        return CardRelation(
            source_card_id=source_card.id,
            preset_key=preset.key,
            forward_label=preset.label,
            inverse_label=preset.inverse_label,
            position=position
        )

    if not relation_input.label or not relation_input.inverse_label:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="自定义关系必须填写正向和反向名称"
        )
    if not relation_input.target_type:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="自定义关系必须指定目标类型"
        )
    if get_entity_type(relation_input.target_type) is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="自定义关系目标类型不存在"
        )

    custom_identity = (
        "custom",
        str(
            relation_input.target_card_id
            or relation_input.new_target.name
        ),
        f"{relation_input.label}|{relation_input.inverse_label}"
    )
    if custom_identity in seen_relations:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="不能重复添加同一关联"
        )
    seen_relations.add(custom_identity)

    return CardRelation(
        source_card_id=source_card.id,
        preset_key=None,
        forward_label=relation_input.label,
        inverse_label=relation_input.inverse_label,
        position=position
    )


def _create_relations(
    session: Session,
    source_card: Card,
    relation_inputs: Iterable[RelationInput]
) -> None:
    """
    @brief Validate and add all requested outgoing relationships

    @return None
    """

    seen_relations: set[tuple[str, str, str]] = set()
    preset_counts: dict[str, int] = {}
    relation_models: list[CardRelation] = []

    for position, relation_input in enumerate(relation_inputs):
        target = _resolve_related_card(
            session=session,
            relation_input=relation_input
        )
        if target.id == source_card.id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="对象不能关联自身"
            )

        relation = _make_relation(
            source_card=source_card,
            relation_input=relation_input,
            position=position,
            seen_relations=seen_relations,
            preset_counts=preset_counts
        )

        expected_type = None
        if relation.preset_key:
            preset = get_relation_preset(relation.preset_key)
            expected_type = preset.target_type if preset else None
        else:
            expected_type = relation_input.target_type

        if expected_type != target.card_type:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="关联对象类型与关系定义不匹配"
            )

        relation.target_card_id = target.id
        relation_models.append(relation)

    session.add_all(relation_models)
    session.flush()


def _load_card_query():
    """
    @brief Build a card query with relationship summaries

    @return SQLAlchemy select statement
    """

    return (
        select(Card)
        .execution_options(populate_existing=True)
        .options(
            selectinload(Card.outgoing_relations)
            .joinedload(CardRelation.target_card),
            selectinload(Card.incoming_relations)
            .joinedload(CardRelation.source_card)
        )
    )


def _relation_response(
    relation: CardRelation,
    direction: str
) -> CardRelationOut:
    """
    @brief Serialize a relationship from one card's perspective

    @return Relationship response
    """

    if direction == "outgoing":
        related_card = relation.target_card
        label = relation.forward_label
        inverse_label = relation.inverse_label
    else:
        related_card = relation.source_card
        label = relation.inverse_label
        inverse_label = relation.forward_label

    preset = (
        get_relation_preset(relation.preset_key)
        if relation.preset_key
        else None
    )
    cardinality = preset.cardinality if preset else "many"

    return CardRelationOut(
        id=relation.id,
        preset_key=relation.preset_key,
        label=label,
        inverse_label=inverse_label,
        direction=direction,
        cardinality=cardinality,
        related_card=RelatedCard(
            id=related_card.id,
            card_type=related_card.card_type,
            name=related_card.name,
            icon=related_card.icon
        )
    )


def card_to_response(card: Card) -> CardOut:
    """
    @brief Serialize a full card, including incoming and outgoing relationships

    @return Card response
    """

    outgoing = [
        _relation_response(
            relation,
            "outgoing"
        )
        for relation in card.outgoing_relations
    ]
    incoming = [
        _relation_response(
            relation,
            "incoming"
        )
        for relation in card.incoming_relations
    ]
    incoming.sort(
        key=lambda relation: relation.id
    )

    return CardOut(
        id=card.id,
        card_type=card.card_type,
        name=card.name,
        icon=card.icon,
        summary=card.summary,
        custom_fields=card.custom_fields,
        relations=outgoing + incoming,
        created_at=card.created_at,
        updated_at=card.updated_at
    )


def get_card_or_404(
    session: Session,
    card_id: UUID
) -> Card:
    """
    @brief Load one card with relationships

    @return Card model
    """

    card = session.scalar(
        _load_card_query().where(Card.id == card_id)
    )
    if card is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="对象卡片不存在"
        )
    return card


def list_cards(
    session: Session,
    card_type: str
) -> list[CardOut]:
    """
    @brief List all cards of one type, newest first

    @return Serialized cards
    """

    if get_entity_type(card_type) is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"未知对象类型: {card_type}"
        )

    cards = session.scalars(
        _load_card_query()
        .where(Card.card_type == card_type)
        .order_by(Card.created_at.desc())
    ).unique().all()

    return [
        card_to_response(card)
        for card in cards
    ]


def create_card(
    session: Session,
    payload: CardCreate
) -> CardOut:
    """
    @brief Create a card and all nested drafts atomically

    @return Created card response
    """

    card = _build_card(
        card_type=payload.card_type,
        name=payload.name,
        icon=payload.icon,
        summary=payload.summary,
        custom_fields=payload.custom_fields
    )

    try:
        session.add(card)
        session.flush()
        card_id = card.id
        field_sync = sync_card_fields(
            session=session,
            card_type=card.card_type,
            current_card_id=card.id,
            incoming_fields=card.custom_fields
        )
        card.custom_fields = field_sync.fields
        _create_relations(
            session=session,
            source_card=card,
            relation_inputs=payload.relations
        )
        sync_custom_relation_definitions(
            session=session,
            card_type=card.card_type
        )
        entity_type = get_entity_type(card.card_type)
        relation_values = _relation_values(
            session=session,
            card_id=card.id
        )
        changes = [
            *_basic_changes(
                {},
                {
                    "name": card.name,
                    "icon": card.icon,
                    "summary": card.summary
                }
            ),
            *_custom_field_changes(
                {},
                _field_value_map(card.custom_fields)
            ),
            *_schema_field_changes(
                field_sync.new_keys,
                field_sync.affected_cards
            ),
            *_relation_changes(
                [],
                relation_values
            )
        ]
        record_operation(
            session=session,
            action="create",
            entity_type=card.card_type,
            entity_id=card.id,
            summary=(
                f"新建{entity_type.name}「{card.name}」"
                if entity_type
                else f"新建对象「{card.name}」"
            ),
            details={
                "changes": changes,
                "new_category_fields": field_sync.new_keys,
                "affected_cards": field_sync.affected_cards,
                "relation_count": len(payload.relations)
            }
        )
        session.commit()
        session.expire_all()
    except Exception:
        session.rollback()
        raise

    return card_to_response(
        get_card_or_404(
            session=session,
            card_id=card_id
        )
    )


def update_card(
    session: Session,
    card_id: UUID,
    payload: CardUpdate
) -> CardOut:
    """
    @brief Update a card and optionally replace its outgoing relationships

    @return Updated card response
    """

    card = get_card_or_404(
        session=session,
        card_id=card_id
    )

    card_id = card.id
    before_basic = {
        "name": card.name,
        "icon": card.icon,
        "summary": card.summary
    }
    before_fields = _field_value_map(card.custom_fields)
    before_relations = _relation_values(
        session=session,
        card_id=card.id
    )
    try:
        removed_field_keys = {
            key.strip()
            for key in (payload.removed_field_keys or [])
            if key.strip()
        }
        removed_relation_pairs = [
            (
                relation.forward_label,
                relation.inverse_label
            )
            for relation in (payload.removed_custom_relations or [])
        ]
        field_removal = remove_category_fields(
            session=session,
            card_type=card.card_type,
            field_keys=list(removed_field_keys)
        )
        relation_removal = remove_custom_relation_definitions(
            session=session,
            card_type=card.card_type,
            relation_pairs=removed_relation_pairs
        )
        session.expire(card, ["outgoing_relations"])

        if payload.name is not None:
            card.name = payload.name.strip()
            if not card.name:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="对象名称不能为空"
                )

        if payload.icon is not None:
            _validate_type_and_icon(
                card_type=card.card_type,
                icon=payload.icon.strip()
            )
            card.icon = payload.icon.strip()

        if payload.summary is not None:
            card.summary = payload.summary.strip()

        if payload.custom_fields is not None:
            card.custom_fields = [
                field
                for field in _normalize_custom_fields(payload.custom_fields)
                if field["key"] not in removed_field_keys
            ]

        field_sync = sync_card_fields(
            session=session,
            card_type=card.card_type,
            current_card_id=card.id,
            incoming_fields=card.custom_fields
        )
        card.custom_fields = field_sync.fields

        if payload.relations is not None:
            for relation in list(card.outgoing_relations):
                session.delete(relation)
            session.flush()
            _create_relations(
                session=session,
                source_card=card,
                relation_inputs=payload.relations
            )

        sync_custom_relation_definitions(
            session=session,
            card_type=card.card_type
        )
        entity_type = get_entity_type(card.card_type)
        after_relations = _relation_values(
            session=session,
            card_id=card.id
        )
        changes = [
            *_basic_changes(
                before_basic,
                {
                    "name": card.name,
                    "icon": card.icon,
                    "summary": card.summary
                }
            ),
            *_custom_field_changes(
                before_fields,
                _field_value_map(card.custom_fields)
            ),
            *_schema_field_changes(
                field_sync.new_keys,
                field_sync.affected_cards
            ),
            *_relation_changes(
                before_relations,
                after_relations
            )
        ]
        for key in removed_field_keys:
            changes.append(
                {
                    "field": f"类别字段「{key}」",
                    "before": "已定义",
                    "after": (
                        f"已删除，更新 {field_removal.affected_cards} 张同类卡片"
                    )
                }
            )
        for forward_label, inverse_label in removed_relation_pairs:
            changes.append(
                {
                    "field": f"类别因缘「{forward_label}」",
                    "before": f"{forward_label} / {inverse_label}",
                    "after": (
                        f"已删除，清理 {relation_removal.removed_relations} 条关联"
                    )
                }
            )
        record_operation(
            session=session,
            action="update",
            entity_type=card.card_type,
            entity_id=card.id,
            summary=(
                f"更新{entity_type.name}「{card.name}」"
                if entity_type
                else f"更新对象「{card.name}」"
            ),
            details={
                "changes": changes,
                "new_category_fields": field_sync.new_keys,
                "affected_cards": field_sync.affected_cards,
                "removed_category_fields": sorted(removed_field_keys),
                "removed_custom_relations": [
                    {
                        "forward_label": forward_label,
                        "inverse_label": inverse_label
                    }
                    for forward_label, inverse_label in removed_relation_pairs
                ]
            }
        )
        session.commit()
        session.expire_all()
    except Exception:
        session.rollback()
        raise

    return card_to_response(
        get_card_or_404(
            session=session,
            card_id=card_id
        )
    )


def delete_card(
    session: Session,
    card_id: UUID
) -> None:
    """
    @brief Delete a card and cascade its relationships

    @return None
    """

    card_row = session.execute(
        select(Card.card_type, Card.name).where(Card.id == card_id)
    ).first()
    if card_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="对象卡片不存在"
        )

    card_type, card_name = card_row
    entity_type = get_entity_type(card_type)
    card = session.get(Card, card_id)
    before_basic = {
        "name": card_name,
        "icon": card.icon if card else "",
        "summary": card.summary if card else ""
    }
    before_fields = (
        _field_value_map(card.custom_fields)
        if card
        else {}
    )
    before_relations = _relation_values(
        session=session,
        card_id=card_id
    )
    try:
        session.execute(
            delete(CardRelation).where(
                or_(
                    CardRelation.source_card_id == card_id,
                    CardRelation.target_card_id == card_id
                )
            )
        )
        session.execute(
            delete(Card).where(Card.id == card_id)
        )
        record_operation(
            session=session,
            action="delete",
            entity_type=card_type,
            entity_id=card_id,
            summary=(
                f"删除{entity_type.name}「{card_name}」"
                if entity_type
                else f"删除对象「{card_name}」"
            ),
            details={
                "changes": [
                    *_basic_changes(
                        before_basic,
                        {}
                    ),
                    *_custom_field_changes(
                        before_fields,
                        {}
                    ),
                    *_relation_changes(
                        before_relations,
                        []
                    )
                ]
            }
        )
        session.commit()
    except Exception:
        session.rollback()
        raise
