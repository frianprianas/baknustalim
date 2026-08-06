const User = require('../models/User');
const Kelas = require('../models/Kelas');
const KelasGuruPAI = require('../models/KelasGuruPAI');
const Hafalan = require('../models/Hafalan');
const PraktekIbadah = require('../models/PraktekIbadah');
const Tilawah = require('../models/Tilawah');
const AmalanYaumi = require('../models/AmalanYaumi');

exports.showRapot = async (req, res) => {
  try {
    const currentUser = req.session.user;
    let siswaId = req.params.siswa_id;

    // If logged in user is a student, they can only view their own rapot
    if (currentUser.role === 'siswa') {
      if (siswaId && siswaId !== currentUser.id) {
        return res.status(403).render('error', {
          title: 'Akses Ditolak',
          message: 'Anda tidak memiliki hak akses untuk melihat rapot siswa lain.',
          error: {}
        });
      }
      siswaId = currentUser.id;
    } else {
      // Guru, TU, Admin must specify student ID
      if (!siswaId) {
        return res.redirect('/dashboard');
      }
    }

    // Fetch student profile
    const student = await User.findById(siswaId).populate('kelas_id');
    if (!student) {
      return res.status(404).render('error', {
        title: 'Siswa Tidak Ditemukan',
        message: 'Data siswa dengan ID tersebut tidak ditemukan di sistem.',
        error: {}
      });
    }

    // Verify Guru PAI can only see their own assigned student's report
    if (currentUser.role === 'guru') {
      const classMappings = await KelasGuruPAI.find({ guru_id: currentUser.id });
      const classIds = classMappings.map(m => m.kelas_id.toString());
      if (!student.kelas_id || !classIds.includes(student.kelas_id._id.toString())) {
        return res.status(403).render('error', {
          title: 'Akses Ditolak',
          message: 'Anda hanya diperbolehkan melihat rapot siswa dari kelas yang Anda ampu.',
          error: {}
        });
      }
    }

    // Fetch all evaluations
    const hafalanList = await Hafalan.find({ siswa_id: siswaId }).sort({ tanggal: -1 });
    const ibadahList = await PraktekIbadah.find({ siswa_id: siswaId }).populate('jenis_ibadah_id').sort({ tanggal: -1 });
    const tilawahList = await Tilawah.find({ siswa_id: siswaId }).sort({ tanggal: -1 });
    const amalanLogs = await AmalanYaumi.find({ siswa_id: siswaId });

    // Compute Amalan Yaumi Stats
    let farduDone = 0;
    let farduExpected = amalanLogs.length * 5;
    let sunnahCount = 0;
    let puasaCount = 0;
    
    amalanLogs.forEach(log => {
      if (log.is_halangan) return;
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

    res.render('rapot/index', {
      title: `Rapot Keagamaan - ${student.nama}`,
      student,
      hafalanList,
      ibadahList,
      tilawahList,
      stats: {
        hafalan: { 
          total: hafalanList.length, 
          kompeten: hafalanList.filter(h => h.status === 'Kompeten').length 
        },
        ibadah: { 
          total: ibadahList.length, 
          kompeten: ibadahList.filter(i => i.status === 'Kompeten').length 
        },
        tilawah: { 
          total: tilawahList.length, 
          kompeten: tilawahList.filter(t => t.status === 'Kompeten').length 
        },
        amalan: {
          daysFilled: amalanLogs.length,
          fardu: { done: farduDone, expected: farduExpected },
          sunnah: sunnahCount,
          puasa: puasaCount
        }
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).render('error', {
      title: 'Server Error',
      message: 'Gagal memuat rapot siswa.',
      error
    });
  }
};
