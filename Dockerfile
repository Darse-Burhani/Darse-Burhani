# ── Hugging Face Spaces Production Dockerfile for Darse Burhani Backend ──
FROM node:20-slim

# Install system dependencies (OpenSSL for Prisma, fonts for Arabic/PDF, procps)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    curl \
    fonts-liberation \
    fontconfig \
    && rm -rf /var/lib/apt/lists/*

# Hugging Face runs containers under user with UID 1000
RUN useradd -m -u 1000 appuser

WORKDIR /app

# Copy package manifests
COPY package.json package-lock.json ./
COPY server/package.json ./server/

# Install dependencies
RUN npm ci --workspace=@darse-burhani/server --include-workspace-root

# Copy server source code and prisma schema
COPY server/ ./server/

# Generate Prisma Client & Build Server
WORKDIR /app/server
RUN npx prisma generate
RUN npm run build

# Change ownership to appuser (UID 1000 for Hugging Face)
RUN chown -R appuser:appuser /app

USER appuser

# Hugging Face Spaces listens on port 7860
ENV PORT=7860
ENV NODE_ENV=production
EXPOSE 7860

# Start server
CMD ["node", "dist/index.js"]
