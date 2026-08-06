const express = require('express');
const router = express.Router();
const rapotController = require('../controllers/rapotController');
const { requireAuth } = require('../middlewares/auth');

// All rapot routes require authentication
router.use(requireAuth);

router.get('/', rapotController.showRapot);
router.get('/:siswa_id', rapotController.showRapot);

module.exports = router;
