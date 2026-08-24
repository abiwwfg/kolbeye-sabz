"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const bcrypt = require("bcrypt");

const {
    pool,
    testDatabase,
    initializeDatabase
} = require("./db");

const app = express();

// =====================================================
// تنظیمات سرور
// =====================================================

const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);

// =====================================================
// مسیرهای پروژه
// =====================================================

const projectPath = __dirname;

const dataPath = path.join(
    projectPath,
    "properties.json"
);

const usersPath = path.join(
    projectPath,
    "users.json"
);

// =====================================================
// Middleware
// =====================================================

app.use(
    express.json({
        limit: "50mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "50mb"
    })
);

// =====================================================
// Session
// =====================================================

const isProduction =
    process.env.NODE_ENV === "production";

app.use(
    session({

        secret:
            process.env.SESSION_SECRET ||
            "kolbeye-sabz-secret-key-2026",

        resave: false,

        saveUninitialized: false,

        rolling: true,

        cookie: {

            httpOnly: true,

            sameSite: "lax",

            secure: isProduction,

            maxAge:
                1000 * 60 * 60 * 8

        }

    })
);

// =====================================================
// فایل‌های استاتیک
// =====================================================

app.use(
    express.static(projectPath)
);

// =====================================================
// Health Check
// =====================================================

app.get(
    "/health",
    function (req, res) {

        return res.status(200).json({

            success: true,

            status: "ok",

            message:
                "Kolbeye Sabz Server is running",

            port:
                PORT

        });

    }
);

// =====================================================
// ساخت properties.json در صورت نبودن
// =====================================================

function ensurePropertiesFile() {

    try {

        if (!fs.existsSync(dataPath)) {

            fs.writeFileSync(

                dataPath,

                JSON.stringify(
                    [],
                    null,
                    2
                ),

                "utf8"

            );

        }

    } catch (error) {

        console.error(
            "خطا در ساخت properties.json:",
            error
        );

    }

}

// =====================================================
// ساخت users.json در صورت نبودن
// =====================================================

function ensureUsersFile() {

    try {

        if (!fs.existsSync(usersPath)) {

            const defaultUsers = [

                {

                    id: 1,

                    fullname:
                        "مدیر سیستم",

                    username:
                        "admin",

                    password:
                        "123456",

                    role:
                        "admin",

                    status:
                        true

                }

            ];

            fs.writeFileSync(

                usersPath,

                JSON.stringify(
                    defaultUsers,
                    null,
                    2
                ),

                "utf8"

            );

        }

    } catch (error) {

        console.error(
            "خطا در ساخت users.json:",
            error
        );

    }

}

// =====================================================
// خواندن املاک قدیمی از JSON
// فقط برای Migration
// =====================================================

function getPropertiesFromJSON() {

    try {

        ensurePropertiesFile();

        const raw =
            fs.readFileSync(
                dataPath,
                "utf8"
            );

        if (!raw.trim()) {

            return [];

        }

        const data =
            JSON.parse(raw);

        return Array.isArray(data)
            ? data
            : [];

    } catch (error) {

        console.error(
            "خطا در خواندن properties.json:",
            error
        );

        return [];

    }

}

// =====================================================
// خواندن کاربران
// =====================================================

function getUsers() {

    try {

        ensureUsersFile();

        const raw =
            fs.readFileSync(
                usersPath,
                "utf8"
            );

        if (!raw.trim()) {

            return [];

        }

        const users =
            JSON.parse(raw);

        return Array.isArray(users)
            ? users
            : [];

    } catch (error) {

        console.error(
            "خطا در خواندن users.json:",
            error
        );

        return [];

    }

}

// =====================================================
// ذخیره کاربران
// =====================================================

function saveUsers(users) {

    fs.writeFileSync(

        usersPath,

        JSON.stringify(
            users,
            null,
            2
        ),

        "utf8"

    );

}

// =====================================================
// ایجاد جدول PostgreSQL
// =====================================================

async function initializeDatabase() {

    console.log(
        "در حال بررسی ساختار PostgreSQL..."
    );

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

    console.log(
        "PostgreSQL properties table: READY"
    );

}

// =====================================================
// انتقال اطلاعات properties.json به PostgreSQL
// =====================================================

