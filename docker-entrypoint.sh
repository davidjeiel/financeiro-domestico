#!/bin/sh
set -e

echo "Applying database migrations..."
./node_modules/.bin/drizzle-kit migrate

if [ "$NODE_ENV" = "development" ]; then
  echo "Starting server in development mode..."
  exec pnpm dev
else
  echo "Starting server in production mode..."
  exec node dist/index.js
fi
