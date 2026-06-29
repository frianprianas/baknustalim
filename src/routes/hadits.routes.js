const express = require('express');
const router = express.Router();
const haditsController = require('../controllers/haditsController');

// All authenticated users can search hadits (using middleware if needed, but we'll assume it's protected at app.js level or public)
// For BaknusTa'lim, some routes are public. Let's make it public for now, or protected.
const { requireAuth } = require('../middlewares/auth');

router.get('/', requireAuth, haditsController.getIndex);
router.get('/tanya', requireAuth, haditsController.getTanya);
router.post('/tanya', requireAuth, haditsController.postTanya);

module.exports = router;
