const User = require('../models/User');
const AmalanYaumi = require('../models/AmalanYaumi');
const Hafalan = require('../models/Hafalan');
const Tilawah = require('../models/Tilawah');
const PraktekIbadah = require('../models/PraktekIbadah');

exports.getDashboardStats = async (req, res) => {
  try {
    const apiKey = req.header('X-API-Key') || req.query.api_key;
    const expectedKey = process.env.DASHBOARD_API_KEY || 'baknus_secret_dashboard_key_2026';

    if (!apiKey || apiKey !== expectedKey) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Calculate start and end of today in Asia/Jakarta timezone (WIB)
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
    const parts = formatter.formatToParts(now);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;

    const startToday = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00+07:00`);
    const endToday = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T23:59:59+07:00`);

    // Query statistics
    const totalUsers = await User.countDocuments();
    const totalAccessToday = await User.countDocuments({
      last_active_at: { $gte: startToday, $lte: endToday }
    });
    const totalAmalanToday = await AmalanYaumi.countDocuments({
      tanggal: { $gte: startToday, $lte: endToday }
    });
    const totalHafalanToday = await Hafalan.countDocuments({
      tanggal: { $gte: startToday, $lte: endToday }
    });
    const totalTilawahToday = await Tilawah.countDocuments({
      tanggal: { $gte: startToday, $lte: endToday }
    });

    res.json({
      success: true,
      data: {
        tanggal: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
        total_users: totalUsers,
        total_access_today: totalAccessToday,
        total_amalan_today: totalAmalanToday,
        total_hafalan_today: totalHafalanToday,
        total_tilawah_today: totalTilawahToday
      }
    });
  } catch (error) {
    console.error('[APIController] Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
};

exports.getUserStats = async (req, res) => {
  try {
    const apiKey = req.header('X-API-Key') || req.query.api_key;
    const expectedKey = process.env.DASHBOARD_API_KEY || 'baknus_secret_dashboard_key_2026';

    if (!apiKey || apiKey !== expectedKey) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email parameter is required' });
    }

    // Find the user by mailcow_email
    const user = await User.findOne({ mailcow_email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Retrieve last activities from all activity tracking schemas
    const [lastTilawah, lastHafalan, lastAmalan, lastPraktek] = await Promise.all([
      Tilawah.findOne({ siswa_id: user._id }).sort({ updatedAt: -1 }).lean(),
      Hafalan.findOne({ siswa_id: user._id }).sort({ updatedAt: -1 }).lean(),
      AmalanYaumi.findOne({ siswa_id: user._id }).sort({ updatedAt: -1 }).lean(),
      PraktekIbadah.findOne({ siswa_id: user._id }).populate('jenis_ibadah_id').sort({ updatedAt: -1 }).lean()
    ]);

    // Find the absolute latest activity by comparing timestamps
    let latestActivity = null;
    let latestTime = 0;

    if (lastTilawah) {
      const time = new Date(lastTilawah.updatedAt || lastTilawah.createdAt || lastTilawah.tanggal).getTime();
      if (time > latestTime) {
        latestTime = time;
        latestActivity = {
          tipe: 'Tilawah',
          waktu: lastTilawah.updatedAt || lastTilawah.createdAt || lastTilawah.tanggal,
          detail: {
            surah_nama: lastTilawah.surah_nama,
            surah_number: lastTilawah.surah_number,
            ayat_start: lastTilawah.ayat_start,
            ayat_end: lastTilawah.ayat_end,
            status: lastTilawah.status,
            nilai: lastTilawah.nilai,
            catatan: lastTilawah.catatan
          }
        };
      }
    }

    if (lastHafalan) {
      const time = new Date(lastHafalan.updatedAt || lastHafalan.createdAt || lastHafalan.tanggal).getTime();
      if (time > latestTime) {
        latestTime = time;
        latestActivity = {
          tipe: 'Hafalan',
          waktu: lastHafalan.updatedAt || lastHafalan.createdAt || lastHafalan.tanggal,
          detail: {
            surah_nama: lastHafalan.surah_nama,
            surah_number: lastHafalan.surah_number,
            status: lastHafalan.status,
            nilai: lastHafalan.nilai,
            catatan: lastHafalan.catatan
          }
        };
      }
    }

    if (lastAmalan) {
      const time = new Date(lastAmalan.updatedAt || lastAmalan.createdAt || lastAmalan.tanggal).getTime();
      if (time > latestTime) {
        latestTime = time;
        latestActivity = {
          tipe: 'Amalan Yaumi',
          waktu: lastAmalan.updatedAt || lastAmalan.createdAt || lastAmalan.tanggal,
          detail: {
            tanggal: lastAmalan.tanggal,
            is_halangan: lastAmalan.is_halangan,
            sholat_fardu: lastAmalan.sholat_fardu,
            sholat_sunnah: lastAmalan.sholat_sunnah,
            puasa: lastAmalan.puasa
          }
        };
      }
    }

    if (lastPraktek) {
      const time = new Date(lastPraktek.updatedAt || lastPraktek.createdAt || lastPraktek.tanggal).getTime();
      if (time > latestTime) {
        latestTime = time;
        latestActivity = {
          tipe: 'Praktek Ibadah',
          waktu: lastPraktek.updatedAt || lastPraktek.createdAt || lastPraktek.tanggal,
          detail: {
            jenis_ibadah: lastPraktek.jenis_ibadah_id ? (lastPraktek.jenis_ibadah_id.nama_ibadah || lastPraktek.jenis_ibadah_id.nama) : 'Tidak Diketahui',
            status: lastPraktek.status,
            nilai: lastPraktek.nilai,
            catatan: lastPraktek.catatan
          }
        };
      }
    }

    res.json({
      success: true,
      data: {
        email: user.mailcow_email,
        name: user.nama,
        role: user.role,
        last_activity: latestActivity
      }
    });
  } catch (error) {
    console.error('[APIController] Error fetching user stats:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
};
