# Multi-stage production build for Node.js enterprise backend
FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Non-root security user
USER node

EXPOSE 3001
ENV NODE_ENV=production
ENV PORT=3001

CMD ["node", "index.js"]
