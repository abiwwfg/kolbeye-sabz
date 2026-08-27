"use strict";

const { Pool } = require("pg");

const isProduction =
    process.env.NODE_ENV === "production";

const poolConfig = {
    connectionString:
        process.env.DATABASE_URL,

    max: 10,

    idleTimeoutMillis: 30000,

    connectionTimeoutMillis: 10000
};

if (!isProduction && !process.env.DATABASE_URL) {
    poolConfig.host =
        process.env.PGHOST || "127.0.0.1";

    poolConfig.port =
        Number(process.env.PGPORT || 5432);

    poolConfig.database =
        process.env.PGDATABASE || "kolbeye_sabz";

    poolConfig.user =
        process.env.PGUSER || "postgres";

    poolConfig.password =
        process.env.PGPASSWORD || "123456";
}

if (isProduction) {
    poolConfig.ssl = {
        rejectUnauthorized: false
    };
} else {
    poolConfig.ssl = false;
}

const pool = new Pool(poolConfig);


// =====================================================
// تست اتصال دیتابیس
// =====================================================

async function testDatabase() {

    let client;

    try {

        client = await pool.connect();

        const result = await client.query(
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


// =====================================================
// ساخت جداول
// =====================================================

async function initializeDatabase() {

    try {

        console.log(
            "در حال بررسی ساختار PostgreSQL..."
        );

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

        await pool.query(`

            CREATE TABLE IF NOT EXISTS properties (

                id TEXT PRIMARY KEY,

                code TEXT,

                property_data JSONB NOT NULL,

                created_at TIMESTAMPTZ DEFAULT NOW(),

                updated_at TIMESTAMPTZ DEFAULT NOW()

            )

        `);

        await pool.query(`

            CREATE INDEX IF NOT EXISTS
            properties_code_idx
            ON properties(code)

        `);

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


module.exports = {

    pool,

    testDatabase,

    initializeDatabase

};