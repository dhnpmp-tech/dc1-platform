# DCP Backend API — Express + Node.js Production

FROM node:20-alpine

WORKDIR /app

# System dependencies:
# - curl/tini: health check + signal handling
# - python3/make/g++: required to compile better-sqlite3 native module on Alpine
RUN apk add --no-cache curl tini python3 make g++

# Copy package files
COPY package*.json ./

# Install production dependencies (better-sqlite3 compiles here)
RUN npm ci --only=production

# Copy source code
COPY src ./src
COPY scripts ./scripts

# Create logs directory
RUN mkdir -p logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
  CMD curl -f http://localhost:8083/api/health || exit 1

EXPOSE 8083

ENV NODE_ENV=production
ENV LOG_LEVEL=info

# Use tini to handle signals properly
ENTRYPOINT ["/sbin/tini", "--"]

CMD ["npm", "start"]
