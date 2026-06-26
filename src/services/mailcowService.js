const nodemailer = require('nodemailer');
const { ImapFlow } = require('imapflow');
const User = require('../models/User');

const API_URL = process.env.MAILCOW_API_URL || 'http://mail.smk.baktinusantara666.sch.id';
const API_KEY = process.env.MAILCOW_API_KEY || '925B68-0FF6BB-36B760-F6C051-AAF343';
const MAIL_HOST = process.env.MAILCOW_MAIL_HOST || 'mail.smk.baktinusantara666.sch.id';
const SMTP_PORT = parseInt(process.env.MAILCOW_SMTP_PORT) || 465;
const IMAP_PORT = parseInt(process.env.MAILCOW_IMAP_PORT) || 993;
const AUTH_METHOD = process.env.MAILCOW_AUTH_METHOD || 'SMTP';

/**
 * Authenticate user credentials by attempting SMTP or IMAP connection to Mailcow.
 * Returns true if successful, throws error otherwise.
 */
async function authenticateUser(email, password) {
  if (!email || !password) {
    throw new Error('Email dan password harus diisi.');
  }

  // Development bypass logic
  if (process.env.NODE_ENV === 'development' && password === 'devpass123') {
    const userExists = await User.findOne({ mailcow_email: email.toLowerCase() });
    if (userExists) {
      console.log(`[DevAuth] Bypass authentication granted for ${email}`);
      return true;
    }
  }

  // Try SMTP first (default)
  if (AUTH_METHOD === 'SMTP') {
    try {
      const transporter = nodemailer.createTransport({
        host: MAIL_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: {
          user: email,
          pass: password
        },
        connectionTimeout: 5000,
        greetingTimeout: 5000
      });
      await transporter.verify();
      return true;
    } catch (smtpError) {
      console.warn(`SMTP Authentication failed for ${email}: ${smtpError.message}. Trying IMAP fallback...`);
      // Fallback to IMAP
      return await authenticateViaIMAP(email, password);
    }
  } else {
    // Primary IMAP
    return await authenticateViaIMAP(email, password);
  }
}

async function authenticateViaIMAP(email, password) {
  const client = new ImapFlow({
    host: MAIL_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: {
      user: email,
      pass: password
    },
    logger: false,
    connectionTimeout: 5000
  });

  try {
    await client.connect();
    await client.logout();
    return true;
  } catch (imapError) {
    console.error(`IMAP Authentication failed for ${email}: ${imapError.message}`);
    throw new Error('Email atau password Mailcow salah.');
  }
}

/**
 * Synchronize mailboxes from Mailcow to local MongoDB.
 */
async function syncUsersFromMailcow() {
  try {
    console.log(`Starting Mailcow user synchronization from ${API_URL}...`);
    const response = await fetch(`${API_URL}/api/v1/get/mailbox/all`, {
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch mailboxes from Mailcow API. Status: ${response.status}`);
    }

    const mailboxes = await response.json();
    let syncCount = 0;

    for (const mailbox of mailboxes) {
      // 1. Determine role
      let role = 'siswa'; // default role
      const tags = mailbox.tags || [];

      if (tags.includes('Admin')) {
        role = 'admin';
      } else if (tags.includes('Guru')) {
        role = 'guru';
      } else if (tags.includes('TU')) {
        role = 'tu';
      } else if (tags.includes('Siswa')) {
        role = 'siswa';
      } else {
        // Fallback for untagged mailboxes
        // If local_part is entirely numeric, classify as siswa
        if (/^\d+$/.test(mailbox.local_part)) {
          role = 'siswa';
        } else {
          // Keep default as 'siswa' (or standard user), Admin can change it in the system
          role = 'siswa';
        }
      }

      // 2. Extract NIS/NIP
      let nis = null;
      let nip = null;
      if (role === 'siswa' && /^\d+$/.test(mailbox.local_part)) {
        nis = mailbox.local_part;
      }

      // Find if user already exists
      let user = await User.findOne({ mailcow_email: mailbox.username.toLowerCase() });

      if (user) {
        // Update user (preserve locally-edited fields like is_guru_pai, kelas_id, nis/nip if already manually set)
        user.nama = mailbox.name || user.nama;
        user.role = role; // Sync mailcow role tags as source of truth
        if (!user.nis && nis) user.nis = nis;
        user.last_synced_at = new Date();
        await user.save();
      } else {
        // Create new user representation
        user = new User({
          mailcow_email: mailbox.username.toLowerCase(),
          nama: mailbox.name || mailbox.local_part,
          role: role,
          nis: nis,
          nip: nip,
          is_guru_pai: false,
          last_synced_at: new Date()
        });
        await user.save();
      }
      syncCount++;
    }

    console.log(`Synchronization completed. Synced ${syncCount} users.`);
    return syncCount;
  } catch (error) {
    console.error(`Error during Mailcow user sync: ${error.message}`);
    throw error;
  }
}

/**
 * Fetch profile info for a user based on email.
 */
async function getUserProfile(email) {
  if (!email) return null;
  
  try {
    const response = await fetch(`${API_URL}/api/public/info/${encodeURIComponent(email.toLowerCase())}`);
    if (!response.ok) {
      throw new Error(`Profile API status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.warn(`Could not fetch profile for ${email} from Mailcow API: ${error.message}`);
    return {
      email: email.toLowerCase(),
      displayName: email.split('@')[0],
      phoneNumber: null,
      isPhoneVerified: false,
      avatarUrl: `${API_URL}/api/public/avatar/${encodeURIComponent(email.toLowerCase())}`
    };
  }
}

module.exports = {
  authenticateUser,
  syncUsersFromMailcow,
  getUserProfile
};
