"""Shared test fixtures using an isolated in-memory SQLite database."""

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app


test_engine = create_engine(
    "sqlite+pysqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)


@event.listens_for(test_engine, "connect")
def enable_foreign_keys(
    database_connection,
    connection_record
) -> None:
    """
    @brief Enable SQLite foreign-key enforcement for cascading tests

    @return None
    """

    del connection_record
    cursor = database_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = sessionmaker(
    bind=test_engine,
    autoflush=False,
    expire_on_commit=False
)


def override_get_db() -> Generator[Session, None, None]:
    """
    @brief Provide test database sessions to the FastAPI app

    @return Session generator
    """

    database = TestingSessionLocal()
    try:
        yield database
    finally:
        database.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def reset_database() -> Generator[None, None, None]:
    """
    @brief Recreate the schema before every test

    @return Test lifecycle generator
    """

    Base.metadata.drop_all(test_engine)
    Base.metadata.create_all(test_engine)
    yield


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """
    @brief Create a FastAPI test client

    @return Test client generator
    """

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def database() -> Generator[Session, None, None]:
    """
    @brief Create a direct database session

    @return Database session generator
    """

    database_session = TestingSessionLocal()
    try:
        yield database_session
    finally:
        database_session.close()
