const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://192.168.100.129:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma2:9b';

// Use Node.js built-in http/https to bypass undici HeadersTimeout (UND_ERR_HEADERS_TIMEOUT)
// which kills connections when local AI models take >30s to start responding.
const http = require('http');
const https = require('https');

function callOllamaHttp(urlStr, bodyObj) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlStr);
    const isHttps = parsedUrl.protocol === 'https:';
    const driver = isHttps ? https : http;

    const bodyString = JSON.stringify(bodyObj);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyString)
      },
      // No timeout set — wait as long as the local AI needs
      timeout: 0
    };

    const req = driver.request(options, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.error) {
            reject(new Error(`Ollama error: ${parsed.error}`));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error(`Failed to parse Ollama response: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Ollama connection error: ${err.message}`));
    });

    req.write(bodyString);
    req.end();
  });
}

// Helper function to call Ollama API — uses http module, NO timeouts
async function callOllama(promptText, systemInstructions = '') {
  const url = `${OLLAMA_HOST}/api/generate`;
  
  const fullPrompt = systemInstructions 
    ? `<start_of_turn>system\n${systemInstructions}<end_of_turn>\n<start_of_turn>user\n${promptText}<end_of_turn>\n<start_of_turn>model\n`
    : promptText;

  try {
    console.log(`[AIService] Sending request to Ollama at ${OLLAMA_HOST} (no timeout)...`);
    const data = await callOllamaHttp(url, {
      model: OLLAMA_MODEL,
      prompt: fullPrompt,
      stream: false,
      options: { temperature: 0.7 }
    });
    console.log(`[AIService] Ollama responded successfully.`);
    return data.response;
  } catch (error) {
    console.error('[AIService] Error communicating with Ollama:', error.message);
    throw error;
  }
}

// 1. Generate Draft Answer for PAI Teacher Q&A (Tanya Yuk!)
exports.generateDraftAnswer = async (questionText) => {
  const systemInstructions = `Anda adalah BaknusAI, asisten pintar berbasis kecerdasan buatan dari SMK Bakti Nusantara 666 yang ahli dalam menyusun jawaban Pendidikan Agama Islam (PAI).
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
  const systemInstructions = `Anda adalah BaknusAI, asisten pintar berbasis kecerdasan buatan dari SMK Bakti Nusantara 666.
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
  // Shorter system instruction reduces token processing load on local CPU
  const systemInstructions = `Anda adalah BaknusAI dari SMK Bakti Nusantara 666, ahli Tafsir Hadits.
ATURAN PENTING: Gunakan hadits referensi yang diberikan sebagai dasar jawaban meskipun hadits tersebut hanya menyinggung topik secara tidak langsung. Tarik kesimpulan hukum dari konteks hadits tersebut. Sebutkan perawi hadits (HR. Bukhari, HR. Muslim, dll) dalam jawaban. Jangan gunakan Markdown. Jawab langsung, ringkas, dan ramah.
Jika benar-benar tidak ada keterkaitan sama sekali, baru nyatakan secara jujur dan berikan penjelasan keislaman umum.`;

  // Limit to 3 hadits max and trim text to reduce prompt size significantly
  // Large prompts on CPU-only machines cause very long generation times
  const topHadiths = hadiths.slice(0, 3);
  const contextText = topHadiths.map(h => {
    const cleanTerjemah = h.terjemah ? h.terjemah.replace(/<[^>]+>/g, '').substring(0, 400) : '';
    const cleanArab = h.arab ? h.arab.substring(0, 200) : '';
    const cleanKitab = h.kitab ? h.kitab.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';
    return `[HR. ${cleanKitab} No. ${h.nomor}]\nArab: ${cleanArab}\nTerjemah: ${cleanTerjemah}`;
  }).join('\n\n');

  const prompt = `Pertanyaan: "${question}"

Referensi Hadits:
${contextText || 'Tidak ada hadits referensi yang ditemukan.'}

Jawablah pertanyaan di atas berdasarkan hadits referensi:`;

  console.log(`[AIService] generateHaditsAnswer - prompt length: ${prompt.length} chars, hadiths used: ${topHadiths.length}`);
  return await callOllama(prompt, systemInstructions);
};