async function migratePropertiesToDatabase() {

    try {

        const oldProperties =
            getPropertiesFromJSON();

        if (
            !Array.isArray(oldProperties) ||
            oldProperties.length === 0
        ) {

            console.log(
                "هیچ ملک قدیمی برای انتقال وجود ندارد."
            );

            return;

        }

        const result =
            await pool.query(
                "SELECT COUNT(*)::int AS count FROM properties"
            );

        const databaseCount =
            result.rows[0].count;

        if (databaseCount > 0) {

            console.log(
                "PostgreSQL دارای اطلاعات ملک است؛ Migration رد شد."
            );

            return;

        }

        let migrated =
            0;

        for (
            const property of oldProperties
        ) {

            if (
                !property ||
                !property.id
            ) {

                continue;

            }

            await pool.query(

                `

                INSERT INTO properties
                (
                    id,
                    code,
                    property_data
                )

                VALUES
                (
                    $1,
                    $2,
                    $3::jsonb
                )

                ON CONFLICT (id)
                DO NOTHING

                `,

                [

                    String(property.id),

                    property.code
                        ? String(property.code)
                        : null,

                    JSON.stringify(property)

                ]

            );

            migrated++;

        }

        console.log(
            "تعداد املاک منتقل‌شده به PostgreSQL:",
            migrated
        );

    } catch (error) {

        console.error(
            "PROPERTY MIGRATION ERROR:",
            error
        );

    }

}

// =====================================================
// تبدیل رکورد PostgreSQL به ملک
// =====================================================

function normalizeDatabaseProperty(row) {

    if (
        !row ||
        !row.property_data
    ) {

        return null;

    }

    const property = {

        ...row.property_data

    };

    if (!property.id) {

        property.id =
            row.id;

    }

    if (
        !property.code &&
        row.code
    ) {

        property.code =
            row.code;

    }

    return property;

}

// =====================================================
// انتقال کاربران users.json به PostgreSQL
// =====================================================

async function migrateUsersToDatabase() {

    try {

        const oldUsers = getUsers();

        if (
            !Array.isArray(oldUsers) ||
            oldUsers.length === 0
        ) {

            console.log(
                "هیچ کاربر قدیمی برای انتقال وجود ندارد."
            );

            return;

        }

        const result = await pool.query(
            "SELECT COUNT(*)::int AS count FROM users"
        );

        const databaseCount =
            result.rows[0].count;

        if (databaseCount > 0) {

            console.log(
                "PostgreSQL دارای کاربران است؛ Migration رد شد."
            );

            return;

        }

        let migrated = 0;

        for (const user of oldUsers) {

            if (
                !user ||
                !user.username ||
                !user.password
            ) {

                continue;

            }

            await pool.query(

                `

                INSERT INTO users
                (
                    id,
                    fullname,
                    username,
                    password,
                    role,
                    status
                )

                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6
                )

                ON CONFLICT (username)
                DO NOTHING

                `,

                [

                    String(
                        user.id || Date.now()
                    ),

                    String(
                        user.fullname ||
                        user.name ||
                        user.username
                    ),

                    String(
                        user.username
                    ).trim(),

                    String(
                        user.password
                    ),

                    user.role ||
                        "consultant",

                    user.status !== false

                ]

            );

            migrated++;

        }

        console.log(
            "تعداد کاربران منتقل‌شده به PostgreSQL:",
            migrated
        );

    } catch (error) {

        console.error(
            "USER MIGRATION ERROR:",
            error
        );

        throw error;

    }

}

// =====================================================
// تبدیل رمزهای قدیمی به bcrypt
// =====================================================

async function migratePasswords() {

    const users =
        getUsers();

    let changed =
        false;

    for (
        const user of users
    ) {

        if (

            user.password &&

            !String(
                user.password
            ).startsWith("$2")

        ) {

            user.password =
                await bcrypt.hash(
                    String(
                        user.password
                    ),
                    12
                );

            changed =
                true;

        }

    }

    if (changed) {

        saveUsers(users);

        console.log(
            "رمزهای قدیمی کاربران به bcrypt تبدیل شدند."
        );

    }

}

// =====================================================
// احراز هویت
// =====================================================

function requireAuth(
    req,
    res,
    next
) {

    if (

        !req.session ||

        !req.session.user

    ) {

        return res.status(401).json({

            success: false,

            message:
                "جلسه ورود شما معتبر نیست. لطفاً دوباره وارد سامانه شوید."

        });

    }

    next();

}

// =====================================================
// بررسی نقش کاربر
// =====================================================

