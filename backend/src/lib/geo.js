const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const PRIVATE_IPS = /^(127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|::1|localhost)$/;

function isPrivateIP(ip) {
  if (!ip) return true;
  return PRIVATE_IPS.test(ip);
}

function getCached(ip) {
  const entry = cache.get(ip);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  cache.delete(ip);
  return null;
}

function setCache(ip, data) {
  if (cache.size > 500) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(ip, { data, ts: Date.now() });
}

async function fetchGeoFromIPInfo(ip, token) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const url = token
      ? `https://ipinfo.io/${ip}/json?token=${token}`
      : `https://ipinfo.io/${ip}/json`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      city: data.city || null,
      region: data.region || null,
      country: data.country || null,
      coords: data.loc || null,
    };
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function getGeoLocation(ip) {
  if (isPrivateIP(ip)) {
    return { city: 'Local', region: 'Private', country: 'XX', coords: null };
  }

  const cached = getCached(ip);
  if (cached) return cached;

  const token = process.env.IPINFO_TOKEN || null;
  const result = await fetchGeoFromIPInfo(ip, token);
  if (result) setCache(ip, result);
  return result;
}

module.exports = { getGeoLocation, isPrivateIP };
