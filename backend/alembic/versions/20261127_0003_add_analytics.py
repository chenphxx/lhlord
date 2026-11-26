"""Add visit events and operation logs.

Revision ID: 20261127_0003
Revises: 20261126_0002
Create Date: 2026-11-27
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy.dialects import postgresql
import sqlalchemy as sa


revision: str = "20261127_0003"
down_revision: Union[str, None] = "20261126_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    @brief Create anonymous visit and operation-log tables

    @return None
    """

    op.create_table(
        "visit_events",
        sa.Column(
            "id",
            sa.Uuid(),
            nullable=False
        ),
        sa.Column(
            "visitor_id",
            sa.String(length=64),
            nullable=False
        ),
        sa.Column(
            "card_type",
            sa.String(length=32),
            nullable=False
        ),
        sa.Column(
            "visited_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False
        ),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index(
        "ix_visit_events_visited_at",
        "visit_events",
        ["visited_at"],
        unique=False
    )
    op.create_index(
        "ix_visit_events_visitor",
        "visit_events",
        ["visitor_id"],
        unique=False
    )
    op.create_index(
        "ix_visit_events_type",
        "visit_events",
        ["card_type"],
        unique=False
    )

    op.create_table(
        "operation_logs",
        sa.Column(
            "id",
            sa.Uuid(),
            nullable=False
        ),
        sa.Column(
            "action",
            sa.String(length=32),
            nullable=False
        ),
        sa.Column(
            "entity_type",
            sa.String(length=32),
            nullable=True
        ),
        sa.Column(
            "entity_id",
            sa.Uuid(),
            nullable=True
        ),
        sa.Column(
            "summary",
            sa.Text(),
            nullable=False
        ),
        sa.Column(
            "details",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False
        ),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index(
        "ix_operation_logs_created_at",
        "operation_logs",
        ["created_at"],
        unique=False
    )
    op.create_index(
        "ix_operation_logs_action",
        "operation_logs",
        ["action"],
        unique=False
    )


def downgrade() -> None:
    """
    @brief Remove analytics tables

    @return None
    """

    op.drop_index(
        "ix_operation_logs_action",
        table_name="operation_logs"
    )
    op.drop_index(
        "ix_operation_logs_created_at",
        table_name="operation_logs"
    )
    op.drop_table("operation_logs")
    op.drop_index(
        "ix_visit_events_type",
        table_name="visit_events"
    )
    op.drop_index(
        "ix_visit_events_visitor",
        table_name="visit_events"
    )
    op.drop_index(
        "ix_visit_events_visited_at",
        table_name="visit_events"
    )
    op.drop_table("visit_events")
