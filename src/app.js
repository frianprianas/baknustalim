require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cron = require('node-cron');
const connectDB = require('./config/db');
const mailcowService = require('./services/mailcowService');

// Initialize Express
const app = express();

// Connect to MongoDB
connectDB();

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static Folder
app.use(express.static(path.join(__dirname, '../public')));

// Session Setup with MongoStore persistence
app.use(session({
  secret: process.env.SESSION_SECRET || 'baknus_talim_secret_key_12345',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/baknus_talim',
    collectionName: 'sessions',
    ttl: 14 * 24 * 60 * 60 // 14 days session life
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true in production (requires HTTPS)
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Global variables middleware for EJS templates
app.use(async (req, res, next) => {
  if (req.session.user && !req.session.user.profile) {
    try {
      const mailcowService = require('./services/mailcowService');
      req.session.user.profile = await mailcowService.getUserProfile(req.session.user.mailcow_email);
    } catch (profileErr) {
      console.warn('Lazy profile fetch failed:', profileErr);
    }
  }

  res.locals.currentUser = req.session.user || null;
  res.locals.successMessage = req.session.successMessage || null;
  res.locals.errorMessage = req.session.errorMessage || null;
  
  // Clear flash messages after single display
  delete req.session.successMessage;
  delete req.session.errorMessage;
  next();
});

// View Engine Setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Background Cron Scheduler
// Scheduled to run every night at 02:00 AM
cron.schedule('0 2 * * *', async () => {
  console.log('[Scheduler] Starting automated Mailcow user synchronization...');
  try {
    const count = await mailcowService.syncUsersFromMailcow();
    console.log(`[Scheduler] Automated synchronization complete. Synced ${count} users.`);
  } catch (error) {
    console.error('[Scheduler] ERROR running automated Mailcow synchronization:', error);
  }
});

// Mount Routes
app.use('/', require('./routes/index.routes'));
app.use('/auth', require('./routes/auth.routes'));
app.use('/admin', require('./routes/admin.routes'));
app.use('/hafalan', require('./routes/hafalan.routes'));
app.use('/ibadah', require('./routes/ibadah.routes'));
app.use('/quran', require('./routes/quran.routes'));
app.use('/tanya', require('./routes/tanya.routes'));
app.use('/live', require('./routes/live.routes'));
app.use('/ai', require('./routes/ai.routes'));
app.use('/hadits', require('./routes/hadits.routes'));
app.use('/amalan', require('./routes/amalan.routes'));
app.use('/belajar', require('./routes/belajar.routes'));

// 404 Handler
app.use((req, res, next) => {
  res.status(404).render('error', {
    title: 'Halaman Tidak Ditemukan',
    message: 'Maaf, halaman atau portal yang Anda cari tidak dapat ditemukan.',
    error: { status: 404 }
  });
});

// 500 Handler (Global Error Boundary)
app.use((err, req, res, next) => {
  console.error('[System Error]', err);
  res.status(err.status || 500).render('error', {
    title: 'Gangguan Sistem',
    message: err.message || 'Terjadi kesalahan internal pada server.',
    error: err
  });
});

// Start Server
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

// Configure Socket.IO real-time connection logic
io.on('connection', (socket) => {
  let joinedRoom = null;

  // Join a specific evaluation room (e.g., eval_12345 or eval_BaknusTalim_Live_...)
  socket.on('join_eval_room', (data) => {
    if (data && data.siswa_id) {
      const roomName = `eval_${data.siswa_id}`;
      socket.join(roomName);
      joinedRoom = roomName;
      console.log(`[Socket] Client ${socket.id} joined room: ${roomName}`);

      // Broadcast the updated room size to all users in the room
      const roomSize = io.sockets.adapter.rooms.get(roomName)?.size || 1;
      io.to(roomName).emit('update_room_viewers', roomSize);
    }
  });

  // Receive highlight from student and broadcast to the teacher in the same room
  socket.on('highlight_ayat', (data) => {
    if (data && data.siswa_id && data.ayat_number) {
      const roomName = `eval_${data.siswa_id}`;
      // Emit to everyone in the room except the sender
      socket.to(roomName).emit('ayat_highlighted', {
        surah_number: data.surah_number,
        ayat_number: data.ayat_number
      });
    }
  });

  // Receive live chat message and broadcast to others in the room
  socket.on('live_chat_message', (data) => {
    if (data && data.siswa_id && data.text) {
      const roomName = `eval_${data.siswa_id}`;
      // Emit to everyone in the room except the sender
      socket.to(roomName).emit('chat_message_received', data);
    }
  });

  socket.on('disconnect', () => {
    if (joinedRoom) {
      // Broadcast the updated room size to remaining users
      const roomSize = io.sockets.adapter.rooms.get(joinedRoom)?.size || 0;
      io.to(joinedRoom).emit('update_room_viewers', roomSize);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[App] BaknusTa'lim running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
