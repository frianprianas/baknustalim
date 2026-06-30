const AmalanYaumi = require('../models/AmalanYaumi');
const User = require('../models/User');
const Kelas = require('../models/Kelas');
const KelasGuruPAI = require('../models/KelasGuruPAI');

// Normalizes a date to start of day in UTC/Local to avoid timezone offset mismatches
function getStartOfDay(dateInput) {
  const d = new Date(dateInput);
  d.setHours(0, 0, 0, 0);
  return d;
}

// 1. Show Checklist Log Form for Student
exports.showForm = async (req, res) => {
  try {
    const user = req.session.user;
    if (user.role !== 'siswa') {
      return res.status(403).render('error', { title: 'Akses Ditolak', message: 'Hanya siswa yang dapat mengisi checklist amalan.', error: { status: 403 } });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const selectedDateStr = req.query.tanggal || todayStr;
    const selectedDate = getStartOfDay(selectedDateStr);

    const today = getStartOfDay(new Date());
    if (selectedDate > today) {
      return res.status(400).render('error', { 
        title: 'Tanggal Tidak Valid', 
        message: 'Anda tidak dapat melihat atau mengisi checklist amalan untuk tanggal yang akan datang.', 
        error: { status: 400 } 
      });
    }

    // Fetch existing log if any
    const existingLog = await AmalanYaumi.findOne({
      siswa_id: user.id,
      tanggal: selectedDate
    });

    res.render('amalan/form', {
      title: 'Isi Amalan Yaumi - BaknusTa\'lim',
      selectedDateStr,
      log: existingLog || {
        is_halangan: false,
        sholat_fardu: { subuh: false, dzuhur: false, ashar: false, maghrib: false, isya: false },
        sholat_sunnah: { tahajud: false, duha: false, rawatib: false },
        puasa: { senin: false, kamis: false, ayyamul_bidh: false }
      },
      error: null
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};

// 2. Save Checklist Log (Insert or Update)
exports.saveForm = async (req, res) => {
  try {
    const user = req.session.user;
    if (user.role !== 'siswa') {
      throw new Error('Akses Ditolak.');
    }

    const { tanggal, fardu, sunnah, puasa, is_halangan } = req.body;
    if (!tanggal) {
      throw new Error('Tanggal wajib ditentukan.');
    }

    const logDate = getStartOfDay(tanggal);
    const today = getStartOfDay(new Date());
    if (logDate > today) {
      throw new Error('Anda tidak dapat mengisi checklist amalan untuk tanggal yang akan datang.');
    }

    const hasHalangan = !!is_halangan;

    // Parse checkboxes (only active if not in halangan)
    const sholat_fardu = hasHalangan ? { subuh: false, dzuhur: false, ashar: false, maghrib: false, isya: false } : {
      subuh: !!(fardu && fardu.subuh),
      dzuhur: !!(fardu && fardu.dzuhur),
      ashar: !!(fardu && fardu.ashar),
      maghrib: !!(fardu && fardu.maghrib),
      isya: !!(fardu && fardu.isya)
    };

    const sholat_sunnah = hasHalangan ? { tahajud: false, duha: false, rawatib: false } : {
      tahajud: !!(sunnah && sunnah.tahajud),
      duha: !!(sunnah && sunnah.duha),
      rawatib: !!(sunnah && sunnah.rawatib)
    };

    const parsedPuasa = hasHalangan ? { senin: false, kamis: false, ayyamul_bidh: false } : {
      senin: !!(puasa && puasa.senin),
      kamis: !!(puasa && puasa.kamis),
      ayyamul_bidh: !!(puasa && puasa.ayyamul_bidh)
    };

    // Find and update or create
    await AmalanYaumi.findOneAndUpdate(
      { siswa_id: user.id, tanggal: logDate },
      {
        is_halangan: hasHalangan,
        sholat_fardu,
        sholat_sunnah,
        puasa: parsedPuasa
      },
      { upsert: true, new: true }
    );

    // Update user points
    const { updateUserPoints } = require('../services/pointsService');
    await updateUserPoints(user.id);

    req.session.successMessage = `Berhasil menyimpan checklist amalan untuk tanggal ${new Date(logDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.`;
    res.redirect('/amalan');
  } catch (error) {
    console.error(error);
    res.render('amalan/form', {
      title: 'Isi Amalan Yaumi - BaknusTa\'lim',
      selectedDateStr: req.body.tanggal || new Date().toISOString().split('T')[0],
      log: {
        is_halangan: !!req.body.is_halangan,
        sholat_fardu: {
          subuh: !!(req.body.fardu && req.body.fardu.subuh),
          dzuhur: !!(req.body.fardu && req.body.fardu.dzuhur),
          ashar: !!(req.body.fardu && req.body.fardu.ashar),
          maghrib: !!(req.body.fardu && req.body.fardu.maghrib),
          isya: !!(req.body.fardu && req.body.fardu.isya)
        },
        sholat_sunnah: {
          tahajud: !!(req.body.sunnah && req.body.sunnah.tahajud),
          duha: !!(req.body.sunnah && req.body.sunnah.duha),
          rawatib: !!(req.body.sunnah && req.body.sunnah.rawatib)
        },
        puasa: {
          senin: !!(req.body.puasa && req.body.puasa.senin),
          kamis: !!(req.body.puasa && req.body.puasa.kamis),
          ayyamul_bidh: !!(req.body.puasa && req.body.puasa.ayyamul_bidh)
        }
      },
      error: error.message
    });
  }
};

// 3. Show Student's own history
exports.listRiwayat = async (req, res) => {
  try {
    const user = req.session.user;
    if (user.role !== 'siswa') {
      return res.redirect('/amalan/laporan');
    }

    const history = await AmalanYaumi.find({ siswa_id: user.id }).sort({ tanggal: -1 });

    res.render('amalan/riwayat', {
      title: 'Riwayat Amalan Yaumi - BaknusTa\'lim',
      history
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};

// 4. Show Student Compliance Reports (Admin, Guru PAI, TU)
exports.listLaporan = async (req, res) => {
  try {
    const user = req.session.user;
    if (user.role === 'siswa') {
      return res.redirect('/amalan/riwayat');
    }

    const { class_id, search } = req.query;
    let classes = [];
    let studentFilter = { role: 'siswa' };

    // Get list of classes based on role
    if (user.role === 'guru') {
      const mappings = await KelasGuruPAI.find({ guru_id: user.id });
      const classIds = mappings.map(m => m.kelas_id);
      classes = await Kelas.find({ _id: { $in: classIds } }).sort({ nama_kelas: 1 });
      studentFilter.kelas_id = { $in: classIds };
    } else {
      classes = await Kelas.find().sort({ nama_kelas: 1 });
    }

    // Apply filters
    if (class_id) {
      studentFilter.kelas_id = class_id;
    }

    if (search) {
      studentFilter.$or = [
        { nama: { $regex: search, $options: 'i' } },
        { nis: { $regex: search, $options: 'i' } }
      ];
    }

    const students = await User.find(studentFilter)
      .populate('kelas_id')
      .sort({ nama: 1 });

    // Calculate amalan compliance metrics for each student
    const reportData = await Promise.all(students.map(async (s) => {
      const logs = await AmalanYaumi.find({ siswa_id: s._id });
      
      let farduDone = 0;
      let farduExpected = logs.filter(log => !log.is_halangan).length * 5;
      let sunnahCount = 0;
      let puasaCount = 0;

      logs.forEach(log => {
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
        daysFilled: logs.length,
        fardu: { done: farduDone, expected: farduExpected },
        sunnah: sunnahCount,
        puasa: puasaCount
      };
    }));

    res.render('amalan/laporan', {
      title: 'Laporan Amalan Yaumi Siswa - BaknusTa\'lim',
      classes,
      selectedClass: class_id || '',
      searchQuery: search || '',
      reportData
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};

// 5. Show Detail Logs of a Single Student (for Teachers/Admins)
exports.showDetail = async (req, res) => {
  try {
    const user = req.session.user;
    if (user.role === 'siswa') {
      return res.redirect('/amalan/riwayat');
    }

    const { siswa_id } = req.params;
    const student = await User.findById(siswa_id).populate('kelas_id');
    if (!student) {
      return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Siswa tidak ditemukan.', error: { status: 404 } });
    }

    const history = await AmalanYaumi.find({ siswa_id }).sort({ tanggal: -1 });

    // Group logs by YYYY-MM-DD for easy calendar rendering
    const logsMap = {};
    history.forEach(log => {
      // Use local timezone representation for key
      const year = log.tanggal.getFullYear();
      const month = String(log.tanggal.getMonth() + 1).padStart(2, '0');
      const day = String(log.tanggal.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      // Punctuality check: compare log date vs creation date (both local day representations)
      const tDate = log.tanggal.toDateString();
      const cDate = log.createdAt.toDateString();
      const isPunctual = tDate === cDate;

      logsMap[dateStr] = {
        _id: log._id,
        tanggal: log.tanggal,
        is_halangan: log.is_halangan || false,
        sholat_fardu: log.sholat_fardu || {},
        sholat_sunnah: log.sholat_sunnah || {},
        puasa: log.puasa || {},
        isPunctual,
        createdAt: log.createdAt
      };
    });

    res.render('amalan/detail', {
      title: `Detail Amalan: ${student.nama} - BaknusTa\'lim`,
      student,
      logsMap,
      history
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};
