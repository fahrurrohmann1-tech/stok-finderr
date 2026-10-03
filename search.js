import { cleanQuery, hasPexels, hasPixabay, searchPexels, searchPixabay, sendJson } from '../stock-lib.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed.' });
    const query = cleanQuery(req.query?.query);
    const type = ['all','photo','video'].includes(req.query?.type) ? req.query.type : 'all';
    const orientation = ['all','landscape','portrait','square'].includes(req.query?.orientation) ? req.query.orientation : 'all';
    const order = req.query?.order === 'latest' ? 'latest' : 'popular';
    const page = Math.min(Math.max(Number(req.query?.page) || 1, 1), 50);
    const perPage = Math.min(Math.max(Number(req.query?.perPage) || 12, 6), 24);
    if (!query) return sendJson(res, 400, { error: 'Masukkan kata kunci pencarian.' });
    if (!hasPexels && !hasPixabay) return sendJson(res, 503, { error: 'API key belum dikonfigurasi. Tambahkan environment variables di Vercel.' });

    const [pexels, pixabay] = await Promise.all([
      searchPexels({ query, type, page, orientation, perPage }),
      searchPixabay({ query, type, page, orientation, perPage, order })
    ]);
    let items = [...pexels.items, ...pixabay.items];
    if (order === 'latest') items = items.reverse();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400');
    return sendJson(res, 200, { query, page, perPage, items, sources: { pexels: { configured: pexels.configured, total: pexels.total }, pixabay: { configured: pixabay.configured, total: pixabay.total } } });
  } catch (error) {
    console.error(error);
    const status = error?.status === 429 ? 429 : 500;
    return sendJson(res, status, { error: status === 429 ? 'Batas request API tercapai. Coba lagi nanti.' : error.message || 'Server error.' });
  }
}
