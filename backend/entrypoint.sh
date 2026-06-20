#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set. Create backend/.env.docker from backend/.env.example."
  exit 1
fi

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Running seed (skipped if data exists)..."
npx prisma db seed || true

echo "Starting dev server..."
exec npm run dev
