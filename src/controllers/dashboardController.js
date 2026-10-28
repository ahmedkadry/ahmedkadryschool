const pool = require('../config/db');

exports.renderDashboard = async (req, res) => {
    try {
        const [
            [totalStudents],
            [activeStudents],
            [graduatedStudents],
            [totalTeachers],
            [totalCourses],
            [totalEnrollments]
        ] = await Promise.all([
            pool.query("SELECT COUNT(*) as c FROM students"),
            pool.query("SELECT COUNT(*) as c FROM students WHERE status = 'Active'"),
            pool.query("SELECT COUNT(*) as c FROM students WHERE status = 'Graduated'"),
            pool.query("SELECT COUNT(*) as c FROM teachers WHERE status = 'Active'"),
            pool.query("SELECT COUNT(*) as c FROM courses"),
            pool.query("SELECT COUNT(*) as c FROM course_enrollments WHERE status = 'Enrolled'")
        ]);

        const [attendanceRows] = await pool.query(`
            SELECT COUNT(*) AS total,
                   SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present,
                   SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) AS late
            FROM attendance
            WHERE date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        `);
        const aRow = attendanceRows[0] || {};
        const aTotal = Number(aRow.total) || 0;
        const aPresent = Number(aRow.present) || 0;
        const aLate = Number(aRow.late) || 0;
        const attendanceRate = aTotal > 0 ? Math.round(((aPresent + aLate) / aTotal) * 100) : 0;

        const [recentStudents] = await pool.query(`
            SELECT id, student_id_code, first_name, last_name, profile_photo, status, created_at
            FROM students
            ORDER BY created_at DESC
            LIMIT 5
        `);

        const [recentActivity] = await pool.query(`
            SELECT a.action, a.description, a.created_at, u.email
            FROM activity_logs a
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.created_at DESC
            LIMIT 6
        `);

        const [enrollmentData] = await pool.query(`
            SELECT DATE_FORMAT(enrollment_date, '%b') AS month, COUNT(*) AS count
            FROM students
            WHERE enrollment_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            GROUP BY YEAR(enrollment_date), MONTH(enrollment_date), month
            ORDER BY YEAR(enrollment_date), MONTH(enrollment_date)
        `);

        const [deptData] = await pool.query(`
            SELECT d.name AS label, COUNT(s.id) AS count
            FROM departments d
            LEFT JOIN students s ON s.department_id = d.id
            GROUP BY d.id, d.name
            HAVING count > 0
            ORDER BY count DESC
            LIMIT 6
        `);

        const [attendanceBreakdown] = await pool.query(`
            SELECT status AS label, COUNT(*) AS count
            FROM attendance
            WHERE date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY status
        `);

        const [topCourses] = await pool.query(`
            SELECT c.name, c.course_code, COUNT(ce.id) AS enrolled
            FROM courses c
            LEFT JOIN course_enrollments ce ON ce.course_id = c.id AND ce.status = 'Enrolled'
            GROUP BY c.id
            ORDER BY enrolled DESC, c.name
            LIMIT 5
        `);

        // ---------- PRECOMPUTE FOR TEMPLATE (no ternaries in view) ----------

        // 1. Greeting name
        let displayName = 'Admin';
        if (req.session && req.session.user && req.session.user.email) {
            displayName = req.session.user.email.split('@')[0];
        }

        // 2. Recent students — precompute avatar URL + status class
        const studentRows = recentStudents.map(function (s) {
            let avatar = '/images/default-avatar.svg';
            if (s.profile_photo && s.profile_photo !== 'default-avatar.png') {
                if (s.profile_photo.indexOf('http') === 0) avatar = s.profile_photo;
                else if (s.profile_photo.charAt(0) === '/') avatar = s.profile_photo;
                else avatar = '/' + s.profile_photo;
            }
            let statusClass = 'bg-red-500/10 text-red-400 border border-red-500/20';
            if (s.status === 'Active') statusClass = 'bg-green-500/10 text-green-400 border border-green-500/20';
            else if (s.status === 'Graduated') statusClass = 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
            return {
                id: s.id,
                code: s.student_id_code,
                name: s.first_name + ' ' + s.last_name,
                avatar: avatar,
                status: s.status,
                statusClass: statusClass
            };
        });

        // 3. Activity — precompute display name + time ago
        const activityRows = recentActivity.map(function (a) {
            let display = 'System';
            if (a.email) display = a.email.split('@')[0];
            let when = '';
            if (a.created_at) {
                const sec = Math.floor((Date.now() - new Date(a.created_at).getTime()) / 1000);
                if (sec < 60) when = 'just now';
                else if (sec < 3600) when = Math.floor(sec / 60) + 'm ago';
                else if (sec < 86400) when = Math.floor(sec / 3600) + 'h ago';
                else if (sec < 604800) when = Math.floor(sec / 86400) + 'd ago';
                else when = new Date(a.created_at).toLocaleDateString();
            }
            return {
                display: display,
                description: a.description || a.action || '',
                when: when
            };
        });

        // 4. Top courses — precompute percentages
        let maxEnrolled = 1;
        topCourses.forEach(function (c) {
            if (Number(c.enrolled) > maxEnrolled) maxEnrolled = Number(c.enrolled);
        });
        const courseRows = topCourses.map(function (c) {
            const pct = Math.round((Number(c.enrolled) / maxEnrolled) * 100);
            return {
                name: c.name,
                code: c.course_code,
                enrolled: Number(c.enrolled),
                pct: pct
            };
        });

        res.render('dashboard/index', {
            title: 'Dashboard | EduManage',
            displayName: displayName,
            stats: {
                students: Number(totalStudents[0].c) || 0,
                activeStudents: Number(activeStudents[0].c) || 0,
                graduatedStudents: Number(graduatedStudents[0].c) || 0,
                teachers: Number(totalTeachers[0].c) || 0,
                courses: Number(totalCourses[0].c) || 0,
                enrollments: Number(totalEnrollments[0].c) || 0,
                attendanceRate: attendanceRate
            },
            studentRows: studentRows,
            activityRows: activityRows,
            courseRows: courseRows,
            chartEnrollment: JSON.stringify(enrollmentData || []),
            chartDepartment: JSON.stringify(deptData || []),
            chartAttendance: JSON.stringify(attendanceBreakdown || [])
        });

    } catch (err) {
        console.error('Dashboard error:', err);
        res.render('dashboard/index', {
            title: 'Dashboard | EduManage',
            displayName: 'Admin',
            stats: { students: 0, activeStudents: 0, graduatedStudents: 0, teachers: 0, courses: 0, enrollments: 0, attendanceRate: 0 },
            studentRows: [],
            activityRows: [],
            courseRows: [],
            chartEnrollment: '[]',
            chartDepartment: '[]',
            chartAttendance: '[]'
        });
    }
};