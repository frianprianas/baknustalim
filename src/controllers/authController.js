const mailcowService = require('../services/mailcowService');
const User = require('../models/User');

exports.showLogin = (req, res) => {
  res.render('auth/login', {
    title: 'Login - BaknusTa\'lim',
    error: null,
    email: ''
  });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.render('auth/login', {
      title: 'Login - BaknusTa\'lim',
      error: 'Email dan password wajib diisi.',
      email: email || ''
    });
  }

  try {
    const emailLower = email.trim().toLowerCase();
    
    // 1. Verify credentials via Mailcow (SMTP/IMAP)
    await mailcowService.authenticateUser(emailLower, password);

    // 2. Fetch local user representation
    let user = await User.findOne({ mailcow_email: emailLower });

    if (!user) {
      console.log(`User ${emailLower} not found in database after authentication. Running sync...`);
      // Sync users from Mailcow to see if they exist in the mailbox list
      await mailcowService.syncUsersFromMailcow();
      user = await User.findOne({ mailcow_email: emailLower });
      
      // Fallback: If still not found (e.g. new mailbox or API lag), create a local entry
      if (!user) {
        console.log(`User ${emailLower} still not found in mailbox list. Creating fallback user.`);
        const localPart = emailLower.split('@')[0];
        const isNumeric = /^\d+$/.test(localPart);
        
        user = new User({
          mailcow_email: emailLower,
          nama: localPart,
          role: isNumeric ? 'siswa' : 'siswa', // Default role
          nis: isNumeric ? localPart : null,
          nip: null,
          is_guru_pai: false,
          last_synced_at: new Date()
        });
        await user.save();
      }
    }

    // 3. Fetch profile
    let profile = null;
    try {
      profile = await mailcowService.getUserProfile(emailLower);
    } catch (profileErr) {
      console.warn('Failed to fetch profile during login:', profileErr);
    }

    // 4. Save to session
    req.session.user = {
      id: user._id,
      mailcow_email: user.mailcow_email,
      nama: user.nama,
      role: user.role,
      nis: user.nis,
      nip: user.nip,
      kelas_id: user.kelas_id,
      is_guru_pai: user.is_guru_pai,
      profile: profile
    };

    console.log(`User ${emailLower} logged in successfully with role: ${user.role}`);
    
    // 4. Redirect to intended page or dashboard
    const redirectTo = req.session.redirectTo || '/dashboard';
    delete req.session.redirectTo;
    res.redirect(redirectTo);
  } catch (error) {
    console.error(`Login error for ${email}: ${error.message}`);
    res.render('auth/login', {
      title: 'Login - BaknusTa\'lim',
      error: error.message || 'Koneksi ke server Mailcow gagal.',
      email: email || ''
    });
  }
};

exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.redirect('/auth/login');
  });
};
