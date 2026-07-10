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
  let cachedAyat = await QuranAyat.find({ surah_number: parsedNumber }).sort({ ayat_number: 1 });
  if (cachedAyat && cachedAyat.length > 0) {
    // Check if any cached verse doesn't have tafsir
    const needsTafsirBackfill = cachedAyat.some(a => !a.tafsir);
    // Check if any cached verse doesn't have latin transliteration
    const needsLatinBackfill = cachedAyat.some(a => !a.teks_latin);
    // Check if any cached verse doesn't have tajweed text
    const needsTajweedBackfill = cachedAyat.some(a => !a.teks_tajweed);

    if (needsTafsirBackfill || needsLatinBackfill || needsTajweedBackfill) {
      try {
        console.log(`Backfilling missing data (Tafsir: ${needsTafsirBackfill}, Latin: ${needsLatinBackfill}, Tajweed: ${needsTajweedBackfill}) for Surah ${parsedNumber}...`);
        
        let tafsirMap = {};
        if (needsTafsirBackfill) {
          const tafsirRes = await fetch(`https://equran.id/api/v2/tafsir/${parsedNumber}`);
          if (tafsirRes.ok) {
            const tafsirJson = await tafsirRes.json();
            if (tafsirJson.data && tafsirJson.data.tafsir) {
              const tafsirList = tafsirJson.data.tafsir;
              for (const t of tafsirList) {
                tafsirMap[t.ayat] = t.teks;
              }
            }
          }
        }

        let latinMap = {};
        if (needsLatinBackfill) {
          const surahRes = await fetch(`https://equran.id/api/v2/surat/${parsedNumber}`);
          if (surahRes.ok) {
            const surahJson = await surahRes.json();
            if (surahJson.data && surahJson.data.ayat) {
              const ayatList = surahJson.data.ayat;
              for (const a of ayatList) {
                latinMap[a.nomorAyat] = a.teksLatin;
              }
            }
          }
        }

        let tajweedMap = {};
        if (needsTajweedBackfill) {
          console.log(`Fetching Tajweed data for Surah ${parsedNumber} from api.alquran.cloud...`);
          const tajweedRes = await fetch(`https://api.alquran.cloud/v1/surah/${parsedNumber}/quran-tajweed`);
          if (tajweedRes.ok) {
            const tajweedJson = await tajweedRes.json();
            if (tajweedJson.data && tajweedJson.data.ayahs) {
              const ayahsList = tajweedJson.data.ayahs;
              for (const a of ayahsList) {
                tajweedMap[a.numberInSurah] = a.text;
              }
            }
          }
        }

        // Apply backfills to DB
        const totalLength = cachedAyat.length;
        for (let i = 0; i < totalLength; i++) {
          const a = cachedAyat[i];
          const updateData = {};
          if (needsTafsirBackfill && tafsirMap[a.ayat_number]) {
            updateData.tafsir = tafsirMap[a.ayat_number];
          }
          if (needsLatinBackfill && latinMap[a.ayat_number]) {
            updateData.teks_latin = latinMap[a.ayat_number];
          }
          if (needsTajweedBackfill && tajweedMap[a.ayat_number]) {
            updateData.teks_tajweed = tajweedMap[a.ayat_number];
          }

          if (Object.keys(updateData).length > 0) {
            await QuranAyat.updateOne(
              { surah_number: parsedNumber, ayat_number: a.ayat_number },
              { $set: updateData }
            );
          }
        }

        // Reload from DB
        cachedAyat = await QuranAyat.find({ surah_number: parsedNumber }).sort({ ayat_number: 1 });
      } catch (err) {
        console.warn(`Failed to backfill missing data for Surah ${parsedNumber}:`, err.message);
      }
    }
    return cachedAyat;
  }

  // 2. Fetch from external API (Cache Miss)
  console.log(`Cache miss for Surah ${parsedNumber}. Fetching from EQuran.id API...`);
  try {
    const response = await fetch(`https://equran.id/api/v2/surat/${parsedNumber}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch verses for Surah ${parsedNumber}. Status: ${response.status}`);
    }

    const json = await response.json();
    const surahData = json.data;

    if (!surahData || !surahData.ayat) {
      throw new Error('Unexpected API response layout. Missing verses.');
    }

    // Fetch Tafsir from EQuran.id
    let tafsirMap = {};
    try {
      const tafsirRes = await fetch(`https://equran.id/api/v2/tafsir/${parsedNumber}`);
      if (tafsirRes.ok) {
        const tafsirJson = await tafsirRes.json();
        if (tafsirJson.data && tafsirJson.data.tafsir) {
          const tafsirList = tafsirJson.data.tafsir;
          for (const t of tafsirList) {
            tafsirMap[t.ayat] = t.teks;
          }
        }
      }
    } catch (tafsirErr) {
      console.warn(`Failed to fetch Tafsir for Surah ${parsedNumber} during cache miss:`, tafsirErr.message);
    }

    // Fetch Tajweed from Al Quran Cloud
    let tajweedMap = {};
    try {
      const tajweedRes = await fetch(`https://api.alquran.cloud/v1/surah/${parsedNumber}/quran-tajweed`);
      if (tajweedRes.ok) {
        const tajweedJson = await tajweedRes.json();
        if (tajweedJson.data && tajweedJson.data.ayahs) {
          const ayahsList = tajweedJson.data.ayahs;
          for (const a of ayahsList) {
            tajweedMap[a.numberInSurah] = a.text;
          }
        }
      }
    } catch (tajweedErr) {
      console.warn(`Failed to fetch Tajweed for Surah ${parsedNumber} during cache miss:`, tajweedErr.message);
    }

    const ayahsToInsert = [];
    const totalAyahs = surahData.ayat.length;

    for (let i = 0; i < totalAyahs; i++) {
      const a = surahData.ayat[i];
      const ayatNum = a.nomorAyat;

      const ayatData = {
        surah_number: parsedNumber,
        ayat_number: ayatNum,
        teks_arab: a.teksArab,
        teks_tajweed: tajweedMap[ayatNum] || '',
        teks_latin: a.teksLatin || '',
        teks_terjemahan_id: a.teksIndonesia,
        tafsir: tafsirMap[ayatNum] || ''
      };

      ayahsToInsert.push(ayatData);
    }

    // Insert into DB and return
    const inserted = await QuranAyat.insertMany(ayahsToInsert);
    console.log(`Successfully cached ${inserted.length} verses with Latin transliteration & Tafsir for Surah ${parsedNumber}.`);
    
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
