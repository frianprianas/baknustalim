const { verifyToken } = require('../utils/token');
const User = require('../models/User');

/**
 * Require valid API authentication via Bearer Token or existing Session
 */
async function requireApiAuth(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (token) {
      const decoded = verifyToken(token);
      if (!decoded) {
        return res.status(401).json({
          success: false,
          message: 'Token otentikasi tidak valid atau telah kedaluwarsa.'
        });
      }

      const user = await User.findById(decoded.id || decoded._id);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Pengguna dengan token ini tidak ditemukan.'
        });
      }

      req.user = user;
      return next();
    }

    // Fallback: Web session
    if (req.session && req.session.user) {
      req.user = req.session.user;
      return next();
    }

    return res.status(401).json({
      success: false,
      message: 'Akses ditolak. Silakan sertakan Bearer Token pada header Authorization.'
    });
  } catch (error) {
    console.error('Error in requireApiAuth:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan internal saat verifikasi autentikasi.'
    });
  }
}

/**
 * Optional API authentication (does not block if anonymous)
 */
async function optionalApiAuth(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        const user = await User.findById(decoded.id || decoded._id);
        if (user) req.user = user;
      }
    } else if (req.session && req.session.user) {
      req.user = req.session.user;
    }
  } catch (e) {}
  next();
}

module.exports = {
  requireApiAuth,
  optionalApiAuth
};
