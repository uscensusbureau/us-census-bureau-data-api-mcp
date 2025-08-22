FROM node:20-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm ci --silent
COPY . .
RUN ls -la data/ || echo "No data directory found in source"
RUN npm run build
CMD ["sh", "-c", "npm run migrate:up"]

# Production Environment
FROM node:20-slim AS prod
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --silent
COPY --from=dev /app/dist ./dist
COPY --from=dev /app/data ./data
CMD ["sh", "-c", "npm run migrate:up && npm run seed:prod"]