function requireRole(...roles) {

    return function (
        req,
        res,
        next
    ) {

        if (

            !req.session ||

            !req.session.user

        ) {

            return res.status(401).json({

                success: false,

                message:
                    "جلسه ورود شما معتبر نیست. لطفاً دوباره وارد سامانه شوید."

            });

        }

        if (

            !roles.includes(
                req.session.user.role
            )

        ) {

            return res.status(403).json({

                success: false,

                message:
                    "شما اجازه انجام این عملیات را ندارید."

            });

        }

        next();

    };

}

// =====================================================
// API وضعیت ورود
// =====================================================

app.get(
    "/api/me",
    requireAuth,
    function (
        req,
        res
    ) {

        return res.json({

            success: true,

            user:
                req.session.user

        });

    }
);

// =====================================================
// 
// =====================================================

// =====================================================
// LOGIN - PostgreSQL
// =====================================================

// =====================================================
// LOGIN - PostgreSQL
// =====================================================

app.post(
    "/api/login",
    async function (req, res) {

        try {

            const username =
                String(
                    req.body.username || ""
                ).trim();

            const password =
                String(
                    req.body.password || ""
                );

            if (!username || !password) {

                return res.status(400).json({

                    success: false,

                    message:
                        "نام کاربری و رمز عبور را وارد کنید."

                });

            }

            // =================================================
            // دریافت کاربر از PostgreSQL
            // =================================================

            const result =
                await pool.query(

                    `
                    SELECT
                        id,
                        fullname,
                        username,
                        password,
                        role,
                        status

                    FROM users

                    WHERE LOWER(username) = LOWER($1)

                    LIMIT 1
                    `,

                    [username]

                );

            if (result.rows.length === 0) {

                return res.status(401).json({

                    success: false,

                    message:
                        "نام کاربری یا رمز عبور اشتباه است."

                });

            }

            const user =
                result.rows[0];

            // =================================================
            // بررسی فعال بودن کاربر
            // =================================================

            if (user.status === false) {

                return res.status(403).json({

                    success: false,

                    message:
                        "حساب کاربری شما غیرفعال است."

                });

            }

            // =================================================
            // بررسی رمز عبور
            // =================================================

            const passwordOK =
                await bcrypt.compare(

                    password,

                    String(user.password)

                );

            if (!passwordOK) {

                return res.status(401).json({

                    success: false,

                    message:
                        "نام کاربری یا رمز عبور اشتباه است."

                });

            }

            // =================================================
            // ایجاد Session
            // =================================================

            req.session.user = {

                id:
                    user.id,

                fullname:
                    user.fullname ||
                    user.username,

                username:
                    user.username,

                role:
                    user.role ||
                    "consultant"

            };

            // =================================================
            // ذخیره Session
            // =================================================

            req.session.save(
                function (sessionError) {

                    if (sessionError) {

                        console.error(
                            "Session Save Error:",
                            sessionError
                        );

                        return res.status(500).json({

                            success: false,

                            message:
                                "خطا در ایجاد جلسه ورود."

                        });

                    }

                    console.log(
                        "USER LOGIN:",
                        user.username
                    );

                    return res.json({

                        success: true,

                        message:
                            "ورود با موفقیت انجام شد.",

                        user:
                            req.session.user

                    });

                }
            );

        } catch (error) {

            console.error(
                "LOGIN ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "خطا در ورود به سامانه."

            });

        }

    }
);
// =====================================================
// LOGOUT
// =====================================================

app.post(
    "/api/logout",
    function (
        req,
        res
    ) {

        if (!req.session) {

            return res.json({

                success: true

            });

        }

        req.session.destroy(
            function (
                error
            ) {

                if (error) {

                    console.error(
                        "Logout Error:",
                        error
                    );

                    return res.status(500).json({

                        success: false,

                        message:
                            "خروج از سامانه انجام نشد."

                    });

                }

                res.clearCookie(
                    "connect.sid",
                    {

                        httpOnly: true,

                        sameSite: "lax",

                        secure:
                            isProduction

                    }
                );

                return res.json({

                    success: true,

                    message:
                        "با موفقیت خارج شدید."

                });

            }
        );

    }
);

// =====================================================
// دریافت تمام املاک از PostgreSQL
// =====================================================

app.get(
    "/api/properties",
    requireAuth,
    async function (
        req,
        res
    ) {

        try {

            const result =
                await pool.query(`

                    SELECT
                        id,
                        code,
                        property_data,
                        created_at,
                        updated_at

                    FROM properties

                    ORDER BY created_at DESC

                `);

            const properties =
                result.rows
                    .map(
                        normalizeDatabaseProperty
                    )
                    .filter(Boolean);

            return res.json({

                success: true,

                properties:
                    properties

            });

        } catch (error) {

            console.error(
                "GET PROPERTIES ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "خطا در دریافت فایل‌های ملکی."

            });

        }

    }
);

