from logging.config import fileConfig

import ssl
from sqlalchemy import pool
from sqlalchemy.engine import Connection, make_url
from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context

from app.core.config import settings
from app.database.session import Base
from app.models.scan import Scan

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_migration_config():
    database_url = make_url(settings.database_url)

    if database_url.drivername in ("postgresql", "postgresql+psycopg2"):
        database_url = database_url.set(drivername="postgresql+asyncpg")

    sslmode = database_url.query.get("sslmode")

    database_url = database_url.difference_update_query(
        ["sslmode", "channel_binding"]
    )

    connect_args = {}

    if sslmode in ("require", "verify-ca", "verify-full"):
        connect_args["ssl"] = ssl.create_default_context()

    return database_url, connect_args


def run_migrations_offline() -> None:
    database_url, _ = get_migration_config()

    context.configure(
        url=str(database_url),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    database_url, connect_args = get_migration_config()

    connectable = create_async_engine(
        database_url,
        echo=False,
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    import asyncio
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
