"""ZIP archive export and import for the complete card catalog."""

from datetime import datetime, timezone
from io import BytesIO
import json
from typing import Literal
from uuid import UUID, uuid4
import zipfile

from fastapi import HTTPException, status
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.catalog import get_entity_type, get_relation_preset
from app.models import Card, CardRelation
from app.schemas import CustomField


ARCHIVE_FORMAT = "lhlord-card-catalog"
ARCHIVE_VERSION = 1
MAX_ARCHIVE_BYTES = 50 * 1024 * 1024
MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024


class NavLayoutPayload(BaseModel):
    """Client navigation layout included in exported archives."""

    primary: list[str] = Field(default_factory=list)
    other: list[str] = Field(default_factory=list)


class ArchiveExportRequest(BaseModel):
    """Optional client state submitted while exporting data."""

    nav_layout: NavLayoutPayload | None = None


class ArchiveManifest(BaseModel):
    """Archive identity and version information."""

    format: Literal["lhlord-card-catalog"]
    version: int
    exported_at: datetime
    app_version: str
    card_count: int = Field(ge=0)
    relation_count: int = Field(ge=0)


class ImportRelation(BaseModel):
    """One relationship stored in an archive."""

    id: UUID
    target_card_id: UUID
    preset_key: str | None = Field(default=None, max_length=64)
    forward_label: str = Field(min_length=1, max_length=32)
    inverse_label: str = Field(min_length=1, max_length=32)
    position: int = Field(ge=0)
    created_at: datetime | None = None


class ImportCard(BaseModel):
    """One card and its outgoing relationships stored in an archive."""

    id: UUID
    card_type: str
    name: str = Field(min_length=1, max_length=80)
    icon: str = Field(min_length=1, max_length=128)
    summary: str = Field(default="", max_length=1000)
    custom_fields: list[CustomField] = Field(default_factory=list, max_length=100)
    created_at: datetime
    updated_at: datetime
    outgoing_relations: list[ImportRelation] = Field(
        default_factory=list,
        max_length=2000
    )


class CardsDocument(BaseModel):
    """Card collection document stored in an archive."""

    cards: list[ImportCard] = Field(max_length=5000)


class UiSettingsDocument(BaseModel):
    """Non-database interface settings stored in an archive."""

    nav_layout: NavLayoutPayload | None = None


class ArchiveImportResult(BaseModel):
    """Summary returned after an archive is imported."""

    imported_cards: int
    imported_relations: int
    nav_layout: NavLayoutPayload | None


class ParsedArchive(BaseModel):
    """Validated archive content used for database replacement."""

    manifest: ArchiveManifest
    cards: list[ImportCard]
    nav_layout: NavLayoutPayload | None


def _utc_now() -> datetime:
    """
    @brief Return a timezone-aware current timestamp

    @return Current UTC datetime
    """

    return datetime.now(timezone.utc)


def _json_bytes(payload: object) -> bytes:
    """
    @brief Serialize archive documents as readable UTF-8 JSON

    @return Encoded JSON bytes
    """

    return json.dumps(
        payload,
        ensure_ascii=False,
        indent=2,
        default=str
    ).encode("utf-8")


def export_archive(
    session: Session,
    nav_layout: NavLayoutPayload | None
) -> tuple[bytes, str]:
    """
    @brief Build a ZIP archive containing all cards, relations and UI settings

    @param session Database session
    @param nav_layout Optional current navigation layout

    @return ZIP bytes and download filename
    """

    cards = session.scalars(
        select(Card)
        .options(
            selectinload(Card.outgoing_relations)
            .joinedload(CardRelation.target_card)
        )
        .order_by(Card.created_at.asc())
    ).unique().all()
    relation_count = sum(
        len(card.outgoing_relations)
        for card in cards
    )
    exported_at = _utc_now()
    manifest = ArchiveManifest(
        format=ARCHIVE_FORMAT,
        version=ARCHIVE_VERSION,
        exported_at=exported_at,
        app_version="0.1.0",
        card_count=len(cards),
        relation_count=relation_count
    )
    cards_document = {
        "cards": [
            {
                "id": str(card.id),
                "card_type": card.card_type,
                "name": card.name,
                "icon": card.icon,
                "summary": card.summary,
                "custom_fields": card.custom_fields,
                "created_at": card.created_at,
                "updated_at": card.updated_at,
                "outgoing_relations": [
                    {
                        "id": str(relation.id),
                        "target_card_id": str(relation.target_card_id),
                        "preset_key": relation.preset_key,
                        "forward_label": relation.forward_label,
                        "inverse_label": relation.inverse_label,
                        "position": relation.position,
                        "created_at": relation.created_at
                    }
                    for relation in card.outgoing_relations
                ]
            }
            for card in cards
        ]
    }

    buffer = BytesIO()
    with zipfile.ZipFile(
        buffer,
        mode="w",
        compression=zipfile.ZIP_DEFLATED,
        compresslevel=9
    ) as archive:
        archive.writestr(
            "manifest.json",
            _json_bytes(manifest.model_dump(mode="json"))
        )
        archive.writestr(
            "cards.json",
            _json_bytes(cards_document)
        )
        if nav_layout is not None:
            archive.writestr(
                "ui-settings.json",
                _json_bytes(
                    UiSettingsDocument(nav_layout=nav_layout).model_dump(
                        mode="json"
                    )
                )
            )

    filename = f"lhlord-data-{exported_at:%Y%m%d-%H%M%S}.zip"
    return buffer.getvalue(), filename


def _read_archive_member(
    archive: zipfile.ZipFile,
    member_name: str
) -> bytes:
    """
    @brief Read one explicitly named archive member

    @return Member bytes
    """

    try:
        return archive.read(member_name)
    except KeyError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"压缩包缺少文件: {member_name}"
        ) from error


