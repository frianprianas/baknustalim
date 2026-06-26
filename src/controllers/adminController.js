const User = require('../models/User');
const Kelas = require('../models/Kelas');
const KelasGuruPAI = require('../models/KelasGuruPAI');
const JenisIbadah = require('../models/JenisIbadah');
const Hafalan = require('../models/Hafalan');
const PraktekIbadah = require('../models/PraktekIbadah');
const Question = require('../models/Question');
const mailcowService = require('../services/mailcowService');

// ================= USER MANAGEMENT =================

exports.showDashboard = async (req, res) => {
  try {
    const totalSiswa = await User.countDocuments({ role: 'siswa' });
    const totalGuru = await User.countDocuments({ role: 'guru' });
    const totalTU = await User.countDocuments({ role: 'tu' });
    const totalKelas = await Kelas.countDocuments();
    const totalGuruPAI = await User.countDocuments({ role: 'guru', is_guru_pai: true });

    // Hafalan stats
    const totalHafalan = await Hafalan.countDocuments();
    const kompetenHafalan = await Hafalan.countDocuments({ status: 'Kompeten' });

    // Worship stats
    const totalIbadah = await PraktekIbadah.countDocuments();
    const kompetenIbadah = await PraktekIbadah.countDocuments({ status: 'Kompeten' });

    // Q&A stats
    const totalQuestions = await Question.countDocuments();
    const answeredQuestions = await Question.countDocuments({ status: 'dijawab' });
    const unansweredQuestions = totalQuestions - answeredQuestions;

    res.render('admin/dashboard', {
      title: 'Admin Dashboard - BaknusTa\'lim',
      stats: { 
        totalSiswa, totalGuru, totalTU, totalKelas, totalGuruPAI,
        totalHafalan, kompetenHafalan,
        totalIbadah, kompetenIbadah,
        totalQuestions, answeredQuestions, unansweredQuestions
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};

exports.listUsers = async (req, res) => {
  try {
    const { role, search } = req.query;
    const filter = {};
    
    if (role) {
      filter.role = role;
    }
    if (search) {
      filter.$or = [
        { nama: { $regex: search, $options: 'i' } },
        { mailcow_email: { $regex: search, $options: 'i' } },
        { nis: { $regex: search, $options: 'i' } },
        { nip: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(filter).populate('kelas_id').sort({ nama: 1 });
    res.render('admin/users/index', {
      title: 'Kelola User - BaknusTa\'lim',
      users,
      roleFilter: role || '',
      searchQuery: search || ''
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};

exports.syncMailcow = async (req, res) => {
  try {
    const count = await mailcowService.syncUsersFromMailcow();
    req.session.successMessage = `Berhasil menyinkronkan ${count} user dari Mailcow.`;
    res.redirect('/admin/users');
  } catch (error) {
    console.error(error);
    req.session.errorMessage = `Sinkronisasi gagal: ${error.message}`;
    res.redirect('/admin/users');
  }
};

exports.editUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).render('error', { title: 'User Tidak Ditemukan', message: 'User tidak ditemukan.', error: { status: 404 } });
    }
    
    const classes = await Kelas.find().sort({ nama_kelas: 1, tahun_ajaran: -1 });
    res.render('admin/users/edit', {
      title: `Edit User: ${user.nama} - BaknusTa\'lim`,
      user,
      classes,
      error: null
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { nama, role, nis, nip, is_guru_pai, kelas_id } = req.body;
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).render('error', { title: 'User Tidak Ditemukan', message: 'User tidak ditemukan.', error: { status: 404 } });
    }

    user.nama = nama;
    user.role = role;
    user.nis = role === 'siswa' ? (nis || null) : null;
    user.nip = (role === 'guru' || role === 'tu') ? (nip || null) : null;
    user.is_guru_pai = role === 'guru' ? (is_guru_pai === 'on' || is_guru_pai === true) : false;
    user.kelas_id = role === 'siswa' ? (kelas_id || null) : null;

    await user.save();
    
    req.session.successMessage = `User ${user.nama} berhasil diperbarui.`;
    res.redirect('/admin/users');
  } catch (error) {
    console.error(error);
    const classes = await Kelas.find().sort({ nama_kelas: 1, tahun_ajaran: -1 });
    const user = await User.findById(req.params.id);
    res.render('admin/users/edit', {
      title: `Edit User - BaknusTa\'lim`,
      user,
      classes,
      error: error.message
    });
  }
};

// ================= KELAS MANAGEMENT =================

exports.listKelas = async (req, res) => {
  try {
    const classes = await Kelas.find().sort({ tahun_ajaran: -1, nama_kelas: 1 });
    res.render('admin/kelas/index', {
      title: 'Kelola Kelas - BaknusTa\'lim',
      classes
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};

exports.createKelas = async (req, res) => {
  try {
    const { nama_kelas, tahun_ajaran } = req.body;
    if (!nama_kelas || !tahun_ajaran) {
      throw new Error('Nama Kelas dan Tahun Ajaran wajib diisi.');
    }
    
    await Kelas.create({ nama_kelas, tahun_ajaran });
    req.session.successMessage = `Kelas ${nama_kelas} (${tahun_ajaran}) berhasil dibuat.`;
    res.redirect('/admin/kelas');
  } catch (error) {
    console.error(error);
    req.session.errorMessage = `Gagal membuat kelas: ${error.message}`;
    res.redirect('/admin/kelas');
  }
};

exports.editKelas = async (req, res) => {
  try {
    const kelas = await Kelas.findById(req.params.id);
    if (!kelas) {
      return res.status(404).render('error', { title: 'Kelas Tidak Ditemukan', message: 'Kelas tidak ditemukan.', error: { status: 404 } });
    }

    // Students in this class
    const studentsInClass = await User.find({ role: 'siswa', kelas_id: kelas._id }).sort({ nama: 1 });
    
    // Students with NO class assigned
    const unassignedStudents = await User.find({ role: 'siswa', kelas_id: null }).sort({ nama: 1 });

    // PAI Teachers assigned to this class
    const mappings = await KelasGuruPAI.find({ kelas_id: kelas._id }).populate('guru_id');
    const assignedTeachers = mappings.map(m => m.guru_id).filter(t => t !== null);

    // All Guru PAI list to select from
    const allTeachers = await User.find({ role: 'guru' }).sort({ nama: 1 });
    const assignedIds = assignedTeachers.map(t => t._id.toString());
    const unassignedTeachers = allTeachers.filter(t => !assignedIds.includes(t._id.toString()));

    res.render('admin/kelas/edit', {
      title: `Kelola Detail Kelas: ${kelas.nama_kelas} - BaknusTa\'lim`,
      kelas,
      studentsInClass,
      unassignedStudents,
      assignedTeachers,
      unassignedTeachers
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};

exports.updateKelas = async (req, res) => {
  try {
    const { nama_kelas, tahun_ajaran } = req.body;
    await Kelas.findByIdAndUpdate(req.params.id, { nama_kelas, tahun_ajaran });
    req.session.successMessage = 'Detail Kelas berhasil diperbarui.';
    res.redirect(`/admin/kelas/edit/${req.params.id}`);
  } catch (error) {
    console.error(error);
    req.session.errorMessage = `Gagal memperbarui kelas: ${error.message}`;
    res.redirect(`/admin/kelas/edit/${req.params.id}`);
  }
};

exports.deleteKelas = async (req, res) => {
  try {
    const kelasId = req.params.id;
    // 1. Remove kelas_id from students in this class
    await User.updateMany({ kelas_id: kelasId }, { $set: { kelas_id: null } });
    // 2. Remove Guru PAI mappings
    await KelasGuruPAI.deleteMany({ kelas_id: kelasId });
    // 3. Delete class itself
    await Kelas.findByIdAndDelete(kelasId);
    
    req.session.successMessage = 'Kelas berhasil dihapus.';
    res.redirect('/admin/kelas');
  } catch (error) {
    console.error(error);
    req.session.errorMessage = `Gagal menghapus kelas: ${error.message}`;
    res.redirect('/admin/kelas');
  }
};

// Assign Student to Class
exports.assignStudent = async (req, res) => {
  try {
    const { student_id } = req.body;
    const kelasId = req.params.id;
    
    await User.findByIdAndUpdate(student_id, { kelas_id: kelasId });
    req.session.successMessage = 'Siswa berhasil dimasukkan ke kelas.';
    res.redirect(`/admin/kelas/edit/${kelasId}`);
  } catch (error) {
    console.error(error);
    req.session.errorMessage = error.message;
    res.redirect(`/admin/kelas/edit/${req.params.id}`);
  }
};

// Remove Student from Class
exports.removeStudent = async (req, res) => {
  try {
    const { student_id } = req.body;
    const kelasId = req.params.id;
    
    await User.findByIdAndUpdate(student_id, { kelas_id: null });
    req.session.successMessage = 'Siswa dikeluarkan dari kelas.';
    res.redirect(`/admin/kelas/edit/${kelasId}`);
  } catch (error) {
    console.error(error);
    req.session.errorMessage = error.message;
    res.redirect(`/admin/kelas/edit/${req.params.id}`);
  }
};

// Assign PAI Teacher to Class
exports.assignGuruPAI = async (req, res) => {
  try {
    const { guru_id } = req.body;
    const kelasId = req.params.id;
    
    // 1. Ensure the teacher exists and has is_guru_pai set to true
    const guru = await User.findById(guru_id);
    if (!guru || guru.role !== 'guru') {
      throw new Error('User bukan Guru.');
    }
    
    if (!guru.is_guru_pai) {
      guru.is_guru_pai = true;
      await guru.save();
    }

    // 2. Create the mapping
    await KelasGuruPAI.create({ kelas_id: kelasId, guru_id: guru_id });
    
    req.session.successMessage = 'Guru PAI berhasil ditugaskan ke kelas ini.';
    res.redirect(`/admin/kelas/edit/${kelasId}`);
  } catch (error) {
    console.error(error);
    req.session.errorMessage = `Gagal menugaskan Guru PAI: ${error.message}`;
    res.redirect(`/admin/kelas/edit/${req.params.id}`);
  }
};

// Remove PAI Teacher from Class
exports.removeGuruPAI = async (req, res) => {
  try {
    const { guru_id } = req.body;
    const kelasId = req.params.id;
    
    // Delete the mapping
    await KelasGuruPAI.deleteOne({ kelas_id: kelasId, guru_id: guru_id });
    
    req.session.successMessage = 'Tugas mengajar Guru PAI berhasil dihapus dari kelas ini.';
    res.redirect(`/admin/kelas/edit/${kelasId}`);
  } catch (error) {
    console.error(error);
    req.session.errorMessage = error.message;
    res.redirect(`/admin/kelas/edit/${req.params.id}`);
  }
};

// ================= JENIS IBADAH (MASTER DATA) =================

exports.listIbadah = async (req, res) => {
  try {
    const list = await JenisIbadah.find().sort({ nama_ibadah: 1 });
    res.render('admin/ibadah/index', {
      title: 'Kelola Master Jenis Ibadah - BaknusTa\'lim',
      list
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};

exports.createIbadah = async (req, res) => {
  try {
    const { nama_ibadah, deskripsi } = req.body;
    if (!nama_ibadah) {
      throw new Error('Nama ibadah wajib diisi.');
    }

    await JenisIbadah.create({ nama_ibadah, deskripsi });
    req.session.successMessage = `Jenis Ibadah "${nama_ibadah}" berhasil ditambahkan.`;
    res.redirect('/admin/ibadah');
  } catch (error) {
    console.error(error);
    req.session.errorMessage = `Gagal menambahkan jenis ibadah: ${error.message}`;
    res.redirect('/admin/ibadah');
  }
};

exports.updateIbadah = async (req, res) => {
  try {
    const { nama_ibadah, deskripsi, is_active } = req.body;
    await JenisIbadah.findByIdAndUpdate(req.params.id, {
      nama_ibadah,
      deskripsi,
      is_active: is_active === 'on' || is_active === true
    });
    req.session.successMessage = 'Jenis Ibadah berhasil diperbarui.';
    res.redirect('/admin/ibadah');
  } catch (error) {
    console.error(error);
    req.session.errorMessage = `Gagal memperbarui jenis ibadah: ${error.message}`;
    res.redirect('/admin/ibadah');
  }
};

exports.deleteIbadah = async (req, res) => {
  try {
    await JenisIbadah.findByIdAndDelete(req.params.id);
    req.session.successMessage = 'Jenis Ibadah berhasil dihapus.';
    res.redirect('/admin/ibadah');
  } catch (error) {
    console.error(error);
    req.session.errorMessage = `Gagal menghapus jenis ibadah: ${error.message}`;
    res.redirect('/admin/ibadah');
  }
};
