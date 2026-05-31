#!/usr/bin/env bash
#
# CloudX — Production Deployment Script
# ======================================
# Usage:
#   ./deploy.sh                 # Full deploy (default branch)
#   ./deploy.sh --branch=main   # Deploy a specific branch
#   ./deploy.sh --skip-build    # Skip npm build (backend-only changes)
#   ./deploy.sh --fresh-db      # Run migrate:fresh (DANGEROUS — wipes data)
#
# Prerequisites:
#   - Git, PHP 8.4+, Composer, Node.js 20+, npm
#   - Nginx configured to serve from <project>/public
#   - .env already configured on the server
#
# This script is idempotent and safe to re-run.
# It enables maintenance mode during deploy and disables it when done (even on failure).

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────
DEPLOY_BRANCH="main"
SKIP_BUILD=false
FRESH_DB=false
PHP_BIN="php"
COMPOSER_BIN="composer"
NPM_BIN="npm"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${APP_DIR}/storage/logs/deploy-$(date +%Y%m%d-%H%M%S).log"

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ─── Parse Arguments ─────────────────────────────────────────────────────────
for arg in "$@"; do
    case $arg in
        --branch=*)
            DEPLOY_BRANCH="${arg#*=}"
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --fresh-db)
            FRESH_DB=true
            shift
            ;;
        --php=*)
            PHP_BIN="${arg#*=}"
            shift
            ;;
        --help)
            head -17 "$0" | tail -15
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown argument: $arg${NC}"
            exit 1
            ;;
    esac
done

# ─── Helpers ──────────────────────────────────────────────────────────────────
step() {
    echo -e "\n${CYAN}━━━ $1 ━━━${NC}"
}

success() {
    echo -e "${GREEN}✔ $1${NC}"
}

warn() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

fail() {
    echo -e "${RED}✖ $1${NC}"
    exit 1
}

elapsed() {
    local start=$1
    local end
    end=$(date +%s)
    echo "$((end - start))s"
}

# ─── Pre-flight Checks ───────────────────────────────────────────────────────
step "Pre-flight checks"

cd "$APP_DIR" || fail "Could not change to app directory: $APP_DIR"

command -v git       >/dev/null 2>&1 || fail "git is not installed"
command -v "$PHP_BIN"      >/dev/null 2>&1 || fail "PHP ($PHP_BIN) is not installed"
command -v "$COMPOSER_BIN" >/dev/null 2>&1 || fail "Composer ($COMPOSER_BIN) is not installed"
command -v "$NPM_BIN"      >/dev/null 2>&1 || fail "npm ($NPM_BIN) is not installed"
command -v node      >/dev/null 2>&1 || fail "Node.js is not installed"

# Verify PHP version
PHP_VERSION=$($PHP_BIN -r "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;")
if [[ "$PHP_VERSION" < "8.3" ]]; then
    fail "PHP 8.3+ required, found $PHP_VERSION"
fi

# Verify .env exists
[[ -f ".env" ]] || fail ".env file not found. Copy .env.example and configure it first."

success "All checks passed (PHP $PHP_VERSION, Node $(node -v))"

# ─── Capture start time ──────────────────────────────────────────────────────
DEPLOY_START=$(date +%s)
echo "Deploy started at $(date '+%Y-%m-%d %H:%M:%S')" | tee "$LOG_FILE"
echo "Branch: $DEPLOY_BRANCH" | tee -a "$LOG_FILE"

# ─── Maintenance Mode ON ─────────────────────────────────────────────────────
step "Enabling maintenance mode"

# Ensure maintenance mode is disabled on exit (success or failure)
cleanup() {
    echo ""
    step "Disabling maintenance mode"
    $PHP_BIN artisan up 2>/dev/null || true
    success "Application is live"

    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  Deploy completed in $(elapsed $DEPLOY_START)${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "Log: $LOG_FILE"
}
trap cleanup EXIT

$PHP_BIN artisan down --retry=30 --refresh=15 2>&1 | tee -a "$LOG_FILE"
success "Maintenance mode enabled"

# ─── Git Pull ─────────────────────────────────────────────────────────────────
step "Pulling latest code from '$DEPLOY_BRANCH'"

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "$DEPLOY_BRANCH" ]]; then
    warn "Currently on '$CURRENT_BRANCH', switching to '$DEPLOY_BRANCH'"
    git checkout "$DEPLOY_BRANCH" 2>&1 | tee -a "$LOG_FILE"
fi

BEFORE_HASH=$(git rev-parse HEAD)
git pull origin "$DEPLOY_BRANCH" 2>&1 | tee -a "$LOG_FILE"
AFTER_HASH=$(git rev-parse HEAD)

if [[ "$BEFORE_HASH" == "$AFTER_HASH" ]]; then
    warn "No new commits. Continuing deploy anyway..."
