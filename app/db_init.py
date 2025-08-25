# app/db_init.py
from __future__ import annotations

import sqlite3
from pathlib import Path
from datetime import datetime

SCHEMA_VERSION = 1

def project_root() -> Path:
    # Assumes this file is in pokeflip/app/db_init.py
    return Path(__file__).resolve().parents[1]

def db_path() -> Path:
    return project_root() / "db" / "pokeflip.sqlite"

def ensure_db_folder():
    (project_root() / "db").mkdir(parents=True, exist_ok=True)

DDL_STATEMENTS = [
    # cards
    """
    CREATE TABLE IF NOT EXISTS cards (
        sku                 TEXT PRIMARY KEY,
        name                TEXT NOT NULL,
        set_code            TEXT,
        set_name            TEXT,
        number              TEXT,                -- keep TEXT to allow values like '10a'
        language            TEXT,                -- e.g., EN, JA, DE
        rarity              TEXT,
        holo                INTEGER DEFAULT 0 CHECK (holo IN (0,1)),
        condition           TEXT CHECK (condition IN ('NM','LP','MP','HP','DMG')),
        notes               TEXT,
        image_front_id      INTEGER,
        image_back_id       INTEGER,
        acquisition_cost    REAL DEFAULT 0.0,
        created_at          TEXT DEFAULT (datetime('now')),
        updated_at          TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (image_front_id) REFERENCES images(id),
        FOREIGN KEY (image_back_id)  REFERENCES images(id)
    );
    """,

    # images
    """
    CREATE TABLE IF NOT EXISTS images (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        path        TEXT UNIQUE NOT NULL,
        phash       TEXT,                        -- perceptual hash for de-dup
        sku         TEXT,                        -- optional back-reference (no FK to avoid circular insert pain)
        created_at  TEXT DEFAULT (datetime('now'))
    );
    """,

    # listings
    """
    CREATE TABLE IF NOT EXISTS listings (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        sku             TEXT NOT NULL,
        platform        TEXT NOT NULL DEFAULT 'ebay',
        custom_label    TEXT,                    -- mirror of SKU used by marketplaces
        title           TEXT,
        description     TEXT,
        price_listed    REAL,
        status          TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','active','sold','ended','archived')),
        published_at    TEXT,                    -- when it went live
        created_at      TEXT DEFAULT (datetime('now')),
        updated_at      TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (sku) REFERENCES cards(sku)
    );
    """,

    # sales
    """
    CREATE TABLE IF NOT EXISTS sales (
        id                      INTEGER PRIMARY KEY AUTOINCREMENT,
        sku                     TEXT NOT NULL,
        platform_order_id       TEXT,
        sold_at                 TEXT,
        sale_price              REAL NOT NULL,
        shipping_charged        REAL DEFAULT 0.0,
        shipping_actual         REAL DEFAULT 0.0,
        ebay_fee                REAL DEFAULT 0.0,
        payment_fee             REAL DEFAULT 0.0,
        consumables_cost        REAL DEFAULT 0.0,
        net_profit              REAL,            -- computed by app and stored
        roi_pct                 REAL,            -- computed by app and stored
        created_at              TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (sku) REFERENCES cards(sku)
    );
    """,

    # consumables_prices
    """
    CREATE TABLE IF NOT EXISTS consumables_prices (
        name        TEXT PRIMARY KEY,            -- e.g., 'penny_sleeve', 'top_loader', ...
        unit_cost   REAL NOT NULL
    );
    """,

    # comps_cache
    """
    CREATE TABLE IF NOT EXISTS comps_cache (
        key             TEXT PRIMARY KEY,        -- (name+set+no+lang+cond) or your chosen hash
        lookback_days   INTEGER,
        median_sold     REAL,
        mean_trimmed    REAL,
        last_sold       REAL,
        n_sales         INTEGER,
        updated_at      TEXT DEFAULT (datetime('now'))
    );
    """,
]

INDEX_STATEMENTS = [
    # Helpful indexes
    "CREATE INDEX IF NOT EXISTS idx_images_phash ON images(phash);",
    "CREATE INDEX IF NOT EXISTS idx_listings_sku ON listings(sku);",
    "CREATE INDEX IF NOT EXISTS idx_sales_sku ON sales(sku);",
    "CREATE INDEX IF NOT EXISTS idx_cards_condition ON cards(condition);",
    # One active listing per (platform, custom_label/SKU)
    "CREATE UNIQUE INDEX IF NOT EXISTS ux_active_listing_platform_label ON listings(platform, custom_label) WHERE status='active';",
]

TRIGGERS = [
    # Keep updated_at fresh on cards/listings changes
    """
    CREATE TRIGGER IF NOT EXISTS trg_cards_updated_at
    AFTER UPDATE ON cards
    FOR EACH ROW
    BEGIN
        UPDATE cards SET updated_at = datetime('now') WHERE sku = NEW.sku;
    END;
    """,
    """
    CREATE TRIGGER IF NOT EXISTS trg_listings_updated_at
    AFTER UPDATE ON listings
    FOR EACH ROW
    BEGIN
        UPDATE listings SET updated_at = datetime('now') WHERE id = NEW.id;
    END;
    """,
]

def init_db(conn: sqlite3.Connection):
    cur = conn.cursor()
    cur.execute("PRAGMA foreign_keys = ON;")
    for ddl in DDL_STATEMENTS:
        cur.execute(ddl)
    for idx in INDEX_STATEMENTS:
        cur.execute(idx)
    for trg in TRIGGERS:
        cur.execute(trg)
    # set schema version for future migrations
    cur.execute(f"PRAGMA user_version = {SCHEMA_VERSION};")
    conn.commit()

def main():
    ensure_db_folder()
    path = db_path()
    conn = sqlite3.connect(path)
    try:
        init_db(conn)
    finally:
        conn.close()

    print(f"✅ Database initialised at: {path}")
    # Quick summary
    conn2 = sqlite3.connect(path)
    try:
        cur = conn2.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")
        tables = [r[0] for r in cur.fetchall()]
        print("🗂️  Tables:", ", ".join(tables))
        cur.execute("PRAGMA user_version;")
        ver = cur.fetchone()[0]
        print(f"🔖 Schema version: {ver}")
    finally:
        conn2.close()

if __name__ == "__main__":
    main()
