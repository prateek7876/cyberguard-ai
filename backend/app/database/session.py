import ssl

from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


class Base(DeclarativeBase):
    pass


# Normalize PostgreSQL URL for SQLAlchemy async + asyncpg.
database_url = make_url(settings.database_url)

if database_url.drivername in ("postgresql", "postgresql+psycopg2"):
    database_url = database_url.set(drivername="postgresql+asyncpg")

connect_args = {}

sslmode = database_url.query.get("sslmode")

if sslmode:
    database_url = database_url.difference_update_query(["sslmode", "channel_binding"])

    if sslmode in ("require", "verify-ca", "verify-full"):
        connect_args["ssl"] = ssl.create_default_context()


engine = create_async_engine(
    database_url,
    echo=False,
    pool_pre_ping=True,
    connect_args=connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def check_db_connection() -> bool:
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
