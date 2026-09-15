const Surah = require('../models/Surah');
const QuranAyat = require('../models/QuranAyat');
const Bookmark = require('../models/Bookmark');
const quranService = require('../services/quranService');

const QARI_LIST = [
  { code: '01', name: 'Abdullah Al-Juhany', folder: 'Abdullah-Al-Juhany' },
  { code: '02', name: 'Abdul Muhsin Al-Qasim', folder: 'Abdul-Muhsin-Al-Qasim' },
  { code: '03', name: 'Abdurrahman As-Sudais', folder: 'Abdurrahman-as-Sudais' },
  { code: '04', name: 'Ibrahim Al-Dossari', folder: 'Ibrahim-Al-Dossari' },
  { code: '05', name: 'Misyari Rasyid Al-Afasi', folder: 'Misyari-Rasyid-Al-Afasi', default: true },
  { code: '06', name: 'Yasser Al-Dosari', folder: 'Yasser-Al-Dosari' }
];

const TAJWEED_GUIDE = [
  { code: 'h', name: 'Hamzat Wasl', color: '#AAAAAA', description: 'Hamzah sambung yang tidak dibaca saat washal' },
  { code: 's', name: 'Silent / Alif Lam Syamsiyah', color: '#BDBDBD', description: 'Huruf yang tidak dibunyikan saat dibaca' },
  { code: 'l', name: 'Lam Shamsiyyah', color: '#9E9E9E', description: 'Idgham Syamsiyah' },
  { code: 'n', name: 'Ghunnah / Tasydid', color: '#169200', description: 'Dengung 2 harakat' },
  { code: 'm', name: 'Mad Thabi\'i / Mad Wajib / Jaiz', color: '#0077D4', description: 'Bacaan panjang 2 s.d 6 harakat' },
  { code: 'q', name: 'Qalqalah', color: '#D30000', description: 'Bunyi pantulan (Ba, Jim, Dal, Tha, Qaf)' },
  { code: 'p', name: 'Iqlab', color: '#26A69A', description: 'Penggantian bunyi nun/tanwin menjadi mim' },
  { code: 'i', name: 'Ikhfa\' Haqiqi', color: '#E67E22', description: 'Menyamarkan bacaan nun mati / tanwin dengan dengung' },
  { code: 'd', name: 'Idgham Bighunnah', color: '#8E44AD', description: 'Meleburkan huruf disertai dengung' },
  { code: 'w', name: 'Idgham Bilaghunnah', color: '#5C6BC0', description: 'Meleburkan huruf tanpa dengung' }
];

/**
 * GET /api/v1/quran/surah
 * List all 114 Surahs
 */
