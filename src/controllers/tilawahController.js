const User = require('../models/User');
const Surah = require('../models/Surah');
const Kelas = require('../models/Kelas');
const KelasGuruPAI = require('../models/KelasGuruPAI');
const Tilawah = require('../models/Tilawah');

// Render form to record a student's recitation
exports.showForm = async (req, res) => {
  try {
    const user = req.session.user;
    let students = [];
    let classes = [];

    // 1. Get eligible students based on role
    if (user.role === 'admin') {
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

    // 2. Get all 114 Surahs
    const surahs = await Surah.find().sort({ number: 1 });

    res.render('tilawah/form', {
      title: 'Input Tilawah Al-Qur\'an - BaknusTa\'lim',
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

// Create a new recitation record
exports.create = async (req, res) => {
  const { student_id, surah_number, ayat_start, ayat_end, status, nilai, tanggal, catatan } = req.body;
  const currentUser = req.session.user;

  try {
    if (!student_id || !surah_number || !ayat_start || !ayat_end || !status) {
      throw new Error('Siswa, Surah, Ayat Mulai, Ayat Selesai, dan Status Penilaian wajib diisi.');
    }

    if (parseInt(ayat_start) > parseInt(ayat_end)) {
      throw new Error('Ayat Mulai tidak boleh lebih besar dari Ayat Selesai.');
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
    const record = new Tilawah({
      nis: student.nis || student.mailcow_email.split('@')[0],
      siswa_id: student._id,
      tanggal: tanggal ? new Date(tanggal) : new Date(),
      surah_number: surah.number,
      surah_nama: surah.name_latin,
      ayat_start: parseInt(ayat_start),
      ayat_end: parseInt(ayat_end),
      status: status,
      nilai: status === 'Kompeten' ? nilai : null,
      guru_id: currentUser.id,
      catatan: catatan || ''
    });

    await record.save();

    // Update user points
    const { updateUserPoints } = require('../services/pointsService');
    await updateUserPoints(student._id);

    // Send email notification (non-blocking)
    try {
      const mailerService = require('../services/mailerService');
      const formattedDate = new Date(record.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      const graderName = currentUser.nama || 'Guru PAI';

      const bodyHtml = `
        <p>Halo <b>${student.nama}</b>,</p>
        <p>Penilaian tilawah Al-Qur'an baru telah diinput oleh <b>${graderName}</b> pada tanggal <b>${formattedDate}</b>:</p>
        <table style='width: 100%; border-collapse: collapse; margin-top: 10px;'>
            <tr><td style='padding: 6px 0; font-weight: bold; width: 120px;'>Surah:</td><td>${record.surah_nama} (Surah ke-${record.surah_number})</td></tr>
            <tr><td style='padding: 6px 0; font-weight: bold;'>Ayat:</td><td>Ayat ${record.ayat_start} s.d. ${record.ayat_end}</td></tr>
            <tr><td style='padding: 6px 0; font-weight: bold;'>Status:</td><td><span style='background-color: ${record.status === 'Kompeten' ? '#d1fae5; color: #065f46;' : '#fef3c7; color: #92400e;'} padding: 2px 6px; border-radius: 4px; font-size: 13px;'>${record.status}</span></td></tr>
            <tr><td style='padding: 6px 0; font-weight: bold;'>Nilai:</td><td>${record.nilai || '-'}</td></tr>
            <tr><td style='padding: 6px 0; font-weight: bold;'>Catatan Guru:</td><td>${record.catatan || '-'}</td></tr>
        </table>
        <p style='margin-top: 15px;'>Terus tingkatkan bacaan Al-Qur'an Anda. Semoga berkah!</p>
      `;

      // 1. Send email notification to Student
      mailerService.sendNotification(
        student.mailcow_email,
        `[BaknusTa'lim] Nilai Tilawah Baru: Surah ${record.surah_nama}`,
        "Penilaian Tilawah Selesai",
        bodyHtml
      );

      // 2. Send email copy/confirmation to Teacher (Guru PAI / Grader)
      User.findById(currentUser.id).then(teacherObj => {
        if (teacherObj && teacherObj.mailcow_email) {
          const teacherBodyHtml = `
            <p>Halo <b>${teacherObj.nama}</b>,</p>
            <p>Anda telah berhasil menginput nilai tilawah Al-Qur'an untuk siswa <b>${student.nama}</b> pada tanggal <b>${formattedDate}</b>:</p>
            <table style='width: 100%; border-collapse: collapse; margin-top: 10px;'>
                <tr><td style='padding: 6px 0; font-weight: bold; width: 120px;'>Nama Siswa:</td><td>${student.nama}</td></tr>
                <tr><td style='padding: 6px 0; font-weight: bold;'>Surah:</td><td>${record.surah_nama} (Surah ke-${record.surah_number})</td></tr>
                <tr><td style='padding: 6px 0; font-weight: bold;'>Ayat:</td><td>Ayat ${record.ayat_start} s.d. ${record.ayat_end}</td></tr>
                <tr><td style='padding: 6px 0; font-weight: bold;'>Status:</td><td><span style='background-color: ${record.status === 'Kompeten' ? '#d1fae5; color: #065f46;' : '#fef3c7; color: #92400e;'} padding: 2px 6px; border-radius: 4px; font-size: 13px;'>${record.status}</span></td></tr>
                <tr><td style='padding: 6px 0; font-weight: bold;'>Nilai:</td><td>${record.nilai || '-'}</td></tr>
                <tr><td style='padding: 6px 0; font-weight: bold;'>Catatan Guru:</td><td>${record.catatan || '-'}</td></tr>
            </table>
            <p style='margin-top: 15px;'>Arsip penilaian ini tersimpan otomatis di BaknusTa'lim.</p>
          `;

          mailerService.sendNotification(
            teacherObj.mailcow_email,
            `[BaknusTa'lim - Salinan Guru] Konfirmasi Penilaian Tilawah: ${student.nama} - Surah ${record.surah_nama}`,
            "Konfirmasi Penilaian Tilawah",
            teacherBodyHtml
          );
        }
      }).catch(err => console.error('[TilawahMail] Error sending teacher copy:', err));
    } catch (mailErr) {
      console.error('[TilawahMail] Error sending email:', mailErr);
    }

    req.session.successMessage = `Berhasil menyimpan nilai tilawah untuk ${student.nama}.`;
    res.redirect('/tilawah/riwayat');
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

    res.render('tilawah/form', {
      title: 'Input Tilawah Al-Qur\'an - BaknusTa\'lim',
      students,
      classes,
      surahs,
      error: error.message
    });
  }
};

// View recitation history log
exports.list = async (req, res) => {
  try {
    const user = req.session.user;
    const { class_id, search, status } = req.query;
    
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

    // 2. Extra Filters (status & text search)
    if (status) {
      query.status = status;
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

    const history = await Tilawah.find(query)
      .populate('siswa_id')
      .populate('guru_id')
      .sort({ tanggal: -1, createdAt: -1 });

    // Fetch class info for each history item manually
    const historyWithClass = await Promise.all(history.map(async (record) => {
      const student = await User.findById(record.siswa_id).populate('kelas_id');
      const doc = record.toObject();
      doc.siswa = student;
      return doc;
    }));

    res.render('tilawah/riwayat', {
      title: 'Riwayat Tilawah Al-Qur\'an - BaknusTa\'lim',
      history: historyWithClass,
      classes,
      selectedClassId: class_id || '',
      selectedStatus: status || '',
      searchQuery: search || ''
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};
