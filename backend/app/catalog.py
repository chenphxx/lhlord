"""Static catalog and relationship definitions for card entities."""

from dataclasses import dataclass


RACE_ICONS = (
    "character/race-human.svg",
    "character/race-demon.svg",
    "character/race-beast.svg",
    "character/race-spirit.svg",
    "character/race-dragon.svg",
    "character/race-ghost.svg"
)

ITEM_ICONS = (
    "item/herb.svg",
    "item/material.svg",
    "item/weapon.svg",
    "item/armor.svg",
    "item/accessory.svg",
    "item/robe.svg",
    "item/spirit-boat.svg",
    "item/pill.svg",
    "item/recipe.svg",
    "item/talisman.svg",
    "item/alchemy-furnace.svg",
    "item/spirit-stone.svg",
    "item/artifact.svg",
    "item/storage-bag.svg"
)


@dataclass(frozen=True)
class EntityType:
    """
    @brief Definition of one fixed card type
    """

    id: str
    name: str
    group: str
    group_name: str
    default_icon: str
    icons: tuple[str, ...]

    def as_dict(self) -> dict[str, object]:
        """
        @brief Convert type metadata to an API-friendly mapping

        @return Serialized type metadata
        """

        return {
            "id": self.id,
            "name": self.name,
            "group": self.group,
            "group_name": self.group_name,
            "default_icon": self.default_icon,
            "icons": list(self.icons)
        }


@dataclass(frozen=True)
class RelationPreset:
    """
    @brief Definition of a directed relationship available on a card type
    """

    key: str
    source_type: str
    target_type: str
    label: str
    inverse_label: str
    cardinality: str

    def as_dict(self) -> dict[str, str]:
        """
        @brief Convert relationship metadata to an API-friendly mapping

        @return Serialized relationship metadata
        """

        return {
            "key": self.key,
            "source_type": self.source_type,
            "target_type": self.target_type,
            "label": self.label,
            "inverse_label": self.inverse_label,
            "cardinality": self.cardinality
        }


ENTITY_TYPES = (
    EntityType(
        "sect",
        "宗门",
        "organization",
        "势力",
        "organization/sect.svg",
        ("organization/sect.svg",)
    ),
    EntityType(
        "family",
        "家族",
        "organization",
        "势力",
        "organization/family.svg",
        ("organization/family.svg",)
    ),
    EntityType(
        "dynasty",
        "皇朝",
        "organization",
        "势力",
        "organization/dynasty.svg",
        ("organization/dynasty.svg",)
    ),
    EntityType(
        "race",
        "种族",
        "beings",
        "众生",
        "character/race-human.svg",
        RACE_ICONS
    ),
    EntityType(
        "character",
        "角色",
        "beings",
        "众生",
        "character/player.svg",
        ("character/player.svg",)
    ),
    EntityType(
        "spirit_beast",
        "灵兽",
        "beings",
        "众生",
        "character/spirit-beast.svg",
        ("character/spirit-beast.svg",)
    ),
    EntityType(
        "technique",
        "功法",
        "cultivation",
        "道法",
        "cultivation/technique.svg",
        ("cultivation/technique.svg",)
    ),
    EntityType(
        "spell",
        "术法",
        "cultivation",
        "道法",
        "cultivation/spell.svg",
        ("cultivation/spell.svg",)
    ),
    EntityType(
        "item",
        "物品",
        "objects",
        "器物",
        "item/artifact.svg",
        ITEM_ICONS
    ),
    EntityType(
        "cave",
        "洞府",
        "places",
        "天地",
        "system/cave.svg",
        ("system/cave.svg",)
    ),
    EntityType(
        "secret_realm",
        "秘境",
        "places",
        "天地",
        "system/secret-realm.svg",
        ("system/secret-realm.svg",)
    ),
    EntityType(
        "quest",
        "任务",
        "world",
        "世务",
        "system/quest.svg",
        ("system/quest.svg",)
    )
)

ENTITY_TYPE_MAP = {
    entity_type.id: entity_type
    for entity_type in ENTITY_TYPES
}


RELATION_PRESETS = (
    RelationPreset(
        "character_race",
        "character",
        "race",
        "所属种族",
        "该族角色",
        "one"
    ),
    RelationPreset(
        "character_sect",
        "character",
        "sect",
        "加入宗门",
        "宗门成员",
        "one"
    ),
    RelationPreset(
        "character_family",
        "character",
        "family",
        "出自家族",
        "家族成员",
        "one"
    ),
    RelationPreset(
        "character_dynasty",
        "character",
        "dynasty",
        "隶属皇朝",
        "皇朝成员",
        "one"
    ),
    RelationPreset(
        "character_cave",
        "character",
        "cave",
        "驻留洞府",
        "驻留角色",
        "one"
    ),
    RelationPreset(
        "character_technique",
        "character",
        "technique",
        "修习功法",
        "修习者",
        "many"
    ),
    RelationPreset(
        "character_spell",
        "character",
        "spell",
        "掌握术法",
        "掌握者",
        "many"
    ),
    RelationPreset(
        "character_item",
        "character",
        "item",
        "持有物品",
        "持有者",
        "many"
    ),
    RelationPreset(
        "character_spirit_beast",
        "character",
        "spirit_beast",
        "契约灵兽",
        "契约主人",
        "many"
    ),
    RelationPreset(
        "sect_technique",
        "sect",
        "technique",
        "传承功法",
        "传承宗门",
        "many"
    ),
    RelationPreset(
        "sect_cave",
        "sect",
        "cave",
        "拥有洞府",
        "所属宗门",
        "many"
    ),
    RelationPreset(
        "dynasty_sect",
        "dynasty",
        "sect",
        "统辖宗门",
        "所属皇朝",
        "many"
    ),
    RelationPreset(
        "dynasty_family",
        "dynasty",
        "family",
        "统辖家族",
        "所属皇朝",
        "many"
    ),
    RelationPreset(
        "secret_realm_item",
        "secret_realm",
        "item",
        "产出物品",
        "产出秘境",
        "many"
    ),
    RelationPreset(
        "quest_secret_realm",
        "quest",
        "secret_realm",
        "关联秘境",
        "关联任务",
        "many"
    ),
    RelationPreset(
        "quest_item",
        "quest",
        "item",
        "任务奖励",
        "奖励任务",
        "many"
    ),
    RelationPreset(
        "quest_sect",
        "quest",
        "sect",
        "发布宗门",
        "发布任务",
        "many"
    )
)

RELATION_PRESET_MAP = {
    preset.key: preset
    for preset in RELATION_PRESETS
}

ENTITY_TYPE_IDS = frozenset(ENTITY_TYPE_MAP)


def get_entity_type(type_id: str) -> EntityType | None:
    """
    @brief Resolve a card type by identifier

    @param type_id Card type identifier

    @return Matching metadata or None
    """

    return ENTITY_TYPE_MAP.get(type_id)


def get_relation_preset(preset_key: str) -> RelationPreset | None:
    """
    @brief Resolve a relationship preset by key

    @param preset_key Relationship preset identifier

    @return Matching preset or None
    """

    return RELATION_PRESET_MAP.get(preset_key)


def catalog_payload() -> dict[str, object]:
    """
    @brief Build the public catalog payload

    @return Entity and relationship metadata
    """

    return {
        "version": 1,
        "types": [
            entity_type.as_dict()
            for entity_type in ENTITY_TYPES
        ],
        "relation_presets": [
            preset.as_dict()
            for preset in RELATION_PRESETS
        ]
    }
