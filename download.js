import { allowedDownloadUrl, safeName, sendJson } from '../stock-lib.js';
import { Readable } from 'node:stream';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed.' });
    const body = req.body || {};
    const rawUrl = body.url;
    if (!rawUrl || !allowedDownloadUrl(rawUrl)) return sendJson(res, 400, { error: 'URL asset tidak diizinkan.' });
    const upstream = await fetch(rawUrl, { redirect: 'follow', headers: { 'User-Agent': 'StockFinder/1.0' } });
    if (!upstream.ok || !upstream.body) return sendJson(res, upstream.status || 502, { error: 'File tidak dapat diambil dari sumber.' });
    if (!allowedDownloadUrl(upstream.url)) return sendJson(res, 502, { error: 'Sumber file mengarahkan ke host yang tidak diizinkan.' });
    const mediaType = body.mediaType === 'video' ? 'video' : 'photo';
    const ext = mediaType === 'video' ? '.mp4' : '.jpg';
    const name = `${safeName(String(body.filename || 'stock-asset').replace(/\.(jpg|jpeg|png|webp|mp4)$/i,''))}${ext}`;
    res.setHeader('Content-Type', upstream.headers.get('content-type') || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg'));
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    const len = upstream.headers.get('content-length');
    if (len) res.setHeader('Content-Length', len);
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { error: error.message || 'Download gagal.' });
  }
}
