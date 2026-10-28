const pool = require('../config/db');
const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');

/*
exports.renderLogin = (req, res) => {
    try {
        // If already logged in, redirect
        if (req.session && req.session.user) {
            return res.redirect('/dashboard');
        }

        // Render the login page
        res.render('auth/login', {
            title: 'Login | EduManage',
            error_msg: res.locals.error_msg || [],
            success_msg: res.locals.success_msg || []
        });
    } catch (error) {
        console.error('❌ Render login error:', error);
        res.status(500).send(`
            <h1>Template Error</h1>
            <p>Could not load the login page.</p>
            <pre>${error.message}</pre>
            <p>Please verify that the file exists at: <code>views/auth/login.ejs</code></p>
        `);
    }
};
*/

exports.renderLogin = (req, res) => {
    if (req.session && req.session.user) return res.redirect('/dashboard');
    res.render('auth/login', {
        layout: false,
        title: 'Login | EduManage',
        error_msg: res.locals.error_msg || [],
        success_msg: res.locals.success_msg || []
    });
};



exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const [users] = await pool.query(
            `SELECT u.*, r.name as role_name 
             FROM users u 
             JOIN roles r ON u.role_id = r.id 
             WHERE u.email = ?`,
            [email]
        );

        if (users.length === 0) {
            req.flash('error_msg', 'Invalid email or password.');
            return res.redirect('/login');
        }

        const user = users[0];

        if (user.status !== 'active') {
            req.flash('error_msg', 'Your account is suspended. Contact administration.');
            return res.redirect('/login');
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            req.flash('error_msg', 'Invalid email or password.');
            return res.redirect('/login');
        }

        req.session.regenerate((err) => {
            if (err) {
                console.error('Session regenerate error:', err);
                req.flash('error_msg', 'Server error during login.');
                return res.redirect('/login');
            }

            req.session.user = {
                id: user.id,
                email: user.email,
                role: user.role_name
            };

            pool.query(
                'INSERT INTO activity_logs (user_id, action, description) VALUES (?, ?, ?)',
                [user.id, 'LOGIN', 'User logged into the system']
            ).catch(e => console.error('Activity log error:', e));

            res.redirect('/dashboard');
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        req.flash('error_msg', 'Server error during login.');
        res.redirect('/login');
    }
};

/*
exports.renderRegister = (req, res) => {
    if (req.session && req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('auth/register', {
        title: 'Register | EduManage',
        error_msg: res.locals.error_msg || [],
        success_msg: res.locals.success_msg || [],
        old: req.flash('old')[0] || {} // Retain form data if validation fails
    });
};
*/

exports.renderRegister = (req, res) => {
    if (req.session && req.session.user) return res.redirect('/dashboard');

    // Safely pull previous input (may be undefined)
    const prev = req.flash('old')[0] || {};
    const role = prev.role === 'Teacher' ? 'Teacher' : 'Student';

    res.render('auth/register', {
        layout: false,
        title: 'Register | EduManage',
        error_msg: res.locals.error_msg || [],
        success_msg: res.locals.success_msg || [],
        // Everything precomputed — no logic needed in the template
        role: role,
        studentChecked: role === 'Student' ? 'checked' : '',
        teacherChecked: role === 'Teacher' ? 'checked' : '',
        firstName: prev.firstName || '',
        lastName: prev.lastName || '',
        email: prev.email || ''
    });
};



exports.register = async (req, res) => {
    const { firstName, lastName, email, password, confirmPassword, role } = req.body;

    // 1. Validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.flash('error_msg', errors.array()[0].msg);
        req.flash('old', req.body);
        return res.redirect('/register');
    }

    if (password !== confirmPassword) {
        req.flash('error_msg', 'Passwords do not match.');
        req.flash('old', req.body);
        return res.redirect('/register');
    }

    // 2. Check if email already exists
    try {
        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            req.flash('error_msg', 'Email is already registered.');
            req.flash('old', req.body);
            return res.redirect('/register');
        }

        // 3. Get Role ID (Only allow Student or Teacher)
        let roleName = role === 'Teacher' ? 'Teacher' : 'Student';
        const [roles] = await pool.query('SELECT id FROM roles WHERE name = ?', [roleName]);

        if (roles.length === 0) {
            throw new Error('Role not found in database. Please run the seed script.');
        }
        const roleId = roles[0].id;

        // 4. Hash Password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 5. Use a Transaction
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Insert into users
            const [userResult] = await connection.query(
                'INSERT INTO users (role_id, email, password_hash) VALUES (?, ?, ?)',
                [roleId, email, hashedPassword]
            );
            const userId = userResult.insertId;

            // Generate unique code (e.g., STU-2024-1234)
            const dateYear = new Date().getFullYear();
            const randomNum = Math.floor(1000 + Math.random() * 9000);

            if (roleName === 'Student') {
                const studentCode = `STU-${dateYear}-${randomNum}`;
                // Insert into students with required default fields
                await connection.query(
                    `INSERT INTO students 
                    (user_id, student_id_code, first_name, last_name, gender, dob, enrollment_date, status) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [userId, studentCode, firstName, lastName, 'Other', '2000-01-01', new Date(), 'Active']
                );
            } else if (roleName === 'Teacher') {
                const teacherCode = `TCH-${dateYear}-${randomNum}`;
                // Insert into teachers
                await connection.query(
                    `INSERT INTO teachers 
                    (user_id, teacher_id_code, first_name, last_name, hire_date, status) 
                    VALUES (?, ?, ?, ?, ?, ?)`,
                    [userId, teacherCode, firstName, lastName, new Date(), 'Active']
                );
            }

            // Commit transaction
            await connection.commit();

            // Log the activity
            pool.query(
                'INSERT INTO activity_logs (user_id, action, description) VALUES (?, ?, ?)',
                [userId, 'REGISTER', `New ${roleName} account created`]
            ).catch(e => console.error(e));

            req.flash('success_msg', 'Account created successfully! Please log in.');
            res.redirect('/login');

        } catch (dbError) {
            await connection.rollback();
            throw dbError;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Registration Error:', error);
        req.flash('error_msg', 'Server error during registration. Please try again.');
        res.redirect('/register');
    }
};


exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error(err);
        res.redirect('/login');
    });
};


