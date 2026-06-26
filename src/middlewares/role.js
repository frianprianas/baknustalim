/**
 * Restricts access to users with specific roles.
 * @param {Array<string>} roles - Array of allowed roles (e.g. ['admin', 'tu'])
 */
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.redirect('/auth/login');
    }
    
    const userRole = req.session.user.role;
    if (roles.includes(userRole)) {
      return next();
    }
    
    // Unauthorized
    res.status(403).render('error', {
      title: 'Akses Ditolak',
      message: 'Anda tidak memiliki hak akses untuk membuka halaman ini.',
      error: { status: 403 }
    });
  };
}

/**
 * Restricts access to designated PAI Teachers or Admins.
 */
function requireGuruPAI(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/auth/login');
  }

  const user = req.session.user;
  if (user.role === 'admin' || (user.role === 'guru' && user.is_guru_pai)) {
    return next();
  }

  res.status(403).render('error', {
    title: 'Akses Ditolak',
    message: 'Hanya Guru PAI yang diizinkan untuk melakukan tindakan ini.',
    error: { status: 403 }
  });
}

module.exports = {
  requireRole,
  requireGuruPAI
};
