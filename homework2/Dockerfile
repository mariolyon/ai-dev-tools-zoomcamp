# Build stage for backend
FROM node:20-slim AS backend-builder

WORKDIR /app/backend

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy backend package files
COPY backend/package.json backend/pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy backend source
COPY backend/ ./

# Build backend
RUN pnpm build

# Build stage for frontend
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy frontend package files
COPY frontend/package.json frontend/pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy frontend source
COPY frontend/ ./

# Set build-time environment variables for the frontend
# These will be baked into the build - use empty strings as defaults
# The actual values should be set at build time via --build-arg
ARG PUBLIC_API_URL=""
ARG PUBLIC_WS_URL=""
ENV PUBLIC_API_URL=$PUBLIC_API_URL
ENV PUBLIC_WS_URL=$PUBLIC_WS_URL

# Build frontend
RUN pnpm build

# Production stage
FROM node:20-slim AS production

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy backend build and dependencies
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/backend/package.json ./backend/

# Copy frontend build and dependencies
COPY --from=frontend-builder /app/frontend/build ./frontend/build
COPY --from=frontend-builder /app/frontend/node_modules ./frontend/node_modules
COPY --from=frontend-builder /app/frontend/package.json ./frontend/

# Copy start script
COPY start.sh ./
RUN chmod +x start.sh

# Expose ports
# Backend API + WebSocket
EXPOSE 3001
# Frontend
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV ORIGIN=http://localhost:3000

# Start both services
CMD ["./start.sh"]
