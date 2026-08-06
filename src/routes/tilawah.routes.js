const express = require('express');
const router = express.Router();
const tilawahController = require('../controllers/tilawahController');
const { requireAuth } = require('../middlewares/auth');
const { requireGuruPAI } = require('../middlewares/role');

// All tilawah routes require authentication
router.use(requireAuth);

// Input grading form & save operations (restricted to Guru PAI or Admin)
router.get('/input', requireGuruPAI, tilawahController.showForm);
router.post('/input', requireGuruPAI, tilawahController.create);

// History list (open to all roles, but controller handles role-based data filtering)
router.get('/riwayat', tilawahController.list);

module.exports = router;
