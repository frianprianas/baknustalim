const express = require('express');
const router = express.Router();
const ibadahController = require('../controllers/ibadahController');
const { requireAuth } = require('../middlewares/auth');
const { requireGuruPAI } = require('../middlewares/role');

// All worship routes require authentication
router.use(requireAuth);

// Input grading form & save operations (restricted to Guru PAI or Admin)
router.get('/input', requireGuruPAI, ibadahController.showForm);
router.post('/input', requireGuruPAI, ibadahController.create);

// History list (open to all roles, but controller handles role-based data filtering)
router.get('/riwayat', ibadahController.list);

module.exports = router;
