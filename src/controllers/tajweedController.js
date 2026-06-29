const fs = require('fs');
const path = require('path');

// Helper to load lessons JSON
function getLessons() {
  const filePath = path.join(__dirname, '../data/tajweedLessons.json');
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(fileContent);
}

// 1. Show list of all Bab & Sub-Bab
exports.listLessons = async (req, res) => {
  try {
    const lessons = getLessons();
    res.render('tajweed/index', {
      title: 'Belajar Ilmu Tajwid - BaknusTa\'lim',
      lessons
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};

// 2. Show detailed explanation of a single sub-bab
exports.showLesson = async (req, res) => {
  try {
    const { sub_id } = req.params;
    const lessons = getLessons();

    // Find the specific sub-bab
    let foundSub = null;
    let foundBabTitle = '';

    for (const b of lessons) {
      const match = b.sub_bab.find(s => s.id === sub_id);
      if (match) {
        foundSub = match;
        foundBabTitle = b.bab;
        break;
      }
    }

    if (!foundSub) {
      return res.status(404).render('error', { 
        title: 'Materi Tidak Ditemukan', 
        message: 'Materi sub-bab tajwid tidak ditemukan.', 
        error: { status: 404 } 
      });
    }

    res.render('tajweed/detail', {
      title: `${foundSub.topik} - Belajar Tajwid`,
      babTitle: foundBabTitle,
      lesson: foundSub
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Server Error', message: error.message, error });
  }
};
