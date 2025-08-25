import sqlite3
from pathlib import Path
from .paths import db_path, project_root

def connect_db() -> sqlite3.Connection:
    conn = sqlite3.connect(db_path())
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def ensure_images_table(conn: sqlite3.Connection) -> None:
    cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='images';")
    if cur.fetchone() is None:
        raise RuntimeError("images table not found. Run: python app/db_init.py")

def relpath(p: Path) -> str:
    try:
        return str(p.relative_to(project_root()))
    except ValueError:
        return str(p)

def upsert_image_record(conn: sqlite3.Connection, path_str: str, phash_hex: str) -> str:
    cur = conn.cursor()
    cur.execute("SELECT phash FROM images WHERE path = ?;", (path_str,))
    row = cur.fetchone()
    if row is None:
        cur.execute("INSERT INTO images (path, phash) VALUES (?, ?);", (path_str, phash_hex))
        conn.commit()
        return "inserted"
    else:
        existing = row[0]
        if existing is None or existing != phash_hex:
            cur.execute("UPDATE images SET phash = ? WHERE path = ?;", (phash_hex, path_str))
            conn.commit()
            return "updated"
        return "unchanged"

def update_image_path(conn: sqlite3.Connection, old_relpath: str, new_relpath: str) -> int:
    cur = conn.cursor()
    cur.execute("UPDATE images SET path = ? WHERE path = ?;", (new_relpath, old_relpath))
    conn.commit()
    return cur.rowcount

def get_phash_by_path(conn: sqlite3.Connection, path_str: str) -> str | None:
    cur = conn.execute("SELECT phash FROM images WHERE path = ?;", (path_str,))
    row = cur.fetchone()
    return row[0] if row else None

def find_duplicates_by_phash(conn: sqlite3.Connection, phash_hex: str, exclude_path: str | None = None):
    if exclude_path:
        cur = conn.execute(
            "SELECT path, sku FROM images WHERE phash = ? AND path <> ?;",
            (phash_hex, exclude_path),
        )
    else:
        cur = conn.execute("SELECT path, sku FROM images WHERE phash = ?;", (phash_hex,))
    return cur.fetchall()
