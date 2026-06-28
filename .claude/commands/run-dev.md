Start the full local development environment for this project.

## What this does

1. Starts Docker services (PostgreSQL + Mailpit) via `docker compose up -d db mailpit`
2. Starts the backend with ts-node-dev (hot-reload) in a background process
3. Starts the React frontend dev server in a background process
4. Prints the local URLs when everything is running

## Steps

Run the following in the project root:

```bash
# 1. Start infrastructure (DB + mail catcher)
docker compose up -d db mailpit

# 2. Start backend (hot-reload, runs on http://localhost:3000)
cd backend && npm run dev &

# 3. Start frontend (runs on http://localhost:3001)
cd frontend && npm start &
```

Wait ~10 s then open:
- **Storefront**: http://localhost:3001
- **Admin panel**: http://localhost:3001/admin/login  (admin@example.com / AdminPass1)
- **API docs (Swagger)**: http://localhost:3000/api-docs
- **Mailpit (email catcher)**: http://localhost:8025

## Stop dev environment

```bash
# Stop backend and frontend (kill background processes)
pkill -f "ts-node-dev" ; pkill -f "react-scripts"

# Stop Docker services
docker compose down
```

## Logs

- Backend logs: check the terminal running `npm run dev`
- Frontend logs: check the terminal running `npm start`
- DB logs: `docker compose logs db`
- Mailpit: open http://localhost:8025 in the browser

## Prerequisites

- Docker Desktop running
- `npm install` done in both `backend/` and `frontend/`
- `backend/.env` configured (copy from `backend/.env.example`)
- Prisma DB seeded: `cd backend && npx prisma migrate dev && npx prisma db seed`
