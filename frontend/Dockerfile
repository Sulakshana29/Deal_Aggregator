# Stage 1: Build React/Vite bundle
FROM node:24-alpine AS builder

WORKDIR /app

# npm ci = install exactly what package-lock.json pins (reproducible builds)
COPY package*.json ./
RUN npm ci

# Copy source code and run production build
COPY . .
RUN npm run build

# Stage 2: Serve bundle using the unprivileged Nginx image.
# It runs as the "nginx" user (UID 101) instead of root, which means it cannot
# bind to ports < 1024 — so it listens on 8080 (see nginx.conf).
FROM nginxinc/nginx-unprivileged:1.27-alpine AS production

# Copy built static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx routing & proxy config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Unprivileged HTTP port
EXPOSE 8080

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
