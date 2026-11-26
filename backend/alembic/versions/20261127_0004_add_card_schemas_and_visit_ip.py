"""Add category schemas and visitor IP addresses.

Revision ID: 20261127_0004
Revises: 20261127_0003
Create Date: 2026-11-27
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261127_0004"
down_revision: Union[str, None] = "20261127_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    @brief Add category schemas and anonymous visitor IP storage

    @return None
    """

    op.add_column(
        "visit_events",
        sa.Column(
            "ip_address",
            sa.String(length=45),
            nullable=True
        )
    )

    op.create_table(
        "custom_field_definitions",
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
            "field_key",
            sa.String(length=30),
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
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "card_type",
            "field_key",
            name="uq_custom_field_definitions_type_key"
        )
    )
    op.create_index(
        "ix_custom_field_definitions_type_position",
        "custom_field_definitions",
        [
            "card_type",
            "position"
        ],
        unique=False
    )

    op.create_table(
        "custom_relation_definitions",
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
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "card_type",
            "forward_label",
            "inverse_label",
            name="uq_custom_relation_definitions_type_labels"
        )
    )
    op.create_index(
        "ix_custom_relation_definitions_type_position",
        "custom_relation_definitions",
        [
            "card_type",
            "position"
        ],
        unique=False
    )

    op.execute(
        """
        INSERT INTO custom_field_definitions
            (id, card_type, field_key, position, created_at)
        SELECT
            gen_random_uuid(),
            grouped.card_type,
            grouped.field_key,
            ROW_NUMBER() OVER (
                PARTITION BY grouped.card_type
                ORDER BY grouped.first_seen, grouped.first_position
            ) - 1,
            now()
        FROM (
            SELECT
                cards.card_type,
                custom_field.value ->> 'key' AS field_key,
                MIN(cards.created_at) AS first_seen,
                MIN(custom_field.ordinality) AS first_position
            FROM cards
            CROSS JOIN LATERAL jsonb_array_elements(
                cards.custom_fields
            ) WITH ORDINALITY AS custom_field(value, ordinality)
            WHERE
                jsonb_typeof(cards.custom_fields) = 'array'
                AND NULLIF(BTRIM(custom_field.value ->> 'key'), '') IS NOT NULL
            GROUP BY
                cards.card_type,
                custom_field.value ->> 'key'
        ) AS grouped
        """
    )
    op.execute(
        """
        INSERT INTO custom_relation_definitions
            (
                id,
                card_type,
                forward_label,
                inverse_label,
                position,
                created_at
            )
        SELECT
            gen_random_uuid(),
            grouped.card_type,
            grouped.forward_label,
            grouped.inverse_label,
            ROW_NUMBER() OVER (
                PARTITION BY grouped.card_type
                ORDER BY grouped.first_seen
            ) - 1,
            now()
        FROM (
            SELECT
                cards.card_type,
                relations.forward_label,
                relations.inverse_label,
                MIN(relations.created_at) AS first_seen
            FROM card_relations AS relations
            JOIN cards ON cards.id = relations.source_card_id
            WHERE relations.preset_key IS NULL
            GROUP BY
                cards.card_type,
                relations.forward_label,
                relations.inverse_label
        ) AS grouped
        """
    )


def downgrade() -> None:
    """
    @brief Remove category schemas and visitor IP storage

    @return None
    """

    op.drop_index(
        "ix_custom_relation_definitions_type_position",
        table_name="custom_relation_definitions"
    )
    op.drop_table("custom_relation_definitions")
    op.drop_index(
        "ix_custom_field_definitions_type_position",
        table_name="custom_field_definitions"
    )
    op.drop_table("custom_field_definitions")
    op.drop_column(
        "visit_events",
        "ip_address"
    )
