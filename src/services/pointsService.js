const AmalanYaumi = require('../models/AmalanYaumi');
const Hafalan = require('../models/Hafalan');
const Bookmark = require('../models/Bookmark');
const MateriReadLog = require('../models/MateriReadLog');
const User = require('../models/User');

/**
 * Calculates and updates the total points of a user/student.
 * Self-healing aggregator to avoid double-adding or state drift.
 * @param {string|ObjectId} userId 
 * @returns {Promise<number>} updated total points
 */
async function updateUserPoints(userId) {
  try {
    // 1. Amalan Yaumi points
    const amalanLogs = await AmalanYaumi.find({ siswa_id: userId });
    let amalanPoints = 0;
    
    amalanLogs.forEach(log => {
      if (log.is_halangan) return;
      
      // Salat Fardhu: 5 points each
      if (log.sholat_fardu) {
        if (log.sholat_fardu.subuh) amalanPoints += 5;
        if (log.sholat_fardu.dzuhur) amalanPoints += 5;
        if (log.sholat_fardu.ashar) amalanPoints += 5;
        if (log.sholat_fardu.maghrib) amalanPoints += 5;
        if (log.sholat_fardu.isya) amalanPoints += 5;
      }
      
      // Salat Sunnah: 3 points each
      if (log.sholat_sunnah) {
        if (log.sholat_sunnah.tahajud) amalanPoints += 3;
        if (log.sholat_sunnah.duha) amalanPoints += 3;
        if (log.sholat_sunnah.rawatib) amalanPoints += 3;
      }
      
      // Puasa Sunnah: 10 points each
      if (log.puasa) {
        if (log.puasa.senin) amalanPoints += 10;
        if (log.puasa.kamis) amalanPoints += 10;
        if (log.puasa.ayyamul_bidh) amalanPoints += 10;
      }
    });

    // 2. Hafalan points: 20 points for each Competent surah grade
    const hafalanCount = await Hafalan.countDocuments({ siswa_id: userId, status: 'Kompeten' });
    const hafalanPoints = hafalanCount * 20;

    // 3. Quran Bookmarks: 10 points for each bookmark
    const bookmarkCount = await Bookmark.countDocuments({ user_id: userId });
    const bookmarkPoints = bookmarkCount * 10;

    // 4. Baca Materi (Learning Articles): 5 points for each read article
    const readCount = await MateriReadLog.countDocuments({ siswa_id: userId });
    const readPoints = readCount * 5;

    const totalPoints = amalanPoints + hafalanPoints + bookmarkPoints + readPoints;

    // Save in user profile
    await User.findByIdAndUpdate(userId, { poin: totalPoints });
    return totalPoints;
  } catch (error) {
    console.error(`Error updating points for user ${userId}:`, error);
    return 0;
  }
}

module.exports = {
  updateUserPoints
};
