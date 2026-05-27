FROM php:8.2-apache

RUN docker-php-ext-install pdo pdo_mysql mysqli

RUN a2enmod rewrite

RUN { \
	echo 'file_uploads=On'; \
	echo 'upload_max_filesize=50M'; \
	echo 'post_max_size=60M'; \
	echo 'max_file_uploads=20'; \
} > /usr/local/etc/php/conf.d/uploads.ini

RUN a2enmod headers
RUN sed -i '/<Directory \/var\/www\/>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf

RUN echo '<Directory "/var/www/html">\n\
    Header set Access-Control-Allow-Origin "*"\n\
    Header set Access-Control-Allow-Methods "GET, POST, OPTIONS, DELETE, PUT"\n\
    Header set Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization"\n\
    Header set Access-Control-Expose-Headers "Content-Length,Content-Range"\n\
</Directory>' >> /etc/apache2/conf-available/cors.conf \
    && a2enconf cors