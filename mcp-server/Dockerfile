FROM node:22.12-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.docker.json ./tsconfig.json

# Install all dependencies (including dev for building)
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts

COPY src/ ./src/

#Check Source Files
RUN echo "=== Source files ===" && find . -name "*.ts" -type f

# Build the project
RUN npm run build

# Debug: Check build output
RUN echo "=== Build output ===" && ls -la dist/ || echo "No dist directory"
RUN echo "=== All dist files ===" && find dist -type f || echo "No files in dist"

FROM node:22.12-alpine AS release

WORKDIR /app

# Copy built artifacts and package files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Debug: Check copied files
RUN echo "=== Copied dist files ===" && ls -la dist/ || echo "No dist directory in release"
RUN echo "=== Looking for index.js ===" && ls -la dist/index.js || echo "index.js not found"

ENV NODE_ENV=production

# Install only production dependencies
RUN npm ci --ignore-scripts --omit-dev

ENTRYPOINT ["node", "dist/index.js"]