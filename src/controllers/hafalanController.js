const User = require('../models/User');
const Surah = require('../models/Surah');
const Kelas = require('../models/Kelas');
const KelasGuruPAI = require('../models/KelasGuruPAI');
const Hafalan = require('../models/Hafalan');

// Render form to record a student's memorization
exports.showForm = async (req, res) => {
  try {
    const user = req.session.user;
    let students = [];

    // 1. Get eligible students based on role
    if (user.role === 'admin') {
      // Admins can grade any student who has a class assigned
      students = await User.find({ role: 'siswa', kelas_id: { $ne: null } })
        .populate('kelas_id')
        .sort({ nama: 1 });
    } else if (user.role === 'guru') {
      // Get classes taught by this Guru PAI
      const classMappings = await KelasGuruPAI.find({ guru_id: user.id });
      const classIds = classMappings.map(m => m.kelas_id);
      
      students = await User.find({ role: 'siswa', kelas_id: { $in: classIds } })
        .populate('kelas_id')
        .sort({ nama: 1 });
    }

    // 2. Get all 114 Surahs from cache
    const surahs = await Surah.find().sort({ number: 1 });

    res.render('hafalan/form', {
      title: 'Input Hafalan Al-Qur\'an - BaknusTa\'lim',
      students,
      surahs,
      error: null
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};

// Create a new memorization record
exports.create = async (req, res) => {
  const { student_id, surah_number, status, tanggal, catatan } = req.body;
  const currentUser = req.session.user;

  try {
    if (!student_id || !surah_number || !status) {
      throw new Error('Siswa, Surah, dan Status Penilaian wajib diisi.');
    }

    // 1. Fetch student
    const student = await User.findById(student_id).populate('kelas_id');
    if (!student || student.role !== 'siswa') {
      throw new Error('Siswa tidak ditemukan.');
    }

    if (!student.kelas_id) {
      throw new Error('Siswa belum ditempatkan ke kelas mana pun.');
    }

    // 2. Validate Guru PAI assignment for this student's class (unless admin)
    if (currentUser.role !== 'admin') {
      const isAssigned = await KelasGuruPAI.findOne({
        kelas_id: student.kelas_id._id,
        guru_id: currentUser.id
      });
      if (!isAssigned) {
        throw new Error('Anda tidak berhak menilai siswa di kelas ini karena Anda bukan Guru PAI untuk kelas tersebut.');
      }
    }

    // 3. Get Surah details
    const surah = await Surah.findOne({ number: parseInt(surah_number) });
    if (!surah) {
      throw new Error('Surah tidak valid.');
    }

    // 4. Save record
    const record = new Hafalan({
      nis: student.nis || student.mailcow_email.split('@')[0],
      siswa_id: student._id,
      tanggal: tanggal ? new Date(tanggal) : new Date(),
      surah_number: surah.number,
      surah_nama: surah.name_latin,
      status: status,
      nip_penilai: currentUser.nip || currentUser.mailcow_email.split('@')[0],
      guru_id: currentUser.id,
      catatan: catatan || ''
    });

    await record.save();

    req.session.successMessage = `Berhasil menyimpan nilai hafalan untuk ${student.nama}.`;
    res.redirect('/hafalan/riwayat');
  } catch (error) {
    console.error(error);
    
    // Reload form data
    let students = [];
    if (currentUser.role === 'admin') {
      students = await User.find({ role: 'siswa', kelas_id: { $ne: null } }).populate('kelas_id').sort({ nama: 1 });
    } else if (currentUser.role === 'guru') {
      const classMappings = await KelasGuruPAI.find({ guru_id: currentUser.id });
      const classIds = classMappings.map(m => m.kelas_id);
      students = await User.find({ role: 'siswa', kelas_id: { $in: classIds } }).populate('kelas_id').sort({ nama: 1 });
    }
    const surahs = await Surah.find().sort({ number: 1 });

    res.render('hafalan/form', {
      title: 'Input Hafalan Al-Qur\'an - BaknusTa\'lim',
      students,
      surahs,
      error: error.message
    });
  }
};

// View memorization history log
exports.list = async (req, res) => {
  try {
    const user = req.session.user;
    const { class_id, search, status } = req.query;
    
    let query = {};
    let classes = [];

    // 1. Role-based restrictions
    if (user.role === 'siswa') {
      // Siswa only sees their own history
      query.siswa_id = user.id;
    } else if (user.role === 'guru') {
      // Guru PAI sees records of classes they are assigned to
      const mappings = await KelasGuruPAI.find({ guru_id: user.id });
      const classIds = mappings.map(m => m.kelas_id);
      classes = await Kelas.find({ _id: { $in: classIds } }).sort({ nama_kelas: 1 });

      // Find all students in those classes
      const students = await User.find({ role: 'siswa', kelas_id: { $in: classIds } });
      const studentIds = students.map(s => s._id);
      query.siswa_id = { $in: studentIds };
      
      // If a class filter is selected
      if (class_id) {
        const classStudents = await User.find({ role: 'siswa', kelas_id: class_id });
        query.siswa_id = { $in: classStudents.map(s => s._id) };
      }
    } else if (user.role === 'admin' || user.role === 'tu') {
      // Admin and TU can see all history
      classes = await Kelas.find().sort({ nama_kelas: 1 });
      
      if (class_id) {
        const classStudents = await User.find({ role: 'siswa', kelas_id: class_id });
        query.siswa_id = { $in: classStudents.map(s => s._id) };
      }
    }

    // 2. Extra Filters (status & text search)
    if (status) {
      query.status = status;
    }

    if (search && user.role !== 'siswa') {
      // Search by student name or NIS
      const matchedStudents = await User.find({
        role: 'siswa',
        $or: [
          { nama: { $regex: search, $options: 'i' } },
          { nis: { $regex: search, $options: 'i' } }
        ]
      });
      const studentIds = matchedStudents.map(s => s._id);
      
      // Intersect search matches with existing role-based student restrictions
      if (query.siswa_id) {
        if (query.siswa_id.$in) {
          const allowedIds = query.siswa_id.$in.map(id => id.toString());
          const filteredIds = studentIds.filter(id => allowedIds.includes(id.toString()));
          query.siswa_id = { $in: filteredIds };
        } else {
          // Direct comparison
          const allowedIdStr = query.siswa_id.toString();
          query.siswa_id = studentIds.map(id => id.toString()).includes(allowedIdStr) ? query.siswa_id : null;
        }
      } else {
        query.siswa_id = { $in: studentIds };
      }
    }

    const history = await Hafalan.find(query)
      .populate('siswa_id')
      .populate('guru_id')
      .sort({ tanggal: -1, createdAt: -1 });

    // Populate class info manually since hafalan points to user, who points to class
    const historyWithClass = await Promise.all(history.map(async (record) => {
      // Just in case, retrieve student's current class
      const student = await User.findById(record.siswa_id).populate('kelas_id');
      const doc = record.toObject();
      doc.siswa = student;
      return doc;
    }));

    res.render('hafalan/riwayat', {
      title: 'Riwayat Hafalan Al-Qur\'an - BaknusTa\'lim',
      history: historyWithClass,
      classes,
      selectedClass: class_id || '',
      searchQuery: search || '',
      selectedStatus: status || ''
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};
