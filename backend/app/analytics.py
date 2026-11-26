"""Anonymous visitor statistics and user-visible operation logs."""

from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.catalog import get_entity_type
from app.models import OperationLog, VisitEvent


APP_TIMEZONE = ZoneInfo("Asia/Shanghai")


class VisitRequest(BaseModel):
    """Payload used to record an anonymous category view."""

    visitor_id: str = Field(min_length=8, max_length=64)
    card_type: str = Field(min_length=1, max_length=32)

    @field_validator("visitor_id", "card_type")
    @classmethod
    def strip_visit_text(cls, value: str) -> str:
        """
        @brief Trim anonymous visitor and category values

        @return Trimmed value
        """

        return value.strip()


class DailyVisitStat(BaseModel):
    """Visitor totals for one calendar day."""

    day: date
    visitors: int
    views: int


class PageVisitStat(BaseModel):
    """Visitor totals for one card category."""

    card_type: str
    visitors: int
    views: int


class RecentVisit(BaseModel):
    """One recent anonymous visit with its network address."""

    id: UUID
    visitor_id: str
    ip_address: str
    card_type: str
    visited_at: datetime


class VisitorStats(BaseModel):
    """Complete visitor statistics returned to the browser."""

    total_visitors: int
    today_visitors: int
    total_views: int
    today_views: int
    daily: list[DailyVisitStat]
    pages: list[PageVisitStat]
    recent: list[RecentVisit]


class OperationLogOut(BaseModel):
    """One recent operation visible in the statistics panel."""

    id: UUID
    action: str
    entity_type: str | None
    entity_id: UUID | None
    summary: str
    details: dict[str, object]
    created_at: datetime


class OperationActionStat(BaseModel):
    """Operation count grouped by action."""

    action: str
    count: int


class OperationStats(BaseModel):
    """Operation totals and recent activity."""

    total: int
    today: int
    actions: list[OperationActionStat]
    recent: list[OperationLogOut]


class StatsSummary(BaseModel):
    """Combined visitor and operation statistics."""

    visitors: VisitorStats
    operations: OperationStats


def _local_now() -> datetime:
    """
    @brief Return current time in the application timezone

    @return Local datetime
    """

    return datetime.now(APP_TIMEZONE)


def _start_of_today_utc() -> datetime:
    """
    @brief Return UTC timestamp for local midnight

    @return UTC datetime
    """

    local_now = _local_now()
    local_midnight = local_now.replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0
    )
    return local_midnight.astimezone(timezone.utc)


def _unique_visitor_count(
    session: Session,
    since: datetime | None = None
) -> int:
    """
    @brief Count distinct anonymous visitors

    @return Unique visitor count
    """

    statement = select(
        func.count(func.distinct(VisitEvent.visitor_id))
    )
    if since is not None:
        statement = statement.where(VisitEvent.visited_at >= since)
    return int(session.scalar(statement) or 0)


