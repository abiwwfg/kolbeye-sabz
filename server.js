js
"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const bcrypt = require("bcrypt");

const app = express();

// =====================================================
// تنظیمات سرور
// =====================================================

const PORT = process.env.PORT || 3000;

// Render پشت Proxy قرار دارد
app.set("trust proxy", 1);

// =====================================================
// مسیرهای اصلی پروژه
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

const isProduction =
    process.env.NODE_ENV === "production";

app.use(session({

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

}));

// =====================================================
// فایل‌های استاتیک
// =====================================================

app.use(
    express.static(projectPath)
);

// =====================================================
// Health Check برای Render
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

                    // رمز اولیه: 123456
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
// اجرای اولیه فایل‌ها
// =====================================================

ensurePropertiesFile();

ensureUsersFile();

// =====================================================
// خواندن املاک
// =====================================================

function getProperties() {

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
// ذخیره املاک
// =====================================================

function saveProperties(
    properties
) {

    fs.writeFileSync(

        dataPath,

        JSON.stringify(
            properties,
            null,
            2
        ),

        "utf8"

    );

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

function saveUsers(
    users
) {

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

function requireRole(
    ...roles
) {

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
// LOGIN
// =====================================================

app.post(
    "/api/login",
    async function (
        req,
        res
    ) {

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

            const users =
                getUsers();

            const user =
                users.find(
                    function (
                        item
                    ) {

                        return (

                            String(
                                item.username
                            )
                            .trim()
                            .toLowerCase()

                            ===

                            username
                                .toLowerCase()

                            &&

                            item.status !== false

                        );

                    }
                );

            if (!user) {

                return res.status(401).json({

                    success: false,

                    message:
                        "نام کاربری یا رمز عبور اشتباه است."

                });

            }

            let passwordOK =
                false;

            // =================================================
            // بررسی bcrypt
            // =================================================

            if (

                user.password &&

                String(
                    user.password
                ).startsWith("$2")

            ) {

                passwordOK =
                    await bcrypt.compare(

                        password,

                        user.password

                    );

            }

            // =================================================
            // پشتیبانی از رمز قدیمی
            // =================================================

            else {

                passwordOK =
                    password ===
                    String(
                        user.password
                    );

                if (passwordOK) {

                    user.password =
                        await bcrypt.hash(

                            password,

                            12

                        );

                    saveUsers(users);

                }

            }

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
                    user.name ||
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
                function (
                    sessionError
                ) {

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
// دریافت تمام املاک
// =====================================================

app.get(
    "/api/properties",
    requireAuth,
    function (
        req,
        res
    ) {

        try {

            const properties =
                getProperties();

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
// دریافت یک ملک
// =====================================================

app.get(
    "/api/properties/:id",
    requireAuth,
    function (
        req,
        res
    ) {

        try {

            const properties =
                getProperties();

            const property =
                properties.find(
                    function (
                        item
                    ) {

                        return (

                            String(
                                item.id
                            )

                            ===

                            String(
                                req.params.id
                            )

                        );

                    }
                );

            if (!property) {

                return res.status(404).json({

                    success: false,

                    message:
                        "ملک پیدا نشد."

                });

            }

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
// ثبت ملک
// =====================================================

app.post(
    "/api/properties",
    requireAuth,
    function (
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

            const properties =
                getProperties();

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
            // ذخیره
            // =================================================

            properties.push(
                property
            );

            saveProperties(
                properties
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
// ویرایش ملک
// =====================================================

app.put(
    "/api/properties/:id",
    requireAuth,
    function (
        req,
        res
    ) {

        try {

            const properties =
                getProperties();

            const index =
                properties.findIndex(
                    function (
                        item
                    ) {

                        return (

                            String(
                                item.id
                            )

                            ===

                            String(
                                req.params.id
                            )

                        );

                    }
                );

            if (index === -1) {

                return res.status(404).json({

                    success: false,

                    message:
                        "ملک پیدا نشد."

                });

            }

            const oldProperty =
                properties[index];

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

            properties[index] =
                updatedProperty;

            saveProperties(
                properties
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
// حذف ملک
// =====================================================

app.delete(
    "/api/properties/:id",
    requireRole("admin"),
    function (
        req,
        res
    ) {

        try {

            let properties =
                getProperties();

            const oldLength =
                properties.length;

            properties =
                properties.filter(
                    function (
                        item
                    ) {

                        return (

                            String(
                                item.id
                            )

                            !==

                            String(
                                req.params.id
                            )

                        );

                    }
                );

            if (
                properties.length ===
                oldLength
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "ملک پیدا نشد."

                });

            }

            saveProperties(
                properties
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
// خطای 404 برای API
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
// مدیریت خطاهای Express
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

        await migratePasswords();

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