const Surah = require('../models/Surah');
const QuranAyat = require('../models/QuranAyat');
const Bookmark = require('../models/Bookmark');
const quranService = require('../services/quranService');

// Halaman Daftar Surah
exports.listSurahs = async (req, res) => {
  try {
    let surahs = await Surah.find().sort({ number: 1 });
    
    // Automatically seed Surah metadata on first load if collection is empty
    if (!surahs || surahs.length === 0) {
      console.log('Surah collection is empty. Syncing metadata from Al Quran Cloud...');
      await quranService.syncSurahMetadata();
      surahs = await Surah.find().sort({ number: 1 });
    }

    res.render('quran/index', {
      title: 'Baca Al-Qur\'an Online - BaknusTa\'lim',
      surahs
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};

// Halaman Baca Surah (Arabic and Indonesian side-by-side)
exports.readSurah = async (req, res) => {
  const surahNumber = parseInt(req.params.number);
  const currentUser = req.session.user;

  try {
    if (isNaN(surahNumber) || surahNumber < 1 || surahNumber > 114) {
      return res.status(400).render('error', { title: 'Surah Tidak Valid', message: 'Nomor surah harus antara 1 s.d. 114.', error: { status: 400 } });
    }

    // 1. Fetch surah metadata
    const surah = await Surah.findOne({ number: surahNumber });
    if (!surah) {
      return res.status(404).render('error', { title: 'Surah Tidak Ditemukan', message: 'Surah tidak ditemukan di database.', error: { status: 404 } });
    }

    // 2. Fetch verses (handles caching automatically)
    const ayahs = await quranService.getSurahAyat(surahNumber);

    // Fetch previous and next surah metadata for navigation
    let prevSurah = null;
    let nextSurah = null;
    if (surahNumber > 1) {
      prevSurah = await Surah.findOne({ number: surahNumber - 1 });
    }
    if (surahNumber < 114) {
      nextSurah = await Surah.findOne({ number: surahNumber + 1 });
    }

    // 3. Fetch user bookmarks for this surah
    const userBookmarks = await Bookmark.find({
      user_id: currentUser.id,
      surah_number: surahNumber
    });
    
    // Map to a Set of bookmarked verse numbers for O(1) lookup
    const bookmarkedVerses = new Set(userBookmarks.map(b => b.ayat_number));

    res.render('quran/read', {
      title: `Surah ${surah.name_latin} (${surah.name_arabic}) - BaknusTa\'lim`,
      surah,
      ayahs,
      bookmarkedVerses,
      prevSurah,
      nextSurah,
      userBookmarks: userBookmarks.reduce((acc, curr) => {
        acc[curr.ayat_number] = curr;
        return acc;
      }, {})
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};

// Add Bookmark
exports.addBookmark = async (req, res) => {
  const { surah_number, ayat_number, catatan } = req.body;
  const currentUser = req.session.user;

  try {
    if (!surah_number || !ayat_number) {
      return res.status(400).json({ success: false, message: 'Surah dan Ayat wajib diisi.' });
    }

    // Check if verse exists
    const verse = await QuranAyat.findOne({
      surah_number: parseInt(surah_number),
      ayat_number: parseInt(ayat_number)
    });

    if (!verse) {
      return res.status(404).json({ success: false, message: 'Ayat tidak ditemukan dalam cache. Silakan buka halaman surah tersebut terlebih dahulu.' });
    }

    // Create or update bookmark
    await Bookmark.findOneAndUpdate(
      {
        user_id: currentUser.id,
        surah_number: parseInt(surah_number),
        ayat_number: parseInt(ayat_number)
      },
      {
        catatan: catatan || ''
      },
      { upsert: true, new: true }
    );

    // Update user points
    const { updateUserPoints } = require('../services/pointsService');
    await updateUserPoints(currentUser.id);

    res.json({ success: true, message: 'Bookmark berhasil disimpan.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Remove Bookmark
exports.removeBookmark = async (req, res) => {
  const { surah_number, ayat_number } = req.body;
  const currentUser = req.session.user;

  try {
    if (!surah_number || !ayat_number) {
      return res.status(400).json({ success: false, message: 'Surah dan Ayat wajib diisi.' });
    }

    await Bookmark.deleteOne({
      user_id: currentUser.id,
      surah_number: parseInt(surah_number),
      ayat_number: parseInt(ayat_number)
    });

    // Update user points
    const { updateUserPoints } = require('../services/pointsService');
    await updateUserPoints(currentUser.id);

    res.json({ success: true, message: 'Bookmark berhasil dihapus.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// View Bookmark List
exports.listBookmarks = async (req, res) => {
  const currentUser = req.session.user;

  try {
    const bookmarks = await Bookmark.find({ user_id: currentUser.id }).sort({ createdAt: -1 });

    // Retrieve details for each bookmark (surah name, verse texts)
    const detailedBookmarks = await Promise.all(bookmarks.map(async (b) => {
      const surah = await Surah.findOne({ number: b.surah_number });
      const ayat = await QuranAyat.findOne({ surah_number: b.surah_number, ayat_number: b.ayat_number });
      
      return {
        _id: b._id,
        surah_number: b.surah_number,
        ayat_number: b.ayat_number,
        catatan: b.catatan,
        createdAt: b.createdAt,
        surah_name: surah ? surah.name_latin : `Surah ${b.surah_number}`,
        surah_arabic: surah ? surah.name_arabic : '',
        teks_arab: ayat ? ayat.teks_arab : '[Teks tidak tersedia]',
        teks_terjemahan: ayat ? ayat.teks_terjemahan_id : '[Terjemahan tidak tersedia]'
      };
    }));

    res.render('quran/bookmarks', {
      title: 'Bookmark Saya - BaknusTa\'lim',
      bookmarks: detailedBookmarks
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};

// Halaman Murottal Player
exports.murottalPlayer = async (req, res) => {
  try {
    const surahs = await Surah.find().sort({ number: 1 });
    res.render('quran/murottal', {
      title: 'Murottal Audio Al-Qur\'an - BaknusTa\'lim',
      surahs
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};

// Halaman Utama Ngaji Bareng
exports.ngajiBarengIndex = async (req, res) => {
  const currentUser = req.session.user;
  const NgajiSession = require('../models/NgajiSession');
  try {
    // 1. Clean up any expired active sessions
    await NgajiSession.updateMany(
      { status: 'aktif', waktu_selesai: { $lte: new Date() } },
      { $set: { status: 'selesai' } }
    );

    // 2. Find if there is an active session
    const activeSession = await NgajiSession.findOne({ status: 'aktif' }).populate('created_by');

    // 3. Find recently ended sessions (max 10)
    const endedSessions = await NgajiSession.find({ status: 'selesai' })
      .populate('created_by')
      .sort({ waktu_selesai: -1 })
      .limit(10);

    res.render('quran/ngaji_bareng', {
      title: 'Ngaji Bareng - BaknusTa\'lim',
      activeSession,
      endedSessions,
      currentUser
    });
  } catch (error) {
    console.error('[QuranController] Error in ngajiBarengIndex:', error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};

// Mulai Sesi Ngaji Bareng
exports.startNgajiSession = async (req, res) => {
  const currentUser = req.session.user;
  const NgajiSession = require('../models/NgajiSession');
  
  const isAdmin = currentUser.role === 'admin';
  const isGuruPAI = currentUser.role === 'guru' && currentUser.is_guru_pai;

  if (!isAdmin && !isGuruPAI) {
    req.session.errorMessage = 'Hanya Admin atau Guru PAI yang dapat memulai sesi Ngaji Bareng.';
    return res.redirect('/quran/ngajibareng');
  }

  try {
    const existing = await NgajiSession.findOne({ status: 'aktif' });
    if (existing) {
      req.session.errorMessage = 'Sesi Ngaji Bareng sedang berlangsung.';
      return res.redirect('/quran/ngajibareng');
    }

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 90 * 60 * 1000); // 90 minutes max

    const session = new NgajiSession({
      created_by: currentUser.id,
      creator_name: currentUser.nama || (currentUser.profile && currentUser.profile.displayName) || 'Pengguna',
      waktu_mulai: startTime,
      waktu_selesai: endTime,
      status: 'aktif'
    });

    await session.save();
    req.session.successMessage = 'Sesi Ngaji Bareng berhasil dimulai selama 90 menit!';
    res.redirect('/quran/ngajibareng');
  } catch (error) {
    console.error('[QuranController] Error in startNgajiSession:', error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};

// Hentikan Sesi Ngaji Bareng
exports.stopNgajiSession = async (req, res) => {
  const { id } = req.params;
  const currentUser = req.session.user;
  const NgajiSession = require('../models/NgajiSession');

  try {
    const session = await NgajiSession.findById(id);
    if (!session) {
      req.session.errorMessage = 'Sesi tidak ditemukan.';
      return res.redirect('/quran/ngajibareng');
    }

    // Allow only the session creator or Admin to end the session
    const isCreator = session.created_by.toString() === currentUser.id;
    const isAdmin = currentUser.role === 'admin';

    if (!isCreator && !isAdmin) {
      req.session.errorMessage = 'Hanya Guru PAI yang memulai sesi ini atau Admin yang dapat mengakhirinya.';
      return res.redirect('/quran/ngajibareng');
    }

    session.status = 'selesai';
    session.waktu_selesai = new Date();
    await session.save();

    req.session.successMessage = 'Sesi Ngaji Bareng telah diakhiri.';
    res.redirect('/quran/ngajibareng');
  } catch (error) {
    console.error('[QuranController] Error in stopNgajiSession:', error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};

// Detail Ringkasan Sesi Ngaji Bareng
exports.getNgajiSessionSummary = async (req, res) => {
  const { id } = req.params;
  const NgajiSession = require('../models/NgajiSession');

  try {
    const session = await NgajiSession.findById(id).populate('created_by');
    if (!session) {
      return res.status(404).json({ success: false, message: 'Sesi tidak ditemukan.' });
    }

    // Process & Aggregate reading data (bacaan)
    const rawBacaan = session.bacaan || [];
    
    // Total verses read
    const totalAyatDibaca = rawBacaan.length;

    // Aggregate by user
    const usersMap = {};
    rawBacaan.forEach(b => {
      const uKey = b.user_id ? b.user_id.toString() : b.user_name;
      if (!usersMap[uKey]) {
        usersMap[uKey] = {
          user_name: b.user_name,
          role: b.role,
          total_ayat: 0,
          surahs: {} // { 'Al-Fatihah': Set([1, 2]) }
        };
      }
      usersMap[uKey].total_ayat += 1;
      if (!usersMap[uKey].surahs[b.surah_name]) {
        usersMap[uKey].surahs[b.surah_name] = new Set();
      }
      usersMap[uKey].surahs[b.surah_name].add(b.ayat_number);
    });

    // Format the aggregated user list for rendering JSON
    const pembaca = Object.values(usersMap).map(u => {
      const detailedSurahs = Object.entries(u.surahs).map(([surahName, ayatSet]) => {
        // Sort ayat list in ascending order
        const sortedAyat = Array.from(ayatSet).sort((a, b) => a - b);
        return {
          surah_name: surahName,
          ayat_list: sortedAyat
        };
      });

      return {
        user_name: u.user_name,
        role: u.role,
        total_ayat: u.total_ayat,
        surahs: detailedSurahs
      };
    }).sort((a, b) => b.total_ayat - a.total_ayat); // Sort by most verses read

    // Unique participant count
    const totalPembaca = pembaca.length;

    // Format timeline (recent events first, max 100)
    const timeline = rawBacaan.map(b => ({
      user_name: b.user_name,
      role: b.role,
      surah_name: b.surah_name,
      ayat_number: b.ayat_number,
      waktu: new Date(b.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB'
    })).reverse().slice(0, 100);

    res.json({
      success: true,
      data: {
        creator_name: session.creator_name,
        waktu_mulai: new Date(session.waktu_mulai).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) + ' WIB',
        waktu_selesai: new Date(session.waktu_selesai).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) + ' WIB',
        total_ayat_dibaca: totalAyatDibaca,
        total_pembaca: totalPembaca,
        pembaca,
        timeline
      }
    });

  } catch (error) {
    console.error('[QuranController] Error in getNgajiSessionSummary:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil ringkasan sesi.', error: error.message });
  }
};
