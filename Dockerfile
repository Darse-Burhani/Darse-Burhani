# ── Production Dockerfile for Darse Burhani Backend (Northflank / Cloud) ──
FROM node:20-slim

# Install system dependencies (OpenSSL for Prisma, fonts for Arabic/PDF, ca-certificates, curl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    curl \
    fonts-liberation \
    fontconfig \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package manifests
COPY package.json package-lock.json ./
COPY server/package.json ./server/

# Install dependencies
RUN npm ci --workspace=@darse-burhani/server --include-workspace-root

# Copy prisma schema, scripts, and server source code
COPY prisma/ ./prisma/
COPY scripts/ ./scripts/
COPY server/ ./server/

# Generate Prisma Client (uses prisma/schema.prisma)
RUN npx prisma generate --schema=prisma/schema.prisma

# Build Server (Vite SSR bundle -> dist/index.js)
WORKDIR /app/server
RUN npm run build

WORKDIR /app

# Default environment variables
ENV PORT=7860
ENV NODE_ENV=production
EXPOSE 7860

# Start server
CMD ["node", "server/dist/index.js"]
