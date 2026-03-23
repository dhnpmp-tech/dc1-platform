# DC1 Health Check & Monitoring Service
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache curl

COPY package.json ./
RUN npm ci --only=production

COPY app.js ./
COPY checks/ ./checks/

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:9090/health || exit 1

EXPOSE 9090

ENV NODE_ENV=production

CMD ["node", "app.js"]
