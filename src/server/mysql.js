import "server-only";
import mysql from "mysql2/promise";
const globalForMysql = globalThis;
function createPool() {
    const url = process.env.DATABASE_URL;
    if (!url)
        throw new Error("DATABASE_URL is not configured.");
    const configuredLimit = Number.parseInt(process.env.DB_CONNECTION_LIMIT || "3", 10);
    const connectionLimit = Number.isInteger(configuredLimit) ? Math.min(10, Math.max(1, configuredLimit)) : 3;
    return mysql.createPool({
        uri: url,
        waitForConnections: true,
        connectionLimit,
        maxIdle: Math.min(1, connectionLimit),
        idleTimeout: 60000,
        // Bound queued requests so DB saturation cannot grow the process queue
        // without limit. Tune together with the host's worker count.
        queueLimit: 100,
        enableKeepAlive: true,
        charset: "utf8mb4",
        dateStrings: true,
    });
}
export const mysqlPool = globalForMysql.whizzkidsMysqlPool ?? createPool();
if (process.env.NODE_ENV !== "production") {
    globalForMysql.whizzkidsMysqlPool = mysqlPool;
}
