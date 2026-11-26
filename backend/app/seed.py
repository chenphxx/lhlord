"""Create the initial linked demonstration cards."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Card, CardRelation


def seed_database(session: Session) -> bool:
    """
    @brief Populate demonstration data only when the catalog is empty

    @param session Database session

    @return True when new seed data was created
    """

    card_count = session.scalar(
        select(func.count(Card.id))
    )
    if card_count:
        return False

    race = Card(
        card_type="race",
        name="人族",
        icon="character/race-human.svg",
        summary="生于凡尘，敏而好学，以百家道法叩问长生",
        custom_fields=[
            {
                "key": "族裔特性",
                "value": "悟性与功法适应力均衡"
            }
        ]
    )
    sect = Card(
        card_type="sect",
        name="青云宗",
        icon="organization/sect.svg",
        summary="云海深处的正道宗门，以剑典与炼丹术闻名",
        custom_fields=[
            {
                "key": "山门",
                "value": "东域青岚峰"
            }
        ]
    )
    character = Card(
        card_type="character",
        name="林昭",
        icon="character/player.svg",
        summary="初入仙途的外门弟子，心性沉静，善察草木灵机",
        custom_fields=[
            {
                "key": "境界",
                "value": "炼气后期"
            },
            {
                "key": "灵根",
                "value": "木火双灵根"
            }
        ]
    )

    session.add_all(
        [
            race,
            sect,
            character
        ]
    )
    session.flush()

    session.add_all(
        [
            CardRelation(
                source_card_id=character.id,
                target_card_id=race.id,
                preset_key="character_race",
                forward_label="所属种族",
                inverse_label="该族角色",
                position=0
            ),
            CardRelation(
                source_card_id=character.id,
                target_card_id=sect.id,
                preset_key="character_sect",
                forward_label="加入宗门",
                inverse_label="宗门成员",
                position=1
            )
        ]
    )
    session.commit()
    return True


def main() -> None:
    """
    @brief Run the idempotent seed command

    @return None
    """

    with SessionLocal() as session:
        created = seed_database(session)
    if created:
        print("Seed data created.")
    else:
        print("Seed data already exists; no changes made.")


if __name__ == "__main__":
    main()
