FROM node:24-alpine AS production

# Set working directory inside container
WORKDIR /usr/src/app

# Set NODE_ENV to production for optimization
ENV NODE_ENV=production

# Copy package.json and package-lock.json first to leverage Docker layer caching
COPY package*.json ./

# npm ci installs exactly what package-lock.json pins (reproducible builds);
# --omit=dev keeps jest/eslint/nodemon out of the production image
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source code — owned by root and therefore read-only for the
# runtime user, so a compromised process cannot modify the app code
COPY src ./src
COPY seed.js ./

# Drop root: the official node image ships an unprivileged "node" user (UID 1000)
USER node

# Expose API port
EXPOSE 5000

# Container-level liveness check (used by Docker / Compose; K8s uses its own probes)
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

# Start server — exec form so node is PID 1 and receives SIGTERM directly
CMD ["node", "src/server.js"]
