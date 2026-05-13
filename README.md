# Virtueel-Queer-Museum-Backend

## Security configuration

Set these environment variables before running the stack in anything other than local development:

- `DB_PASS`
- `DB_ROOTPASS`
- `APP_AUTH_USERNAME`
- `APP_AUTH_PASSWORD`
- `APP_JWT_SECRET`

The compose file includes non-secret defaults so the project still runs locally, but those values should be replaced for any shared or deployed environment.