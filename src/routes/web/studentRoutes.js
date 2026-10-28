const express = require('express');
const router = express.Router();
const studentController = require('../../controllers/studentController');
const { isAdmin } = require('../../middleware/authMiddleware');
const upload = require('../../middleware/upload');

// Only Super Admin + Administrator can manage students
router.use(isAdmin);

router.get('/', studentController.getStudents);
router.get('/create', studentController.renderCreateForm);
router.post('/create', upload.single('profile_photo'), studentController.createStudent);
router.get('/edit/:id', studentController.renderEditForm);
router.post('/edit/:id', upload.single('profile_photo'), studentController.updateStudent);
router.get('/delete/:id', studentController.deleteStudent);

module.exports = router;