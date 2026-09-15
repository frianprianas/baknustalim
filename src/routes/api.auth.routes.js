const express = require('express');
const router = express.Router();
const apiAuthController = require('../controllers/apiAuthController');
const { requireApiAuth } = require('../middlewares/apiAuth');

router.post('/login', apiAuthController.login);
router.get('/me', requireApiAuth, apiAuthController.getProfile);

module.exports = router;
