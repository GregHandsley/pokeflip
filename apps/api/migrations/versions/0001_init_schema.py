"""init schema"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0001_init_schema"
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        "cards",
        sa.Column("sku", sa.String(length=64), primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=True),
        sa.Column("set", sa.String(length=120), nullable=True),
        sa.Column("number", sa.String(length=40), nullable=True),
        sa.Column("language", sa.String(length=8), nullable=True),
        sa.Column("rarity", sa.String(length=40), nullable=True),
        sa.Column("holo", sa.Boolean(), nullable=True),
        sa.Column("condition", sa.String(length=8), nullable=True),
        sa.Column("ocr_json", sa.JSON(), nullable=True),
        sa.Column("qa_json", sa.JSON(), nullable=True),
        sa.Column("staged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("listed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sold_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "images",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("sku", sa.String(length=64), sa.ForeignKey("cards.sku", ondelete="SET NULL"), nullable=True),
        sa.Column("key_front", sa.String(length=255), nullable=True),
        sa.Column("key_back", sa.String(length=255), nullable=True),
        sa.Column("phash_front", sa.String(length=32), nullable=True),
        sa.Column("phash_back", sa.String(length=32), nullable=True),
        sa.Column("crop_front", sa.JSON(), nullable=True),
        sa.Column("crop_back", sa.JSON(), nullable=True),
        sa.Column("qa_score", sa.Integer(), nullable=True),
        sa.Column("qa_flags", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "listings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("sku", sa.String(length=64), sa.ForeignKey("cards.sku", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("title", sa.String(length=300), nullable=True),
        sa.Column("description_md", sa.Text(), nullable=True),
        sa.Column("price_listed", sa.Float(), nullable=True),
        sa.Column("marketplace", sa.String(length=32), nullable=True),
        sa.Column("offer_id", sa.String(length=64), nullable=True),
        sa.Column("listing_id", sa.String(length=64), nullable=True),
        sa.Column("last_synced_at", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "sales",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("sku", sa.String(length=64), sa.ForeignKey("cards.sku", ondelete="CASCADE"), nullable=False),
        sa.Column("sold_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("price_sold", sa.Float(), nullable=True),
        sa.Column("fee_total", sa.Float(), nullable=True),
        sa.Column("consumables_cost", sa.Float(), nullable=True),
        sa.Column("net", sa.Float(), nullable=True),
        sa.Column("roi", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_sales_sku", "sales", ["sku"])

    op.create_table(
        "comps_cache",
        sa.Column("key", sa.String(length=128), primary_key=True),
        sa.Column("query_json", sa.JSON(), nullable=True),
        sa.Column("sold_stats_json", sa.JSON(), nullable=True),
        sa.Column("active_stats_json", sa.JSON(), nullable=True),
        sa.Column("source", sa.String(length=32), nullable=True),
        sa.Column("fetched_at_epoch", sa.Integer(), nullable=True),
        sa.Column("ttl_seconds", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "jobs",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("progress", sa.Integer(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_jobs_type", "jobs", ["type"])
    op.create_index("ix_jobs_status", "jobs", ["status"])