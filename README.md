# Whizzkids Academic Center

Setup: `npm install`, configure `.env.local` from `.env.example`, then `npm run dev`.

The app uses Next.js server routes running on Node.js for login, registration, and business actions. MySQL/MariaDB stores account credentials, profiles, sessions, and the shared application state. Booking, scheduling, approvals, messaging, materials, and payroll changes are checked and applied on the server.

Business state is currently stored as one JSON document in the MySQL `application_state` table and updated in a transaction. User accounts and profiles use relational tables. On the first administrator login, legacy browser data is imported once into MySQL and the browser copy is removed. Import `database/mysql/schema.sql`, create the restricted database user, and follow [`database/mysql/README.md`](database/mysql/README.md) to finish setup and create the first administrator.

The Supabase migrations in `database/supabase/migrations` are retained as a future backend option but are not connected.

`whizzkids.db` is a separate SQLite database and is not connected to the app.
