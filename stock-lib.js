const CACHE_TTL = 24 * 60 * 60 * 1000;
const cache = globalThis.__stockFinderCache || new Map();
globalThis.__stockFinderCache = cache;

export const hasPexels = Boolean(process.env.PEXELS_API_KEY);
export const hasPixabay = Boolean(process.env.PIXABAY_API_KEY);

function cacheKey(prefix, url) { return `${prefix}:${url}`; }

async function cached(key, producer) {
  const existing = cache.get(key);
  if (existing && Date.now() - existing.createdAt < CACHE_TTL) return existing.value;
  const value = await producer();
  cache.set(key, { createdAt: Date.now(), value });
  return value;
}

async function fetchJson(url, options = {}, provider = 'Provider') {
  const response = await fetch(url, options);
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';

  // Pixabay returns plain-text bodies for API errors, while successful
  // responses are JSON. Handle both formats so the real API error is visible.
  let data = null;
  if (contentType.includes('application/json')) {
    try { data = text ? JSON.parse(text) : {}; } catch { data = null; }
  } else {
    try { data = text ? JSON.parse(text) : {}; } catch { data = null; }
  }

  if (!response.ok) {
    const message = typeof data?.error === 'string'
      ? data.error
      : (text || `${provider} request failed (${response.status}).`).trim();
    const error = new Error(`${provider}: ${message}`);
    error.status = response.status;
    throw error;
  }

  if (!data || typeof data !== 'object') {
    throw new Error(`${provider}: respons tidak valid.`);
  }

  return data;
}

export function cleanQuery(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 100);
}

export async function searchPexels({ query, type, page, orientation, perPage }) {
  if (!hasPexels) return { items: [], total: 0, configured: false };
  const params = new URLSearchParams({ query, page: String(page), per_page: String(perPage), locale: 'id-ID' });
  if (orientation !== 'all') params.set('orientation', orientation);
  const tasks = [];
  if (type === 'all' || type === 'photo') tasks.push(['photo', `https://api.pexels.com/v1/search?${params}`]);
  if (type === 'all' || type === 'video') tasks.push(['video', `https://api.pexels.com/v1/videos/search?${params}`]);

  const results = await Promise.all(tasks.map(async ([kind, url]) => {
    const data = await cached(`pexels:${url}`, () => fetchJson(url, { headers: { Authorization: process.env.PEXELS_API_KEY } }, 'Pexels'));
    if (kind === 'photo') return {
      total: data.total_results || 0,
      items: (data.photos || []).map(photo => ({
        id: `pexels-photo-${photo.id}`, provider: 'Pexels', providerKey: 'pexels', mediaType: 'photo',
        title: photo.alt || 'Pexels Photo', creator: photo.photographer || 'Pexels contributor', creatorUrl: photo.photographer_url || '', sourceUrl: photo.url,
        previewUrl: photo.src?.large2x || photo.src?.large || photo.src?.medium || '', downloadUrl: photo.src?.original || photo.src?.large2x || photo.src?.large || '',
        width: photo.width, height: photo.height, duration: null, license: 'Pexels License'
      }))
    };
    return {
      total: data.total_results || 0,
      items: (data.videos || []).map(video => {
        const files = Array.isArray(video.video_files) ? video.video_files.filter(v => v?.link && v.file_type === 'video/mp4') : [];
        const picked = files.filter(v => v.quality === 'hd').sort((a,b) => (b.width || 0) - (a.width || 0))[0] || files.sort((a,b) => (b.width || 0) - (a.width || 0))[0];
        return {
          id: `pexels-video-${video.id}`, provider: 'Pexels', providerKey: 'pexels', mediaType: 'video', title: `Pexels Video #${video.id}`,
          creator: video.user?.name || 'Pexels contributor', creatorUrl: video.user?.url || '', sourceUrl: video.url,
          previewUrl: video.image || video.video_pictures?.[0]?.picture || '', downloadUrl: picked?.link || '', width: video.width, height: video.height,
          duration: video.duration ?? null, license: 'Pexels License'
        };
      })
    };
  }));
  return { items: results.flatMap(r => r.items), total: Math.max(...results.map(r => r.total), 0), configured: true };
}

