const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');

router.get('/dashboard-stats', apiController.getDashboardStats);
router.get('/user-stats', apiController.getUserStats);

module.exports = router;
