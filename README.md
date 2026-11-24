# Whizzkids Academic Center

Setup: `npm install`, configure `.env.local` from `.env.example`, then `npm run dev`.

The app uses Next.js server routes running on Node.js for login, registration, and business actions. MySQL/MariaDB stores account credentials, profiles, bookings, scheduling, approvals, messaging, materials, and other application records in relational tables. Actions are checked and persisted transactionally on the server.

The MySQL `application_state` row is retained as an initialization marker and transaction lock; it is no longer the store for business records. On first read, older JSON-backed state is migrated into relational tables. On the first administrator login, legacy browser data is imported once into MySQL and the browser copy is removed. Import `database/mysql/schema.sql`, create the restricted database user, and follow [`database/mysql/README.md`](database/mysql/README.md) to finish setup and create the first administrator.

The Supabase migrations in `database/supabase/migrations` are retained as a future backend option but are not connected.

`whizzkids.db` is a separate SQLite database and is not connected to the app.

## Repository layout and current limits

The active Next.js app is the root `src/` tree, configured by the root `package.json`. `repo-update/` is a historical TypeScript snapshot retained for comparison; it is not imported, built, or run by the root app. Make active app changes in root `src/` unless the migration plan explicitly changes this layout.

The shop purchase flow is disabled. Program bookings can still accept payment receipts for administrator review; this app does not take online payments.

Tutorial booking requests reserve their requested slots while awaiting admin review, with no automatic expiration. Admins may confirm a tutor for all dates or allow a partial match; dates the tutor cannot cover are removed from that booking. The app does not yet provide a tutee cancellation flow for a submitted tutorial request or define refunds for any center-collected payments.

Notifications currently appear in the app. `email` and `sms` values attached to notifications describe intended channels only; no email or SMS provider is configured, so those messages are not sent externally.

Supabase migrations are an unconnected future-backend artifact. `whizzkids.db` is a disconnected SQLite file; MySQL/MariaDB is the active database.

## Production operations and limits

Login is limited to five failed attempts per account identifier per 15 minutes and 100 failed attempts per IP per 15 minutes. Each registration route is limited to 10 attempts per IP per hour. These throttles are process-local and are suitable only when this app runs as one persistent Node.js server process. For a multi-instance or serverless deployment, replace them with a shared rate-limit store. When deployed behind a reverse proxy, configure it to overwrite `X-Real-IP` or `X-Forwarded-For`; the application uses those headers to group attempts.

Read-only app state requests use a consistent database snapshot and do not take the application-wide write lock. Business updates still lock and load the shared application state to preserve booking and scheduling consistency. This can limit write throughput as records and concurrent traffic grow; measure load and plan a transition to narrower, domain-level transactions before scaling.

Production responses include baseline browser security headers and a Content Security Policy. The policy permits inline scripts for Next.js hydration, so it is not a strict nonce-based CSP. Deploy behind HTTPS, keep MySQL private, configure backups and monitoring, and review the hosting proxy's request-size and rate limits before opening the app to public traffic.

