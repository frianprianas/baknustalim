const https = require('https');
const http = require('http');

/**
 * Search Wikipedia Indonesia for Islamic topic context.
 * Returns an array of { title, snippet, url } objects.
 */
async function searchWikipedia(query) {
  return new Promise((resolve) => {
    const q = encodeURIComponent(query + ' Islam');
    const req = https.request({
      hostname: 'id.wikipedia.org',
      path: `/w/api.php?action=query&list=search&srsearch=${q}&srlimit=3&format=json&origin=*`,
      method: 'GET',
      headers: { 'User-Agent': 'BaknusAI/1.0 (SMK Bakti Nusantara 666)' },
      timeout: 10000
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          const searchResults = (data.query && data.query.search) || [];
          const results = searchResults.map(r => ({
            title: r.title,
            snippet: r.snippet.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
            url: `https://id.wikipedia.org/wiki/${encodeURIComponent(r.title)}`
          }));
          resolve(results);
        } catch (e) {
          console.error('[WebSearch] Wikipedia parse error:', e.message);
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
    req.on('timeout', () => { req.destroy(); resolve([]); });
    req.end();
  });
}

/**
 * Get a Wikipedia page summary for a specific topic.
 * Returns { title, extract, url } or null.
 */
async function getWikipediaSummary(topicTitle) {
  return new Promise((resolve) => {
    const path = `/api/rest_v1/page/summary/${encodeURIComponent(topicTitle)}`;
    const req = https.request({
      hostname: 'id.wikipedia.org',
      path,
      method: 'GET',
      headers: { 'User-Agent': 'BaknusAI/1.0 (SMK Bakti Nusantara 666)' },
      timeout: 10000
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const data = JSON.parse(raw);
          if (data.extract && data.extract.length > 100) {
            resolve({
              title: data.title,
              extract: data.extract.substring(0, 800),
              url: data.content_urls && data.content_urls.desktop && data.content_urls.desktop.page
            });
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

/**
 * Main function: Search web context for an Islamic question.
 * Tries to get the best contextual information from Wikipedia Indonesia.
 * Returns { context, sources } where context is text and sources is array of links.
 */
exports.searchIslamicContext = async (question, keyword) => {
  console.log(`[WebSearch] Searching Islamic context for: "${keyword}"`);
  
  const searchResults = await searchWikipedia(keyword);
  
  if (searchResults.length === 0) {
    console.log('[WebSearch] No Wikipedia results found.');
    return { context: null, sources: [] };
  }

  // Try to get full summary for the most relevant result
  let bestContext = null;
  let sources = [];

  for (const result of searchResults.slice(0, 2)) {
    const summary = await getWikipediaSummary(result.title);
    if (summary) {
      if (!bestContext) {
        bestContext = `[${summary.title} - Wikipedia]\n${summary.extract}`;
      }
      sources.push({
        title: result.title,
        snippet: result.snippet.substring(0, 150),
        url: summary.url || result.url
      });
    } else {
      sources.push({
        title: result.title,
        snippet: result.snippet.substring(0, 150),
        url: result.url
      });
    }
  }

  console.log(`[WebSearch] Found context from ${sources.length} sources.`);
  return { context: bestContext, sources };
};
