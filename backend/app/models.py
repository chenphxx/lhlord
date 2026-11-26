"""SQLAlchemy models for cards and their directed relationships."""

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.catalog import ENTITY_TYPE_IDS
from app.database import Base


type_check = ", ".join(
    f"'{type_id}'"
    for type_id in sorted(ENTITY_TYPE_IDS)
)


class Card(Base):
    """A catalog card representing one game-world object."""

    __tablename__ = "cards"
    __table_args__ = (
        CheckConstraint(
            f"card_type IN ({type_check})",
            name="ck_cards_card_type"
        ),
        Index("ix_cards_card_type_created_at", "card_type", "created_at")
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    card_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False
    )
    name: Mapped[str] = mapped_column(
        String(80),
        nullable=False
    )
    icon: Mapped[str] = mapped_column(
        String(128),
        nullable=False
    )
    summary: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default=""
    )
    custom_fields: Mapped[list[dict[str, str]]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=False,
        default=list
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    outgoing_relations: Mapped[list["CardRelation"]] = relationship(
        "CardRelation",
        foreign_keys="CardRelation.source_card_id",
        back_populates="source_card",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
        order_by="CardRelation.position"
    )
    incoming_relations: Mapped[list["CardRelation"]] = relationship(
        "CardRelation",
        foreign_keys="CardRelation.target_card_id",
        back_populates="target_card",
        passive_deletes=True,
        lazy="selectin"
    )


class CardRelation(Base):
    """A directed relationship between two cards."""

    __tablename__ = "card_relations"
    __table_args__ = (
        CheckConstraint(
            "source_card_id <> target_card_id",
            name="ck_card_relations_not_self"
        ),
        Index("ix_card_relations_source", "source_card_id"),
        Index("ix_card_relations_target", "target_card_id")
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    source_card_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "cards.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )
    target_card_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey(
            "cards.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )
    preset_key: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True
    )
    forward_label: Mapped[str] = mapped_column(
        String(32),
        nullable=False
    )
    inverse_label: Mapped[str] = mapped_column(
        String(32),
        nullable=False
    )
    position: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now()
    )

    source_card: Mapped[Card] = relationship(
        "Card",
        foreign_keys=[source_card_id],
        back_populates="outgoing_relations"
    )
    target_card: Mapped[Card] = relationship(
        "Card",
        foreign_keys=[target_card_id],
        back_populates="incoming_relations"
    )


class VisitEvent(Base):
    """An anonymous page view made by a browser visitor."""

    __tablename__ = "visit_events"
    __table_args__ = (
        Index("ix_visit_events_visited_at", "visited_at"),
        Index("ix_visit_events_visitor", "visitor_id"),
        Index("ix_visit_events_type", "card_type")
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    visitor_id: Mapped[str] = mapped_column(
        String(64),
        nullable=False
    )
    card_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False
    )
    visited_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now()
    )


class OperationLog(Base):
    """A record of a user-visible mutation or data-transfer action."""

    __tablename__ = "operation_logs"
    __table_args__ = (
        Index("ix_operation_logs_created_at", "created_at"),
        Index("ix_operation_logs_action", "action")
    )

    id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid4
    )
    action: Mapped[str] = mapped_column(
        String(32),
        nullable=False
    )
    entity_type: Mapped[str | None] = mapped_column(
        String(32),
        nullable=True
    )
    entity_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        nullable=True
    )
    summary: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )
    details: Mapped[dict[str, object]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=False,
        default=dict
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now()
    )