exports.getAllSurahs = async (req, res) => {
  try {
    let surahs = await Surah.find().sort({ number: 1 });
    if (!surahs || surahs.length === 0) {
      await quranService.syncSurahMetadata();
      surahs = await Surah.find().sort({ number: 1 });
    }

    const data = surahs.map(s => {
      const padded = String(s.number).padStart(3, '0');
      return {
        number: s.number,
        name_latin: s.name_latin,
        name_arabic: s.name_arabic,
        name_translation: s.name_translation_id,
        jumlah_ayat: s.jumlah_ayat,
        tempat_turun: s.tempat_turun,
        audio_full_preview: `https://cdn.equran.id/audio-full/Misyari-Rasyid-Al-Afasi/${padded}.mp3`
      };
    });

    res.json({
      success: true,
      total: data.length,
      data
    });
  } catch (error) {
    console.error('Error getAllSurahs:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/v1/quran/surah/:number
 * Get Surah detail with all ayahs, translation, transliteration, tajweed, and tafsir
 * Query params:
 *   - qari: '01' | '02' | '03' | '04' | '05' | '06' (default '05')
 */
exports.getSurahDetail = async (req, res) => {
  const surahNumber = parseInt(req.params.number);
  if (isNaN(surahNumber) || surahNumber < 1 || surahNumber > 114) {
    return res.status(400).json({
      success: false,
      message: 'Nomor surah tidak valid (harus 1 s.d. 114).'
    });
  }

  const qariCode = req.query.qari || '05';
  const qari = QARI_LIST.find(q => q.code === qariCode) || QARI_LIST.find(q => q.code === '05');
  const padded = String(surahNumber).padStart(3, '0');
  const fullAudioUrl = `https://cdn.equran.id/audio-full/${qari.folder}/${padded}.mp3`;

  try {
    const surah = await Surah.findOne({ number: surahNumber });
    if (!surah) {
      return res.status(404).json({ success: false, message: 'Surah tidak ditemukan.' });
    }

    // Fetch verses (with auto-cache / backfill)
    const ayahs = await quranService.getSurahAyat(surahNumber);

    // Check user bookmarks if user authenticated
    let bookmarkedVerses = new Set();
    if (req.user) {
      const userBookmarks = await Bookmark.find({
        user_id: req.user._id || req.user.id,
        surah_number: surahNumber
      });
      userBookmarks.forEach(b => bookmarkedVerses.add(b.ayat_number));
    }

    const verses = ayahs.map(a => {
      const paddedAyat = String(a.ayat_number).padStart(3, '0');
      return {
        ayat_number: a.ayat_number,
        teks_arab: a.teks_arab,
        teks_latin: a.teks_latin || '',
        teks_terjemahan: a.teks_terjemahan_id,
        teks_tajweed: a.teks_tajweed || a.teks_arab,
        tafsir: a.tafsir || '',
        audio_ayat: `https://cdn.equran.id/audio-full/${qari.folder}/${padded}.mp3#t=${a.ayat_number}`,
        audio_per_ayah_cloud: `https://api.alquran.cloud/v1/ayah/${surahNumber}:${a.ayat_number}/ar.alafasy`,
        is_bookmarked: bookmarkedVerses.has(a.ayat_number)
      };
    });

    res.json({
      success: true,
      surah: {
        number: surah.number,
        name_latin: surah.name_latin,
        name_arabic: surah.name_arabic,
        name_translation: surah.name_translation_id,
        jumlah_ayat: surah.jumlah_ayat,
        tempat_turun: surah.tempat_turun
      },
      qari_selected: {
        code: qari.code,
        name: qari.name
      },
      audio_full: fullAudioUrl,
      total_ayat: verses.length,
      ayat: verses
    });
  } catch (error) {
    console.error('Error getSurahDetail:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/v1/quran/surah/:number/:ayat
 * Get single verse detail
 */
exports.getSingleAyat = async (req, res) => {
  const surahNumber = parseInt(req.params.number);
  const ayatNumber = parseInt(req.params.ayat);

  if (isNaN(surahNumber) || isNaN(ayatNumber)) {
    return res.status(400).json({ success: false, message: 'Parameter surah dan ayat harus berupa angka.' });
  }

  try {
    const surah = await Surah.findOne({ number: surahNumber });
    if (!surah) return res.status(404).json({ success: false, message: 'Surah tidak ditemukan.' });

    let verse = await QuranAyat.findOne({ surah_number: surahNumber, ayat_number: ayatNumber });
    if (!verse) {
      await quranService.getSurahAyat(surahNumber);
      verse = await QuranAyat.findOne({ surah_number: surahNumber, ayat_number: ayatNumber });
    }

    if (!verse) {
      return res.status(404).json({ success: false, message: 'Ayat tidak ditemukan.' });
    }

    let is_bookmarked = false;
    if (req.user) {
      const bm = await Bookmark.findOne({
        user_id: req.user._id || req.user.id,
        surah_number: surahNumber,
        ayat_number: ayatNumber
      });
      is_bookmarked = !!bm;
    }

    res.json({
      success: true,
      surah: {
        number: surah.number,
        name_latin: surah.name_latin,
        name_arabic: surah.name_arabic
      },
      ayat: {
        ayat_number: verse.ayat_number,
        teks_arab: verse.teks_arab,
        teks_latin: verse.teks_latin,
        teks_terjemahan: verse.teks_terjemahan_id,
        teks_tajweed: verse.teks_tajweed,
        tafsir: verse.tafsir,
        audio_per_ayah_cloud: `https://api.alquran.cloud/v1/ayah/${surahNumber}:${ayatNumber}/ar.alafasy`,
        is_bookmarked
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/v1/quran/qari
 * List all available audio Qaris
 */
exports.getQariList = (req, res) => {
  res.json({
    success: true,
    total: QARI_LIST.length,
    data: QARI_LIST.map(q => ({
      code: q.code,
      name: q.name,
      is_default: !!q.default
    }))
  });
};

/**
 * GET /api/v1/quran/tajweed-guide
 * Guide and color mapping for Flutter RichText rendering
 */
exports.getTajweedGuide = (req, res) => {
  res.json({
    success: true,
    description: 'Format penanda tajwid menggunakan tag kurung siku seperti [n]teks[/n]. Gunakan kode berikut untuk mewarnai teks di Flutter via TextSpan.',
    data: TAJWEED_GUIDE
  });
};

/**
 * GET /api/v1/quran/search?q=...
 * Search verses by translation or latin text
 */
exports.searchQuran = async (req, res) => {
  const query = req.query.q;
  if (!query || query.trim().length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Kata kunci pencarian minimal 2 karakter.'
    });
  }

  try {
    const regex = new RegExp(query.trim(), 'i');
    const results = await QuranAyat.find({
      $or: [
        { teks_terjemahan_id: regex },
        { teks_latin: regex }
      ]
    }).limit(50);

    const data = await Promise.all(results.map(async r => {
      const surah = await Surah.findOne({ number: r.surah_number });
      return {
        surah_number: r.surah_number,
        surah_name: surah ? surah.name_latin : `Surah ${r.surah_number}`,
        ayat_number: r.ayat_number,
        teks_arab: r.teks_arab,
        teks_terjemahan: r.teks_terjemahan_id
      };
    }));

    res.json({
      success: true,
      query,
      total_found: data.length,
      data
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/v1/quran/bookmarks
 * Get all bookmarks of current user (Requires Auth)
 */
exports.getUserBookmarks = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const bookmarks = await Bookmark.find({ user_id: userId }).sort({ createdAt: -1 });

    const data = await Promise.all(bookmarks.map(async b => {
      const surah = await Surah.findOne({ number: b.surah_number });
      const ayat = await QuranAyat.findOne({ surah_number: b.surah_number, ayat_number: b.ayat_number });
      return {
        id: b._id,
        surah_number: b.surah_number,
        surah_name_latin: surah ? surah.name_latin : `Surah ${b.surah_number}`,
        surah_name_arabic: surah ? surah.name_arabic : '',
        ayat_number: b.ayat_number,
        catatan: b.catatan || '',
        teks_arab: ayat ? ayat.teks_arab : '',
        teks_terjemahan: ayat ? ayat.teks_terjemahan_id : '',
        created_at: b.createdAt
      };
    }));

    res.json({
      success: true,
      total: data.length,
      data
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/v1/quran/bookmark
 * Add or update bookmark (Requires Auth)
 * Body: { surah_number, ayat_number, catatan }
 */
exports.addBookmark = async (req, res) => {
  const { surah_number, ayat_number, catatan } = req.body;
  const userId = req.user._id || req.user.id;

  if (!surah_number || !ayat_number) {
    return res.status(400).json({
      success: false,
      message: 'surah_number dan ayat_number wajib diisi.'
    });
  }

  try {
    const surahNum = parseInt(surah_number);
    const ayatNum = parseInt(ayat_number);

    let bookmark = await Bookmark.findOne({
      user_id: userId,
      surah_number: surahNum,
      ayat_number: ayatNum
    });

    if (bookmark) {
      bookmark.catatan = catatan !== undefined ? catatan : bookmark.catatan;
      await bookmark.save();
    } else {
      bookmark = await Bookmark.create({
        user_id: userId,
        surah_number: surahNum,
        ayat_number: ayatNum,
        catatan: catatan || ''
      });
    }

    // Send email notification (non-blocking)
    const mailerService = require('../services/mailerService');
    mailerService.sendBookmarkNotification(req.user, surahNum, ayatNum, catatan)
      .catch(err => console.error('[ApiBookmarkMail] Error sending notification:', err));

    res.json({
      success: true,
      message: 'Ayat berhasil ditambahkan ke bookmark.',
      data: bookmark
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/v1/quran/bookmark/:id
 * Remove bookmark by ID or by surah/ayat
 */
exports.removeBookmark = async (req, res) => {
  const userId = req.user._id || req.user.id;
  const { id } = req.params;

  try {
    const deleted = await Bookmark.findOneAndDelete({ _id: id, user_id: userId });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Bookmark tidak ditemukan.' });
    }
    res.json({ success: true, message: 'Bookmark berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/v1/quran/bookmark/surah/:surah/ayat/:ayat
 */
exports.removeBookmarkBySurahAyat = async (req, res) => {
  const userId = req.user._id || req.user.id;
  const surahNum = parseInt(req.params.surah);
  const ayatNum = parseInt(req.params.ayat);

  try {
    const deleted = await Bookmark.findOneAndDelete({
      user_id: userId,
      surah_number: surahNum,
      ayat_number: ayatNum
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Bookmark tidak ditemukan.' });
    }
    res.json({ success: true, message: 'Bookmark berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
