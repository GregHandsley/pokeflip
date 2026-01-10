#!/bin/bash
# Restore Data from JSON Export
# WARNING: This script will modify your database. Use with caution!

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
EXPORT_FILE="${1:-}"
DRY_RUN="${DRY_RUN:-true}"
DATABASE_URL="${DATABASE_URL:-}"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if [ -z "$EXPORT_FILE" ]; then
        log_error "Usage: $0 <export-file.json> [DATABASE_URL=...] [DRY_RUN=false]"
        exit 1
    fi
    
    if [ ! -f "$EXPORT_FILE" ]; then
        log_error "Export file not found: $EXPORT_FILE"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        log_error "jq is required but not installed. Install it with: brew install jq"
        exit 1
    fi
    
    if [ "$DRY_RUN" != "true" ] && [ "$DRY_RUN" != "false" ]; then
        log_error "DRY_RUN must be 'true' or 'false'"
        exit 1
    fi
    
    if [ "$DRY_RUN" = "false" ] && [ -z "$DATABASE_URL" ]; then
        log_error "DATABASE_URL is required when DRY_RUN=false"
        exit 1
    fi
    
    if [ "$DRY_RUN" = "false" ] && ! command -v psql &> /dev/null; then
        log_error "psql is required for restoration. Install PostgreSQL client tools."
        exit 1
    fi
    
    log_info "Prerequisites check complete."
    log_warn "DRY_RUN mode: $DRY_RUN"
}

# Validate export file
validate_export() {
    log_info "Validating export file..."
    
    if ! jq -e '.export_date, .version, .data' "$EXPORT_FILE" > /dev/null 2>&1; then
        log_error "Invalid export file format"
        exit 1
    fi
    
    EXPORT_DATE=$(jq -r '.export_date' "$EXPORT_FILE")
    EXPORT_VERSION=$(jq -r '.version' "$EXPORT_FILE")
    
    log_info "Export date: $EXPORT_DATE"
    log_info "Export version: $EXPORT_VERSION"
    
    # Check for required tables
    REQUIRED_TABLES=("acquisitions" "inventory_lots" "sales_orders")
    for table in "${REQUIRED_TABLES[@]}"; do
        if ! jq -e ".data.$table" "$EXPORT_FILE" > /dev/null 2>&1; then
            log_warn "Table '$table' not found in export"
        else
            COUNT=$(jq ".data.$table | length" "$EXPORT_FILE")
            log_info "Table '$table': $COUNT records"
        fi
    done
}

# Generate SQL for restoration
generate_restore_sql() {
    log_info "Generating restore SQL..."
    
    SQL_FILE="/tmp/restore-$(date +%s).sql"
    
    {
        echo "-- Restore SQL generated from export: $EXPORT_FILE"
        echo "-- Export date: $(jq -r '.export_date' "$EXPORT_FILE")"
        echo "-- Generated: $(date)"
        echo ""
        echo "BEGIN;"
        echo ""
        echo "-- Disable foreign key checks temporarily"
        echo "SET session_replication_role = 'replica';"
        echo ""
        
        # Restore acquisitions
        log_info "Processing acquisitions..."
        jq -r '.data.acquisitions[]? | 
            "INSERT INTO acquisitions (id, source_name, source_type, reference, purchase_total_pence, purchased_at, notes, status, created_at) VALUES (" +
            "\047\(.id)\047, " +
            "\047\(.source_name // "")\047, " +
            "\047\(.source_type // "other")\047, " +
            (if .reference then "\047\(.reference)\047" else "NULL" end) + ", " +
            "\(.purchase_total_pence // 0), " +
            "\047\(.purchased_at)\047, " +
            (if .notes then "\047\(.notes)\047" else "NULL" end) + ", " +
            "\047\(.status // "open")\047, " +
            "\047\(.created_at)\047" +
            ") ON CONFLICT (id) DO UPDATE SET " +
            "source_name = EXCLUDED.source_name, " +
            "source_type = EXCLUDED.source_type, " +
            "reference = EXCLUDED.reference, " +
            "purchase_total_pence = EXCLUDED.purchase_total_pence, " +
            "purchased_at = EXCLUDED.purchased_at, " +
            "notes = EXCLUDED.notes, " +
            "status = EXCLUDED.status;"
        ' "$EXPORT_FILE" >> "$SQL_FILE"
        
        echo ""
        echo "-- Restore inventory lots (requires cards to exist)"
        log_info "Processing inventory lots..."
        jq -r '.data.inventory_lots[]? | 
            "INSERT INTO inventory_lots (id, card_id, condition, quantity, for_sale, list_price_pence, note, photo_front_path, photo_back_path, status, created_at, updated_at) VALUES (" +
            "\047\(.id)\047, " +
            "\047\(.card_id)\047, " +
            "\047\(.condition)\047, " +
            "\(.quantity // 0), " +
            "\(.for_sale // true), " +
            (if .list_price_pence then "\(.list_price_pence)" else "NULL" end) + ", " +
            (if .note then "\047\(.note)\047" else "NULL" end) + ", " +
            (if .photo_front_path then "\047\(.photo_front_path)\047" else "NULL" end) + ", " +
            (if .photo_back_path then "\047\(.photo_back_path)\047" else "NULL" end) + ", " +
            "\047\(.status // "draft")\047, " +
            "\047\(.created_at)\047, " +
            "\047\(.updated_at // .created_at)\047" +
            ") ON CONFLICT (id) DO UPDATE SET " +
            "card_id = EXCLUDED.card_id, " +
            "condition = EXCLUDED.condition, " +
            "quantity = EXCLUDED.quantity, " +
            "for_sale = EXCLUDED.for_sale, " +
            "list_price_pence = EXCLUDED.list_price_pence, " +
            "note = EXCLUDED.note, " +
            "status = EXCLUDED.status, " +
            "updated_at = EXCLUDED.updated_at;"
        ' "$EXPORT_FILE" >> "$SQL_FILE"
        
        echo ""
        echo "-- Re-enable foreign key checks"
        echo "SET session_replication_role = 'origin';"
        echo ""
        echo "COMMIT;"
    } > "$SQL_FILE"
    
    log_info "SQL file generated: $SQL_FILE"
    echo "$SQL_FILE"
}

# Execute restoration
execute_restore() {
    SQL_FILE="$1"
    
    if [ "$DRY_RUN" = "true" ]; then
        log_warn "DRY RUN MODE - Not executing SQL"
        log_info "SQL to be executed:"
        echo "---"
        head -n 50 "$SQL_FILE"
        echo "..."
        echo "---"
        log_info "To execute for real, run with DRY_RUN=false"
        return
    fi
    
    log_warn "EXECUTING RESTORATION - This will modify your database!"
    read -p "Are you sure you want to continue? (yes/no): " CONFIRM
    
    if [ "$CONFIRM" != "yes" ]; then
        log_info "Restoration cancelled by user"
        return
    fi
    
    log_info "Executing SQL restoration..."
    
    if psql "$DATABASE_URL" -f "$SQL_FILE"; then
        log_info "Restoration completed successfully"
    else
        log_error "Restoration failed. Check errors above."
        exit 1
    fi
}

# Main execution
main() {
    log_info "Starting data restoration from export..."
    
    check_prerequisites
    validate_export
    SQL_FILE=$(generate_restore_sql)
    execute_restore "$SQL_FILE"
    
    log_info "Restoration procedure complete."
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "SQL file saved at: $SQL_FILE"
        log_info "Review the SQL before executing manually if needed."
    fi
}

# Run main function
main "$@"

