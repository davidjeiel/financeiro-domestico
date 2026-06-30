#!/bin/sh
set -e

echo "Applying database migrations..."
# Run migrations but don't fail if tables already exist (idempotent)
./node_modules/.bin/drizzle-kit migrate || true

if [ "$NODE_ENV" = "development" ]; then
  echo "Starting server in development mode..."
  exec pnpm dev
else
  echo "Starting server in production mode..."
  exec node dist/index.js
fi
