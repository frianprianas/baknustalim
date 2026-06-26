const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAuth } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/role');

// Apply admin role middleware to all routes in this router
router.use(requireAuth, requireRole(['admin']));

// Dashboard
router.get('/', (req, res) => res.redirect('/admin/dashboard'));
router.get('/dashboard', adminController.showDashboard);

// User Management
router.get('/users', adminController.listUsers);
router.post('/users/sync', adminController.syncMailcow);
router.get('/users/edit/:id', adminController.editUser);
router.post('/users/edit/:id', adminController.updateUser);

// Kelas Management
router.get('/kelas', adminController.listKelas);
router.post('/kelas/create', adminController.createKelas);
router.get('/kelas/edit/:id', adminController.editKelas);
router.post('/kelas/edit/:id', adminController.updateKelas);
router.post('/kelas/delete/:id', adminController.deleteKelas);

// Class Assignment operations
router.post('/kelas/:id/assign-student', adminController.assignStudent);
router.post('/kelas/:id/remove-student', adminController.removeStudent);
router.post('/kelas/:id/assign-guru', adminController.assignGuruPAI);
router.post('/kelas/:id/remove-guru', adminController.removeGuruPAI);

// Master Jenis Ibadah Management
router.get('/ibadah', adminController.listIbadah);
router.post('/ibadah/create', adminController.createIbadah);
router.post('/ibadah/edit/:id', adminController.updateIbadah);
router.post('/ibadah/delete/:id', adminController.deleteIbadah);

module.exports = router;
