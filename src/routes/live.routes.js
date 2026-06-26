const express = require('express');
const router = express.Router();
const liveController = require('../controllers/liveController');
const { requireAuth } = require('../middlewares/auth');

// All live routes require authentication
router.use(requireAuth);

router.get('/', liveController.listLiveSessions);
router.post('/start', liveController.startLiveSession);
router.post('/stop/:id', liveController.stopLiveSession);
router.get('/room/:room_name', liveController.joinLiveSession);

module.exports = router;
