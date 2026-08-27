"use strict";

const { Pool } = require("pg");

// =====================================================
// PostgreSQL Connection
// Local + Render
// =====================================================

const isProduction =
    process.env.NODE_ENV === "production";

const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,

        ssl: isProduction
            ? {
                rejectUnauthorized: false
            }
            : false,

        max: 10,

        idleTimeoutMillis: 30000,

        connectionTimeoutMillis: 10000
    }
    : {
        host:
            process.env.PGHOST ||
            "127.0.0.1",

        port:
            Number(
                process.env.PGPORT ||
                5432
            ),

        database:
            process.env.PGDATABASE ||
            "kolbeye_sabz",

        user:
            process.env.PGUSER ||
            "postgres",

        password:
            process.env.PGPASSWORD ||
            "123456",

        ssl: false,

        max: 10,

        idleTimeoutMillis: 30000,

        connectionTimeoutMillis: 10000
    };

const pool = new Pool(poolConfig);

// =====================================================
// مدیریت خطای Pool
// =====================================================

pool.on("error", error => {
    console.error(
        "Unexpected PostgreSQL pool error:",
        error
    );
});

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
            "Database mode:",
            process.env.DATABASE_URL
                ? "DATABASE_URL"
                : "LOCAL"
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

        // =================================================
        // جدول کاربران
        // =================================================

        await pool.query(`

            CREATE TABLE IF NOT EXISTS users (

                id TEXT PRIMARY KEY,

                fullname TEXT NOT NULL,

                username TEXT UNIQUE NOT NULL,

                password TEXT NOT NULL,

                role TEXT NOT NULL
                    DEFAULT 'consultant',

                status BOOLEAN NOT NULL
                    DEFAULT TRUE,

                created_at TIMESTAMPTZ
                    DEFAULT NOW(),

                updated_at TIMESTAMPTZ
                    DEFAULT NOW()

            )

        `);

        // =================================================
        // جدول املاک
        // =================================================

        await pool.query(`

            CREATE TABLE IF NOT EXISTS properties (

                id TEXT PRIMARY KEY,

                code TEXT,

                property_data JSONB NOT NULL,

                created_at TIMESTAMPTZ
                    DEFAULT NOW(),

                updated_at TIMESTAMPTZ
                    DEFAULT NOW()

            )

        `);

        // =================================================
        // Index کاربران
        // =================================================

        await pool.query(`

            CREATE INDEX IF NOT EXISTS
            users_username_idx
            ON users(username)

        `);

        // =================================================
        // Index املاک
        // =================================================

        await pool.query(`

            CREATE INDEX IF NOT EXISTS
            properties_code_idx
            ON properties(code)

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

// =====================================================
// تست سلامت کامل دیتابیس
// =====================================================

async function checkDatabaseHealth() {

    let client;

    try {

        client = await pool.connect();

        await client.query(
            "SELECT 1"
        );

        return true;

    } catch (error) {

        console.error(
            "DATABASE HEALTH ERROR:",
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
// بستن اتصال دیتابیس
// =====================================================

async function closeDatabase() {

    try {

        await pool.end();

        console.log(
            "PostgreSQL pool closed."
        );

    } catch (error) {

        console.error(
            "DATABASE CLOSE ERROR:",
            error
        );

    }

}

// =====================================================
// Export
// =====================================================

module.exports = {

    pool,

    testDatabase,

    initializeDatabase,

    checkDatabaseHealth,

    closeDatabase

};