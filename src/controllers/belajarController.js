const fs = require('fs');
const path = require('path');
const MateriIslam = require('../models/MateriIslam');

// Helper to load static Tajweed lessons JSON
function getTajwidLessons() {
  const filePath = path.join(__dirname, '../data/tajweedLessons.json');
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(fileContent);
}

// Map slug/db category to human-readable names
const KATEGORI_MAP = {
  'akhlak': 'Akhlak',
  'fiqih_ibadah': 'Fiqih Ibadah',
  'aqidah': 'Aqidah'
};

// 1. Show Main Dashboard Menu (Belajar Islam)
exports.listMenu = async (req, res) => {
  try {
    res.render('belajar/index', {
      title: 'Belajar Islam - BaknusTa\'lim',
      categories: [
        { id: 'tajwid', name: 'Tajwid', desc: 'Aturan cara membaca Al-Qur\'an secara tartil, benar, dan fasih.', icon: 'fa-book-quran', color: 'border-success', badgeColor: 'bg-success-subtle text-success' },
        { id: 'akhlak', name: 'Akhlak', desc: 'Pembinaan karakter islami, adab sehari-hari, dan budi pekerti.', icon: 'fa-hands-holding-child', color: 'border-info', badgeColor: 'bg-info-subtle text-info' },
        { id: 'fiqih_ibadah', name: 'Fiqih Ibadah', desc: 'Hukum-hukum fikih praktis bersuci, salat, puasa, dan ibadah lainnya.', icon: 'fa-mosque', color: 'border-warning', badgeColor: 'bg-warning-subtle text-warning' },
        { id: 'aqidah', name: 'Aqidah', desc: 'Penguatan tauhid, rukun iman, dan keyakinan beragama Islam.', icon: 'fa-kaaba', color: 'border-primary', badgeColor: 'bg-primary-subtle text-primary' }
      ]
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};

// 2. Show static Tajweed chapters list
exports.listTajwid = async (req, res) => {
  try {
    const lessons = getTajwidLessons();
    res.render('belajar/tajwid_list', {
      title: 'Belajar Tajwid - BaknusTa\'lim',
      lessons
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};

// 3. Show static Tajweed lesson detail
exports.showTajwid = async (req, res) => {
  try {
    const { sub_id } = req.params;
    const lessons = getTajwidLessons();

    let foundSub = null;
    let foundBabTitle = '';

    for (const b of lessons) {
      const match = b.sub_bab.find(s => s.id === sub_id);
      if (match) {
        foundSub = match;
        foundBabTitle = b.bab;
        break;
      }
    }

    if (!foundSub) {
      return res.status(404).render('error', { 
        title: 'Materi Tidak Ditemukan', 
        message: 'Materi sub-bab tajwid tidak ditemukan.', 
        error: { status: 404 } 
      });
    }

    res.render('belajar/tajwid_detail', {
      title: `${foundSub.topik} - Belajar Tajwid`,
      babTitle: foundBabTitle,
      lesson: foundSub
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};

// 4. Show list of dynamic articles in a category (Akhlak, Fiqih, Aqidah)
exports.listKategori = async (req, res) => {
  try {
    const { kategori_id } = req.params;
    if (!KATEGORI_MAP[kategori_id]) {
      return res.status(404).render('error', { title: 'Kategori Tidak Ditemukan', message: 'Kategori materi belajar tidak ditemukan.', error: { status: 404 } });
    }

    const materiList = await MateriIslam.find({ kategori: kategori_id })
      .populate('guru_id', 'nama')
      .sort({ createdAt: -1 });

    res.render('belajar/kategori_list', {
      title: `Belajar ${KATEGORI_MAP[kategori_id]} - BaknusTa\'lim`,
      kategoriId: kategoriId = kategori_id,
      kategoriName: KATEGORI_MAP[kategori_id],
      materiList
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};

// 5. Show detail view of a dynamic article
exports.showMateri = async (req, res) => {
  try {
    const { materi_id } = req.params;
    const materi = await MateriIslam.findById(materi_id).populate('guru_id', 'nama');
    if (!materi) {
      return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Materi belajar tidak ditemukan.', error: { status: 404 } });
    }

    const currentUser = req.session.user;
    let earnedPoints = false;
    if (currentUser && currentUser.role === 'siswa') {
      const MateriReadLog = require('../models/MateriReadLog');
      const existingLog = await MateriReadLog.findOne({
        siswa_id: currentUser.id,
        materi_id: materi._id
      });
      if (!existingLog) {
        await MateriReadLog.create({
          siswa_id: currentUser.id,
          materi_id: materi._id
        });
        const { updateUserPoints } = require('../services/pointsService');
        await updateUserPoints(currentUser.id);
        earnedPoints = true;
      }
    }

    res.render('belajar/materi_detail', {
      title: `${materi.judul} - Belajar ${KATEGORI_MAP[materi.kategori]}`,
      materi,
      kategoriName: KATEGORI_MAP[materi.kategori],
      earnedPoints
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};

// 6. Show input/edit form for Guru PAI / Admin
exports.showInputForm = async (req, res) => {
  try {
    const { edit_id } = req.query;
    let materi = null;

    if (edit_id) {
      materi = await MateriIslam.findById(edit_id);
      if (!materi) {
        return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Materi yang akan diedit tidak ditemukan.', error: { status: 404 } });
      }
      
      // Verify ownership (Guru PAI who uploaded or Admin)
      const user = req.session.user;
      if (user.role !== 'admin' && materi.guru_id.toString() !== user.id) {
        return res.status(403).render('error', { title: 'Akses Ditolak', message: 'Anda tidak memiliki wewenang untuk mengedit materi ini.', error: { status: 403 } });
      }
    }

    res.render('belajar/form', {
      title: materi ? 'Edit Materi Belajar - BaknusTa\'lim' : 'Tambah Materi Belajar - BaknusTa\'lim',
      materi,
      categories: KATEGORI_MAP,
      error: null
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};

// 7. Save new or updated material
exports.saveMateri = async (req, res) => {
  try {
    const user = req.session.user;
    const { id, kategori, judul, konten } = req.body;

    if (!kategori || !KATEGORI_MAP[kategori]) {
      throw new Error('Kategori tidak valid.');
    }
    if (!judul || judul.trim() === '') {
      throw new Error('Judul materi wajib diisi.');
    }
    if (!konten || konten.trim() === '') {
      throw new Error('Konten materi wajib diisi.');
    }

    if (id) {
      // Update existing
      const existingMateri = await MateriIslam.findById(id);
      if (!existingMateri) {
        throw new Error('Materi tidak ditemukan.');
      }
      if (user.role !== 'admin' && existingMateri.guru_id.toString() !== user.id) {
        throw new Error('Anda tidak memiliki hak untuk mengubah materi ini.');
      }

      existingMateri.kategori = kategori;
      existingMateri.judul = judul;
      existingMateri.konten = konten;
      await existingMateri.save();

      req.session.successMessage = 'Materi berhasil diperbarui.';
      res.redirect(`/belajar/materi/${existingMateri._id}`);
    } else {
      // Create new
      const newMateri = new MateriIslam({
        kategori,
        judul,
        konten,
        guru_id: user.id
      });
      await newMateri.save();

      req.session.successMessage = 'Materi baru berhasil diunggah.';
      res.redirect(`/belajar/kategori/${kategori}`);
    }
  } catch (error) {
    console.error(error);
    res.render('belajar/form', {
      title: req.body.id ? 'Edit Materi Belajar - BaknusTa\'lim' : 'Tambah Materi Belajar - BaknusTa\'lim',
      materi: req.body,
      categories: KATEGORI_MAP,
      error: error.message
    });
  }
};

// 8. Delete material
exports.deleteMateri = async (req, res) => {
  try {
    const user = req.session.user;
    const { materi_id } = req.params;

    const materi = await MateriIslam.findById(materi_id);
    if (!materi) {
      return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Materi yang akan dihapus tidak ditemukan.', error: { status: 404 } });
    }

    if (user.role !== 'admin' && materi.guru_id.toString() !== user.id) {
      return res.status(403).render('error', { title: 'Akses Ditolak', message: 'Anda tidak memiliki wewenang untuk menghapus materi ini.', error: { status: 403 } });
    }

    const kategori = materi.kategori;
    await MateriIslam.findByIdAndDelete(materi_id);

    req.session.successMessage = 'Materi berhasil dihapus.';
    res.redirect(`/belajar/kategori/${kategori}`);
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};
