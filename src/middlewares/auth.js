function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    // Add user details to res.locals for easy access in EJS templates
    res.locals.currentUser = req.session.user;
    return next();
  }
  
  // Store the original URL so we can redirect back after login
  req.session.redirectTo = req.originalUrl;
  res.redirect('/auth/login');
}

function redirectIfAuth(req, res, next) {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }
  next();
}

module.exports = {
  requireAuth,
  redirectIfAuth
};
