import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


def normalize_database_url(raw_url: str) -> str:
    candidate = raw_url.strip()
    if candidate.startswith("postgres://"):
        # Some hosts still provide deprecated postgres:// URLs.
        return "postgresql+psycopg://" + candidate[len("postgres://") :]
    if candidate.startswith("postgresql://") and not candidate.startswith("postgresql+"):
        # Force SQLAlchemy to use psycopg (v3) which is in requirements.
        return "postgresql+psycopg://" + candidate[len("postgresql://") :]
    return candidate


DATABASE_URL = normalize_database_url(
    os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://atlas:atlaspass@localhost:5432/atlas",
    )
)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=300,
    connect_args={"connect_timeout": 10},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
