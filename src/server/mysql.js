import "server-only";
import mysql from "mysql2/promise";
const globalForMysql = globalThis;
function createPool() {
    const url = process.env.DATABASE_URL;
    if (!url)
        throw new Error("DATABASE_URL is not configured.");
    return mysql.createPool({
        uri: url,
        waitForConnections: true,
        connectionLimit: 10,
        maxIdle: 10,
        idleTimeout: 60000,
        queueLimit: 0,
        enableKeepAlive: true,
        charset: "utf8mb4",
        dateStrings: true,
    });
}
export const mysqlPool = globalForMysql.whizzkidsMysqlPool ?? createPool();
if (process.env.NODE_ENV !== "production") {
    globalForMysql.whizzkidsMysqlPool = mysqlPool;
}
