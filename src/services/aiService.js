const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://119.235.218.186:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma2:9b';

// Helper function to call Ollama API with a timeout
async function callOllama(promptText, systemInstructions = '') {
  const url = `${OLLAMA_HOST}/api/generate`;
  
  // Combine system instructions with prompt
  const fullPrompt = systemInstructions 
    ? `<start_of_turn>system\n${systemInstructions}<end_of_turn>\n<start_of_turn>user\n${promptText}<end_of_turn>\n<start_of_turn>model\n`
    : promptText;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: fullPrompt,
        stream: false,
        options: {
          temperature: 0.7
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('[AIService] Error communicating with Ollama:', error.message);
    if (error.name === 'AbortError') {
      throw new Error('Koneksi ke Server AI Lokal (Ollama) timeout. Pastikan server aktif.');
    }
    throw error;
  }
}

// 1. Generate Draft Answer for PAI Teacher Q&A (Tanya Yuk!)
exports.generateDraftAnswer = async (questionText) => {
  const systemInstructions = `Anda adalah seorang Ustadz / Guru Pendidikan Agama Islam (PAI) yang bijaksana, berilmu luas, dan santun. 
Tugas Anda adalah membuat draf jawaban awal yang syar'i, jelas, ramah, dan mendidik untuk menjawab pertanyaan siswa. 
Gunakan bahasa Indonesia yang baik, sopan, dan berikan penjelasan singkat berdasarkan dalil Al-Qur'an atau Hadits bila relevan.
Jangan gunakan format Markdown yang terlalu kompleks (seperti heading besar atau tabel). Cukup gunakan spasi baris (linebreaks) dan tanda kutip untuk dalil. 
Tuliskan draf jawaban secara langsung tanpa kata pengantar tambahan seperti "Berikut adalah draf jawaban Anda:".`;

  const prompt = `Pertanyaan Siswa: "${questionText}"
Berikan jawaban ringkas namun komprehensif untuk pertanyaan di atas:`;

  return await callOllama(prompt, systemInstructions);
};

// 2. Generate Student Evaluation/Grading Feedback (Hafalan & Ibadah)
exports.generateFeedback = async ({ type, item, status, notes, nama_siswa }) => {
  const systemInstructions = `Anda adalah seorang Guru Pendidikan Agama Islam (PAI) di sekolah SMK. 
Tugas Anda adalah men-generate 1-2 paragraf catatan umpan balik (feedback) dan motivasi yang ditujukan kepada siswa bernama ${nama_siswa} setelah evaluasi/ujian. 
Catatan harus bernada ramah, mendukung, memberikan apresiasi jika lulus, dan menyemangati jika belum lulus.
Berikan saran praktis keislaman. Jangan terlalu formal, gunakan panggilan akrab namun sopan seperti "Ananda ${nama_siswa}" atau "${nama_siswa}".`;

  let prompt = `Jenis Ujian: ${type} (${item})
Status Kelulusan: ${status} (${status === 'Kompeten' ? 'Lulus / Kompeten' : 'Belum Lulus / Belum Kompeten'})
Catatan Singkat Guru: "${notes || 'Tidak ada catatan khusus'}"

Buatlah catatan evaluasi dan motivasi belajar yang ramah dan inspiratif untuk siswa ini berdasarkan data di atas:`;

  return await callOllama(prompt, systemInstructions);
};

// 3. Generate Answer for Q&A based on Hadith References (Tanya Hadits AI)
exports.generateHaditsAnswer = async (question, hadiths) => {
  const systemInstructions = `Anda adalah seorang Ustadz / Ahli Tafsir Hadits yang bijaksana, berilmu luas, dan santun.
Tugas Anda adalah menjawab pertanyaan user secara syar'i, bijaksana, dan ramah berdasarkan referensi hadits-hadits yang disediakan.
Jika hadits yang disediakan tidak mendukung atau tidak relevan dengan pertanyaan, jawablah dengan jujur dan santun bahwa referensi hadits yang ada kurang mencukupi, namun tetap berikan pandangan umum keislaman yang sahih.
Sebutkan nama perawi hadits (HR. Bukhari, HR. Muslim, dll) yang Anda gunakan untuk mendukung jawaban Anda di dalam teks jawaban secara santun (misal: "Berdasarkan hadits riwayat Muslim nomor...").
Jangan gunakan format Markdown yang terlalu kompleks. Cukup gunakan spasi baris (linebreaks) dan tanda kutip untuk dalil. Tuliskan jawaban Anda secara langsung dengan ramah.`;

  const contextText = hadiths.map(h => {
    const cleanTerjemah = h.terjemah ? h.terjemah.replace(/<[^>]+>/g, '') : '';
    const cleanKitab = h.kitab ? h.kitab.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';
    return `[Hadits HR. ${cleanKitab} No. ${h.nomor}]\nArab: ${h.arab}\nTerjemah: ${cleanTerjemah}`;
  }).join('\n\n');

  const prompt = `Pertanyaan User: "${question}"

Referensi Hadits yang Ditemukan Sistem:
${contextText || 'Tidak ada hadits referensi spesifik yang ditemukan di database.'}

Jawablah pertanyaan tersebut secara komprehensif berdasarkan referensi hadits di atas:`;

  return await callOllama(prompt, systemInstructions);
};
