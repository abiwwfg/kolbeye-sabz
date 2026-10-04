"use strict";

const { Pool } = require("pg");

const isProduction =
    process.env.NODE_ENV === "production";

/* =========================================================
   DATABASE URL
========================================================= */

const databaseUrl =
    process.env.DATABASE_URL;

let cleanDatabaseUrl =
    databaseUrl;

if (cleanDatabaseUrl) {
    try {
        const url =
            new URL(cleanDatabaseUrl);

        // حذف تنظیمات SSL از DATABASE_URL
        url.searchParams.delete("sslmode");
        url.searchParams.delete("ssl");
        url.searchParams.delete("sslrootcert");
        url.searchParams.delete("sslcert");
        url.searchParams.delete("sslkey");

        cleanDatabaseUrl =
            url.toString();

    } catch (error) {

        console.error(
            "DATABASE_URL parse error:",
            error
        );
    }
}

/* =========================================================
   POOL CONFIG
========================================================= */

const poolConfig = {

    connectionString:
        cleanDatabaseUrl,

    max: 10,

    idleTimeoutMillis:
        30000,

    connectionTimeoutMillis:
        10000,

    // این دیتابیس SSL ندارد
    ssl: false
};

/* =========================================================
   LOCAL DEVELOPMENT DATABASE
========================================================= */

if (
    !isProduction &&
    !process.env.DATABASE_URL
) {

    poolConfig.host =
        process.env.PGHOST ||
        "127.0.0.1";

    poolConfig.port =
        Number(
            process.env.PGPORT ||
            5432
        );

    poolConfig.database =
        process.env.PGDATABASE ||
        "kolbeye_sabz";

    poolConfig.user =
        process.env.PGUSER ||
        "postgres";

    poolConfig.password =
        process.env.PGPASSWORD ||
        "123456";

    poolConfig.ssl =
        false;
}

/* =========================================================
   POSTGRESQL POOL
========================================================= */

const pool =
    new Pool(poolConfig);

/* =========================================================
   TEST DATABASE
========================================================= */

async function testDatabase() {

    let client;

    try {

        client =
            await pool.connect();

        const result =
            await client.query(
                "SELECT NOW() AS now"
            );

        console.log(
            "=========================================="
        );

        console.log(
            "PostgreSQL connection: SUCCESS"
        );

        console.log(
            "Database time:",
            result.rows[0].now
        );

        console.log(
            "=========================================="
        );

        return true;

    } catch (error) {

        console.error(
            "PostgreSQL connection: FAILED"
        );

        console.error(
            "PostgreSQL ERROR:",
            error
        );

        return false;

    } finally {

        if (client) {
            client.release();
        }
    }
}

/* =========================================================
   INITIALIZE DATABASE
========================================================= */

async function initializeDatabase() {

    try {

        console.log(
            "در حال بررسی ساختار PostgreSQL..."
        );

        /* USERS */

        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                fullname TEXT NOT NULL,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'consultant',
                status BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        /* PROPERTIES */

        await pool.query(`
            CREATE TABLE IF NOT EXISTS properties (
                id TEXT PRIMARY KEY,
                code TEXT,
                property_data JSONB NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        /* PROPERTY CODE INDEX */

        await pool.query(`
            CREATE INDEX IF NOT EXISTS
            properties_code_idx
            ON properties(code)
        `);

        /* USERNAME INDEX */

        await pool.query(`
            CREATE INDEX IF NOT EXISTS
            users_username_idx
            ON users(username)
        `);

        console.log(
            "PostgreSQL tables: READY"
        );

        return true;

    } catch (error) {

        console.error(
            "DATABASE INITIALIZATION ERROR:",
            error
        );

        throw error;
    }
}

/* =========================================================
   EXPORT
========================================================= */

module.exports = {

    pool,

    testDatabase,

    initializeDatabase

};