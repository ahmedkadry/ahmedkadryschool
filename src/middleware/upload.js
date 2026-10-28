const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../public/uploads/profiles');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('📁 Created upload directory:', uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `profile-${unique}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Only JPG, PNG, WebP allowed'));
};

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
    fileFilter
});

// Wrapper that catches multer errors cleanly and redirects back with a flash message
upload.handleSingle = (field) => (req, res, next) => {
    upload.single(field)(req, res, (err) => {
        if (!err) return next();

        console.error('❌ Upload error:', err.message);
        let msg = 'Upload failed.';
        if (err.code === 'LIMIT_FILE_SIZE') msg = 'File too large. Maximum size is 2 MB.';
        else if (err.code === 'LIMIT_UNEXPECTED_FILE') msg = 'Invalid file type. Use JPG, PNG or WebP.';
        else if (err.message) msg = err.message;

        req.flash('error_msg', msg);
        return res.redirect(req.get('Referer') || '/students');
    });
};

module.exports = upload;