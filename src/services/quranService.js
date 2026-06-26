const Surah = require('../models/Surah');
const QuranAyat = require('../models/QuranAyat');

/**
 * Sync the metadata of 114 Surahs from Al Quran Cloud API into the local MongoDB database.
 * This runs when the server starts if the collection is empty, or can be triggered.
 */
async function syncSurahMetadata() {
  try {
    console.log('Syncing Quran Surah metadata from api.alquran.cloud...');
    const response = await fetch('https://api.alquran.cloud/v1/surah');
    if (!response.ok) {
      throw new Error(`Failed to fetch Surah list. Status: ${response.status}`);
    }

    const json = await response.json();
    const surahs = json.data;

    let createdCount = 0;
    let updatedCount = 0;

    for (const s of surahs) {
      const existing = await Surah.findOne({ number: s.number });
      const surahData = {
        number: s.number,
        name_arabic: s.name,
        name_latin: s.englishName,
        name_translation_id: s.englishNameTranslation, // Indonesian translation name if available, fallback to english translation name
        jumlah_ayat: s.numberOfAyahs,
        tempat_turun: s.revelationType.toLowerCase() === 'meccan' ? 'Makkiyah' : 'Madaniyah'
      };

      if (existing) {
        await Surah.updateOne({ number: s.number }, surahData);
        updatedCount++;
      } else {
        await Surah.create(surahData);
        createdCount++;
      }
    }

    console.log(`Surah metadata sync completed. Created: ${createdCount}, Updated: ${updatedCount}`);
    return { createdCount, updatedCount };
  } catch (error) {
    console.error(`Error syncing Surah metadata: ${error.message}`);
    throw error;
  }
}

/**
 * Retrieve verses of a specific Surah.
 * Checks the database cache first; if not present, fetches from the Al Quran Cloud API,
 * caches it, and returns the result.
 */
async function getSurahAyat(surahNumber) {
  const parsedNumber = parseInt(surahNumber);
  if (isNaN(parsedNumber) || parsedNumber < 1 || parsedNumber > 114) {
    throw new Error('Nomor Surah harus berkisar antara 1 s.d. 114.');
  }

  // 1. Check local cache
  const cachedAyat = await QuranAyat.find({ surah_number: parsedNumber }).sort({ ayat_number: 1 });
  if (cachedAyat && cachedAyat.length > 0) {
    return cachedAyat;
  }

  // 2. Fetch from external API
  console.log(`Cache miss for Surah ${parsedNumber}. Fetching from API...`);
  try {
    const response = await fetch(`https://api.alquran.cloud/v1/surah/${parsedNumber}/editions/quran-uthmani,id.indonesian`);
    if (!response.ok) {
      throw new Error(`Failed to fetch verses for Surah ${parsedNumber}. Status: ${response.status}`);
    }

    const json = await response.json();
    const editions = json.data;

    if (!editions || editions.length < 2) {
      throw new Error('Unexpected API response layout. Missing editions.');
    }

    const arabicEdition = editions[0];
    const indonesianEdition = editions[1];

    const ayahsToInsert = [];
    const results = [];

    const totalAyahs = arabicEdition.ayahs.length;
    for (let i = 0; i < totalAyahs; i++) {
      const arAyah = arabicEdition.ayahs[i];
      const idAyah = indonesianEdition.ayahs[i];

      const ayatData = {
        surah_number: parsedNumber,
        ayat_number: arAyah.numberInSurah,
        teks_arab: arAyah.text,
        teks_terjemahan_id: idAyah.text
      };

      ayahsToInsert.push(ayatData);
    }

    // Insert into DB and return
    const inserted = await QuranAyat.insertMany(ayahsToInsert);
    console.log(`Successfully cached ${inserted.length} verses for Surah ${parsedNumber}.`);
    
    // Sort just in case insertMany response order is different
    return inserted.sort((a, b) => a.ayat_number - b.ayat_number);
  } catch (error) {
    console.error(`Error fetching/caching verses for Surah ${parsedNumber}: ${error.message}`);
    throw error;
  }
}

module.exports = {
  syncSurahMetadata,
  getSurahAyat
};
