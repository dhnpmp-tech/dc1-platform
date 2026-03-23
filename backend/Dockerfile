# DC1 Backend API — Express + Node.js Production

FROM node:20-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache curl tini

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src
COPY scripts ./scripts

# Create logs directory
RUN mkdir -p logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
  CMD curl -f http://localhost:8083/health || exit 1

EXPOSE 8083

ENV NODE_ENV=production
ENV LOG_LEVEL=info

# Use tini to handle signals properly
ENTRYPOINT ["/sbin/tini", "--"]

CMD ["npm", "start"]
