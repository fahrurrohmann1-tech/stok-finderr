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

    const results = await Promise.allSettled([
      searchPexels({ query, type, page, orientation, perPage }),
      searchPixabay({ query, type, page, orientation, perPage, order })
    ]);

    const pexels = results[0].status === 'fulfilled'
      ? results[0].value
      : { items: [], total: 0, configured: hasPexels, error: results[0].reason?.message || 'Pexels error' };
    const pixabay = results[1].status === 'fulfilled'
      ? results[1].value
      : { items: [], total: 0, configured: hasPixabay, error: results[1].reason?.message || 'Pixabay error' };

    let items = [...pexels.items, ...pixabay.items];
    if (order === 'latest') items = items.reverse();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400');
    const sourceErrors = {};
    if (pexels.error) sourceErrors.pexels = pexels.error;
    if (pixabay.error) sourceErrors.pixabay = pixabay.error;
    return sendJson(res, 200, {
      query,
      page,
      perPage,
      items,
      sources: {
        pexels: { configured: pexels.configured, total: pexels.total, error: pexels.error || null },
        pixabay: { configured: pixabay.configured, total: pixabay.total, error: pixabay.error || null }
      },
      sourceErrors
    });
  } catch (error) {
    console.error(error);
    const status = error?.status === 429 ? 429 : 500;
    return sendJson(res, status, { error: status === 429 ? 'Batas request API tercapai. Coba lagi nanti.' : error.message || 'Server error.' });
  }
}
