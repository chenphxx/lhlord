"""Expand card types with the remaining icon objects.

Revision ID: 20261126_0002
Revises: 20261126_0001
Create Date: 2026-11-26
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20261126_0002"
down_revision: Union[str, None] = "20261126_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ALLOWED_TYPES = (
    "'body'",
    "'breakthrough'",
    "'cave'",
    "'character'",
    "'combat'",
    "'cultivation'",
    "'dao'",
    "'dynasty'",
    "'earth'",
    "'escape'",
    "'family'",
    "'fire'",
    "'formation'",
    "'item'",
    "'map'",
    "'market'",
    "'metal'",
    "'qi'",
    "'quest'",
    "'race'",
    "'reputation'",
    "'secret_realm'",
    "'sect'",
    "'spell'",
    "'spirit'",
    "'spirit_beast'",
    "'spirit_field'",
    "'sword'",
    "'technique'",
    "'tribulation'",
    "'water'",
    "'wood'"
)


def upgrade() -> None:
    """
    @brief Replace the card-type check constraint with the expanded catalog

    @return None
    """

    op.drop_constraint(
        "ck_cards_card_type",
        "cards",
        type_="check"
    )
    op.create_check_constraint(
        "ck_cards_card_type",
        "cards",
        f"card_type IN ({', '.join(ALLOWED_TYPES)})"
    )


def downgrade() -> None:
    """
    @brief Restore the original twelve card types

    @return None
    """

    core_types = (
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
    op.drop_constraint(
        "ck_cards_card_type",
        "cards",
        type_="check"
    )
    op.create_check_constraint(
        "ck_cards_card_type",
        "cards",
        f"card_type IN ({', '.join(core_types)})"
    )
