# Development/Test stage - includes all dependencies
FROM node:20-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm ci --silent
COPY . .
CMD ["npm", "run", "migrate:up"]

# Production stage - only production dependencies
FROM node:20-slim AS prod
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --silent
COPY . .
CMD ["npm", "run", "migrate:up"]