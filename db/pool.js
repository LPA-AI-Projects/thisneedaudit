"use strict";

const { Pool } = require("pg");

function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. In Railway, link the Postgres service to this app " +
        "so DATABASE_URL is available (Variables → Reference → Postgres DATABASE_URL)."
    );
  }
  return url;
}

function createPool() {
  const connectionString = requireDatabaseUrl();
  const isRailway =
    Boolean(process.env.RAILWAY_ENVIRONMENT) ||
    connectionString.includes("railway") ||
    connectionString.includes("rlwy.net");

  return new Pool({
    connectionString,
    ssl: isRailway || process.env.PGSSLMODE === "require"
      ? { rejectUnauthorized: false }
      : undefined,
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
