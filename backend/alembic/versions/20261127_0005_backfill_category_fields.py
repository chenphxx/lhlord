"""Backfill shared custom fields on existing cards.

Revision ID: 20261127_0005
Revises: 20261127_0004
Create Date: 2026-11-27
"""

from typing import Sequence, Union

from alembic import op


revision: str = "20261127_0005"
down_revision: Union[str, None] = "20261127_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    @brief Add empty category fields to cards created before field schemas

    @return None
    """

    op.execute(
        """
        WITH normalized AS (
            SELECT
                cards.id,
                jsonb_agg(
                    jsonb_build_object(
                        'key',
                        definitions.field_key,
                        'value',
                        COALESCE(
                            (
                                SELECT existing.value ->> 'value'
                                FROM jsonb_array_elements(
                                    cards.custom_fields
                                ) WITH ORDINALITY AS existing(value, ordinality)
                                WHERE existing.value ->> 'key' = definitions.field_key
                                ORDER BY existing.ordinality
                                LIMIT 1
                            ),
                            ''
                        )
                    )
                    ORDER BY definitions.position
                ) AS custom_fields
            FROM cards
            JOIN custom_field_definitions AS definitions
                ON definitions.card_type = cards.card_type
            GROUP BY cards.id, cards.custom_fields
        )
        UPDATE cards
        SET custom_fields = normalized.custom_fields
        FROM normalized
        WHERE
            cards.id = normalized.id
            AND cards.custom_fields IS DISTINCT FROM normalized.custom_fields
        """
    )


def downgrade() -> None:
    """
    @brief Preserve normalized card values during rollback

    @return None
    """

    pass
