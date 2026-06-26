const express = require('express');
const router = express.Router();
const hafalanController = require('../controllers/hafalanController');
const { requireAuth } = require('../middlewares/auth');
const { requireGuruPAI } = require('../middlewares/role');

// All hafalan routes require authentication
router.use(requireAuth);

// Input grading form & save operations (restriced to Guru PAI or Admin)
router.get('/input', requireGuruPAI, hafalanController.showForm);
router.post('/input', requireGuruPAI, hafalanController.create);

// History list (open to all roles, but controller handles role-based data filtering)
router.get('/riwayat', hafalanController.list);

module.exports = router;
