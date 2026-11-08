# XAMPP database setup

The app stores accounts and business records in relational MySQL/MariaDB tables. Server routes load the records needed by an action, validate and apply the action, and persist the changed rows in one transaction. `application_state` is retained only as an initialization marker and transaction lock; legacy JSON data is imported into the relational tables once.

## Local development setup

1. Start **MySQL** in the XAMPP Control Panel. Apache is not needed by Next.js.
2. Open phpMyAdmin at `http://localhost/phpmyadmin`.
3. Import [`schema.sql`](schema.sql). It creates the `whizzkids` database and tables, including `application_state` and `tutor_schedules`. Re-import it after an application update to create any newly added tables; existing rows are preserved.
   For an existing database, run [`20261102_add_tutor_checked_in_at.sql`](migrations/20261102_add_tutor_checked_in_at.sql) and [`20261109_booking_capacity_cycles.sql`](migrations/20261109_booking_capacity_cycles.sql) in phpMyAdmin before starting the updated app. The booking migration adds session type, cycle dates/allowance, pending expiration fields, and a shared tutor assignment key for paired Academic Group records.
4. In phpMyAdmin, create a database user named `whizzkids_app` restricted to `localhost`, with a strong password. Grant it only `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on the `whizzkids` database. Do not use the XAMPP `root` account from the app.
5. Copy the root `.env.example` to `.env.local` and replace `CHANGE_ME` with the database user's password. `.env.local` is ignored by Git. The connection module and `/api/health` endpoint are now in place.
6. Start the Next.js app with `npm run dev`, then visit `http://localhost:3000/api/health`. A successful connection returns `{"ok":true,"database":"whizzkids"}`.

Keep MySQL bound to localhost while developing. Do not expose port 3306 to the internet or forward it through your router. XAMPP is for development/testing; for a public deployment, move the database to a maintained, access-controlled host and configure encrypted connections, backups, and firewall rules.

Pending requests expire after `BOOKING_PENDING_TTL_HOURS` (default 72) and trigger an administrator warning within `BOOKING_EXPIRY_WARNING_HOURS` (default 12). Expiration is processed transactionally during business actions.

## Migration status

- [x] Add the MySQL/MariaDB schema and server-only database connection.
- [x] Move login/registration to server-side password hashing and secure sessions.
- [x] Move business actions and shared state reads/writes behind authenticated Next.js endpoints.
- [x] Import legacy localStorage data once when the administrator initializes server state.
- [x] Store business records in relational tables and migrate existing JSON state on first read.

## Authentication setup

The schema includes `auth_sessions` and `application_state`. Re-import `schema.sql` in phpMyAdmin to add these tables to an existing database; `CREATE TABLE IF NOT EXISTS` preserves existing rows. Then run `npm run db:create-admin` from the project folder in an interactive terminal. The script asks for the first admin account and hides password input. It refuses to run if an admin already exists.

New registrations and logins use MySQL, scrypt password hashes, and HTTP-only session cookies. Business actions are executed by server code and persisted under a MySQL row lock. When an administrator signs in and no shared state exists yet, the app imports that browser's previous state once, maps the old demo administrator to the MySQL administrator, removes plaintext passwords, and then deletes that browser copy. If the database has an older `application_state.state_json` payload, the app moves its records into relational tables and clears the payload. Apply the updated schema before starting the updated app so new tables are present.

The Supabase migrations remain in `database/supabase/migrations` as an alternate/future backend path; they are not applied to MySQL.
