# ── build stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── dev stage ──────────────────────────────────────────────────────────────────
FROM node:20-alpine AS dev
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY tsconfig.json ./
# src/ is bind-mounted at runtime for hot-reload; copy here only as fallback
COPY src ./src
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
