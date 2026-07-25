# Stage 1: Production Base Image
FROM node:20-alpine AS production

# Set working directory inside container
WORKDIR /usr/src/app

# Set NODE_ENV to production for optimization
ENV NODE_ENV=production

# Copy package.json and package-lock.json first to leverage Docker layer caching
COPY package*.json ./

# Install only production dependencies cleanly
RUN npm ci --only=production

# Copy application source code
COPY src ./src
COPY seed.js ./

# Expose API port
EXPOSE 5000

# Start server
CMD ["node", "src/server.js"]
