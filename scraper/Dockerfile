# One-shot scraper container — runs scrape.js then exits
# Used by: docker compose --profile scraper run --rm scraper
# Used by: Kubernetes CronJob (Phase 4)
FROM node:20-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Leverage layer caching for dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy scraper source files
COPY scrape.js   ./
COPY brands.js   ./

# Exit code 0 = success, 1 = fatal (K8s CronJob reads this)
CMD ["node", "scrape.js"]
