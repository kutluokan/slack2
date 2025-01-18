# Build stage
FROM node:22-alpine as builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Create uploads directory with proper permissions
RUN mkdir -p /app/uploads && \
    chown -R node:node /app && \
    chmod -R 755 /app && \
    chmod 777 /app/uploads && \
    chown -R node:node /app/uploads

# Switch to non-root user
USER node

EXPOSE 4000
CMD ["npm", "start"]