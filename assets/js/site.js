/* ============================================================
   Egg Tools — shared header/footer + tool grid renderer.
   Every page includes this after tools-registry.js and sets:
     window.EGG_BASE          — relative path back to site root
     window.EGG_CURRENT_TOOL  — id of the tool this page is (or '' on home)
   ============================================================ */

(function () {
  const base = window.EGG_BASE || './';
  const currentTool = window.EGG_CURRENT_TOOL || '';

  function renderHeader() {
    const el = document.getElementById('site-header');
    if (!el) return;

    const items = EGG_TOOLS.map(t => `
      <a class="nav-tools-item${t.id === currentTool ? ' current' : ''}"
         href="${t.status === 'live' ? base + t.url : '#'}"
         ${t.status !== 'live' ? 'onclick="return false"' : ''}>
        <span class="t">${t.icon} ${t.name}${t.status !== 'live' ? ' · soon' : ''}</span>
        <span class="d">${t.desc}</span>
      </a>`).join('');

    el.innerHTML = `
      <a class="logo-link" href="${base}index.html">
        <div class="logo-mark">🥚</div>
        <span class="logo-text">Egg <span>Tools</span></span>
      </a>
      <div class="sub">
        <span>ASME B31.3 / B31.4 · Piping Engineering Tools</span>
        <div class="nav-tools" id="nav-tools">
          <button class="nav-tools-btn" id="nav-tools-btn" type="button">
            Tools
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="nav-tools-menu">${items}</div>
        </div>
      </div>`;

    const nav = document.getElementById('nav-tools');
    const btn = document.getElementById('nav-tools-btn');
    btn.addEventListener('click', e => {
      e.stopPropagation();
      nav.classList.toggle('open');
    });
    document.addEventListener('click', () => nav.classList.remove('open'));
  }

  function renderFooter() {
    const el = document.getElementById('site-footer');
    if (!el) return;
    el.innerHTML = `Egg Tools · built for internal piping engineering use ·
      <a href="https://github.com/PlazmaEssence/Engg-Tools" target="_blank" rel="noopener">source on GitHub</a>`;
  }

  function renderToolGrid() {
    const el = document.getElementById('tool-grid');
    if (!el) return;
    el.innerHTML = EGG_TOOLS.map(t => `
      <a class="tool-card${t.status !== 'live' ? ' coming-soon' : ''}" href="${base + t.url}">
        <div class="tc-icon">${t.icon}</div>
        <div class="tc-title">${t.name}${t.status !== 'live' ? ' (soon)' : ''}</div>
        <div class="tc-desc">${t.desc}</div>
        <div class="tc-tags">${t.tags.map(tag => `<span class="tc-tag">${tag}</span>`).join('')}</div>
      </a>`).join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderHeader();
    renderFooter();
    renderToolGrid();
  });
})();