def parse_archive(archive_bytes: bytes) -> ParsedArchive:
    """
    @brief Validate an uploaded ZIP archive without extracting it to disk

    @return Parsed archive content
    """

    if not archive_bytes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="导入文件为空"
        )
    if len(archive_bytes) > MAX_ARCHIVE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail="导入压缩包不能超过 50 MB"
        )

    try:
        with zipfile.ZipFile(BytesIO(archive_bytes), mode="r") as archive:
            total_uncompressed = sum(
                entry.file_size
                for entry in archive.infolist()
            )
            if total_uncompressed > MAX_UNCOMPRESSED_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                    detail="压缩包解压后的数据量过大"
                )

            manifest = ArchiveManifest.model_validate_json(
                _read_archive_member(archive, "manifest.json")
            )
            if manifest.version != ARCHIVE_VERSION:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail=f"不支持的压缩包版本: {manifest.version}"
                )

            cards_document = CardsDocument.model_validate_json(
                _read_archive_member(archive, "cards.json")
            )
            nav_layout = None
            if "ui-settings.json" in archive.namelist():
                ui_settings = UiSettingsDocument.model_validate_json(
                    _read_archive_member(archive, "ui-settings.json")
                )
                nav_layout = ui_settings.nav_layout
    except HTTPException:
        raise
    except zipfile.BadZipFile as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="导入文件不是有效的 ZIP 压缩包"
        ) from error
    except (ValidationError, ValueError, UnicodeDecodeError) as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="压缩包内容格式不正确"
        ) from error

    return ParsedArchive(
        manifest=manifest,
        cards=cards_document.cards,
        nav_layout=nav_layout
    )


def _validate_archive_cards(parsed: ParsedArchive) -> None:
    """
    @brief Validate card identifiers, types, icons and relationship targets

    @return None
    """

    card_by_id = {
        card.id: card
        for card in parsed.cards
    }
    if len(card_by_id) != len(parsed.cards):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="压缩包中存在重复的对象 ID"
        )
    if parsed.manifest.card_count != len(parsed.cards):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="压缩包对象数量与清单不一致"
        )

    relation_ids: set[UUID] = set()
    preset_counts: dict[tuple[UUID, str], int] = {}
    relation_count = 0

    for card in parsed.cards:
        entity_type = get_entity_type(card.card_type)
        if entity_type is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"压缩包包含未知对象类型: {card.card_type}"
            )
        if card.icon not in entity_type.icons:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"对象「{card.name}」使用了不匹配的图标"
            )
        if not card.name.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="压缩包中存在名称为空的对象"
            )

        seen_targets: set[tuple[str, UUID]] = set()
        for relation in card.outgoing_relations:
            relation_count += 1
            if relation.id in relation_ids:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="压缩包中存在重复的关系 ID"
                )
            relation_ids.add(relation.id)

            target = card_by_id.get(relation.target_card_id)
            if target is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="压缩包中的关联对象不存在"
                )
            if target.id == card.id:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="压缩包中存在对象关联自身的数据"
                )

            relation_key = relation.preset_key or "custom"
            identity = (
                relation_key,
                target.id
            )
            if identity in seen_targets:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="压缩包中存在重复关系"
                )
            seen_targets.add(identity)

            if relation.preset_key:
                preset = get_relation_preset(relation.preset_key)
                if preset is None:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                        detail=f"压缩包包含未知关系: {relation.preset_key}"
                    )
                if (
                    preset.source_type != card.card_type
                    or preset.target_type != target.card_type
                ):
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                        detail="压缩包中的预设关系与对象类型不匹配"
                    )
                count_key = (
                    card.id,
                    preset.key
                )
                preset_counts[count_key] = preset_counts.get(count_key, 0) + 1
                if preset.cardinality == "one" and preset_counts[count_key] > 1:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                        detail=f"对象「{card.name}」的单一关联出现多次"
                    )

    manifest_relation_count = parsed.manifest.relation_count
    if relation_count != manifest_relation_count:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="压缩包关系数量与清单不一致"
        )


def import_archive(
    session: Session,
    archive_bytes: bytes
) -> ArchiveImportResult:
    """
    @brief Validate and atomically replace the entire catalog from an archive

    @return Import summary
    """

    parsed = parse_archive(archive_bytes)
    _validate_archive_cards(parsed)

    try:
        session.execute(delete(CardRelation))
        session.execute(delete(Card))
        session.flush()

        imported_cards = [
            Card(
                id=card.id,
                card_type=card.card_type,
                name=card.name.strip(),
                icon=card.icon,
                summary=card.summary,
                custom_fields=[
                    field.model_dump()
                    for field in card.custom_fields
                ],
                created_at=card.created_at,
                updated_at=card.updated_at
            )
            for card in parsed.cards
        ]
        session.add_all(imported_cards)
        session.flush()

        imported_relations = [
            CardRelation(
                id=relation.id or uuid4(),
                source_card_id=card.id,
                target_card_id=relation.target_card_id,
                preset_key=relation.preset_key,
                forward_label=(
                    get_relation_preset(relation.preset_key).label
                    if relation.preset_key
                    else relation.forward_label
                ),
                inverse_label=(
                    get_relation_preset(relation.preset_key).inverse_label
                    if relation.preset_key
                    else relation.inverse_label
                ),
                position=relation.position,
                created_at=relation.created_at or _utc_now()
            )
            for card in parsed.cards
            for relation in card.outgoing_relations
        ]
        session.add_all(imported_relations)
        session.commit()
    except Exception:
        session.rollback()
        raise

    return ArchiveImportResult(
        imported_cards=len(imported_cards),
        imported_relations=len(imported_relations),
        nav_layout=parsed.nav_layout
    )
