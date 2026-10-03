const state = {
  query: '',
  type: 'all',
  orientation: 'all',
  order: 'popular',
  page: 1,
  items: [],
  hasMore: false,
  selected: null,
  favorites: JSON.parse(localStorage.getItem('stockfinder:favorites') || '{}'),
  config: { pexels: false, pixabay: false }
};

const $ = (selector) => document.querySelector(selector);
const els = {
  form: $('#searchForm'),
  input: $('#searchInput'),
  quick: $('#quickSearches'),
  grid: $('#resultsGrid'),
  empty: $('#emptyState'),
  notice: $('#notice'),
  loadMoreWrap: $('#loadMoreWrap'),
  loadMore: $('#loadMoreBtn'),
  resultKicker: $('#resultKicker'),
  resultTitle: $('#resultTitle'),
  resultMeta: $('#resultMeta'),
  sourceStatus: $('#sourceStatus'),
  favoriteCount: $('#favoriteCount'),
  orientation: $('#orientationSelect'),
  order: $('#orderSelect'),
  modal: $('#previewModal'),
  modalMedia: $('#modalMedia'),
  modalProvider: $('#modalProvider'),
  modalTitle: $('#modalTitle'),
  modalCreator: $('#modalCreator'),
  modalSpecs: $('#modalSpecs'),
  modalLicense: $('#modalLicense'),
  modalDownload: $('#modalDownload'),
  modalSource: $('#modalSource'),
  toast: $('#toast')
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;' })[char]);
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '';
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function formatNumber(n) {
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat('id-ID').format(n);
}

function ratioLabel(item) {
  if (!item.width || !item.height) return '';
  const ratio = item.width / item.height;
  if (ratio > 1.65) return '16:9';
  if (ratio < 0.7) return '9:16';
  if (ratio > .9 && ratio < 1.1) return '1:1';
  return `${item.width}×${item.height}`;
}

function filenameFor(item) {
  const title = (item.title || 'stock-asset').toLowerCase().slice(0, 45);
  return `${item.provider}-${title}-${item.id}`;
}

function saveFavorites() {
  localStorage.setItem('stockfinder:favorites', JSON.stringify(state.favorites));
  els.favoriteCount.textContent = Object.keys(state.favorites).length;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove('show'), 2300);
}

function showNotice(message = '') {
  els.notice.textContent = message;
  els.notice.classList.toggle('hidden', !message);
}

function setLoading(on) {
  if (on) {
    els.grid.innerHTML = Array.from({ length: 8 }, () => '<div class="loading-card"></div>').join('');
  }
}

function renderCards() {
  els.empty.classList.toggle('hidden', state.items.length > 0);
  els.grid.innerHTML = state.items.map((item, index) => {
    const key = item.id;
    const favored = Boolean(state.favorites[key]);
    const safePreview = escapeHtml(item.previewUrl);
    const media = item.mediaType === 'video'
      ? `<video src="${safePreview}" poster="${safePreview}" muted loop playsinline preload="metadata" data-preview-video="${index}"></video>`
      : `<img src="${safePreview}" alt="${escapeHtml(item.title)}" loading="lazy">`;
    return `
      <article class="card" data-index="${index}">
        <div class="card-media">
          ${media}
          <div class="card-overlay">
            <div class="card-top">
              <span class="badge">${escapeHtml(item.provider)}</span>
              <button class="fav ${favored ? 'active' : ''}" type="button" data-favorite="${escapeHtml(key)}" aria-label="Favorite">${favored ? '♥' : '♡'}</button>
            </div>
            <div class="card-bottom">
              ${item.mediaType === 'video' ? `<span class="play-chip">▶ ${formatDuration(item.duration) || 'VIDEO'}</span>` : `<span class="play-chip">PHOTO</span>`}
              <span class="download-chip">↓ Download</span>
            </div>
          </div>
        </div>
        <div class="card-info">
          <div class="card-title">${escapeHtml(item.title || `${item.provider} asset`)}</div>
          <div class="card-sub">
            <span class="provider">${escapeHtml(item.creator)}</span>
            <span>${escapeHtml(ratioLabel(item))}</span>
          </div>
        </div>
      </article>
    `;
  }).join('');

  els.grid.querySelectorAll('article.card').forEach(card => {
    card.addEventListener('click', event => {
      if (event.target.closest('[data-favorite]')) return;
      const index = Number(card.dataset.index);
      openModal(state.items[index]);
    });
  });

  els.grid.querySelectorAll('[data-favorite]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      const key = button.dataset.favorite;
      if (state.favorites[key]) delete state.favorites[key];
      else state.favorites[key] = state.items.find(i => i.id === key);
      saveFavorites();
      renderCards();
    });
  });

  els.grid.querySelectorAll('[data-preview-video]').forEach(video => {
    video.addEventListener('mouseenter', () => video.play().catch(() => {}));
    video.addEventListener('mouseleave', () => { video.pause(); video.currentTime = 0; });
  });
}

async function loadConfig() {
  try {
    state.config = await fetch('/api/config').then(r => r.json());
  } catch {
    state.config = { pexels: false, pixabay: false };
  }
  const labels = [];
  if (state.config.pexels) labels.push('Pexels');
  if (state.config.pixabay) labels.push('Pixabay');
  els.sourceStatus.textContent = labels.length ? `${labels.length} sources connected` : 'API keys missing';
}

