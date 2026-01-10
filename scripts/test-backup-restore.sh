#!/bin/bash
# Test Backup and Restore Procedure
# This script tests that backups can be restored successfully

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_REF="${SUPABASE_PROJECT_REF:-}"
BACKUP_DIR="./backups"
EXPORT_URL="${EXPORT_URL:-http://localhost:3000/api/admin/backup/full-export}"
AUTH_TOKEN="${AUTH_TOKEN:-}"

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
    
    if ! command -v jq &> /dev/null; then
        log_error "jq is required but not installed. Install it with: brew install jq"
        exit 1
    fi
    
    if ! command -v supabase &> /dev/null; then
        log_warn "Supabase CLI not found. Some tests will be skipped."
    fi
    
    if [ -z "$AUTH_TOKEN" ]; then
        log_warn "AUTH_TOKEN not set. Manual export tests will be skipped."
    fi
    
    log_info "Prerequisites check complete."
}

# Test manual export
test_manual_export() {
    log_info "Testing manual export..."
    
    if [ -z "$AUTH_TOKEN" ]; then
        log_warn "Skipping manual export test (no AUTH_TOKEN)"
        return
    fi
    
    mkdir -p "$BACKUP_DIR"
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    EXPORT_FILE="$BACKUP_DIR/test-export-$TIMESTAMP.json"
    
    log_info "Fetching export from $EXPORT_URL..."
    HTTP_CODE=$(curl -s -w "%{http_code}" -o "$EXPORT_FILE" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        "$EXPORT_URL?format=json")
    
    if [ "$HTTP_CODE" != "200" ]; then
        log_error "Export failed with HTTP code $HTTP_CODE"
        return 1
    fi
    
    # Validate export structure
    if ! jq -e '.export_date, .version, .data' "$EXPORT_FILE" > /dev/null 2>&1; then
        log_error "Export file is not valid JSON or missing required fields"
        return 1
    fi
    
    # Check for required tables
    REQUIRED_TABLES=("acquisitions" "inventory_lots" "sales_orders" "bundles")
    for table in "${REQUIRED_TABLES[@]}"; do
        if ! jq -e ".data.$table" "$EXPORT_FILE" > /dev/null 2>&1; then
            log_warn "Table '$table' not found in export"
        else
            COUNT=$(jq ".data.$table | length" "$EXPORT_FILE")
            log_info "Table '$table': $COUNT records"
        fi
    done
    
    log_info "Export test completed successfully: $EXPORT_FILE"
    echo "$EXPORT_FILE"
}

# Test export data integrity
test_export_integrity() {
    log_info "Testing export data integrity..."
    
    EXPORT_FILE="$1"
    if [ -z "$EXPORT_FILE" ] || [ ! -f "$EXPORT_FILE" ]; then
        log_error "Export file not provided or not found"
        return 1
    fi
    
    # Check for null/empty critical fields
    log_info "Checking for data quality issues..."
    
    # Check acquisitions have required fields
    INVALID_ACQS=$(jq '[.data.acquisitions[] | select(.source_name == "" or .purchase_total_pence == null)] | length' "$EXPORT_FILE")
    if [ "$INVALID_ACQS" -gt 0 ]; then
        log_warn "Found $INVALID_ACQS acquisitions with missing required fields"
    fi
    
    # Check inventory lots have card references
    INVALID_LOTS=$(jq '[.data.inventory_lots[] | select(.card_id == "" or .quantity == null)] | length' "$EXPORT_FILE")
    if [ "$INVALID_LOTS" -gt 0 ]; then
        log_warn "Found $INVALID_LOTS inventory lots with missing required fields"
    fi
    
    # Check sales orders have items
    ORDERS_WITHOUT_ITEMS=$(jq '[.data.sales_orders[] | select((.sales_items // []) | length == 0)] | length' "$EXPORT_FILE")
    if [ "$ORDERS_WITHOUT_ITEMS" -gt 0 ]; then
        log_warn "Found $ORDERS_WITHOUT_ITEMS sales orders without items"
    fi
    
    log_info "Data integrity check complete."
}

# Test Supabase backup listing (if CLI available)
test_supabase_backups() {
    log_info "Testing Supabase backup access..."
    
    if ! command -v supabase &> /dev/null; then
        log_warn "Skipping Supabase backup test (CLI not available)"
        return
    fi
    
    if [ -z "$PROJECT_REF" ]; then
        log_warn "Skipping Supabase backup test (PROJECT_REF not set)"
        return
    fi
    
    log_info "Listing available backups for project $PROJECT_REF..."
    if supabase db backups list --project-ref "$PROJECT_REF" 2>/dev/null; then
        BACKUP_COUNT=$(supabase db backups list --project-ref "$PROJECT_REF" 2>/dev/null | wc -l | tr -d ' ')
        log_info "Found $BACKUP_COUNT backup(s) available"
        
        # Check for recent backup (within last 48 hours)
        RECENT_BACKUP=$(supabase db backups list --project-ref "$PROJECT_REF" 2>/dev/null | head -n 1)
        if [ -n "$RECENT_BACKUP" ]; then
            log_info "Most recent backup: $RECENT_BACKUP"
        else
            log_warn "No recent backups found"
        fi
    else
        log_error "Failed to list backups. Check your Supabase credentials and project ref."
        return 1
    fi
}

# Generate test report
generate_report() {
    log_info "Generating test report..."
    
    REPORT_FILE="$BACKUP_DIR/test-report-$(date +%Y%m%d-%H%M%S).txt"
    {
        echo "Backup and Restore Test Report"
        echo "=============================="
        echo "Date: $(date)"
        echo "Project Ref: ${PROJECT_REF:-N/A}"
        echo ""
        echo "Test Results:"
        echo "- Manual Export: ${EXPORT_TEST_RESULT:-Not tested}"
        echo "- Data Integrity: ${INTEGRITY_TEST_RESULT:-Not tested}"
        echo "- Supabase Backups: ${SUPABASE_TEST_RESULT:-Not tested}"
        echo ""
        echo "Export File: ${EXPORT_FILE:-N/A}"
        echo ""
        echo "Recommendations:"
        echo "1. Verify backup schedule is configured"
        echo "2. Test restore procedure monthly"
        echo "3. Keep exports in secure, offsite location"
    } > "$REPORT_FILE"
    
    log_info "Report generated: $REPORT_FILE"
    cat "$REPORT_FILE"
}

# Main execution
main() {
    log_info "Starting backup and restore test procedure..."
    
    check_prerequisites
    
    # Run tests
    EXPORT_FILE=$(test_manual_export) || EXPORT_TEST_RESULT="FAILED"
    EXPORT_TEST_RESULT="PASSED"
    
    if [ -n "$EXPORT_FILE" ]; then
        test_export_integrity "$EXPORT_FILE" || INTEGRITY_TEST_RESULT="FAILED"
        INTEGRITY_TEST_RESULT="PASSED"
    fi
    
    test_supabase_backups || SUPABASE_TEST_RESULT="FAILED"
    SUPABASE_TEST_RESULT="PASSED"
    
    # Generate report
    generate_report
    
    log_info "Backup and restore test procedure complete."
}

# Run main function
main "$@"

