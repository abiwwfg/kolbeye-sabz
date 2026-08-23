"use strict";

const { Pool } = require("pg");

// =====================================================
// PostgreSQL Connection
// =====================================================

const pool = new Pool({

    connectionString:
        process.env.DATABASE_URL,

    ssl:
        process.env.DATABASE_URL
            ? {
                rejectUnauthorized: false
            }
            : false,

    max: 10,

    idleTimeoutMillis: 30000,

    connectionTimeoutMillis: 10000

});

// =====================================================
// تست اتصال دیتابیس
// =====================================================

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

// =====================================================
// Export
// =====================================================

module.exports = {

    pool,

    testDatabase

};