async function search({ append = false } = {}) {
  const query = els.input.value.trim();
  if (!query) {
    showToast('Masukkan kata kunci terlebih dahulu.');
    els.input.focus();
    return;
  }
  if (!append) state.page = 1;
  state.query = query;
  state.type = document.querySelector('.segmented button.active')?.dataset.type || 'all';
  state.orientation = els.orientation.value;
  state.order = els.order.value;

  showNotice('');
  els.empty.classList.add('hidden');
  els.resultKicker.textContent = 'Searching two libraries';
  els.resultTitle.textContent = `Hasil untuk “${query}”`;
  els.resultMeta.textContent = append ? 'Loading more…' : 'Pexels + Pixabay';
  if (!append) setLoading(true);
  els.loadMoreWrap.classList.add('hidden');

  try {
    const params = new URLSearchParams({
      query,
      type: state.type,
      orientation: state.orientation,
      order: state.order,
      page: String(state.page),
      perPage: '12'
    });
    const response = await fetch(`/api/search?${params}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Search failed');

    state.items = append ? state.items.concat(data.items || []) : (data.items || []);
    state.hasMore = (data.items || []).length >= 12 && state.page < 50;
    const pTotal = data.sources?.pexels?.total || 0;
    const bTotal = data.sources?.pixabay?.total || 0;
    const status = [];
    if (data.sources?.pexels?.configured) status.push(`Pexels ${formatNumber(pTotal)}`);
    if (data.sources?.pixabay?.configured) status.push(`Pixabay ${formatNumber(bTotal)}`);
    els.resultKicker.textContent = `${state.items.length} assets loaded`;
    els.resultMeta.textContent = status.join('  ·  ');
    renderCards();

    const sourceErrors = Object.values(data.sourceErrors || {});
    if (sourceErrors.length) showNotice(sourceErrors.join('  |  '));
    els.loadMoreWrap.classList.toggle('hidden', !state.hasMore);
    if (!state.items.length) showNotice('Tidak ada hasil. Coba keyword yang lebih umum seperti “coffee”, “nature”, atau “travel”.');
    if (!append) $('#workspace').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    state.items = append ? state.items : [];
    renderCards();
    showNotice(error.message || 'Pencarian gagal.');
    els.resultKicker.textContent = 'Something went wrong';
    els.resultMeta.textContent = '';
  }
}

function openModal(item) {
  state.selected = item;
  els.modal.classList.remove('hidden');
  els.modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  els.modalProvider.textContent = `${item.provider} · ${item.mediaType}`;
  els.modalTitle.textContent = item.title || 'Stock asset';
  els.modalCreator.innerHTML = item.creatorUrl
    ? `by <a href="${escapeHtml(item.creatorUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.creator)}</a>`
    : `by ${escapeHtml(item.creator)}`;
  const chips = [];
  if (item.width && item.height) chips.push(`${formatNumber(item.width)} × ${formatNumber(item.height)}`);
  if (item.duration != null) chips.push(formatDuration(item.duration));
  chips.push(item.mediaType === 'video' ? 'MP4' : 'JPG');
  chips.push(ratioLabel(item));
  els.modalSpecs.innerHTML = chips.filter(Boolean).map(x => `<span>${escapeHtml(x)}</span>`).join('');
  els.modalLicense.textContent = item.license;
  els.modalSource.href = item.sourceUrl || '#';
  els.modalMedia.innerHTML = item.mediaType === 'video'
    ? `<video src="${escapeHtml(item.downloadUrl || item.previewUrl)}" poster="${escapeHtml(item.previewUrl)}" controls playsinline></video>`
    : `<img src="${escapeHtml(item.previewUrl)}" alt="${escapeHtml(item.title)}">`;
}

function closeModal() {
  els.modal.classList.add('hidden');
  els.modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  els.modalMedia.innerHTML = '';
  state.selected = null;
}

async function downloadItem(item) {
  if (!item?.downloadUrl) {
    showToast('File download tidak tersedia untuk asset ini.');
    return;
  }
  els.modalDownload.disabled = true;
  els.modalDownload.textContent = '↓ Preparing...';
  try {
    const response = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: item.downloadUrl,
        filename: filenameFor(item),
        mediaType: item.mediaType
      })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Download gagal');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenameFor(item)}.${item.mediaType === 'video' ? 'mp4' : 'jpg'}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2500);
    showToast('Download dimulai.');
  } catch (error) {
    showToast(error.message || 'Download gagal.');
  } finally {
    els.modalDownload.disabled = false;
    els.modalDownload.textContent = '↓ Download';
  }
}

els.form.addEventListener('submit', event => {
  event.preventDefault();
  search();
});

els.quick.addEventListener('click', event => {
  const button = event.target.closest('[data-query]');
  if (!button) return;
  els.input.value = button.dataset.query;
  search();
});

document.querySelectorAll('.segmented button').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.segmented button').forEach(b => b.classList.remove('active'));
    button.classList.add('active');
    if (state.query) search();
  });
});

[els.orientation, els.order].forEach(select => select.addEventListener('change', () => { if (state.query) search(); }));

els.loadMore.addEventListener('click', () => {
  state.page += 1;
  search({ append: true });
});

document.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', closeModal));
els.modalDownload.addEventListener('click', () => downloadItem(state.selected));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !els.modal.classList.contains('hidden')) closeModal(); });

$('#favoritesBtn').addEventListener('click', () => {
  const favorites = Object.values(state.favorites);
  if (!favorites.length) {
    showToast('Belum ada favorite.');
    return;
  }
  state.query = '';
  els.input.value = '';
  els.grid.innerHTML = '';
  state.items = favorites;
  els.resultKicker.textContent = `${favorites.length} saved assets`;
  els.resultTitle.textContent = 'Your favorites';
  els.resultMeta.textContent = 'Disimpan di browser kamu';
  els.empty.classList.add('hidden');
  els.loadMoreWrap.classList.add('hidden');
  showNotice('Favorite disimpan secara lokal di browser ini.');
  renderCards();
  $('#workspace').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

saveFavorites();
loadConfig();
