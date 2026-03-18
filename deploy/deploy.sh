#!/bin/bash
set -euo pipefail

DEPLOY_DIR="/opt/thekickback"
COMPOSE="docker compose -f $DEPLOY_DIR/deploy/docker-compose.yml"

echo "=== theKickBack Zero-Downtime Deploy ==="

cd "$DEPLOY_DIR"

# Determine which slot is active
if docker inspect landing-blue --format '{{.State.Health.Status}}' 2>/dev/null | grep -q "healthy"; then
    ACTIVE="blue"
    STANDBY="green"
else
    ACTIVE="green"
    STANDBY="blue"
fi

echo "Active: $ACTIVE | Deploying to: $STANDBY"

# Step 1: Build new image
echo "Building new image..."
$COMPOSE build landing-$STANDBY

# Step 2: Start standby container
echo "Starting $STANDBY container..."
$COMPOSE --profile deploy up -d landing-$STANDBY

# Step 3: Wait for health check
echo "Waiting for $STANDBY to become healthy..."
RETRIES=30
until docker inspect landing-$STANDBY --format '{{.State.Health.Status}}' 2>/dev/null | grep -q "healthy"; do
    RETRIES=$((RETRIES - 1))
    if [ $RETRIES -le 0 ]; then
        echo "FAIL: $STANDBY never became healthy. Rolling back."
        $COMPOSE stop landing-$STANDBY
        exit 1
    fi
    sleep 2
done
echo "$STANDBY is healthy."

# Step 4: Stop old container (standby is already serving on its port)
echo "Stopping $ACTIVE..."
$COMPOSE stop landing-$ACTIVE

echo "=== Deploy complete. Active: $STANDBY ==="
echo "Landing page available on port 3100 (blue) or 3101 (green)"
