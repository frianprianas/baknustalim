const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'BAKNUS_TALIM_SECRET_KEY_2026';

/**
 * Generate HMAC-SHA256 signed bearer token
 * @param {object} payload - User information to encode
 * @param {number} expiresInSeconds - Token validity in seconds (default 30 days)
 */
function generateToken(payload, expiresInSeconds = 30 * 86400) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const data = { ...payload, exp, iat: Math.floor(Date.now() / 1000) };

  const encodeBase64Url = (obj) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');

  const encodedHeader = encodeBase64Url(header);
  const encodedPayload = encodeBase64Url(data);
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify and decode an HMAC-SHA256 token
 * @param {string} token
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  if (signature !== expectedSignature) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload;
  } catch (err) {
    return null;
  }
}

module.exports = {
  generateToken,
  verifyToken
};
