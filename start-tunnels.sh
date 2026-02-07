#!/bin/bash

# SCE2 Tunnel Manager
# Starts cloud server, webapp, mobile web, and cloudflare tunnels

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting SCE2 services with Cloudflare tunnels...${NC}"

# Kill existing processes
echo "Stopping existing processes..."
pkill -9 -f "tsx.*cloud-server" 2>/dev/null || true
pkill -9 -f "vite" 2>/dev/null || true
pkill -9 -f "cloudflared tunnel" 2>/dev/null || true
fuser -k -9 3333/tcp 5173/tcp 5174/tcp 2>/dev/null || true
sleep 3

# Start Cloud Server
echo "Starting Cloud Server on :3333..."
cd /home/sergio/Projects/SCE2/packages/cloud-server
nohup npm run dev > /tmp/sce2-cloud.log 2>&1 &
sleep 3

# Start Cloudflare tunnels
echo "Starting Cloudflare tunnels..."
nohup cloudflared tunnel --url http://localhost:3333 > /tmp/sce2-tunnel-api.log 2>&1 &
nohup cloudflared tunnel --url http://localhost:5173 > /tmp/sce2-tunnel-webapp.log 2>&1 &
nohup cloudflared tunnel --url http://localhost:5174 > /tmp/sce2-tunnel-mobile.log 2>&1 &
sleep 8

# Extract tunnel URLs
API_URL=$(grep "trycloudflare.com" /tmp/sce2-tunnel-api.log | tail -1 | sed 's/.*|  //' | sed 's/  *|$//')
WEBAPP_URL=$(grep "trycloudflare.com" /tmp/sce2-tunnel-webapp.log | tail -1 | sed 's/.*|  //' | sed 's/  *|$//')
MOBILE_URL=$(grep "trycloudflare.com" /tmp/sce2-tunnel-mobile.log | tail -1 | sed 's/.*|  //' | sed 's/  *|$//')

echo ""
echo -e "${GREEN}Tunnel URLs:${NC}"
echo "  API:    $API_URL"
echo "  Webapp: $WEBAPP_URL"
echo "  Mobile: $MOBILE_URL"

# Start Webapp
echo "Starting Webapp..."
cd /home/sergio/Projects/SCE2/packages/webapp
VITE_CLOUD_BASE_URL="$API_URL" VITE_MOBILE_BASE_URL="$MOBILE_URL" nohup npm run dev > /tmp/sce2-webapp.log 2>&1 &
sleep 4

# Start Mobile Web
echo "Starting Mobile Web..."
cd /home/sergio/Projects/SCE2/packages/mobile-web
VITE_API_BASE_URL="$API_URL" nohup npm run dev > /tmp/sce2-mobile.log 2>&1 &
sleep 4

echo ""
echo -e "${GREEN}All services started!${NC}"
echo ""
echo "Access URLs:"
echo "  Webapp: $WEBAPP_URL"
echo "  Mobile (QR codes): $MOBILE_URL"
echo "  API: $API_URL/api/health"
echo ""
echo "To stop services, run: pkill -f 'tsx.*cloud-server|vite|cloudflared'"
