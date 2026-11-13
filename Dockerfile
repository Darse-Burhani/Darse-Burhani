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

# Copy package manifests & prisma & scripts needed for dependency resolution
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/
COPY prisma/ ./prisma/
COPY scripts/ ./scripts/

# Install server workspace dependencies (--ignore-scripts avoids premature postinstall)
RUN npm ci --workspace=@darse-burhani/server --include-workspace-root --ignore-scripts

# Generate Prisma Client explicitly
RUN npx prisma generate --schema=prisma/schema.prisma

# Copy server source code and config
COPY server/ ./server/

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
