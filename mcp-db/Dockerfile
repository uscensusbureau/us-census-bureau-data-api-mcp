FROM node:20-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm ci --silent
COPY . .
RUN npm run build
CMD ["sh", "-c", "npm run migrate:up"]

# Production Environment
FROM node:20-slim AS prod
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --silent
COPY . .
CMD ["sh", "-c", "npm run migrate:up"]