export async function searchPixabay({ query, type, page, orientation, perPage, order }) {
  if (!hasPixabay) return { items: [], total: 0, configured: false };
  const imageParams = new URLSearchParams({ key: process.env.PIXABAY_API_KEY, q: query, lang: 'id', image_type: 'all', orientation: orientation === 'portrait' ? 'vertical' : orientation === 'landscape' ? 'horizontal' : 'all', safesearch: 'true', order, page: String(page), per_page: String(perPage) });
  const videoParams = new URLSearchParams({ key: process.env.PIXABAY_API_KEY, q: query, lang: 'id', video_type: 'all', safesearch: 'true', order, page: String(page), per_page: String(perPage) });
  const tasks = [];
  if (type === 'all' || type === 'photo') tasks.push(['photo', `https://pixabay.com/api/?${imageParams}`]);
  if (type === 'all' || type === 'video') tasks.push(['video', `https://pixabay.com/api/videos/?${videoParams}`]);

  const results = await Promise.all(tasks.map(async ([kind, url]) => {
    const data = await cached(`pixabay:${url}`, () => fetchJson(url, {}, 'Pixabay'));
    if (kind === 'photo') return {
      total: data.totalHits || 0,
      items: (data.hits || []).map(hit => ({
        id: `pixabay-photo-${hit.id}`, provider: 'Pixabay', providerKey: 'pixabay', mediaType: 'photo', title: (hit.tags || 'Pixabay Photo').split(',')[0].trim(),
        creator: hit.user || 'Pixabay contributor', creatorUrl: hit.user_id ? `https://pixabay.com/users/${encodeURIComponent(hit.user)}-${hit.user_id}/` : '', sourceUrl: hit.pageURL,
        previewUrl: hit.webformatURL || hit.previewURL || '', downloadUrl: hit.fullHDURL || hit.largeImageURL || hit.webformatURL || '',
        width: hit.imageWidth, height: hit.imageHeight, duration: null, license: 'Pixabay Content License'
      }))
    };
    return {
      total: data.totalHits || 0,
      items: (data.hits || []).map(hit => {
        const rendition = hit.videos?.large?.url ? hit.videos.large : hit.videos?.medium?.url ? hit.videos.medium : hit.videos?.small?.url ? hit.videos.small : hit.videos?.tiny?.url ? hit.videos.tiny : null;
        return {
          id: `pixabay-video-${hit.id}`, provider: 'Pixabay', providerKey: 'pixabay', mediaType: 'video', title: (hit.tags || `Pixabay Video #${hit.id}`).split(',')[0].trim(),
          creator: hit.user || 'Pixabay contributor', creatorUrl: hit.user_id ? `https://pixabay.com/users/${encodeURIComponent(hit.user)}-${hit.user_id}/` : '', sourceUrl: hit.pageURL,
          previewUrl: rendition?.thumbnail || '', downloadUrl: rendition?.url || '', width: rendition?.width || null, height: rendition?.height || null,
          duration: hit.duration ?? null, license: 'Pixabay Content License'
        };
      })
    };
  }));
  return { items: results.flatMap(r => r.items), total: Math.max(...results.map(r => r.total), 0), configured: true };
}

export function allowedDownloadUrl(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { return false; }
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  return ['images.pexels.com','videos.pexels.com','static-videos.pexels.com','player.vimeo.com','cdn.pixabay.com','pixabay.com'].includes(host);
}

export function safeName(value) {
  return String(value || 'stock-asset').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,80) || 'stock-asset';
}

export function sendJson(res, status, payload) {
  res.status(status).json(payload);
}
