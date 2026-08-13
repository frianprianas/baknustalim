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
    let classes = [];

    // 1. Get eligible students based on role
    if (user.role === 'admin') {
      // Admins can grade any student who has a class assigned
      students = await User.find({ role: 'siswa', kelas_id: { $ne: null } })
        .populate('kelas_id')
        .sort({ nama: 1 });
      classes = await Kelas.find().sort({ nama_kelas: 1, tahun_ajaran: -1 });
    } else if (user.role === 'guru') {
      // Get classes taught by this Guru PAI
      const classMappings = await KelasGuruPAI.find({ guru_id: user.id });
      const classIds = classMappings.map(m => m.kelas_id);
      
      students = await User.find({ role: 'siswa', kelas_id: { $in: classIds } })
        .populate('kelas_id')
        .sort({ nama: 1 });
      classes = await Kelas.find({ _id: { $in: classIds } }).sort({ nama_kelas: 1, tahun_ajaran: -1 });
    }

    // 2. Get all 114 Surahs from cache
    const surahs = await Surah.find().sort({ number: 1 });

    res.render('hafalan/form', {
      title: 'Input Hafalan Al-Qur\'an - BaknusTa\'lim',
      students,
      classes,
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
  const { student_id, surah_number, status, nilai, tanggal, catatan } = req.body;
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
      nilai: status === 'Kompeten' ? nilai : null,
      nip_penilai: currentUser.nip || currentUser.mailcow_email.split('@')[0],
      guru_id: currentUser.id,
      catatan: catatan || ''
    });

    await record.save();

    // Update user points for the graded student
    const { updateUserPoints } = require('../services/pointsService');
    await updateUserPoints(student._id);

    // Send email notification (non-blocking)
    try {
      const mailerService = require('../services/mailerService');
      const formattedDate = new Date(record.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      const graderName = currentUser.nama || 'Guru PAI';

      const bodyHtml = `
        <p>Halo <b>${student.nama}</b>,</p>
        <p>Penilaian hafalan Al-Qur'an baru telah diinput oleh <b>${graderName}</b> pada tanggal <b>${formattedDate}</b>:</p>
        <table style='width: 100%; border-collapse: collapse; margin-top: 10px;'>
            <tr><td style='padding: 6px 0; font-weight: bold; width: 120px;'>Surah:</td><td>${record.surah_nama} (Surah ke-${record.surah_number})</td></tr>
            <tr><td style='padding: 6px 0; font-weight: bold;'>Status:</td><td><span style='background-color: ${record.status === 'Kompeten' ? '#d1fae5; color: #065f46;' : '#fef3c7; color: #92400e;'} padding: 2px 6px; border-radius: 4px; font-size: 13px;'>${record.status}</span></td></tr>
            <tr><td style='padding: 6px 0; font-weight: bold;'>Nilai:</td><td>${record.nilai || '-'}</td></tr>
            <tr><td style='padding: 6px 0; font-weight: bold;'>Catatan Guru:</td><td>${record.catatan || '-'}</td></tr>
        </table>
        <p style='margin-top: 15px;'>Terus tingkatkan hafalan Anda. Semoga berkah!</p>
      `;

      // 1. Send email notification to Student
      mailerService.sendNotification(
        student.mailcow_email,
        `[BaknusTa'lim] Nilai Hafalan Baru: Surah ${record.surah_nama}`,
        "Penilaian Hafalan Selesai",
        bodyHtml
      );

      // 2. Send email copy/confirmation to Teacher (Guru PAI / Grader)
      User.findById(currentUser.id).then(teacherObj => {
        if (teacherObj && teacherObj.mailcow_email) {
          const teacherBodyHtml = `
            <p>Halo <b>${teacherObj.nama}</b>,</p>
            <p>Anda telah berhasil menginput nilai hafalan Al-Qur'an untuk siswa <b>${student.nama}</b> pada tanggal <b>${formattedDate}</b>:</p>
            <table style='width: 100%; border-collapse: collapse; margin-top: 10px;'>
                <tr><td style='padding: 6px 0; font-weight: bold; width: 120px;'>Nama Siswa:</td><td>${student.nama}</td></tr>
                <tr><td style='padding: 6px 0; font-weight: bold;'>Surah:</td><td>${record.surah_nama} (Surah ke-${record.surah_number})</td></tr>
                <tr><td style='padding: 6px 0; font-weight: bold;'>Status:</td><td><span style='background-color: ${record.status === 'Kompeten' ? '#d1fae5; color: #065f46;' : '#fef3c7; color: #92400e;'} padding: 2px 6px; border-radius: 4px; font-size: 13px;'>${record.status}</span></td></tr>
                <tr><td style='padding: 6px 0; font-weight: bold;'>Nilai:</td><td>${record.nilai || '-'}</td></tr>
                <tr><td style='padding: 6px 0; font-weight: bold;'>Catatan Guru:</td><td>${record.catatan || '-'}</td></tr>
            </table>
            <p style='margin-top: 15px;'>Arsip penilaian ini tersimpan otomatis di BaknusTa'lim.</p>
          `;

          mailerService.sendNotification(
            teacherObj.mailcow_email,
            `[BaknusTa'lim - Salinan Guru] Konfirmasi Penilaian Hafalan: ${student.nama} - Surah ${record.surah_nama}`,
            "Konfirmasi Penilaian Hafalan",
            teacherBodyHtml
          );
        }
      }).catch(err => console.error('[HafalanMail] Error sending teacher copy:', err));
    } catch (mailErr) {
      console.error('[HafalanMail] Error sending email:', mailErr);
    }

    req.session.successMessage = `Berhasil menyimpan nilai hafalan untuk ${student.nama}.`;
    res.redirect('/hafalan/riwayat');
  } catch (error) {
    console.error(error);
    
    // Reload form data
    let students = [];
    let classes = [];
    if (currentUser.role === 'admin') {
      students = await User.find({ role: 'siswa', kelas_id: { $ne: null } }).populate('kelas_id').sort({ nama: 1 });
      classes = await Kelas.find().sort({ nama_kelas: 1, tahun_ajaran: -1 });
    } else if (currentUser.role === 'guru') {
      const classMappings = await KelasGuruPAI.find({ guru_id: currentUser.id });
      const classIds = classMappings.map(m => m.kelas_id);
      students = await User.find({ role: 'siswa', kelas_id: { $in: classIds } }).populate('kelas_id').sort({ nama: 1 });
      classes = await Kelas.find({ _id: { $in: classIds } }).sort({ nama_kelas: 1, tahun_ajaran: -1 });
    }
    const surahs = await Surah.find().sort({ number: 1 });

    res.render('hafalan/form', {
      title: 'Input Hafalan Al-Qur\'an - BaknusTa\'lim',
      students,
      classes,
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
