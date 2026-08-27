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
// تنظیمات اصلی
// =====================================================

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";
const projectPath = __dirname;

const isProduction =
    process.env.NODE_ENV === "production";

app.set("trust proxy", 1);

// =====================================================
// فایل‌های قدیمی JSON
// فقط برای Migration
// =====================================================

const propertiesJSONPath =
    path.join(projectPath, "properties.json");

const usersJSONPath =
    path.join(projectPath, "users.json");

// =====================================================
// Middleware
// =====================================================

app.use(express.json({
    limit: "50mb"
}));

app.use(express.urlencoded({
    extended: true,
    limit: "50mb"
}));

// =====================================================
// Session
// =====================================================

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
// Health Check - Render
// =====================================================

app.get("/health", (req, res) => {

    return res.status(200).json({
        success: true,
        status: "ok",
        message:
            "Kolbeye Sabz Server is running",
        port: PORT
    });

});

// =====================================================
// فایل‌های JSON قدیمی
// =====================================================

function ensurePropertiesFile() {

    try {

        if (
            !fs.existsSync(
                propertiesJSONPath
            )
        ) {

            fs.writeFileSync(
                propertiesJSONPath,
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

function ensureUsersFile() {

    try {

        if (
            !fs.existsSync(
                usersJSONPath
            )
        ) {

            const defaultUsers = [
                {
                    id: "1",
                    fullname: "مدیر سیستم",
                    username: "admin",
                    password: "123456",
                    role: "admin",
                    status: true
                }
            ];

            fs.writeFileSync(
                usersJSONPath,
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

function getPropertiesFromJSON() {

    try {

        ensurePropertiesFile();

        const raw =
            fs.readFileSync(
                propertiesJSONPath,
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

function getUsersFromJSON() {

    try {

        ensureUsersFile();

        const raw =
            fs.readFileSync(
                usersJSONPath,
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
            "خطا در خواندن users.json:",
            error
        );

        return [];

    }

}

// =====================================================
// Migration املاک قدیمی
// =====================================================

async function migratePropertiesToDatabase() {

    try {

        const oldProperties =
            getPropertiesFromJSON();

        if (
            !oldProperties.length
        ) {

            console.log(
                "هیچ ملک قدیمی برای انتقال وجود ندارد."
            );

            return;

        }

        let migrated = 0;

        for (
            const property
            of oldProperties
        ) {

            if (
                !property ||
                !property.id
            ) {
                continue;
            }

            const result =
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
                    RETURNING id
                    `,
                    [
                        String(property.id),

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

            if (
                result.rowCount > 0
            ) {
                migrated++;
            }

        }

        console.log(
            "تعداد املاک منتقل‌شده:",
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
// Migration کاربران قدیمی
// =====================================================

async function migrateUsersToDatabase() {

    try {

        const oldUsers =
            getUsersFromJSON();

        if (!oldUsers.length) {

            console.log(
                "هیچ کاربر قدیمی برای انتقال وجود ندارد."
            );

            return;

        }

        let migrated = 0;

        for (
            const user
            of oldUsers
        ) {

            if (
                !user ||
                !user.username ||
                !user.password
            ) {
                continue;
            }

            let password =
                String(user.password);

            if (
                !password.startsWith("$2")
            ) {

                password =
                    await bcrypt.hash(
                        password,
                        12
                    );

            }

            const result =
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
                    RETURNING id
                    `,
                    [
                        String(
                            user.id ||
                            Date.now()
                        ),

                        String(
                            user.fullname ||
                            user.name ||
                            user.username
                        ),

                        String(
                            user.username
                        ).trim(),

                        password,

                        user.role ||
                            "consultant",

                        user.status !== false
                    ]
                );

            if (
                result.rowCount > 0
            ) {
                migrated++;
            }

        }

        console.log(
            "تعداد کاربران منتقل‌شده:",
            migrated
        );

    } catch (error) {

        console.error(
            "USER MIGRATION ERROR:",
            error
        );

    }

}

// =====================================================
// Hash کردن رمزهای موجود
// =====================================================

async function migrateDatabasePasswords() {

    try {

        const result =
            await pool.query(
                `
                SELECT id, password
                FROM users
                `
            );

        let changed = 0;

        for (
            const user
            of result.rows
        ) {

            const password =
                String(
                    user.password || ""
                );

            if (
                password &&
                !password.startsWith("$2")
            ) {

                const hashed =
                    await bcrypt.hash(
                        password,
                        12
                    );

                await pool.query(
                    `
                    UPDATE users

                    SET
                        password = $1,
                        updated_at = NOW()

                    WHERE id = $2
                    `,
                    [
                        hashed,
                        String(user.id)
                    ]
                );

                changed++;

            }

        }

        if (changed > 0) {

            console.log(
                "تعداد رمزهای Hash شده:",
                changed
            );

        }

    } catch (error) {

        console.error(
            "PASSWORD MIGRATION ERROR:",
            error
        );

    }

}

// =====================================================
// Authentication
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
// تبدیل رکورد ملک
// =====================================================

function normalizeDatabaseProperty(
    row
) {

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
        property.id = row.id;
    }

    if (
        !property.code &&
        row.code
    ) {
        property.code = row.code;
    }

    return property;

}

// =====================================================
// اطلاعات کاربر فعلی
// =====================================================

app.get(
    "/api/me",
    requireAuth,
    (req, res) => {

        return res.json({
            success: true,
            user:
                req.session.user
        });

    }
);

// =====================================================
// LOGIN
// =====================================================

app.post(
    "/api/login",
    async (req, res) => {

        try {

            const username =
                String(
                    req.body.username || ""
                ).trim();

            const password =
                String(
                    req.body.password || ""
                );

            if (
                !username ||
                !password
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "نام کاربری و رمز عبور را وارد کنید."
                });

            }

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

                    WHERE LOWER(username)
                        = LOWER($1)

                    LIMIT 1
                    `,
                    [username]
                );

            if (
                result.rows.length === 0
            ) {

                return res.status(401).json({
                    success: false,
                    message:
                        "نام کاربری یا رمز عبور اشتباه است."
                });

            }

            const user =
                result.rows[0];

            if (
                user.status === false
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        "حساب کاربری شما غیرفعال است."
                });

            }

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

            req.session.user = {
                id: user.id,

                fullname:
                    user.fullname ||
                    user.username,

                username:
                    user.username,

                role:
                    user.role ||
                    "consultant"
            };

            req.session.save(
                sessionError => {

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
    (req, res) => {

        if (!req.session) {

            return res.json({
                success: true
            });

        }

        req.session.destroy(
            error => {

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
                        secure: isProduction
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
// دریافت تمام املاک
// =====================================================

app.get(
    "/api/properties",
    requireAuth,
    async (req, res) => {

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

                    ORDER BY created_at DESC
                    `
                );

            const properties =
                result.rows
                    .map(
                        normalizeDatabaseProperty
                    )
                    .filter(Boolean);

            return res.json({
                success: true,
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
// دریافت یک ملک
// =====================================================

app.get(
    "/api/properties/:id",
    requireAuth,
    async (req, res) => {

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

            return res.json({
                success: true,
                property:
                    normalizeDatabaseProperty(
                        result.rows[0]
                    )
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
// ثبت ملک
// =====================================================

app.post(
    "/api/properties",
    requireAuth,
    async (req, res) => {

        try {

            if (
                !req.body ||
                typeof req.body !== "object"
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

            property.id =
                "KS-" +
                Date.now() +
                "-" +
                Math.random()
                    .toString(36)
                    .substring(2, 7);

            if (
                !property.code ||
                !String(
                    property.code
                ).trim()
            ) {

                property.code =
                    "KS-" + Date.now();

            }

            property.createdAt =
                new Date()
                    .toLocaleString(
                        "fa-IR"
                    );

            property.createdBy =
                req.session.user.fullname;

            property.createdById =
                req.session.user.id;

            if (
                !Array.isArray(
                    property.features
                )
            ) {

                property.features = [];

            }

            if (
                !Array.isArray(
                    property.images
                )
            ) {

                property.images = [];

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
                `,
                [
                    String(property.id),

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
// ویرایش ملک
// =====================================================

app.put(
    "/api/properties/:id",
    requireAuth,
    async (req, res) => {

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
                    req.body.code !== undefined
                        ? req.body.code
                        : oldProperty.code,

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

                updatedProperty.features = [];

            }

            if (
                !Array.isArray(
                    updatedProperty.images
                )
            ) {

                updatedProperty.images = [];

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
// حذف ملک - فقط مدیر
// =====================================================

app.delete(
    "/api/properties/:id",
    requireRole("admin"),
    async (req, res) => {

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
    async (req, res) => {

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

            const exists =
                await pool.query(
                    `
                    SELECT id

                    FROM users

                    WHERE LOWER(username)
                        = LOWER($1)

                    LIMIT 1
                    `,
                    [username]
                );

            if (
                exists.rows.length > 0
            ) {

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
                    String(Date.now()),

                fullname,

                username,

                password:
                    hashedPassword,

                role,

                status: true
            };

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
                `,
                [
                    newUser.id,
                    newUser.fullname,
                    newUser.username,
                    newUser.password,
                    newUser.role,
                    newUser.status
                ]
            );

            console.log(
                "USER CREATED:",
                newUser.username
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
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        fullname,
                        username,
                        role,
                        status,
                        created_at,
                        updated_at

                    FROM users

                    ORDER BY created_at ASC
                    `
                );

            const users =
                result.rows.map(
                    user => ({
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
                    })
                );

            return res.json({
                success: true,
                users
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
    async (req, res) => {

        try {

            const target =
                await pool.query(
                    `
                    SELECT
                        id,
                        username

                    FROM users

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
                target.rows.length === 0
            ) {

                return res.status(404).json({
                    success: false,
                    message:
                        "کاربر پیدا نشد."
                });

            }

            if (
                String(
                    target.rows[0].username
                ).toLowerCase() ===
                "admin"
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        "مدیر اصلی قابل حذف نیست."
                });

            }

            await pool.query(
                `
                DELETE FROM users

                WHERE id = $1
                `,
                [
                    String(
                        req.params.id
                    )
                ]
            );

            console.log(
                "USER DELETED:",
                target.rows[0].username
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
    (req, res) => {

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
    (req, res) => {

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
    (error, req, res, next) => {

        console.error(
            "EXPRESS ERROR:",
            error
        );

        if (
            res.headersSent
        ) {
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

        // ---------------------------------------------
        // 1. اتصال PostgreSQL
        // ---------------------------------------------

        const databaseConnected =
            await testDatabase();

        if (
            !databaseConnected
        ) {

            throw new Error(
                "PostgreSQL connection failed"
            );

        }

        // ---------------------------------------------
        // 2. ساخت جداول
        // ---------------------------------------------

        await initializeDatabase();

        // ---------------------------------------------
        // 3. Migration اطلاعات قدیمی
        // ---------------------------------------------

        await migratePropertiesToDatabase();

        await migrateUsersToDatabase();

        // ---------------------------------------------
        // 4. Hash رمزهای دیتابیس
        // ---------------------------------------------

        await migrateDatabasePasswords();

        // ---------------------------------------------
        // 5. اجرای سرور
        // ---------------------------------------------

        const server =
            app.listen(
                PORT,
                HOST,
                () => {

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
                        "Port: " + PORT
                    );

                    console.log(
                        "Host: " + HOST
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
                        "Environment    : " +
                        (
                            isProduction
                                ? "PRODUCTION"
                                : "LOCAL"
                        )
                    );

                    console.log(
                        "=========================================="
                    );

                    console.log("");

                }
            );

        server.on(
            "error",
            error => {

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
    error => {

        console.error(
            "UNCAUGHT EXCEPTION:",
            error
        );

    }
);

process.on(
    "unhandledRejection",
    error => {

        console.error(
            "UNHANDLED REJECTION:",
            error
        );

    }
);