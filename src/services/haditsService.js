const apiKey = process.env.AHMAD_SANUSI_API_KEY || 'ask_vfTCnm7eYANK3o3UxXmMBpTpMMmklyx6PvPwkW6M8ug';

/**
 * Cari hadits berdasarkan kata kunci.
 * @param {string} keyword Kata kunci pencarian (misal: 'wudhu')
 * @param {number} limit Jumlah hasil maksimal (default: 20)
 * @returns {Array} Array objek hadits
 */
async function searchHadits(keyword, limit = 20) {
  try {
    const url = `https://api.ahmadsanusi.com/v1/hadits/search?q=${encodeURIComponent(keyword)}&limit=${limit}`;
    const res = await fetch(url, {
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json'
      },
      timeout: 10000 // 10 seconds timeout
    });

    if (!res.ok) {
      throw new Error(`API Error: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    return json.data && json.data.hadits ? json.data.hadits : [];
  } catch (error) {
    console.error('Error in searchHadits:', error.message);
    throw error;
  }
}

module.exports = {
  searchHadits
};
