FROM php:8.2-apache

RUN docker-php-ext-install pdo pdo_mysql mysqli

RUN a2enmod rewrite

RUN { \
	echo 'file_uploads=On'; \
	echo 'upload_max_filesize=50M'; \
	echo 'post_max_size=60M'; \
	echo 'max_file_uploads=20'; \
} > /usr/local/etc/php/conf.d/uploads.ini