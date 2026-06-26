const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { requireAuth } = require('../middlewares/auth');
const { requireGuruPAI } = require('../middlewares/role');

// All AI helper endpoints require authentication and Guru PAI / Admin role
router.use(requireAuth);
router.use(requireGuruPAI);

router.post('/draft-answer', aiController.getDraftAnswer);
router.post('/generate-feedback', aiController.getFeedback);

module.exports = router;
