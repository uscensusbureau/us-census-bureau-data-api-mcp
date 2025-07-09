FROM node:20-alpine
WORKDIR /app

# Copy built artifacts and package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev --silent

# Copy Migration Files Over
COPY . .

# Run the Migrations
CMD ["npm", "run", "migrate:up"]