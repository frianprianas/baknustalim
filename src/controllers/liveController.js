const LiveSession = require('../models/LiveSession');
const User = require('../models/User');

// Halaman Daftar Live Kajian
exports.listLiveSessions = async (req, res) => {
  const currentUser = req.session.user;
  try {
    const activeSessions = await LiveSession.find({ status: 'aktif' }).populate('guru_id');
    const endedSessions = await LiveSession.find({ status: 'selesai' })
      .populate('guru_id')
      .sort({ waktu_selesai: -1 })
      .limit(10);

    res.render('live/index', {
      title: 'Kajian Live - BaknusTa\'lim',
      activeSessions,
      endedSessions,
      isGuruPAI: currentUser.role === 'guru' && currentUser.is_guru_pai
    });
  } catch (error) {
    console.error('[LiveController] Error listing sessions:', error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};

// Mulai Live Kajian Baru
exports.startLiveSession = async (req, res) => {
  const currentUser = req.session.user;
  const { topik } = req.body;

  if (currentUser.role !== 'guru' || !currentUser.is_guru_pai) {
    return res.status(403).render('error', {
      title: 'Akses Ditolak',
      message: 'Hanya Guru PAI yang dapat memulai siaran langsung.',
      error: { status: 403 }
    });
  }

  if (!topik || topik.trim() === '') {
    req.session.errorMessage = 'Topik kajian wajib diisi.';
    return res.redirect('/live');
  }

  try {
    // Check if teacher already has an active session
    const existingSession = await LiveSession.findOne({
      guru_id: currentUser.id,
      status: 'aktif'
    });

    if (existingSession) {
      // Direct them to their active session instead of creating a new one
      return res.redirect(`/live/room/${existingSession.nama_room}`);
    }

    // Generate unique Jitsi Room Name
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const roomName = `BaknusTalim_Live_${currentUser.id}_${randomSuffix}`;

    const newSession = new LiveSession({
      guru_id: currentUser.id,
      nama_guru: currentUser.nama,
      nama_room: roomName,
      topik: topik.trim(),
      status: 'aktif'
    });

    await newSession.save();
    req.session.successMessage = 'Siaran langsung berhasil dimulai!';
    res.redirect(`/live/room/${roomName}`);
  } catch (error) {
    console.error('[LiveController] Error starting session:', error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};

// Hentikan Live Kajian
exports.stopLiveSession = async (req, res) => {
  const currentUser = req.session.user;
  const { id } = req.params;

  try {
    const session = await LiveSession.findById(id);
    if (!session) {
      req.session.errorMessage = 'Sesi live tidak ditemukan.';
      return res.redirect('/live');
    }

    // Ensure only the teacher hosting can stop it (or admin)
    if (session.guru_id.toString() !== currentUser.id && currentUser.role !== 'admin') {
      return res.status(403).render('error', {
        title: 'Akses Ditolak',
        message: 'Anda tidak memiliki hak untuk menghentikan siaran ini.',
        error: { status: 403 }
      });
    }

    session.status = 'selesai';
    session.waktu_selesai = new Date();
    await session.save();

    req.session.successMessage = 'Siaran langsung telah diakhiri.';
    res.redirect('/live');
  } catch (error) {
    console.error('[LiveController] Error stopping session:', error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};

// Masuk ke Ruang Live Kajian (Video Player Page)
exports.joinLiveSession = async (req, res) => {
  const { room_name } = req.params;
  const currentUser = req.session.user;

  try {
    const session = await LiveSession.findOne({ nama_room: room_name }).populate('guru_id');
    if (!session) {
      return res.status(404).render('error', {
        title: 'Sesi Tidak Ditemukan',
        message: 'Kajian live yang Anda cari tidak aktif atau tidak ditemukan.',
        error: { status: 404 }
      });
    }

    // Retrieve Jitsi domain from env or default to baknusmeet
    const jitsiDomain = process.env.BAKNUSMEET_URL || 'baknusmeet.smkbn666.sch.id';

    res.render('live/room', {
      title: `Live: ${session.topik} - BaknusTa\'lim`,
      session,
      room_name,
      jitsiDomain,
      currentUser
    });
  } catch (error) {
    console.error('[LiveController] Error joining session:', error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};
