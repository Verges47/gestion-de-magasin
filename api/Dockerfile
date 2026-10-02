FROM php:8.2-apache

RUN docker-php-ext-install pdo pdo_mysql mysqli

COPY . /var/www/html/

RUN echo '<Directory /var/www/html>' > /etc/apache2/conf-available/docroot.conf \
    && echo '    AllowOverride All' >> /etc/apache2/conf-available/docroot.conf \
    && echo '</Directory>' >> /etc/apache2/conf-available/docroot.conf \
    && a2enconf docroot

CMD sh -c "sed -i \"s/80/\$PORT/g\" /etc/apache2/ports.conf /etc/apache2/sites-enabled/000-default.conf && apache2-foreground"
