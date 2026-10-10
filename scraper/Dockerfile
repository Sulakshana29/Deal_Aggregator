# One-shot scraper container — runs scrape.js then exits
# Used by: docker compose --profile scraper run --rm scraper
# Used by: Kubernetes CronJob
FROM node:24-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Leverage layer caching for dependencies; npm ci = exact lockfile versions
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy scraper source files (root-owned → read-only for the runtime user)
COPY scrape.js   ./
COPY brands.js   ./

# Run as the unprivileged "node" user (UID 1000)
USER node

# Exit code 0 = success, 1 = fatal (K8s CronJob reads this)
CMD ["node", "scrape.js"]
