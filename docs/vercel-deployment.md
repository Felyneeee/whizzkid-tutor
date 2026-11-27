# Vercel deployment

The root project is a Next.js application with Node.js API routes and MySQL/MariaDB. Deploy the app and its API routes as one Vercel project. Vercel does not host this app's MySQL database; use a managed MySQL/MariaDB provider with a network endpoint reachable from Vercel.

## Required services

- A production MySQL/MariaDB database with TLS enabled, backups configured, and a restricted application user.
- Upstash Redis with REST access for login and registration rate limits shared across Vercel instances.
- A Vercel project connected to this repository.

## Database setup

1. Create a production database and user. Grant only the privileges the app needs at runtime; do not use a database administrator account.
2. Import `database/mysql/schema.sql`.
3. Apply every SQL file in `database/mysql/migrations/` that is not already applied, in filename order. The application user does not have schema-alteration privileges.
4. Create the first administrator by running `npm run db:create-admin` with `DATABASE_URL` set to the production database URL. Do this only after the schema is current.
5. Confirm the database is reachable from Vercel and that `/api/health` returns `{"ok":true,"database":"whizzkids"}` after deployment.

Do not put the production database URL in source control or expose the database publicly without firewall/access controls. Use the provider's TLS connection settings in `DATABASE_URL`.

## Vercel project settings

Import the repository as a Next.js project using the root directory. Keep the default Next.js build settings (`npm run build`, output handled by Next.js). Add these environment variables to the Production environment:

- `DATABASE_URL`: production MySQL/MariaDB URL.
- `DB_CONNECTION_LIMIT`: per-instance pool size; start at `2` or `3` and check the database provider's connection cap.
- `UPSTASH_REDIS_REST_URL`: Upstash Redis HTTPS REST endpoint.
- `UPSTASH_REDIS_REST_TOKEN`: Upstash Redis REST token.
- `BOOKING_PENDING_TTL_HOURS` and `BOOKING_EXPIRY_WARNING_HOURS` only if changing their defaults.

The Redis variables are required in production. If either is missing or Redis is unreachable, authentication and registration fail with a service error rather than silently using per-instance rate limits.

## Before inviting users

1. Deploy a preview and check `/api/health`.
2. Create/sign in with the administrator account; test tutee registration, tutor registration including resume upload, login/logout, booking creation, and admin approval.
3. Confirm uploaded files and receipts work end to end. They are stored in MySQL, so keep payloads within the app's current limits.
4. Confirm the production domain uses HTTPS and the database rejects connections from unapproved sources.
5. Watch Vercel function errors, Redis usage, and database connection limits during the sample.

The app's writes serialize through the `application_state` row lock. This is workable for a small sample, but may limit throughput if many users submit changes at once. Rate limits are shared through Redis; the business data remains in MySQL.
