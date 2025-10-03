from __future__ import annotations
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import os
import sys

# Add repo root to path (so "apps.api" resolves)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))

from apps.api.core.settings import settings
from apps.api.models import Base  # imports all models via __init__

config = context.config
if config.get_main_option("sqlalchemy.url") in (None, "", "None"):
    config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

fileConfig(config.config_file_name) if config.config_file_name else None

target_metadata = Base.metadata

def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        future=True,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()