def visitor_stats(session: Session) -> VisitorStats:
    """
    @brief Calculate all-time, today and recent visitor statistics

    @return Visitor statistics
    """

    today_start = _start_of_today_utc()
    total_views = int(
        session.scalar(
            select(func.count(VisitEvent.id))
        ) or 0
    )
    today_views = int(
        session.scalar(
            select(func.count(VisitEvent.id)).where(
                VisitEvent.visited_at >= today_start
            )
        ) or 0
    )
    total_visitors = _unique_visitor_count(session)
    today_visitors = _unique_visitor_count(
        session,
        today_start
    )

    local_today = _local_now().date()
    daily_totals: dict[date, tuple[set[str], int]] = {}
    history_start = datetime.combine(
        local_today - timedelta(days=6),
        time.min,
        tzinfo=APP_TIMEZONE
    )
    history_start_utc = history_start.astimezone(timezone.utc)
    history_events = session.execute(
        select(
            VisitEvent.visitor_id,
            VisitEvent.visited_at
        ).where(
            VisitEvent.visited_at >= history_start_utc
        )
    ).all()
    for visitor_id, visited_at in history_events:
        if visited_at.tzinfo is None:
            visited_at = visited_at.replace(tzinfo=timezone.utc)
        local_day = visited_at.astimezone(APP_TIMEZONE).date()
        visitors, views = daily_totals.get(local_day, (set(), 0))
        visitors.add(visitor_id)
        daily_totals[local_day] = (visitors, views + 1)

    daily = []
    for offset in range(6, -1, -1):
        day = local_today - timedelta(days=offset)
        visitors, views = daily_totals.get(day, (set(), 0))
        daily.append(
            DailyVisitStat(
                day=day,
                visitors=len(visitors),
                views=views
            )
        )

    page_rows = session.execute(
        select(
            VisitEvent.card_type,
            func.count(func.distinct(VisitEvent.visitor_id)),
            func.count(VisitEvent.id)
        )
        .group_by(VisitEvent.card_type)
        .order_by(desc(func.count(VisitEvent.id)))
    ).all()
    pages = [
        PageVisitStat(
            card_type=card_type,
            visitors=int(unique_visitors),
            views=int(views)
        )
        for card_type, unique_visitors, views in page_rows
    ]
    recent_events = session.scalars(
        select(VisitEvent)
        .order_by(VisitEvent.visited_at.desc())
        .limit(20)
    ).all()

    return VisitorStats(
        total_visitors=total_visitors,
        today_visitors=today_visitors,
        total_views=total_views,
        today_views=today_views,
        daily=daily,
        pages=pages,
        recent=[
            RecentVisit(
                id=event.id,
                visitor_id=event.visitor_id,
                ip_address=event.ip_address or "未知",
                card_type=event.card_type,
                visited_at=event.visited_at
            )
            for event in recent_events
        ]
    )


def record_visit(
    session: Session,
    payload: VisitRequest,
    ip_address: str | None
) -> VisitorStats:
    """
    @brief Record one anonymous category view and return updated totals

    @return Updated visitor statistics
    """

    if get_entity_type(payload.card_type) is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="访客记录包含未知对象类型"
        )

    session.add(
        VisitEvent(
            visitor_id=payload.visitor_id,
            ip_address=ip_address,
            card_type=payload.card_type
        )
    )
    session.commit()
    return visitor_stats(session)


def record_operation(
    session: Session,
    action: str,
    summary: str,
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    details: dict[str, object] | None = None
) -> None:
    """
    @brief Add an operation log inside the caller's transaction

    @return None
    """

    session.add(
        OperationLog(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            summary=summary,
            details=details or {}
        )
    )


def operation_stats(
    session: Session,
    recent_limit: int = 30
) -> OperationStats:
    """
    @brief Calculate operation counts and recent log entries

    @return Operation statistics
    """

    today_start = _start_of_today_utc()
    total = int(
        session.scalar(
            select(func.count(OperationLog.id))
        ) or 0
    )
    today = int(
        session.scalar(
            select(func.count(OperationLog.id)).where(
                OperationLog.created_at >= today_start
            )
        ) or 0
    )
    action_rows = session.execute(
        select(
            OperationLog.action,
            func.count(OperationLog.id)
        )
        .group_by(OperationLog.action)
        .order_by(desc(func.count(OperationLog.id)))
    ).all()
    actions = [
        OperationActionStat(
            action=action,
            count=int(count)
        )
        for action, count in action_rows
    ]
    recent_logs = session.scalars(
        select(OperationLog)
        .order_by(OperationLog.created_at.desc())
        .limit(max(1, min(recent_limit, 100)))
    ).all()

    return OperationStats(
        total=total,
        today=today,
        actions=actions,
        recent=[
            OperationLogOut(
                id=log.id,
                action=log.action,
                entity_type=log.entity_type,
                entity_id=log.entity_id,
                summary=log.summary,
                details=log.details,
                created_at=log.created_at
            )
            for log in recent_logs
        ]
    )


def stats_summary(
    session: Session,
    recent_limit: int = 30
) -> StatsSummary:
    """
    @brief Build the combined statistics payload

    @return Combined visitor and operation statistics
    """

    return StatsSummary(
        visitors=visitor_stats(session),
        operations=operation_stats(
            session=session,
            recent_limit=recent_limit
        )
    )
