"""Create cards and card relations.

Revision ID: 20261126_0001
Revises:
Create Date: 2026-11-26
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy.dialects import postgresql
import sqlalchemy as sa


revision: str = "20261126_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ALLOWED_TYPES = (
    "'cave'",
    "'character'",
    "'dynasty'",
    "'family'",
    "'item'",
    "'quest'",
    "'race'",
    "'secret_realm'",
    "'sect'",
    "'spell'",
    "'spirit_beast'",
    "'technique'"
)


def upgrade() -> None:
    """
    @brief Create the card and relationship tables

    @return None
    """

    op.create_table(
        "cards",
        sa.Column(
            "id",
            sa.Uuid(),
            nullable=False
        ),
        sa.Column(
            "card_type",
            sa.String(length=32),
            nullable=False
        ),
        sa.Column(
            "name",
            sa.String(length=80),
            nullable=False
        ),
        sa.Column(
            "icon",
            sa.String(length=128),
            nullable=False
        ),
        sa.Column(
            "summary",
            sa.Text(),
            nullable=False
        ),
        sa.Column(
            "custom_fields",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False
        ),
        sa.CheckConstraint(
            f"card_type IN ({', '.join(ALLOWED_TYPES)})",
            name="ck_cards_card_type"
        ),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index(
        "ix_cards_card_type_created_at",
        "cards",
        [
            "card_type",
            "created_at"
        ],
        unique=False
    )

    op.create_table(
        "card_relations",
        sa.Column(
            "id",
            sa.Uuid(),
            nullable=False
        ),
        sa.Column(
            "source_card_id",
            sa.Uuid(),
            nullable=False
        ),
        sa.Column(
            "target_card_id",
            sa.Uuid(),
            nullable=False
        ),
        sa.Column(
            "preset_key",
            sa.String(length=64),
            nullable=True
        ),
        sa.Column(
            "forward_label",
            sa.String(length=32),
            nullable=False
        ),
        sa.Column(
            "inverse_label",
            sa.String(length=32),
            nullable=False
        ),
        sa.Column(
            "position",
            sa.Integer(),
            nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False
        ),
        sa.CheckConstraint(
            "source_card_id <> target_card_id",
            name="ck_card_relations_not_self"
        ),
        sa.ForeignKeyConstraint(
            ["source_card_id"],
            ["cards.id"],
            ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["target_card_id"],
            ["cards.id"],
            ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id")
    )
    op.create_index(
        "ix_card_relations_source",
        "card_relations",
        ["source_card_id"],
        unique=False
    )
    op.create_index(
        "ix_card_relations_target",
        "card_relations",
        ["target_card_id"],
        unique=False
    )


def downgrade() -> None:
    """
    @brief Remove card catalog tables

    @return None
    """

    op.drop_index(
        "ix_card_relations_target",
        table_name="card_relations"
    )
    op.drop_index(
        "ix_card_relations_source",
        table_name="card_relations"
    )
    op.drop_table("card_relations")
    op.drop_index(
        "ix_cards_card_type_created_at",
        table_name="cards"
    )
    op.drop_table("cards")
