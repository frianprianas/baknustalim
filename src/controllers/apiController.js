const User = require('../models/User');
const AmalanYaumi = require('../models/AmalanYaumi');
const Hafalan = require('../models/Hafalan');
const Tilawah = require('../models/Tilawah');

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
