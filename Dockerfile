# Stage 1: Build the React Frontend
FROM node:20-alpine AS builder

WORKDIR /app
COPY client/package*.json ./client/
RUN cd client && npm ci

COPY client/ ./client/
RUN cd client && npm run build

# Stage 2: Setup Production Server
FROM node:20-alpine

WORKDIR /app

# Copy and install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy server source code
COPY server/ ./server/

# Copy built frontend from Stage 1
COPY --from=builder /app/client/dist ./client/dist

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

WORKDIR /app/server
CMD ["node", "index.js"]
