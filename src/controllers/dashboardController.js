const User = require('../models/User');
const Kelas = require('../models/Kelas');
const KelasGuruPAI = require('../models/KelasGuruPAI');
const Hafalan = require('../models/Hafalan');
const PraktekIbadah = require('../models/PraktekIbadah');
const JenisIbadah = require('../models/JenisIbadah');
const Question = require('../models/Question');
const LiveSession = require('../models/LiveSession');
const AmalanYaumi = require('../models/AmalanYaumi');

exports.showDashboard = async (req, res) => {
  const user = req.session.user;

  try {
    if (user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    }

    if (user.role === 'siswa') {
      // 1. Refresh & Fetch Student profile & class
      const { updateUserPoints } = require('../services/pointsService');
      await updateUserPoints(user.id);

      const student = await User.findById(user.id).populate('kelas_id');
      
      // 2. Fetch Memorization Stats
      const totalHafalan = await Hafalan.countDocuments({ siswa_id: user.id });
      const kompetenHafalan = await Hafalan.countDocuments({ siswa_id: user.id, status: 'Kompeten' });
      const belumHafalan = totalHafalan - kompetenHafalan;

      // 3. Fetch Worship Stats
      const totalIbadah = await PraktekIbadah.countDocuments({ siswa_id: user.id });
      const kompetenIbadah = await PraktekIbadah.countDocuments({ siswa_id: user.id, status: 'Kompeten' });
      const belumIbadah = totalIbadah - kompetenIbadah;

      // 4. Fetch recent logs
      const recentHafalan = await Hafalan.find({ siswa_id: user.id })
        .populate('guru_id')
        .sort({ tanggal: -1, createdAt: -1 })
        .limit(5);

      const recentIbadah = await PraktekIbadah.find({ siswa_id: user.id })
        .populate('jenis_ibadah_id')
        .populate('guru_id')
        .sort({ tanggal: -1, createdAt: -1 })
        .limit(5);

      const activeLiveSessions = await LiveSession.find({ status: 'aktif' }).populate('guru_id');

      return res.render('dashboard/siswa', {
        title: 'Dashboard Siswa - BaknusTa\'lim',
        student,
        stats: {
          totalHafalan, kompetenHafalan, belumHafalan,
          totalIbadah, kompetenIbadah, belumIbadah
        },
        recentHafalan,
        recentIbadah,
        activeLiveSessions
      });
    }

    if (user.role === 'guru') {
      // 1. Get classes where this teacher is assigned as Guru PAI
      const mappings = await KelasGuruPAI.find({ guru_id: user.id }).populate('kelas_id');
      const classes = mappings.map(m => m.kelas_id).filter(c => c !== null);
      const classIds = classes.map(c => c._id);

      // 2. Count of students in their classes
      const studentCount = await User.countDocuments({ role: 'siswa', kelas_id: { $in: classIds } });

      // 3. Count total evaluations graded by this teacher
      const hafalanGraded = await Hafalan.countDocuments({ guru_id: user.id });
      const ibadahGraded = await PraktekIbadah.countDocuments({ guru_id: user.id });

      // 4. Memorization stats (school-wide)
      const totalHafalan = await Hafalan.countDocuments();
      const kompetenHafalan = await Hafalan.countDocuments({ status: 'Kompeten' });

      // 5. Worship stats (school-wide)
      const totalIbadah = await PraktekIbadah.countDocuments();
      const kompetenIbadah = await PraktekIbadah.countDocuments({ status: 'Kompeten' });

      // 6. Q&A stats
      const totalQuestions = await Question.countDocuments();
      const answeredQuestions = await Question.countDocuments({ status: 'dijawab' });
      const unansweredQuestions = totalQuestions - answeredQuestions;
      const answeredByMe = await Question.countDocuments({ guru_id: user.id });

      const activeLiveSessions = await LiveSession.find({ status: 'aktif' }).populate('guru_id');

      return res.render('dashboard/guru', {
        title: 'Dashboard Guru - BaknusTa\'lim',
        classes,
        stats: {
          studentCount,
          hafalanGraded,
          ibadahGraded,
          totalHafalan,
          kompetenHafalan,
          totalIbadah,
          kompetenIbadah,
          totalQuestions,
          answeredQuestions,
          unansweredQuestions,
          answeredByMe
        },
        activeLiveSessions
      });
    }

    if (user.role === 'tu') {
      // 1. Fetch overall statistics
      const totalSiswa = await User.countDocuments({ role: 'siswa' });
      const totalKelas = await Kelas.countDocuments();
      const classes = await Kelas.find().sort({ nama_kelas: 1, tahun_ajaran: -1 });

      // 2. Generate a report recap: lists students with their class and compliance counts
      // To prevent memory issues in large schools, we filter by class if selected in query
      const selectedClassId = req.query.class_id || '';
      
      const studentFilter = { role: 'siswa' };
      if (selectedClassId) {
        studentFilter.kelas_id = selectedClassId;
      }

      const students = await User.find(studentFilter)
        .populate('kelas_id')
        .sort({ nama: 1 });

      const recap = await Promise.all(students.map(async (s) => {
        // Memorization stats
        const hafalanTotal = await Hafalan.countDocuments({ siswa_id: s._id });
        const hafalanKompeten = await Hafalan.countDocuments({ siswa_id: s._id, status: 'Kompeten' });
        
        // Worship stats
        const ibadahTotal = await PraktekIbadah.countDocuments({ siswa_id: s._id });
        const ibadahKompeten = await PraktekIbadah.countDocuments({ siswa_id: s._id, status: 'Kompeten' });

        // Amalan stats
        const amalanLogs = await AmalanYaumi.find({ siswa_id: s._id });
        let farduDone = 0;
        let farduExpected = amalanLogs.length * 5;
        let sunnahCount = 0;
        let puasaCount = 0;
        
        amalanLogs.forEach(log => {
          if (log.sholat_fardu) {
            if (log.sholat_fardu.subuh) farduDone++;
            if (log.sholat_fardu.dzuhur) farduDone++;
            if (log.sholat_fardu.ashar) farduDone++;
            if (log.sholat_fardu.maghrib) farduDone++;
            if (log.sholat_fardu.isya) farduDone++;
          }
          if (log.sholat_sunnah) {
            if (log.sholat_sunnah.tahajud) sunnahCount++;
            if (log.sholat_sunnah.duha) sunnahCount++;
            if (log.sholat_sunnah.rawatib) sunnahCount++;
          }
          if (log.puasa) {
            if (log.puasa.senin) puasaCount++;
            if (log.puasa.kamis) puasaCount++;
            if (log.puasa.ayyamul_bidh) puasaCount++;
          }
        });

        return {
          id: s._id,
          nis: s.nis || '-',
          nama: s.nama,
          kelas: s.kelas_id ? s.kelas_id.nama_kelas : 'Belum Ada Kelas',
          tahun_ajaran: s.kelas_id ? s.kelas_id.tahun_ajaran : '-',
          hafalan: { total: hafalanTotal, kompeten: hafalanKompeten },
          ibadah: { total: ibadahTotal, kompeten: ibadahKompeten },
          amalan: {
            daysFilled: amalanLogs.length,
            fardu: { done: farduDone, expected: farduExpected },
            sunnah: sunnahCount,
            puasa: puasaCount
          }
        };
      }));

      return res.render('dashboard/tu', {
        title: 'Rekap Laporan - BaknusTa\'lim',
        stats: { totalSiswa, totalKelas },
        classes,
        recap,
        selectedClassId
      });
    }

    res.status(403).render('error', { title: 'Akses Ditolak', message: 'Role tidak dikenal.', error: { status: 403 } });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};
