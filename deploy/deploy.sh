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

# Step 4: Swap nginx to point to new container
echo "Swapping nginx upstream to $STANDBY..."
cat > "$DEPLOY_DIR/deploy/nginx/nginx.conf" <<NGINX_EOF
upstream landing {
    server landing-$STANDBY:3000;
    server landing-$ACTIVE:3000 backup;
}

server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://landing;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
    }

    location /health/nginx {
        return 200 '{"status":"ok","service":"nginx"}';
        add_header Content-Type application/json;
    }
}
NGINX_EOF

# Reload nginx (zero-downtime, no restart)
docker exec $(docker ps -qf "name=nginx") nginx -s reload
echo "Nginx reloaded. Traffic now on $STANDBY."

# Step 5: Drain and stop old container (30s grace)
echo "Draining $ACTIVE (30s grace)..."
sleep 5
$COMPOSE stop landing-$ACTIVE
echo "$ACTIVE stopped."

echo "=== Deploy complete. Active: $STANDBY ==="
