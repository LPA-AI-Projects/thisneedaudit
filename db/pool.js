"use strict";

const { Pool } = require("pg");

function buildConnectionStringFromParts() {
  const host = process.env.PGHOST;
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD;
  const database = process.env.PGDATABASE;
  const port = process.env.PGPORT || "5432";

  if (!host || !user || !password || !database) return null;

  const encUser = encodeURIComponent(user);
  const encPass = encodeURIComponent(password);
  return `postgresql://${encUser}:${encPass}@${host}:${port}/${database}`;
}

function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL || buildConnectionStringFromParts();
  if (!url) {
    throw new Error(
      "Database is not configured. On the web app service Variables, add a " +
        "Reference to Postgres DATABASE_URL (or PGHOST, PGPORT, PGUSER, " +
        "PGPASSWORD, PGDATABASE)."
    );
  }
  return url;
}

function createPool() {
  const connectionString = requireDatabaseUrl();
  const host = process.env.PGHOST || "";
  const isPrivate =
    host.includes(".railway.internal") ||
    connectionString.includes(".railway.internal");
  const isRailway =
    Boolean(process.env.RAILWAY_ENVIRONMENT) ||
    connectionString.includes("railway") ||
    connectionString.includes("rlwy.net") ||
    isPrivate;

  // Private network Postgres usually does not need SSL; public proxy often does.
  const useSsl = isRailway && !isPrivate
    ? { rejectUnauthorized: false }
    : process.env.PGSSLMODE === "require"
      ? { rejectUnauthorized: false }
      : undefined;

  return new Pool({
    connectionString,
    ssl: useSsl,
    max: 10,
    idleTimeoutMillis: 30000,
  });
}

let pool;

function getPool() {
  if (!pool) pool = createPool();
  return pool;
}

module.exports = { getPool, requireDatabaseUrl };
