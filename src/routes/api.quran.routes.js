const express = require('express');
const router = express.Router();
const apiQuranController = require('../controllers/apiQuranController');
const { requireApiAuth, optionalApiAuth } = require('../middlewares/apiAuth');

// Public Quran endpoints (can also receive optional auth token to check user bookmarks)
router.get('/surah', apiQuranController.getAllSurahs);
router.get('/surah/:number', optionalApiAuth, apiQuranController.getSurahDetail);
router.get('/surah/:number/:ayat', optionalApiAuth, apiQuranController.getSingleAyat);
router.get('/qari', apiQuranController.getQariList);
router.get('/tajweed-guide', apiQuranController.getTajweedGuide);
router.get('/search', apiQuranController.searchQuran);

// Protected User Bookmark endpoints
router.get('/bookmarks', requireApiAuth, apiQuranController.getUserBookmarks);
router.post('/bookmark', requireApiAuth, apiQuranController.addBookmark);
router.delete('/bookmark/:id', requireApiAuth, apiQuranController.removeBookmark);
router.delete('/bookmark/surah/:surah/ayat/:ayat', requireApiAuth, apiQuranController.removeBookmarkBySurahAyat);

module.exports = router;
