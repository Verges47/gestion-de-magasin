FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV RAILWAY_ENVIRONMENT=1
ENV VITE_API_URL=/api
RUN npm run build

FROM php:8.2-cli
RUN docker-php-ext-install pdo pdo_mysql mysqli
WORKDIR /var/www/html
COPY --from=build /app/dist/ ./
COPY api/ ./api/
COPY router.php ./router.php
CMD ["sh", "-c", "php -S 0.0.0.0:${PORT:-8080} -t /var/www/html /var/www/html/router.php"]
