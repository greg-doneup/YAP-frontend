# Stage 0, "build-stage", based on Node.js, to build and compile the frontend
FROM node:18.19-alpine AS build-stage
WORKDIR /app

# Copy package files and npm config for dependency installation
COPY package.json ./
COPY package-lock.json ./
COPY .npmrc ./

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy source code and configuration files
COPY src/ ./src/
COPY angular.json ./
COPY tsconfig.app.json ./
COPY tsconfig.json ./
COPY ionic.config.json ./

# Build with the production configuration
RUN npx ng build --configuration production --output-hashing all

# Stage 1: Run app with nginx
FROM nginx:alpine as prod-stage
COPY --from=build-stage /app/www /usr/share/nginx/html
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
ENTRYPOINT ["nginx","-g","daemon off;"]