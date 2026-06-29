const express = require('express');
const router = express.Router();
const tajweedController = require('../controllers/tajweedController');
const { requireAuth } = require('../middlewares/auth');

// All Tajweed routes require authentication
router.use(requireAuth);

router.get('/', tajweedController.listLessons);
router.get('/materi/:sub_id', tajweedController.showLesson);

module.exports = router;
