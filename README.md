# Whizzkids Academic Center

Setup: `npm install`, configure `.env.local` from `.env.example`, then `npm run dev`.

The app uses Next.js server routes running on Node.js for login, registration, and business actions. MySQL/MariaDB stores account credentials, profiles, bookings, scheduling, approvals, messaging, materials, payroll, and other application records in relational tables. Actions are checked and persisted transactionally on the server.

The MySQL `application_state` row is retained as an initialization marker and transaction lock; it is no longer the store for business records. On first read, older JSON-backed state is migrated into relational tables. On the first administrator login, legacy browser data is imported once into MySQL and the browser copy is removed. Import `database/mysql/schema.sql`, create the restricted database user, and follow [`database/mysql/README.md`](database/mysql/README.md) to finish setup and create the first administrator.

The Supabase migrations in `database/supabase/migrations` are retained as a future backend option but are not connected.

`whizzkids.db` is a separate SQLite database and is not connected to the app.

## Repository layout and current limits

The active Next.js app is the root `src/` tree, configured by the root `package.json`. `repo-update/` is a historical TypeScript snapshot retained for comparison; it is not imported, built, or run by the root app. Make active app changes in root `src/` unless the migration plan explicitly changes this layout.

The implemented purchase flow covers center-settled shop orders: a tutee submits an order, an administrator marks it `paid` after collecting payment, then marks it `released` after handing over the items. This app does not take online payments. Tutorial and assessment fees are calculated and displayed, but there is no payment collection, receipt, refund, or cancellation-refund workflow in the app; those are handled operationally by the center.

Tutorial booking requests reserve their requested slots while awaiting admin review, with no automatic expiration. Admins may confirm a tutor for all dates or allow a partial match; dates the tutor cannot cover are removed from that booking. The app does not yet provide a tutee cancellation flow for a submitted tutorial request or define refunds for any center-collected payments.

Notifications currently appear in the app. `email` and `sms` values attached to notifications describe intended channels only; no email or SMS provider is configured, so those messages are not sent externally.

Supabase migrations are an unconnected future-backend artifact. `whizzkids.db` is a disconnected SQLite file; MySQL/MariaDB is the active database.

The `lint` script uses Next.js's ESLint integration, but the root package currently does not include ESLint or an ESLint configuration. Install and configure ESLint before relying on that script.
