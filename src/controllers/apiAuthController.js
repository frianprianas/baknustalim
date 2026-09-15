const mailcowService = require('../services/mailcowService');
const User = require('../models/User');
const { generateToken } = require('../utils/token');

/**
 * POST /api/v1/auth/login
 * Body: { email, password }
 */
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email dan password wajib diisi.'
    });
  }

  try {
    let emailLower = email.trim().toLowerCase();
    if (!emailLower.includes('@')) {
      emailLower = `${emailLower}@smk.baktinusantara666.sch.id`;
    }

    // 1. Authenticate via Mailcow
    await mailcowService.authenticateUser(emailLower, password);

    // 2. Fetch or create local user
    let user = await User.findOne({ mailcow_email: emailLower });
    if (!user) {
      await mailcowService.syncUsersFromMailcow();
      user = await User.findOne({ mailcow_email: emailLower });
      if (!user) {
        const localPart = emailLower.split('@')[0];
        const isNumeric = /^\d+$/.test(localPart);
        user = new User({
          mailcow_email: emailLower,
          nama: localPart,
          role: 'siswa',
          nis: isNumeric ? localPart : null,
          last_synced_at: new Date()
        });
        await user.save();
      }
    }

    // Update last_active_at
    user.last_active_at = new Date();
    await user.save();

    // 3. Generate token
    const token = generateToken({
      id: user._id,
      email: user.mailcow_email,
      nama: user.nama,
      role: user.role
    });

    res.json({
      success: true,
      message: 'Login berhasil.',
      token,
      user: {
        id: user._id,
        nama: user.nama,
        email: user.mailcow_email,
        role: user.role,
        nis: user.nis,
        nip: user.nip,
        poin: user.poin
      }
    });
  } catch (error) {
    console.error('API Login Error:', error.message);
    res.status(401).json({
      success: false,
      message: 'Email atau password salah, atau akun tidak terdaftar di Mailcow.'
    });
  }
};

/**
 * GET /api/v1/auth/me
 */
exports.getProfile = async (req, res) => {
  try {
    const user = req.user;
    res.json({
      success: true,
      user: {
        id: user._id,
        nama: user.nama,
        email: user.mailcow_email,
        role: user.role,
        nis: user.nis,
        nip: user.nip,
        poin: user.poin,
        is_guru_pai: user.is_guru_pai
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
