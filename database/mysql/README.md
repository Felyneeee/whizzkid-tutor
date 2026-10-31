# XAMPP database setup

The app uses MySQL/MariaDB for account data and shared business state. Next.js server routes enforce authentication and role checks before applying business actions. Business state is stored as a JSON document in `application_state`; account and profile data use relational tables.

## Local development setup

1. Start **MySQL** in the XAMPP Control Panel. Apache is not needed by Next.js.
2. Open phpMyAdmin at `http://localhost/phpmyadmin`.
3. Import [`schema.sql`](schema.sql). It creates the `whizzkids` database and tables, including `application_state`.
4. In phpMyAdmin, create a database user named `whizzkids_app` restricted to `localhost`, with a strong password. Grant it only `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on the `whizzkids` database. Do not use the XAMPP `root` account from the app.
5. Copy the root `.env.example` to `.env.local` and replace `CHANGE_ME` with the database user's password. `.env.local` is ignored by Git. The connection module and `/api/health` endpoint are now in place.
6. Start the Next.js app with `npm run dev`, then visit `http://localhost:3000/api/health`. A successful connection returns `{"ok":true,"database":"whizzkids"}`.

Keep MySQL bound to localhost while developing. Do not expose port 3306 to the internet or forward it through your router. XAMPP is for development/testing; for a public deployment, move the database to a maintained, access-controlled host and configure encrypted connections, backups, and firewall rules.

## Migration status

- [x] Add the MySQL/MariaDB schema and server-only database connection.
- [x] Move login/registration to server-side password hashing and secure sessions.
- [x] Move business actions and shared state reads/writes behind authenticated Next.js endpoints.
- [x] Import legacy localStorage data once when the administrator initializes server state.
- [ ] Replace the JSON state document with fully normalized transactional tables as the next database refinement.

## Authentication setup

The schema includes `auth_sessions` and `application_state`. Re-import `schema.sql` in phpMyAdmin to add these tables to an existing database; `CREATE TABLE IF NOT EXISTS` preserves existing rows. Then run `npm run db:create-admin` from the project folder in an interactive terminal. The script asks for the first admin account and hides password input. It refuses to run if an admin already exists.

New registrations and logins use MySQL, scrypt password hashes, and HTTP-only session cookies. Business actions are executed by server code and persisted under a MySQL row lock. When an administrator signs in and no shared state exists yet, the app imports that browser's previous state once, maps the old demo administrator to the MySQL administrator, removes plaintext passwords, and then deletes that browser copy.

The Supabase migrations remain in `database/supabase/migrations` as an alternate/future backend path; they are not applied to MySQL.
