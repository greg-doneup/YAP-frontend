# Stage 0, "build-stage", based on Node.js, to build and compile the frontend
FROM node:18.19-alpine AS build-stage
WORKDIR /app

COPY package.json ./
COPY .npmrc ./
RUN npm install && npm install -g @angular/cli@14.2.12

# Copy only what's needed for the build
COPY src/ ./src/
COPY angular.json ./
COPY tsconfig.app.json ./
COPY tsconfig.json ./
COPY tailwind.config.js ./
COPY postcss.config.js ./

# Build with the production configuration
RUN ng build --configuration production --output-hashing all
RUN rm -f .npmrc

# Stage 1: Run app
FROM nginx:alpine as prod-stage
COPY --from=build-stage /app/www /usr/share/nginx/html
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
ENTRYPOINT ["nginx","-g","daemon off;"]