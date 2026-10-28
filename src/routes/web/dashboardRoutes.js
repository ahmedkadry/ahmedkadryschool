const express = require('express');
const router = express.Router();
const dashboardController = require('../../controllers/dashboardController');
const { isAuthenticated, isStaff } = require('../../middleware/authMiddleware');

// Only staff (Super Admin, Admin, Teacher) can access the admin dashboard
router.get('/dashboard', isAuthenticated, isStaff, dashboardController.renderDashboard);

module.exports = router;