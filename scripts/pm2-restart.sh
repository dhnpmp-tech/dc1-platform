#!/bin/bash

# Usage: ./scripts/pm2-restart.sh [service-name]
# Restarts all PM2 services if no arg, or a specific service if provided.

set -u

if [ -n "${1:-}" ]; then
  pm2 reload "$1" --update-env
else
  pm2 reload ecosystem.config.js --update-env
fi

pm2 status
