const express = require('express');
const router = express.Router();
const belajarController = require('../controllers/belajarController');
const { requireAuth } = require('../middlewares/auth');
const { requireGuruPAI } = require('../middlewares/role');

// Require authentication for all learning portal routes
router.use(requireAuth);

// 1. Menu Utama Portal Belajar Islam
router.get('/', belajarController.listMenu);

// 2. Modul Tajwid (Statis)
router.get('/tajwid', belajarController.listTajwid);
router.get('/tajwid/materi/:sub_id', belajarController.showTajwid);

// 3. Modul Kategori Lain (Dinamis: Akhlak, Fiqih, Aqidah)
router.get('/kategori/:kategori_id', belajarController.listKategori);
router.get('/materi/:materi_id', belajarController.showMateri);

// 4. Pengunggahan & Manajemen Materi (Hanya Guru PAI & Admin)
router.get('/input', requireGuruPAI, belajarController.showInputForm);
router.post('/input', requireGuruPAI, belajarController.saveMateri);
router.post('/delete/:materi_id', requireGuruPAI, belajarController.deleteMateri);

module.exports = router;
