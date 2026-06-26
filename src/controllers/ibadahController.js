const User = require('../models/User');
const Kelas = require('../models/Kelas');
const KelasGuruPAI = require('../models/KelasGuruPAI');
const JenisIbadah = require('../models/JenisIbadah');
const PraktekIbadah = require('../models/PraktekIbadah');

// Render form to record a student's worship practice
exports.showForm = async (req, res) => {
  try {
    const user = req.session.user;
    let students = [];

    // 1. Get eligible students based on role
    if (user.role === 'admin') {
      students = await User.find({ role: 'siswa', kelas_id: { $ne: null } })
        .populate('kelas_id')
        .sort({ nama: 1 });
    } else if (user.role === 'guru') {
      const classMappings = await KelasGuruPAI.find({ guru_id: user.id });
      const classIds = classMappings.map(m => m.kelas_id);
      
      students = await User.find({ role: 'siswa', kelas_id: { $in: classIds } })
        .populate('kelas_id')
        .sort({ nama: 1 });
    }

    // 2. Get active worship categories from master data
    const listIbadah = await JenisIbadah.find({ is_active: true }).sort({ nama_ibadah: 1 });

    res.render('ibadah/form', {
      title: 'Input Praktek Ibadah - BaknusTa\'lim',
      students,
      listIbadah,
      error: null
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};

// Create a new worship practice record
exports.create = async (req, res) => {
  const { student_id, jenis_ibadah_id, status, tanggal, catatan } = req.body;
  const currentUser = req.session.user;

  try {
    if (!student_id || !jenis_ibadah_id || !status) {
      throw new Error('Siswa, Jenis Ibadah, dan Status Penilaian wajib diisi.');
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

    // 3. Verify Jenis Ibadah
    const ibadahType = await JenisIbadah.findById(jenis_ibadah_id);
    if (!ibadahType || !ibadahType.is_active) {
      throw new Error('Jenis ibadah tidak valid atau sudah tidak aktif.');
    }

    // 4. Save record
    const record = new PraktekIbadah({
      nis: student.nis || student.mailcow_email.split('@')[0],
      siswa_id: student._id,
      tanggal: tanggal ? new Date(tanggal) : new Date(),
      jenis_ibadah_id: ibadahType._id,
      status: status,
      guru_id: currentUser.id,
      catatan: catatan || ''
    });

    await record.save();

    req.session.successMessage = `Berhasil menyimpan nilai praktek ibadah untuk ${student.nama}.`;
    res.redirect('/ibadah/riwayat');
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
    const listIbadah = await JenisIbadah.find({ is_active: true }).sort({ nama_ibadah: 1 });

    res.render('ibadah/form', {
      title: 'Input Praktek Ibadah - BaknusTa\'lim',
      students,
      listIbadah,
      error: error.message
    });
  }
};

// View worship practice history log
exports.list = async (req, res) => {
  try {
    const user = req.session.user;
    const { class_id, search, status, jenis_ibadah_id } = req.query;
    
    let query = {};
    let classes = [];

    // 1. Role-based restrictions
    if (user.role === 'siswa') {
      query.siswa_id = user.id;
    } else if (user.role === 'guru') {
      const mappings = await KelasGuruPAI.find({ guru_id: user.id });
      const classIds = mappings.map(m => m.kelas_id);
      classes = await Kelas.find({ _id: { $in: classIds } }).sort({ nama_kelas: 1 });

      const students = await User.find({ role: 'siswa', kelas_id: { $in: classIds } });
      const studentIds = students.map(s => s._id);
      query.siswa_id = { $in: studentIds };
      
      if (class_id) {
        const classStudents = await User.find({ role: 'siswa', kelas_id: class_id });
        query.siswa_id = { $in: classStudents.map(s => s._id) };
      }
    } else if (user.role === 'admin' || user.role === 'tu') {
      classes = await Kelas.find().sort({ nama_kelas: 1 });
      
      if (class_id) {
        const classStudents = await User.find({ role: 'siswa', kelas_id: class_id });
        query.siswa_id = { $in: classStudents.map(s => s._id) };
      }
    }

    // 2. Extra Filters (status, ibadah type, text search)
    if (status) {
      query.status = status;
    }
    if (jenis_ibadah_id) {
      query.jenis_ibadah_id = jenis_ibadah_id;
    }

    if (search && user.role !== 'siswa') {
      const matchedStudents = await User.find({
        role: 'siswa',
        $or: [
          { nama: { $regex: search, $options: 'i' } },
          { nis: { $regex: search, $options: 'i' } }
        ]
      });
      const studentIds = matchedStudents.map(s => s._id);
      
      if (query.siswa_id) {
        if (query.siswa_id.$in) {
          const allowedIds = query.siswa_id.$in.map(id => id.toString());
          const filteredIds = studentIds.filter(id => allowedIds.includes(id.toString()));
          query.siswa_id = { $in: filteredIds };
        } else {
          const allowedIdStr = query.siswa_id.toString();
          query.siswa_id = studentIds.map(id => id.toString()).includes(allowedIdStr) ? query.siswa_id : null;
        }
      } else {
        query.siswa_id = { $in: studentIds };
      }
    }

    const history = await PraktekIbadah.find(query)
      .populate('siswa_id')
      .populate('jenis_ibadah_id')
      .populate('guru_id')
      .sort({ tanggal: -1, createdAt: -1 });

    // Populate class info manually
    const historyWithClass = await Promise.all(history.map(async (record) => {
      const student = await User.findById(record.siswa_id).populate('kelas_id');
      const doc = record.toObject();
      doc.siswa = student;
      return doc;
    }));

    // Fetch ibadah categories for filter dropdown
    const ibadahCategories = await JenisIbadah.find().sort({ nama_ibadah: 1 });

    res.render('ibadah/riwayat', {
      title: 'Riwayat Praktek Ibadah - BaknusTa\'lim',
      history: historyWithClass,
      classes,
      ibadahCategories,
      selectedClass: class_id || '',
      searchQuery: search || '',
      selectedStatus: status || '',
      selectedIbadah: jenis_ibadah_id || ''
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};
