"""Pydantic request and response schemas."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class CustomField(BaseModel):
    """An ordered, user-defined text field."""

    key: str = Field(min_length=1, max_length=30)
    value: str = Field(default="", max_length=500)

    @field_validator("key", "value")
    @classmethod
    def strip_text(cls, value: str) -> str:
        """
        @brief Trim whitespace around custom field text

        @param value Raw field text

        @return Trimmed text
        """

        return value.strip()


class LinkedCardInput(BaseModel):
    """A new related card submitted atomically with its parent card."""

    card_type: str
    name: str = Field(min_length=1, max_length=80)
    icon: str = Field(min_length=1, max_length=128)
    summary: str = Field(default="", max_length=1000)
    custom_fields: list[CustomField] = Field(default_factory=list)

    @field_validator("card_type", "name", "icon", "summary")
    @classmethod
    def strip_linked_text(cls, value: str) -> str:
        """
        @brief Trim text fields on a linked card draft

        @param value Raw text

        @return Trimmed text
        """

        return value.strip()


class RelationInput(BaseModel):
    """Create a preset or custom relationship from a source card."""

    preset_key: str | None = None
    target_card_id: UUID | None = None
    new_target: LinkedCardInput | None = None
    target_type: str | None = None
    label: str | None = Field(default=None, max_length=32)
    inverse_label: str | None = Field(default=None, max_length=32)

    @field_validator("preset_key", "target_type", "label", "inverse_label")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        """
        @brief Trim optional relation text

        @param value Raw text

        @return Trimmed text or None
        """

        if value is None:
            return None
        return value.strip()

    @model_validator(mode="after")
    def validate_relation_input(self) -> "RelationInput":
        """
        @brief Validate target source and preset/custom shape

        @return Validated relation input
        """

        if (self.target_card_id is None) == (self.new_target is None):
            raise ValueError("关联对象必须且只能选择已有对象或填写新对象")

        if self.preset_key:
            return self

        if self.target_type is None:
            raise ValueError("自定义关系必须指定目标类型")
        if not self.label or not self.inverse_label:
            raise ValueError("自定义关系必须填写正向和反向名称")

        return self


class CardCreate(BaseModel):
    """Card creation payload."""

    card_type: str
    name: str = Field(min_length=1, max_length=80)
    icon: str = Field(min_length=1, max_length=128)
    summary: str = Field(default="", max_length=1000)
    custom_fields: list[CustomField] = Field(default_factory=list)
    relations: list[RelationInput] = Field(default_factory=list)

    @field_validator("card_type", "name", "icon", "summary")
    @classmethod
    def strip_card_text(cls, value: str) -> str:
        """
        @brief Trim core card text

        @param value Raw card text

        @return Trimmed text
        """

        return value.strip()


class CardUpdate(BaseModel):
    """Partial card update payload."""

    name: str | None = Field(default=None, min_length=1, max_length=80)
    icon: str | None = Field(default=None, min_length=1, max_length=128)
    summary: str | None = Field(default=None, max_length=1000)
    custom_fields: list[CustomField] | None = None
    relations: list[RelationInput] | None = None
    removed_field_keys: list[str] | None = None
    removed_custom_relations: list["CustomRelationRef"] | None = None

    @field_validator("name", "icon", "summary")
    @classmethod
    def strip_update_text(cls, value: str | None) -> str | None:
        """
        @brief Trim optional card text

        @param value Raw card text

        @return Trimmed text or None
        """

        if value is None:
            return None
        return value.strip()


class CustomRelationRef(BaseModel):
    """Identity of a category custom relationship definition."""

    forward_label: str = Field(min_length=1, max_length=32)
    inverse_label: str = Field(min_length=1, max_length=32)

    @field_validator("forward_label", "inverse_label")
    @classmethod
    def strip_relation_labels(cls, value: str) -> str:
        """
        @brief Trim custom relationship definition labels

        @return Trimmed label
        """

        return value.strip()


CardUpdate.model_rebuild()


class RelatedCard(BaseModel):
    """Compact card representation embedded in a relationship."""

    id: UUID
    card_type: str
    name: str
    icon: str


class CardRelationOut(BaseModel):
    """A relationship rendered from the current card's perspective."""

    id: UUID
    preset_key: str | None
    label: str
    inverse_label: str
    direction: Literal["outgoing", "incoming"]
    cardinality: Literal["one", "many"]
    related_card: RelatedCard


class CardOut(BaseModel):
    """Full card response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    card_type: str
    name: str
    icon: str
    summary: str
    custom_fields: list[CustomField]
    relations: list[CardRelationOut]
    created_at: datetime
    updated_at: datetime


class CardsResponse(BaseModel):
    """Card list response."""

    items: list[CardOut]


class CustomFieldDefinitionOut(BaseModel):
    """One category-wide custom field schema entry."""

    key: str
    position: int


class CustomRelationDefinitionOut(BaseModel):
    """One category-wide custom relationship schema entry."""

    forward_label: str
    inverse_label: str
    position: int


class CardTypeSchemaOut(BaseModel):
    """Shared custom fields and custom relation slots for a card type."""

    card_type: str
    custom_fields: list[CustomFieldDefinitionOut]
    custom_relations: list[CustomRelationDefinitionOut]
