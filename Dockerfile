FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV RAILWAY_ENVIRONMENT=1
ENV VITE_API_URL=/api
RUN npm run build

FROM php:8.2-apache
RUN docker-php-ext-install pdo pdo_mysql mysqli && a2enmod rewrite
COPY --from=build /app/dist/ /var/www/html/
COPY api/ /var/www/html/api/
COPY spa.htaccess /var/www/html/.htaccess

RUN echo '<Directory /var/www/html>' > /etc/apache2/conf-available/docroot.conf \
    && echo '    AllowOverride All' >> /etc/apache2/conf-available/docroot.conf \
    && echo '</Directory>' >> /etc/apache2/conf-available/docroot.conf \
    && a2enconf docroot

CMD ["sh", "-c", "sed -i \"s/Listen 80/Listen ${PORT:-80}/\" /etc/apache2/ports.conf && sed -i \"s/:80>/:${PORT:-80}>/\" /etc/apache2/sites-enabled/000-default.conf && apache2-foreground"]
