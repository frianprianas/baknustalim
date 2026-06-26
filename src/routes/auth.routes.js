const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { redirectIfAuth } = require('../middlewares/auth');

router.get('/login', redirectIfAuth, authController.showLogin);
router.post('/login', redirectIfAuth, authController.login);
router.get('/logout', authController.logout);

module.exports = router;
