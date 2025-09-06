from pathlib import Path

def project_root() -> Path:

    return Path(__file__).resolve().parents[2]

def inbox_unsorted_dir() -> Path:
    return project_root() / "inbox" / "unsorted"

def inbox_pending_dir() -> Path:
    return project_root() / "inbox" / "pending"

def db_path() -> Path:
    return project_root() / "db" / "pokeflip.sqlite"