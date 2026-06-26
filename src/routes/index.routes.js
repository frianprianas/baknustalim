const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { requireAuth } = require('../middlewares/auth');

router.get('/', requireAuth, (req, res) => res.redirect('/dashboard'));
router.get('/dashboard', requireAuth, dashboardController.showDashboard);

module.exports = router;
