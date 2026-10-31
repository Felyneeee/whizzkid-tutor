import { randomBytes, scrypt as scryptCallback, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { createInterface, emitKeypressEvents } from "node:readline";
import mysql from "mysql2/promise";

const scrypt = promisify(scryptCallback);

async function readDatabaseUrl() {
  const envText = await readFile(new URL("../.env.local", import.meta.url), "utf8");
  const match = envText.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/m);
  if (!match) throw new Error("DATABASE_URL is missing from .env.local.");
  return match[1].replace(/^['"]|['"]$/g, "");
}

function promptLine(label) {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => terminal.question(label, (answer) => {
    terminal.close();
    resolve(answer.trim());
  }));
}

function promptHidden(label) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error("Run this command in an interactive terminal so the password can be entered privately.");
  }
  process.stdout.write(label);
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const cleanup = () => {
      process.stdin.off("keypress", onKeypress);
      process.stdin.setRawMode(false);
      process.stdout.write("\n");
    };
    const onKeypress = (character, key = {}) => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new Error("Cancelled."));
      } else if (key.name === "return" || key.name === "enter") {
        cleanup();
        resolve(value);
      } else if (key.name === "backspace") {
        value = value.slice(0, -1);
      } else if (character && !key.ctrl && !key.meta) {
        value += character;
      }
    };
    process.stdin.on("keypress", onKeypress);
  });
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${Buffer.from(derived).toString("hex")}`;
}

let pool;
try {
  const databaseUrl = await readDatabaseUrl();
  pool = mysql.createPool({ uri: databaseUrl, connectionLimit: 2, charset: "utf8mb4" });
  const [existing] = await pool.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (existing.length) throw new Error("An admin account already exists; bootstrap stopped without changes.");

  const email = (await promptLine("Admin email: ")).toLowerCase();
  const username = await promptLine("Admin username: ");
  const password = await promptHidden("Admin password (12+ characters; input hidden): ");
  const confirmation = await promptHidden("Confirm admin password: ");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("Enter a valid email address.");
  if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username)) throw new Error("Username must be 3–32 characters using letters, numbers, _ or -.");
  if (password.length < 12 || password.length > 128) throw new Error("Password must be between 12 and 128 characters.");
  if (password !== confirmation) throw new Error("Passwords do not match.");

  const passwordHash = await hashPassword(password);
  await pool.execute(
    "INSERT INTO users (id, role, email, username, password_hash) VALUES (?, 'admin', ?, ?, ?)",
    [randomUUID(), email, username, passwordHash],
  );
  process.stdout.write("Admin account created. You can now log in with this account.\n");
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
} finally {
  await pool?.end();
}
