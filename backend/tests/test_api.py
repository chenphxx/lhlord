"""API behavior tests for card CRUD and relationships."""

from io import BytesIO
import json
import zipfile

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Card, CardRelation
from app.seed import seed_database


def create_card(
    client: TestClient,
    card_type: str,
    name: str,
    icon: str,
    custom_fields: list[dict[str, str]] | None = None,
    relations: list[dict[str, object]] | None = None
) -> dict[str, object]:
    """
    @brief Create a card through the public API

    @return Created card JSON
    """

    response = client.post(
        "/api/cards",
        json={
            "card_type": card_type,
            "name": name,
            "icon": icon,
            "summary": f"{name}的简介",
            "custom_fields": custom_fields or [],
            "relations": relations or []
        }
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_catalog_has_fixed_types_and_icon_pools(
    client: TestClient
) -> None:
    """
    @brief Verify the public metadata contract
    """

    response = client.get("/api/catalog")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["types"]) == 32
    assert len(payload["relation_presets"]) == 17

    type_by_id = {
        entity_type["id"]: entity_type
        for entity_type in payload["types"]
    }
    assert len(type_by_id["race"]["icons"]) == 6
    assert len(type_by_id["item"]["icons"]) == 14
    assert type_by_id["character"]["default_icon"] == "character/player.svg"
    assert type_by_id["cultivation"]["name"] == "修炼"
    assert type_by_id["metal"]["default_icon"] == "element/metal.svg"
    assert type_by_id["spirit_field"]["name"] == "灵田"


def test_create_nested_cards_and_expose_reverse_relationships(
    client: TestClient
) -> None:
    """
    @brief Verify atomic nested creation and reverse relationship views
    """

    sect = create_card(
        client,
        "sect",
        "青云宗",
        "organization/sect.svg"
    )
    character = create_card(
        client,
        "character",
        "林昭",
        "character/player.svg",
        custom_fields=[
            {
                "key": "境界",
                "value": "炼气后期"
            },
            {
                "key": "灵根",
                "value": "木火双灵根"
            }
        ],
        relations=[
            {
                "preset_key": "character_race",
                "new_target": {
                    "card_type": "race",
                    "name": "人族",
                    "icon": "character/race-human.svg",
                    "summary": "生于凡尘",
                    "custom_fields": []
                }
            },
            {
                "preset_key": "character_sect",
                "target_card_id": sect["id"],
                "target_type": "sect"
            }
        ]
    )

    assert [
        field["key"]
        for field in character["custom_fields"]
    ] == [
        "境界",
        "灵根"
    ]

    sect_response = client.get(
        "/api/cards",
        params={"type": "sect"}
    )
    sect_card = sect_response.json()["items"][0]
    assert sect_card["relations"][0]["label"] == "宗门成员"
    assert sect_card["relations"][0]["related_card"]["name"] == "林昭"

    race_response = client.get(
        "/api/cards",
        params={"type": "race"}
    )
    race_card = race_response.json()["items"][0]
    assert race_card["name"] == "人族"
    assert race_card["relations"][0]["label"] == "该族角色"


def test_rejects_invalid_icons_and_rolls_back_nested_cards(
    client: TestClient
) -> None:
    """
    @brief Verify validation runs in the same transaction as nested creation
    """

    response = client.post(
        "/api/cards",
        json={
            "card_type": "character",
            "name": "无效修士",
            "icon": "character/player.svg",
            "summary": "",
            "custom_fields": [],
            "relations": [
                {
                    "preset_key": "character_race",
                    "new_target": {
                        "card_type": "race",
                        "name": "错族",
                        "icon": "item/pill.svg",
                        "summary": "",
                        "custom_fields": []
                    }
                }
            ]
        }
    )

    assert response.status_code == 422
    character_response = client.get(
        "/api/cards",
        params={"type": "character"}
    )
    race_response = client.get(
        "/api/cards",
        params={"type": "race"}
    )
    assert character_response.json()["items"] == []
    assert race_response.json()["items"] == []


def test_rejects_single_relationship_conflicts_and_duplicates(
    client: TestClient
) -> None:
    """
    @brief Verify cardinality, target type, and duplicate checks
    """

    first_sect = create_card(
        client,
        "sect",
        "青云宗",
        "organization/sect.svg"
    )
    second_sect = create_card(
        client,
        "sect",
        "玄月宗",
        "organization/sect.svg"
    )
    character = create_card(
        client,
        "character",
        "林昭",
        "character/player.svg"
    )

    duplicate_response = client.patch(
        f"/api/cards/{character['id']}",
        json={
            "relations": [
                {
                    "preset_key": "character_sect",
                    "target_card_id": first_sect["id"]
                },
                {
                    "preset_key": "character_sect",
                    "target_card_id": first_sect["id"]
                }
            ]
        }
    )
    assert duplicate_response.status_code == 422

    conflict_response = client.patch(
        f"/api/cards/{character['id']}",
        json={
            "relations": [
                {
                    "preset_key": "character_sect",
                    "target_card_id": first_sect["id"]
                },
                {
                    "preset_key": "character_sect",
                    "target_card_id": second_sect["id"]
                }
            ]
        }
    )
    assert conflict_response.status_code == 422
    assert "只能关联一个对象" in conflict_response.json()["detail"]

    wrong_type_response = client.patch(
        f"/api/cards/{character['id']}",
        json={
            "relations": [
                {
                    "preset_key": "character_sect",
                    "target_card_id": character["id"]
                }
            ]
        }
    )
    assert wrong_type_response.status_code == 422


