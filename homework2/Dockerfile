# Build stage - install all dependencies and build both frontend and backend
FROM node:20-slim AS builder

WORKDIR /app

# Install pnpm (use specific version matching package.json)
RUN npm install -g pnpm@10.15.1

# Copy workspace configuration files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY frontend/ ./frontend/
COPY backend/ ./backend/

# Build frontend (static files)
RUN pnpm --filter codeview-frontend build

# Build backend
RUN pnpm --filter codeview-backend build

# Production stage
FROM node:20-slim AS production

WORKDIR /app

# Install pnpm (use specific version matching package.json)
RUN npm install -g pnpm@10.15.1

# Copy workspace configuration for production install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json ./backend/

# Install only backend production dependencies
RUN pnpm install --frozen-lockfile --prod --filter codeview-backend

# Copy backend build
COPY --from=builder /app/backend/dist ./backend/dist

# Copy frontend build (static files served by backend)
COPY --from=builder /app/frontend/build ./frontend/build

# Expose single port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV FRONTEND_PATH=/app/frontend/build

WORKDIR /app/backend

# Start the server
CMD ["node", "dist/index.js"]
