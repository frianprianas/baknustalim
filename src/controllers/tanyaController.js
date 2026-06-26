const Question = require('../models/Question');
const User = require('../models/User');

exports.showQuestions = async (req, res, next) => {
  try {
    const user = req.session.user;
    const isGuruPai = user.role === 'guru' && user.is_guru_pai;
    const isAdmin = user.role === 'admin';
    const isGuruPaiOrAdmin = isAdmin || isGuruPai;

    let query = {};
    if (!isAdmin) {
      if (isGuruPai) {
        // Guru PAI sees: answered questions, questions directed to them, or questions they asked
        query = {
          $or: [
            { status: 'dijawab' },
            { guru_id: user.id },
            { user_id: user.id }
          ]
        };
      } else {
        // Regular users see: answered questions or questions they asked
        query = {
          $or: [
            { status: 'dijawab' },
            { user_id: user.id }
          ]
        };
      }
    }

    const questions = await Question.find(query)
      .populate('user_id', 'nama role nis nip')
      .populate('guru_id', 'nama role nip')
      .sort({ createdAt: -1 });

    // Fetch list of designated PAI teachers for the selection dropdown
    const guruPaiList = await User.find({ role: 'guru', is_guru_pai: true }).sort({ nama: 1 });

    res.render('tanya/index', {
      title: 'Tanya Yuk! - BaknusTa\'lim',
      questions,
      isGuruPaiOrAdmin,
      guruPaiList,
      error: null
    });
  } catch (err) {
    next(err);
  }
};

exports.createQuestion = async (req, res, next) => {
  const { pertanyaan, guru_id } = req.body;
  
  if (!pertanyaan || !pertanyaan.trim()) {
    req.session.errorMessage = 'Pertanyaan tidak boleh kosong.';
    return res.redirect('/tanya');
  }

  if (!guru_id) {
    req.session.errorMessage = 'Harap pilih Guru PAI yang ingin Anda tanyakan.';
    return res.redirect('/tanya');
  }

  try {
    // Verify that the selected teacher is indeed a designated Guru PAI
    const selectedGuru = await User.findOne({ _id: guru_id, role: 'guru', is_guru_pai: true });
    if (!selectedGuru) {
      req.session.errorMessage = 'Guru PAI yang dipilih tidak valid.';
      return res.redirect('/tanya');
    }

    const newQuestion = new Question({
      user_id: req.session.user.id,
      pertanyaan: pertanyaan.trim(),
      guru_id: selectedGuru._id
    });
    await newQuestion.save();
    req.session.successMessage = `Pertanyaan Anda berhasil diajukan kepada ${selectedGuru.nama}!`;
    res.redirect('/tanya');
  } catch (err) {
    next(err);
  }
};

exports.answerQuestion = async (req, res, next) => {
  const { id } = req.params;
  const { jawaban } = req.body;
  const user = req.session.user;
  const isGuruPai = user.role === 'guru' && user.is_guru_pai;
  const isAdmin = user.role === 'admin';

  if (!isGuruPai && !isAdmin) {
    req.session.errorMessage = 'Anda tidak memiliki akses untuk menjawab pertanyaan.';
    return res.redirect('/tanya');
  }

  if (!jawaban || !jawaban.trim()) {
    req.session.errorMessage = 'Jawaban tidak boleh kosong.';
    return res.redirect('/tanya');
  }

  try {
    const question = await Question.findById(id);
    if (!question) {
      req.session.errorMessage = 'Pertanyaan tidak ditemukan.';
      return res.redirect('/tanya');
    }

    // Verify that this question was directed to this teacher, or user is Admin
    if (!isAdmin && question.guru_id.toString() !== user.id.toString()) {
      req.session.errorMessage = 'Pertanyaan ini tidak ditujukan kepada Anda.';
      return res.redirect('/tanya');
    }

    question.jawaban = jawaban.trim();
    question.status = 'dijawab';
    question.tanggal_dijawab = new Date();
    await question.save();

    req.session.successMessage = 'Pertanyaan berhasil dijawab!';
    res.redirect('/tanya');
  } catch (err) {
    next(err);
  }
};

exports.deleteQuestion = async (req, res, next) => {
  const { id } = req.params;
  const user = req.session.user;

  try {
    const question = await Question.findById(id);
    if (!question) {
      req.session.errorMessage = 'Pertanyaan tidak ditemukan.';
      return res.redirect('/tanya');
    }

    // Only allow admin or the user who asked to delete the question
    const isAuthorized = user.role === 'admin' || question.user_id.toString() === user.id.toString();
    if (!isAuthorized) {
      req.session.errorMessage = 'Anda tidak memiliki akses untuk menghapus pertanyaan ini.';
      return res.redirect('/tanya');
    }

    await Question.findByIdAndDelete(id);
    req.session.successMessage = 'Pertanyaan berhasil dihapus.';
    res.redirect('/tanya');
  } catch (err) {
    next(err);
  }
};
