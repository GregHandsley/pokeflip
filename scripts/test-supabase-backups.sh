#!/bin/bash
# Test Supabase Backups via CLI
# This script helps verify that Supabase backups are working correctly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

log_step() {
    echo -e "\n${BLUE}[STEP]${NC} $1"
}

# Check if Supabase CLI is installed
check_cli() {
    log_step "Checking Supabase CLI installation..."
    
    if ! command -v supabase &> /dev/null; then
        log_error "Supabase CLI is not installed."
        log_info "Install it from: https://supabase.com/docs/guides/cli"
        exit 1
    fi
    
    VERSION=$(supabase --version 2>&1 | head -n 1)
    log_info "Supabase CLI version: $VERSION"
}

# Check authentication
check_auth() {
    log_step "Checking authentication..."
    
    if ! supabase projects list &> /dev/null; then
        log_warn "Not authenticated. You'll need to login."
        log_info "Run: supabase login"
        log_info "Or set SUPABASE_ACCESS_TOKEN environment variable"
        return 1
    fi
    
    log_info "Authenticated successfully"
    return 0
}

# List available projects
list_projects() {
    log_step "Listing available projects..."
    
    PROJECTS=$(supabase projects list 2>&1)
    
    if [ $? -ne 0 ]; then
        log_error "Failed to list projects. Make sure you're authenticated."
        return 1
    fi
    
    echo "$PROJECTS"
    return 0
}

# List backups for a project
list_backups() {
    local PROJECT_REF="$1"
    
    if [ -z "$PROJECT_REF" ]; then
        log_error "Project ref is required"
        return 1
    fi
    
    log_step "Listing backups for project: $PROJECT_REF"
    
    BACKUPS=$(supabase db backups list --project-ref "$PROJECT_REF" 2>&1)
    
    if [ $? -ne 0 ]; then
        log_error "Failed to list backups"
        echo "$BACKUPS"
        return 1
    fi
    
    if [ -z "$BACKUPS" ] || echo "$BACKUPS" | grep -q "No backups found"; then
        log_warn "No backups found for this project"
        log_info "This could mean:"
        log_info "  1. Backups haven't been created yet (check if project is on Pro plan or above)"
        log_info "  2. Project is too new (backups are created daily)"
        log_info "  3. Backups are disabled for this project"
        return 1
    fi
    
    echo "$BACKUPS"
    
    # Count backups
    BACKUP_COUNT=$(echo "$BACKUPS" | grep -c "backup\|Backup" || echo "0")
    log_info "Found $BACKUP_COUNT backup(s)"
    
    # Check for recent backup (within last 48 hours)
    RECENT_BACKUP=$(echo "$BACKUPS" | head -n 5)
    log_info "Most recent backups:"
    echo "$RECENT_BACKUP" | head -n 3
    
    return 0
}

# Get backup details
get_backup_details() {
    local PROJECT_REF="$1"
    local BACKUP_ID="$2"
    
    if [ -z "$PROJECT_REF" ] || [ -z "$BACKUP_ID" ]; then
        log_error "Project ref and backup ID are required"
        return 1
    fi
    
    log_step "Getting details for backup: $BACKUP_ID"
    
    DETAILS=$(supabase db backups list --project-ref "$PROJECT_REF" 2>&1 | grep -A 10 "$BACKUP_ID" || echo "")
    
    if [ -z "$DETAILS" ]; then
        log_error "Backup not found"
        return 1
    fi
    
    echo "$DETAILS"
    return 0
}

# Test backup restoration (dry run - shows what would happen)
test_restore_preview() {
    local PROJECT_REF="$1"
    local BACKUP_ID="$2"
    
    if [ -z "$PROJECT_REF" ] || [ -z "$BACKUP_ID" ]; then
        log_error "Project ref and backup ID are required for restore test"
        return 1
    fi
    
    log_step "Previewing restore operation for backup: $BACKUP_ID"
    log_warn "This is a PREVIEW only - no actual restore will be performed"
    
    log_info "To actually restore, you would run:"
    echo "  supabase db restore $BACKUP_ID --project-ref $PROJECT_REF"
    echo ""
    log_warn "WARNING: Restoring will overwrite your current database!"
    log_info "It's recommended to:"
    log_info "  1. Test restore to a separate project/staging environment first"
    log_info "  2. Verify the backup data is correct"
    log_info "  3. Take a manual export before restoring to production"
    
    return 0
}

