const express = require('express');
const path = require('path');
const helmet = require('helmet');
const session = require('express-session');
require('dotenv').config();

const app = express();

// ============================================================
// 1. SECURITY HEADERS
// ============================================================
app.use(helmet({
    contentSecurityPolicy: false, // Disabled in dev for Tailwind CDN
}));

// ============================================================
// 2. BODY PARSERS
// ============================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================
// 3. STATIC FILES
// ============================================================
app.use(express.static(path.join(__dirname, '../public')));

// ============================================================
// 4. VIEW ENGINE (EJS)
// ============================================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// ============================================================
// 4. Layout (EJS)
// ============================================================
const expressLayouts = require('express-ejs-layouts');
app.use(expressLayouts);
app.set('layout', 'layouts/dashboard'); // default layout
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// ============================================================
// 5. SESSION
// ============================================================
app.use(session({
    secret: process.env.SESSION_SECRET || 'dev_secret_fallback_change_me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// ============================================================
// 6. FLASH MESSAGES (with fallback)
// ============================================================
/*let flash;
try {
    flash = require('connect-flash');
    app.use(flash());
    console.log('✅ connect-flash loaded successfully');
} catch (err) {
    console.warn('⚠️ connect-flash not found. Using manual flash fallback.');

    // Manual flash implementation
    app.use((req, res, next) => {
        req.flash = function (type, message) {
            req.session.flash = req.session.flash || {};
            req.session.flash[type] = req.session.flash[type] || [];
            if (message) {
                req.session.flash[type].push(message);
                return req.session.flash[type];
            } else {
                const messages = req.session.flash[type] || [];
                req.session.flash[type] = [];
                return messages;
            }
        };
        next();
    });
}*/

app.use((req, res, next) => {
    req.session.flash = req.session.flash || {};

    req.flash = function (type, message) {
        // Get existing messages for this type
        const existing = req.session.flash[type] || [];

        // If a message is provided, push it and return the array
        if (message !== undefined) {
            existing.push(message);
            req.session.flash[type] = existing;
            return existing;
        }

        // Otherwise, return the messages and clear them
        req.session.flash[type] = [];
        return existing;
    };

    next();
});

// ============================================================
// 7. GLOBAL LOCALS (uses req.flash — MUST come after flash!)
// ============================================================
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.user = req.session.user || null;
    next();
});

// ============================================================
// 8. ROUTES
// ============================================================
const authRoutes = require('./routes/web/authRoutes');
const dashboardRoutes = require('./routes/web/dashboardRoutes');
const studentRoutes = require('./routes/web/studentRoutes');
const teacherRoutes = require('./routes/web/teacherRoutes');
const courseRoutes = require('./routes/web/courseRoutes');
const attendanceRoutes = require('./routes/web/attendanceRoutes');

app.use('/', authRoutes);
app.use('/', dashboardRoutes);
app.use('/students', studentRoutes);
app.use('/teachers', teacherRoutes);
app.use('/courses', courseRoutes);
app.use('/attendance', attendanceRoutes);

// Landing Page
app.get('/', (req, res) => {
    res.render('landing/index', {
        layout: false,
        title: 'EduManage | Premium SMS',
        error_msg: res.locals.error_msg || [],
        success_msg: res.locals.success_msg || []
    });
});

// Temporary Dashboard Route
app.get('/dashboard', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.send(`
        <html>
        <body style="font-family: sans-serif; padding: 40px; background: #0B0F19; color: white;">
            <h1>✅ Logged in as: ${req.session.user.email}</h1>
            <p>Role: <strong>${req.session.user.role}</strong></p>
            <p>Dashboard coming in Part 3.</p>
            <a href="/logout" style="color: #8B5CF6;">Logout</a>
        </body>
        </html>
    `);
});

// ============================================================
// 9. 404 HANDLER
// ============================================================
app.use((req, res) => {
    res.status(404).send(`
        <div style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1>404 — Page Not Found</h1>
            <p>The route <code>${req.path}</code> does not exist.</p>
            <a href="/">← Back to Home</a>
        </div>
    `);
});

module.exports = app;