"use strict";

const fs = require("fs");
const path = require("path");
const { getPool } = require("./pool");

async function migrate() {
  const schemaPath = path.join(__dirname, "..", "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  const pool = getPool();

  console.log("Running PostgreSQL migrations...");
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log("Migrations complete: learners, attempts, responses, session_control");
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  migrate().catch((err) => {
    console.error("Migration failed:", err.message);
    process.exit(1);
  });
}

module.exports = { migrate };
