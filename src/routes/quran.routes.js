const express = require('express');
const router = express.Router();
const quranController = require('../controllers/quranController');
const { requireAuth } = require('../middlewares/auth');

// All Quran routes require authentication
router.use(requireAuth);

router.get('/', quranController.listSurahs);
router.get('/murottal', quranController.murottalPlayer);
router.get('/surah/:number', quranController.readSurah);
router.post('/bookmark/add', quranController.addBookmark);
router.post('/bookmark/remove', quranController.removeBookmark);
router.get('/bookmarks', quranController.listBookmarks);
router.get('/ngajibareng', quranController.ngajiBarengIndex);
router.post('/ngajibareng/start', quranController.startNgajiSession);
router.post('/ngajibareng/stop/:id', quranController.stopNgajiSession);
router.get('/ngajibareng/summary/:id', quranController.getNgajiSessionSummary);

module.exports = router;