// =====================================================
// دریافت یک ملک از PostgreSQL
// =====================================================

app.get(
    "/api/properties/:id",
    requireAuth,
    async function (
        req,
        res
    ) {

        try {

            const result =
                await pool.query(

                    `

                    SELECT
                        id,
                        code,
                        property_data,
                        created_at,
                        updated_at

                    FROM properties

                    WHERE id = $1

                    LIMIT 1

                    `,

                    [
                        String(
                            req.params.id
                        )
                    ]

                );

            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "ملک پیدا نشد."

                });

            }

            const property =
                normalizeDatabaseProperty(
                    result.rows[0]
                );

            return res.json({

                success: true,

                property:
                    property

            });

        } catch (error) {

            console.error(
                "GET PROPERTY ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "خطا در دریافت اطلاعات ملک."

            });

        }

    }
);

// =====================================================
// ثبت ملک در PostgreSQL
// =====================================================

app.post(
    "/api/properties",
    requireAuth,
    async function (
        req,
        res
    ) {

        try {

            if (

                !req.body ||

                typeof req.body !==
                    "object"

            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "اطلاعات ملک ارسال نشده است."

                });

            }

            const property = {

                ...req.body

            };

            // =================================================
            // شناسه اصلی
            // =================================================

            property.id =
                "KS-" +
                Date.now() +
                "-" +
                Math.random()
                    .toString(36)
                    .substring(2, 7);

            // =================================================
            // کد فایل
            // =================================================

            if (

                !property.code ||

                !String(
                    property.code
                ).trim()

            ) {

                property.code =
                    "KS-" +
                    Date.now();

            }

            // =================================================
            // اطلاعات ثبت
            // =================================================

            property.createdAt =
                new Date()
                    .toLocaleString(
                        "fa-IR"
                    );

            property.createdBy =
                req.session.user.fullname;

            property.createdById =
                req.session.user.id;

            // =================================================
            // آرایه‌های ضروری
            // =================================================

            if (
                !Array.isArray(
                    property.features
                )
            ) {

                property.features =
                    [];

            }

            if (
                !Array.isArray(
                    property.images
                )
            ) {

                property.images =
                    [];

            }

            // =================================================
            // ذخیره در PostgreSQL
            // =================================================

            await pool.query(

                `

                INSERT INTO properties
                (
                    id,
                    code,
                    property_data
                )

                VALUES
                (
                    $1,
                    $2,
                    $3::jsonb
                )

                `,

                [

                    String(
                        property.id
                    ),

                    property.code
                        ? String(
                            property.code
                        )
                        : null,

                    JSON.stringify(
                        property
                    )

                ]

            );

            console.log(
                "PROPERTY CREATED:",
                property.id
            );

            return res.status(201).json({

                success: true,

                message:
                    "ملک با موفقیت ثبت شد.",

                property:
                    property

            });

        } catch (error) {

            console.error(
                "CREATE PROPERTY ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "خطا در ذخیره اطلاعات ملک."

            });

        }

    }
);

// =====================================================
// ویرایش ملک در PostgreSQL
// =====================================================

app.put(
    "/api/properties/:id",
    requireAuth,
    async function (
        req,
        res
    ) {

        try {

            const result =
                await pool.query(

                    `

                    SELECT
                        id,
                        code,
                        property_data

                    FROM properties

                    WHERE id = $1

                    LIMIT 1

                    `,

                    [
                        String(
                            req.params.id
                        )
                    ]

                );

            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "ملک پیدا نشد."

                });

            }

            const oldProperty =
                normalizeDatabaseProperty(
                    result.rows[0]
                );

            const updatedProperty = {

                ...oldProperty,

                ...req.body,

                id:
                    oldProperty.id,

                code:
                    oldProperty.code ||
                    req.body.code,

                createdAt:
                    oldProperty.createdAt,

                createdBy:
                    oldProperty.createdBy,

                createdById:
                    oldProperty.createdById,

                updatedAt:
                    new Date()
                        .toLocaleString(
                            "fa-IR"
                        ),

                updatedBy:
                    req.session.user.fullname,

                updatedById:
                    req.session.user.id

            };

            if (
                !Array.isArray(
                    updatedProperty.features
                )
            ) {

                updatedProperty.features =
                    [];

            }

            if (
                !Array.isArray(
                    updatedProperty.images
                )
            ) {

                updatedProperty.images =
                    [];

            }

            await pool.query(

                `

                UPDATE properties

                SET

                    code = $1,

                    property_data = $2::jsonb,

                    updated_at = NOW()

                WHERE id = $3

                `,

                [

                    updatedProperty.code
                        ? String(
                            updatedProperty.code
                        )
                        : null,

                    JSON.stringify(
                        updatedProperty
                    ),

                    String(
                        oldProperty.id
                    )

                ]

            );

            console.log(
                "PROPERTY UPDATED:",
                oldProperty.id
            );

            return res.json({

                success: true,

                message:
                    "ملک با موفقیت ویرایش شد.",

                property:
                    updatedProperty

            });

        } catch (error) {

            console.error(
                "UPDATE PROPERTY ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "خطا در ویرایش ملک."

            });

        }

    }
);

