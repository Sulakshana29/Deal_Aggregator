# Stage 1: Build React/Vite bundle
FROM node:24-alpine AS builder

WORKDIR /app

# Install dependencies using package-lock for reproducible builds
COPY package*.json ./
RUN npm install

# Copy source code and run production build
COPY . .
RUN npm run build

# Stage 2: Serve bundle using lightweight Nginx
FROM nginx:alpine AS production

# Clean out default nginx HTML
RUN rm -rf /usr/share/nginx/html/*

# Copy built static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx routing & proxy config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
