# Whizzkids Academic Center

Setup: `npm install`, configure `.env.local` from `.env.example`, then `npm run dev`.

The app uses Next.js server routes running on Node.js for login, registration, and business actions. MySQL/MariaDB stores account credentials, profiles, bookings, scheduling, approvals, messaging, materials, payroll, and other application records in relational tables. Actions are checked and persisted transactionally on the server.

The MySQL `application_state` row is retained as an initialization marker and transaction lock; it is no longer the store for business records. On first read, older JSON-backed state is migrated into relational tables. On the first administrator login, legacy browser data is imported once into MySQL and the browser copy is removed. Import `database/mysql/schema.sql`, create the restricted database user, and follow [`database/mysql/README.md`](database/mysql/README.md) to finish setup and create the first administrator.

The Supabase migrations in `database/supabase/migrations` are retained as a future backend option but are not connected.

`whizzkids.db` is a separate SQLite database and is not connected to the app.