// =====================================================
// حذف ملک از PostgreSQL
// =====================================================

app.delete(
    "/api/properties/:id",
    requireRole("admin"),
    async function (
        req,
        res
    ) {

        try {

            const result =
                await pool.query(

                    `

                    DELETE FROM properties

                    WHERE id = $1

                    RETURNING id

                    `,

                    [
                        String(
                            req.params.id
                        )
                    ]

                );

            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "ملک پیدا نشد."

                });

            }

            console.log(
                "PROPERTY DELETED:",
                req.params.id
            );

            return res.json({

                success: true,

                message:
                    "ملک با موفقیت حذف شد."

            });

        } catch (error) {

            console.error(
                "DELETE PROPERTY ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "خطا در حذف ملک."

            });

        }

    }
);

// =====================================================
// ایجاد کاربر
// =====================================================

app.post(
    "/api/users",
    requireRole("admin"),
    async function (
        req,
        res
    ) {

        try {

            const fullname =
                String(
                    req.body.fullname || ""
                ).trim();

            const username =
                String(
                    req.body.username || ""
                ).trim();

            const password =
                String(
                    req.body.password || ""
                );

            const role =
                req.body.role ||
                "consultant";

            if (
                !fullname ||
                !username ||
                !password
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "نام، نام کاربری و رمز عبور الزامی است."

                });

            }

            const users =
                getUsers();

            const exists =
                users.some(
                    function (
                        user
                    ) {

                        return (

                            String(
                                user.username
                            )
                            .toLowerCase()

                            ===

                            username
                                .toLowerCase()

                        );

                    }
                );

            if (exists) {

                return res.status(400).json({

                    success: false,

                    message:
                        "این نام کاربری قبلاً ثبت شده است."

                });

            }

            const hashedPassword =
                await bcrypt.hash(
                    password,
                    12
                );

            const newUser = {

                id:
                    Date.now(),

                fullname:
                    fullname,

                username:
                    username,

                password:
                    hashedPassword,

                role:
                    role,

                status:
                    true

            };

            users.push(
                newUser
            );

            saveUsers(
                users
            );

            return res.status(201).json({

                success: true,

                message:
                    "کاربر با موفقیت ایجاد شد.",

                user: {

                    id:
                        newUser.id,

                    fullname:
                        newUser.fullname,

                    username:
                        newUser.username,

                    role:
                        newUser.role,

                    status:
                        newUser.status

                }

            });

        } catch (error) {

            console.error(
                "CREATE USER ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "خطا در ایجاد کاربر."

            });

        }

    }
);

// =====================================================
// دریافت کاربران
// =====================================================

app.get(
    "/api/users",
    requireRole("admin"),
    function (
        req,
        res
    ) {

        try {

            const users =
                getUsers();

            const safeUsers =
                users.map(
                    function (
                        user
                    ) {

                        return {

                            id:
                                user.id,

                            fullname:
                                user.fullname,

                            username:
                                user.username,

                            role:
                                user.role,

                            status:
                                user.status

                        };

                    }
                );

            return res.json({

                success: true,

                users:
                    safeUsers

            });

        } catch (error) {

            console.error(
                "GET USERS ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "خطا در دریافت کاربران."

            });

        }

    }
);

// =====================================================
// حذف کاربر
// =====================================================

