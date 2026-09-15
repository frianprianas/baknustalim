const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');

router.get('/dashboard-stats', apiController.getDashboardStats);
router.get('/user-stats', apiController.getUserStats);

// Forward /api/quran and /api/v1/quran to Quran API routes
router.use('/quran', require('./api.quran.routes'));
router.use('/v1/quran', require('./api.quran.routes'));
router.use('/auth', require('./api.auth.routes'));
router.use('/v1/auth', require('./api.auth.routes'));

module.exports = router;
