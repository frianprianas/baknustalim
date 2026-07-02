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

    // Allow session creator, Guru, or Admin to end the session
    if (
      session.created_by.toString() !== currentUser.id && 
      currentUser.role !== 'guru' && 
      currentUser.role !== 'admin'
    ) {
      req.session.errorMessage = 'Anda tidak memiliki wewenang untuk mengakhiri sesi ini.';
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
