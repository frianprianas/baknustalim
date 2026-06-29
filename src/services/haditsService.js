const apiKey = process.env.AHMAD_SANUSI_API_KEY || 'ask_vfTCnm7eYANK3o3UxXmMBpTpMMmklyx6PvPwkW6M8ug';

/**
 * Cari hadits berdasarkan kata kunci dengan paginasi.
 * @param {string} keyword Kata kunci pencarian (misal: 'wudhu')
 * @param {number} page Halaman saat ini (default: 1)
 * @param {number} limit Jumlah hasil per halaman (default: 10)
 * @returns {Object} Hasil pencarian dan metadata paginasi
 */
async function searchHadits(keyword, page = 1, limit = 10) {
  try {
    const url = `https://api.ahmadsanusi.com/v1/hadits/search?q=${encodeURIComponent(keyword)}&page=${page}&limit=${limit}`;
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
    return {
      results: json.data && Array.isArray(json.data.results) ? json.data.results : [],
      pagination: {
        page: json.data?.page || 1,
        total: json.data?.total || 0,
        total_pages: json.data?.total_pages || 1,
        per_page: json.data?.per_page || 10
      }
    };
  } catch (error) {
    console.error('Error in searchHadits:', error.message);
    throw error;
  }
}

module.exports = {
  searchHadits
};
