<?php

function envValue(string $name, string $default): string
{
	$value = getenv($name);
	if ($value === false || $value === '') {
		return $default;
	}

	return $value;
}

$DB_HOST = envValue('DB_HOST', 'mysql');
$DB = envValue('DB_NAME', 'cms');
$USER = envValue('DB_USER', 'cms_user');
$PASS = envValue('DB_PASS', 'change-me-db-password');
$ROOTPASS = envValue('DB_ROOTPASS', 'change-me-root-password');

$AUTH_USERNAME = envValue('APP_AUTH_USERNAME', 'admin');
$AUTH_PASSWORD = envValue('APP_AUTH_PASSWORD', 'change-me-admin-password');
$AUTH_PASSWORD_HASH = envValue('APP_AUTH_PASSWORD_HASH', '');
$JWT_SECRET = envValue('APP_JWT_SECRET', 'change-me-jwt-secret');

// Controls whether uploaded images are publicly available without auth.
// Set to '0' to require a valid token to view uploads.
$UPLOADS_PUBLIC = envValue('APP_UPLOADS_PUBLIC', '1');

// Enable verbose upload/debug logging (set to '1' in development only).
$APP_DEBUG_UPLOADS = envValue('APP_DEBUG_UPLOADS', '0');

?>