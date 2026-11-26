"""Public HTTP routes for the card catalog."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics import (
    StatsSummary,
    VisitRequest,
    VisitorStats,
    record_operation,
    record_visit,
    stats_summary
)
from app.archive import (
    ArchiveExportRequest,
    ArchiveImportResult,
    export_archive,
    import_archive
)
from app.catalog import catalog_payload
from app.card_schema import get_card_type_schema
from app.database import get_db
from app.schemas import CardCreate, CardOut, CardsResponse, CardTypeSchemaOut, CardUpdate
from app.services import (
    card_to_response,
    create_card,
    delete_card,
    get_card_or_404,
    list_cards,
    update_card
)


router = APIRouter(prefix="/api")


@router.get("/health")
def health_check(
    session: Session = Depends(get_db)
) -> dict[str, str]:
    """
    @brief Verify API and database availability

    @return Health status
    """

    session.execute(select(1))
    return {"status": "ok"}


@router.get("/catalog")
def get_catalog() -> dict[str, object]:
    """
    @brief Return the fixed entity and relationship catalog

    @return Catalog payload
    """

    return catalog_payload()


@router.post(
    "/visits",
    response_model=VisitorStats
)
def create_visit(
    payload: VisitRequest,
    request: Request,
    session: Session = Depends(get_db)
) -> VisitorStats:
    """
    @brief Record one anonymous category view

    @return Updated visitor statistics
    """

    return record_visit(
        session=session,
        payload=payload,
        ip_address=(
            request.client.host
            if request.client
            else None
        )
    )


@router.get(
    "/stats",
    response_model=StatsSummary
)
def get_stats(
    operation_limit: int = Query(default=30, ge=1, le=100),
    session: Session = Depends(get_db)
) -> StatsSummary:
    """
    @brief Return current visitor and operation statistics

    @return Combined statistics
    """

    return stats_summary(
        session=session,
        recent_limit=operation_limit
    )


@router.get(
    "/cards",
    response_model=CardsResponse
)
def get_cards(
    card_type: str = Query(alias="type"),
    session: Session = Depends(get_db)
) -> CardsResponse:
    """
    @brief List all cards for one entity type

    @return Cards response
    """

    return CardsResponse(
        items=list_cards(
            session=session,
            card_type=card_type
        )
    )


@router.get(
    "/card-types/{card_type}/schema",
    response_model=CardTypeSchemaOut
)
def get_schema(
    card_type: str,
    session: Session = Depends(get_db)
) -> CardTypeSchemaOut:
    """
    @brief Return shared custom-field and relationship definitions

    @return Card type schema
    """

    return get_card_type_schema(
        session=session,
        card_type=card_type
    )


@router.get(
    "/cards/{card_id}",
    response_model=CardOut
)
def get_card(
    card_id: UUID,
    session: Session = Depends(get_db)
) -> CardOut:
    """
    @brief Get a single card with all relationship views

    @return Card response
    """

    return card_to_response(
        get_card_or_404(
            session=session,
            card_id=card_id
        )
    )


@router.post(
    "/cards",
    response_model=CardOut,
    status_code=status.HTTP_201_CREATED
)
def create_card_route(
    payload: CardCreate,
    session: Session = Depends(get_db)
) -> CardOut:
    """
    @brief Create a card and nested related drafts

    @return Created card response
    """

    return create_card(
        session=session,
        payload=payload
    )


@router.patch(
    "/cards/{card_id}",
    response_model=CardOut
)
def update_card_route(
    card_id: UUID,
    payload: CardUpdate,
    session: Session = Depends(get_db)
) -> CardOut:
    """
    @brief Update a card and replace relationships when supplied

    @return Updated card response
    """

    return update_card(
        session=session,
        card_id=card_id,
        payload=payload
    )


@router.delete(
    "/cards/{card_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
def delete_card_route(
    card_id: UUID,
    session: Session = Depends(get_db)
) -> Response:
    """
    @brief Delete a card and cascade all attached relationships

    @return Empty response
    """

    delete_card(
        session=session,
        card_id=card_id
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/export")
def export_catalog(
    payload: ArchiveExportRequest,
    session: Session = Depends(get_db)
) -> Response:
    """
    @brief Export all cards, relations and optional navigation settings as ZIP

    @return ZIP download response
    """

    archive_bytes, filename = export_archive(
        session=session,
        nav_layout=payload.nav_layout
    )
    record_operation(
        session=session,
        action="export",
        summary="导出全部对象数据",
        details={
            "filename": filename
        }
    )
    session.commit()
    return Response(
        content=archive_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store"
        }
    )


@router.post(
    "/import",
    response_model=ArchiveImportResult
)
async def import_catalog(
    request: Request,
    session: Session = Depends(get_db)
) -> ArchiveImportResult:
    """
    @brief Replace all catalog data from a validated ZIP archive

    @return Import summary
    """

    archive_bytes = await request.body()
    return import_archive(
        session=session,
        archive_bytes=archive_bytes
    )
