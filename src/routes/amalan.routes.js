const express = require('express');
const router = express.Router();
const amalanController = require('../controllers/amalanController');
const { requireAuth } = require('../middlewares/auth');
const { requireGuruPAI } = require('../middlewares/role');

// All amalan routes require authentication
router.use(requireAuth);

// Student logging routes
router.get('/', amalanController.showForm);
router.post('/', amalanController.saveForm);
router.get('/riwayat', amalanController.listRiwayat);

// Teacher/Admin/TU report routes
router.get('/laporan', amalanController.listLaporan);
router.get('/detail/:siswa_id', amalanController.showDetail);

module.exports = router;