else
    COMMIT_COUNT=$(git rev-list --count "$BEFORE_HASH".."$AFTER_HASH")
    success "Pulled $COMMIT_COUNT new commit(s)"
    echo "  ${BEFORE_HASH:0:8} → ${AFTER_HASH:0:8}"
fi

# ─── Composer Install ────────────────────────────────────────────────────────
step "Installing PHP dependencies"

$COMPOSER_BIN install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --optimize-autoloader \
    2>&1 | tee -a "$LOG_FILE"

success "Composer dependencies installed"

# ─── Database Migration ──────────────────────────────────────────────────────
step "Running database migrations"

if [[ "$FRESH_DB" == true ]]; then
    warn "Running migrate:fresh — ALL DATA WILL BE LOST"
    $PHP_BIN artisan migrate:fresh --force --no-interaction 2>&1 | tee -a "$LOG_FILE"
    $PHP_BIN artisan db:seed --force --no-interaction 2>&1 | tee -a "$LOG_FILE"
else
    $PHP_BIN artisan migrate --force --no-interaction 2>&1 | tee -a "$LOG_FILE"
fi

success "Migrations completed"

# ─── NPM Build ───────────────────────────────────────────────────────────────
if [[ "$SKIP_BUILD" == false ]]; then
    step "Building frontend assets"

    $NPM_BIN ci --ignore-scripts 2>&1 | tee -a "$LOG_FILE"
    $NPM_BIN run build 2>&1 | tee -a "$LOG_FILE"

    success "Frontend built successfully"
else
    warn "Skipping frontend build (--skip-build)"
fi

# ─── Laravel Cache Optimization ──────────────────────────────────────────────
step "Optimizing Laravel caches"

# Clear all caches first to avoid stale data
$PHP_BIN artisan cache:clear 2>&1 | tee -a "$LOG_FILE"

# Rebuild optimized caches
$PHP_BIN artisan config:cache 2>&1 | tee -a "$LOG_FILE"
$PHP_BIN artisan route:cache 2>&1 | tee -a "$LOG_FILE"
$PHP_BIN artisan view:cache 2>&1 | tee -a "$LOG_FILE"
$PHP_BIN artisan event:cache 2>&1 | tee -a "$LOG_FILE"

success "Caches optimized"

# ─── Storage Link ─────────────────────────────────────────────────────────────
step "Ensuring storage link"

$PHP_BIN artisan storage:link 2>/dev/null || true

success "Storage linked"

# ─── Restart Queue Workers ───────────────────────────────────────────────────
step "Restarting queue workers"

$PHP_BIN artisan queue:restart 2>&1 | tee -a "$LOG_FILE"

success "Queue restart signal sent"

# ─── Restart Reverb (WebSocket) ──────────────────────────────────────────────
step "Restarting Reverb (if running)"

if pgrep -f "artisan reverb:start" > /dev/null 2>&1; then
    pkill -f "artisan reverb:start" 2>/dev/null || true
    sleep 2
    nohup $PHP_BIN artisan reverb:start --host=0.0.0.0 --port=8080 >> "${APP_DIR}/storage/logs/reverb.log" 2>&1 &
    success "Reverb restarted (PID: $!)"
else
    warn "Reverb not running, skipping restart"
fi

# ─── File Permissions ─────────────────────────────────────────────────────────
step "Fixing file permissions"

# Detect web server user (nginx/www-data)
WEB_USER="www-data"
if id "nginx" &>/dev/null; then
    WEB_USER="nginx"
fi

CURRENT_USER=$(whoami)

if [[ "$CURRENT_USER" == "root" ]]; then
    chown -R "${WEB_USER}:${WEB_USER}" storage bootstrap/cache
    chmod -R 775 storage bootstrap/cache
    success "Permissions set (owner: $WEB_USER)"
else
    chmod -R 775 storage bootstrap/cache 2>/dev/null || true
    success "Permissions set (chmod 775)"
fi

# ─── Reload Nginx ─────────────────────────────────────────────────────────────
step "Reloading Nginx"

if command -v nginx >/dev/null 2>&1; then
    if [[ "$CURRENT_USER" == "root" ]]; then
        nginx -t 2>&1 | tee -a "$LOG_FILE" && nginx -s reload 2>&1 | tee -a "$LOG_FILE"
        success "Nginx reloaded"
    else
        sudo nginx -t 2>&1 | tee -a "$LOG_FILE" && sudo nginx -s reload 2>&1 | tee -a "$LOG_FILE"
        success "Nginx reloaded (via sudo)"
    fi
else
    warn "Nginx not found, skipping reload"
fi

# ─── Done (cleanup trap will disable maintenance mode) ────────────────────────
echo "" | tee -a "$LOG_FILE"
echo "Deploy finished at $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$LOG_FILE"
echo "Commit: ${AFTER_HASH:-$BEFORE_HASH}" | tee -a "$LOG_FILE"