# Check backup status and health
check_backup_health() {
    local PROJECT_REF="$1"
    
    if [ -z "$PROJECT_REF" ]; then
        log_error "Project ref is required"
        return 1
    fi
    
    log_step "Checking backup health for project: $PROJECT_REF"
    
    # Get backups
    BACKUPS=$(supabase db backups list --project-ref "$PROJECT_REF" 2>&1)
    
    if [ $? -ne 0 ] || [ -z "$BACKUPS" ]; then
        log_error "Unable to retrieve backup information"
        return 1
    fi
    
    # Check if backups exist
    if echo "$BACKUPS" | grep -q "No backups found"; then
        log_error "No backups found - backups may not be enabled"
        log_info "Check your Supabase plan - backups require Pro plan or above"
        return 1
    fi
    
    # Get most recent backup date
    LATEST_BACKUP=$(echo "$BACKUPS" | head -n 5 | grep -E "[0-9]{4}-[0-9]{2}-[0-9]{2}" | head -n 1 || echo "")
    
    if [ -n "$LATEST_BACKUP" ]; then
        log_info "Latest backup found: $LATEST_BACKUP"
        
        # Try to parse date and check if it's recent (within last 3 days)
        BACKUP_DATE=$(echo "$LATEST_BACKUP" | grep -oE "[0-9]{4}-[0-9]{2}-[0-9]{2}" | head -n 1)
        if [ -n "$BACKUP_DATE" ]; then
            BACKUP_TIMESTAMP=$(date -j -f "%Y-%m-%d" "$BACKUP_DATE" "+%s" 2>/dev/null || date -d "$BACKUP_DATE" "+%s" 2>/dev/null || echo "0")
            CURRENT_TIMESTAMP=$(date "+%s")
            DAYS_AGO=$(( (CURRENT_TIMESTAMP - BACKUP_TIMESTAMP) / 86400 ))
            
            if [ "$DAYS_AGO" -le 3 ]; then
                log_info "✓ Backup is recent (${DAYS_AGO} day(s) ago)"
            else
                log_warn "Backup is ${DAYS_AGO} days old - check if daily backups are enabled"
            fi
        fi
    else
        log_warn "Could not determine latest backup date"
    fi
    
    # Count total backups
    TOTAL_BACKUPS=$(echo "$BACKUPS" | grep -c "backup\|Backup\|ID:" || echo "0")
    log_info "Total backups available: $TOTAL_BACKUPS"
    
    if [ "$TOTAL_BACKUPS" -eq 0 ]; then
        log_error "No backups found"
        return 1
    fi
    
    log_info "✓ Backup system appears to be working"
    return 0
}

# Main menu
show_menu() {
    echo ""
    log_step "Supabase Backup Testing Tool"
    echo ""
    echo "1. List all projects"
    echo "2. List backups for a project"
    echo "3. Check backup health for a project"
    echo "4. Get backup details"
    echo "5. Test restore preview (dry run)"
    echo "6. Run full health check"
    echo "7. Exit"
    echo ""
}

# Full health check
full_health_check() {
    log_step "Running full backup health check..."
    
    if ! check_auth; then
        log_error "Authentication required. Run: supabase login"
        return 1
    fi
    
    PROJECT_REF="${SUPABASE_PROJECT_REF:-}"
    
    if [ -z "$PROJECT_REF" ]; then
        log_info "Listing projects to find project ref..."
        list_projects
        echo ""
        read -p "Enter project ref to check: " PROJECT_REF
    fi
    
    if [ -z "$PROJECT_REF" ]; then
        log_error "Project ref is required"
        return 1
    fi
    
    check_backup_health "$PROJECT_REF"
    
    echo ""
    log_info "For detailed backup information, visit:"
    log_info "https://app.supabase.com/project/$PROJECT_REF/settings/database"
}

# Interactive mode
interactive_mode() {
    while true; do
        show_menu
        read -p "Select an option (1-7): " choice
        
        case $choice in
            1)
                list_projects
                ;;
            2)
                read -p "Enter project ref: " PROJECT_REF
                list_backups "$PROJECT_REF"
                ;;
            3)
                read -p "Enter project ref: " PROJECT_REF
                check_backup_health "$PROJECT_REF"
                ;;
            4)
                read -p "Enter project ref: " PROJECT_REF
                read -p "Enter backup ID: " BACKUP_ID
                get_backup_details "$PROJECT_REF" "$BACKUP_ID"
                ;;
            5)
                read -p "Enter project ref: " PROJECT_REF
                read -p "Enter backup ID: " BACKUP_ID
                test_restore_preview "$PROJECT_REF" "$BACKUP_ID"
                ;;
            6)
                full_health_check
                ;;
            7)
                log_info "Exiting..."
                exit 0
                ;;
            *)
                log_error "Invalid option"
                ;;
        esac
        
        echo ""
        read -p "Press Enter to continue..."
    done
}

# Non-interactive mode (if project ref provided)
non_interactive_mode() {
    PROJECT_REF="${1:-${SUPABASE_PROJECT_REF:-}}"
    
    if [ -z "$PROJECT_REF" ]; then
        log_error "Project ref is required in non-interactive mode"
        log_info "Usage: $0 [project-ref]"
        log_info "Or set SUPABASE_PROJECT_REF environment variable"
        exit 1
    fi
    
    log_info "Running non-interactive backup check for project: $PROJECT_REF"
    
    if ! check_auth; then
        log_error "Authentication required. Run: supabase login"
        exit 1
    fi
    
    check_backup_health "$PROJECT_REF"
}

# Main execution
main() {
    check_cli
    
    # If project ref provided as argument, run non-interactive
    if [ $# -gt 0 ]; then
        non_interactive_mode "$1"
    else
        # Otherwise run interactive mode or full health check
        if [ -n "${SUPABASE_PROJECT_REF:-}" ]; then
            full_health_check
        else
            interactive_mode
        fi
    fi
}

# Run main function
main "$@"

