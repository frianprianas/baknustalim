const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');

router.get('/dashboard-stats', apiController.getDashboardStats);

module.exports = router;