def test_update_and_delete_cascade_relationships(
    client: TestClient
) -> None:
    """
    @brief Verify update replacement and target deletion cleanup
    """

    race = create_card(
        client,
        "race",
        "人族",
        "character/race-human.svg"
    )
    character = create_card(
        client,
        "character",
        "林昭",
        "character/player.svg",
        relations=[
            {
                "preset_key": "character_race",
                "target_card_id": race["id"]
            }
        ]
    )

    update_response = client.patch(
        f"/api/cards/{character['id']}",
        json={
            "name": "林昭之",
            "relations": []
        }
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "林昭之"
    assert update_response.json()["relations"] == []

    second_update = client.patch(
        f"/api/cards/{character['id']}",
        json={
            "relations": [
                {
                    "preset_key": "character_race",
                    "target_card_id": race["id"]
                }
            ]
        }
    )
    assert second_update.status_code == 200

    delete_response = client.delete(f"/api/cards/{race['id']}")
    assert delete_response.status_code == 204

    character_response = client.get(
        f"/api/cards/{character['id']}"
    )
    assert character_response.status_code == 200
    assert character_response.json()["relations"] == []


def test_custom_relationship_exposes_inverse_label(
    client: TestClient
) -> None:
    """
    @brief Verify custom relationships can target another type and render backward
    """

    item = create_card(
        client,
        "item",
        "青锋剑",
        "item/weapon.svg"
    )
    character = create_card(
        client,
        "character",
        "林昭",
        "character/player.svg"
    )

    response = client.patch(
        f"/api/cards/{character['id']}",
        json={
            "relations": [
                {
                    "target_card_id": item["id"],
                    "target_type": "item",
                    "label": "本命法器",
                    "inverse_label": "祭炼者"
                }
            ]
        }
    )
    assert response.status_code == 200
    assert response.json()["relations"][0]["label"] == "本命法器"

    item_response = client.get(
        f"/api/cards/{item['id']}"
    )
    assert item_response.status_code == 200
    relation = item_response.json()["relations"][0]
    assert relation["direction"] == "incoming"
    assert relation["label"] == "祭炼者"
    assert relation["related_card"]["name"] == "林昭"


def test_seed_is_idempotent(
    database: Session
) -> None:
    """
    @brief Verify seed data only appears once
    """

    assert seed_database(database) is True
    assert seed_database(database) is False

    card_count = database.scalar(
        select(func.count(Card.id))
    )
    relation_count = database.scalar(
        select(func.count(CardRelation.id))
    )
    assert card_count == 3
    assert relation_count == 2


def test_export_and_import_archive_round_trip(
    client: TestClient
) -> None:
    """
    @brief Verify all cards, relationships and navigation settings survive a ZIP round trip
    """

    race = create_card(
        client,
        "race",
        "人族",
        "character/race-human.svg"
    )
    sect = create_card(
        client,
        "sect",
        "青云宗",
        "organization/sect.svg"
    )
    character = create_card(
        client,
        "character",
        "林昭",
        "character/player.svg",
        relations=[
            {
                "preset_key": "character_race",
                "target_card_id": race["id"]
            },
            {
                "preset_key": "character_sect",
                "target_card_id": sect["id"]
            }
        ]
    )
    nav_layout = {
        "primary": [
            "sect",
            "race",
            "character"
        ],
        "other": [
            "cave"
        ]
    }

    export_response = client.post(
        "/api/export",
        json={"nav_layout": nav_layout}
    )
    assert export_response.status_code == 200
    assert export_response.headers["content-type"] == "application/zip"
    assert "attachment" in export_response.headers["content-disposition"]

    with zipfile.ZipFile(BytesIO(export_response.content)) as archive:
        assert set(archive.namelist()) == {
            "manifest.json",
            "cards.json",
            "ui-settings.json"
        }
        cards_document = json.loads(archive.read("cards.json"))
        assert len(cards_document["cards"]) == 3

    create_card(
        client,
        "spell",
        "临时术法",
        "cultivation/spell.svg"
    )

    import_response = client.post(
        "/api/import",
        content=export_response.content,
        headers={"Content-Type": "application/zip"}
    )
    assert import_response.status_code == 200, import_response.text
    assert import_response.json()["imported_cards"] == 3
    assert import_response.json()["imported_relations"] == 2
    assert import_response.json()["nav_layout"] == nav_layout

    spell_response = client.get(
        "/api/cards",
        params={"type": "spell"}
    )
    assert spell_response.json()["items"] == []

    character_response = client.get(
        f"/api/cards/{character['id']}"
    )
    assert character_response.status_code == 200
    assert {
        relation["related_card"]["name"]
        for relation in character_response.json()["relations"]
    } == {
        "人族",
        "青云宗"
    }


def test_invalid_archive_does_not_change_existing_data(
    client: TestClient
) -> None:
    """
    @brief Verify malformed imports are rejected before deleting current cards
    """

    create_card(
        client,
        "sect",
        "青云宗",
        "organization/sect.svg"
    )

    response = client.post(
        "/api/import",
        content=b"not-a-zip",
        headers={"Content-Type": "application/zip"}
    )

    assert response.status_code == 422
    sect_response = client.get(
        "/api/cards",
        params={"type": "sect"}
    )
    assert len(sect_response.json()["items"]) == 1