app.delete(
    "/api/users/:id",
    requireRole("admin"),
    function (
        req,
        res
    ) {

        try {

            let users =
                getUsers();

            const target =
                users.find(
                    function (
                        user
                    ) {

                        return (

                            String(
                                user.id
                            )

                            ===

                            String(
                                req.params.id
                            )

                        );

                    }
                );

            if (!target) {

                return res.status(404).json({

                    success: false,

                    message:
                        "کاربر پیدا نشد."

                });

            }

            if (

                String(
                    target.username
                )
                .toLowerCase()

                ===

                "admin"

            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "مدیر اصلی قابل حذف نیست."

                });

            }

            users =
                users.filter(
                    function (
                        user
                    ) {

                        return (

                            String(
                                user.id
                            )

                            !==

                            String(
                                req.params.id
                            )

                        );

                    }
                );

            saveUsers(
                users
            );

            return res.json({

                success: true,

                message:
                    "کاربر با موفقیت حذف شد."

            });

        } catch (error) {

            console.error(
                "DELETE USER ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "خطا در حذف کاربر."

            });

        }

    }
);

// =====================================================
// صفحه اصلی
// =====================================================

app.get(
    "/",
    function (
        req,
        res
    ) {

        return res.sendFile(

            path.join(
                projectPath,
                "index.html"
            )

        );

    }
);

// =====================================================
// 404 API
// =====================================================

app.use(
    "/api",
    function (
        req,
        res
    ) {

        return res.status(404).json({

            success: false,

            message:
                "مسیر API پیدا نشد."

        });

    }
);

// =====================================================
// مدیریت خطا
// =====================================================

app.use(
    function (
        error,
        req,
        res,
        next
    ) {

        console.error(
            "EXPRESS ERROR:",
            error
        );

        if (res.headersSent) {

            return next(error);

        }

        return res.status(500).json({

            success: false,

            message:
                "خطای داخلی سرور."

        });

    }
);

// =====================================================
// راه‌اندازی سرور
// =====================================================

async function startServer() {

    try {

        ensurePropertiesFile();

        ensureUsersFile();

        // =================================================
        // بررسی اتصال PostgreSQL
        // =================================================

        const databaseConnected =
            await testDatabase();

        if (!databaseConnected) {

            throw new Error(
                "PostgreSQL connection failed"
            );

        }

        // =================================================
        // ساخت جدول‌ها
        // =================================================

        await initializeDatabase();

        // =================================================
        // انتقال اطلاعات قدیمی
        // =================================================

        await migratePropertiesToDatabase();

        // =================================================
        // انتقال کاربران به PostgreSQL
        // =================================================
        
        await migrateUsersToDatabase();
        
        // =================================================
        // تبدیل رمزهای قدیمی
        // =================================================
        
        await migratePasswords();
        // =================================================
        // اجرای سرور
        // =================================================

        const server =
            app.listen(

                PORT,

                "0.0.0.0",

                function () {

                    console.log("");

                    console.log(
                        "=========================================="
                    );

                    console.log(
                        "     سامانه تخصصی املاک کلبه سبز"
                    );

                    console.log(
                        "=========================================="
                    );

                    console.log(
                        "Server Running:"
                    );

                    console.log(
                        "Port: " +
                        PORT
                    );

                    console.log(
                        "Host: 0.0.0.0"
                    );

                    console.log(
                        "Health: /health"
                    );

                    console.log(
                        "=========================================="
                    );

                    console.log(
                        "Authentication : ACTIVE"
                    );

                    console.log(
                        "Session        : ACTIVE"
                    );

                    console.log(
                        "Properties API : ACTIVE"
                    );

                    console.log(
                        "Users API      : ACTIVE"
                    );

                    console.log(
                        "PostgreSQL     : ACTIVE"
                    );

                    console.log(
                        "=========================================="
                    );

                    console.log("");

                }

            );

        server.on(
            "error",
            function (
                error
            ) {

                console.error(
                    "SERVER ERROR:",
                    error
                );

                process.exit(1);

            }
        );

    } catch (error) {

        console.error(
            "خطا در راه‌اندازی سرور:",
            error
        );

        process.exit(1);

    }

}

startServer();

// =====================================================
// خطاهای پیش‌بینی‌نشده
// =====================================================

process.on(
    "uncaughtException",
    function (
        error
    ) {

        console.error(
            "UNCAUGHT EXCEPTION:",
            error
        );

    }
);

process.on(
    "unhandledRejection",
    function (
        error
    ) {

        console.error(
            "UNHANDLED REJECTION:",
            error
        );

    }
);