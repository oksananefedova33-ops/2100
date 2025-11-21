(function(){
  'use strict';

  function onReady(fn){ document.readyState==='loading' ? document.addEventListener('DOMContentLoaded',fn) : fn(); }

  function addStatsButton(){
    const toolbar = document.querySelector('.topbar');
    if (!toolbar || document.getElementById('btnStats')) return;

    const btn = document.createElement('button');
    btn.type='button';
    btn.id='btnStats';
    btn.textContent='📊 Статистика';
    btn.className='rs-btn';
    toolbar.appendChild(btn);
    btn.addEventListener('click', openModal);
  }

  function openModal(){
    const old = document.getElementById('statsModal');
    if (old) old.remove();

    const m = document.createElement('div');
    m.id='statsModal';
    m.className='stats-modal';
    m.innerHTML = `
      <div class="stats-modal__container">
        <div class="stats-modal__header">
          <div class="stats-modal__title">📊 Статистика посещений</div>
          <button type="button" class="stats-close">×</button>
        </div>
        <div class="stats-modal__body">
          <div class="stats-section">
            <div class="stats-section__title">🌐 Выберите домены</div>
            <div id="statsDomainChips" class="stats-chiplist"></div>
          </div>
          <div class="stats-section">
            <div class="stats-section__title">📅 Период</div>
            <div class="stats-range">
              <input type="date" id="statsFrom">—<input type="date" id="statsTo">
              <button class="stats-btn" id="statsApply">📊 Показать статистику</button>
            </div>
          </div>
          <div id="statsTotalSection" style="display:none;" class="stats-total">
            <div class="stats-total__title">📈 Общая статистика по всем доменам</div>
            <div id="statsTotalKpis"></div>
          </div>
          <div class="stats-section" id="statsSummary"></div>
          <div class="stats-section">
            <div class="stats-table-wrap">
              <table class="stats-table">
                <thead><tr>
                  <th>Домен</th>
                  <th>👥 Уник. посетители</th>
                  <th>🔗 Клики</th>
                  <th>📥 Загрузки</th>
                  <th>🌍 Страны</th>
                  <th>📱 Устройства</th>
                  <th>🔍 Источники</th>
                </tr></thead>
                <tbody id="statsRows"><tr><td colspan="7" class="stats-empty">Выберите домены и период для просмотра статистики</td></tr></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(m);

    // Закрытие по кнопке
    m.querySelector('.stats-close').addEventListener('click', ()=>m.remove());
    
    // Закрытие по клику вне модалки
    m.addEventListener('click', function(e){
      if (e.target === m) m.remove();
    });

    // Заполняем домены
    const chips = m.querySelector('#statsDomainChips');
    const raw = JSON.parse(localStorage.getItem('rs_domains') || '[]');
    const stored = raw
      .map(x => (typeof x === 'string') ? x : (x && x.url ? x.url : ''))
      .filter(Boolean);

    if (stored.length === 0) {
      chips.innerHTML = '<div class="stats-empty">В «Мои сайты» пока нет доменов.</div>';
    } else {
      stored.forEach(function(url){
        const host = url.replace(/^https?:\/\//,'').replace(/^www\./,'');
        const el = document.createElement('label');
        el.className = 'stats-chip';
        el.innerHTML = '<input type="checkbox" class="stats-chk" checked> <span>' +
          escapeHtml(host) +
          '</span>';
        el.querySelector('input').dataset.domain = host;
        chips.appendChild(el);
      });
    }

    // Defaults: last 30 days
    const fromI = m.querySelector('#statsFrom');
    const toI   = m.querySelector('#statsTo');
    const today = new Date();
    const dtTo  = today.toISOString().slice(0,10);
    const fromD = new Date(today.getTime() - 29*24*3600*1000).toISOString().slice(0,10);
    fromI.value = fromD; toI.value = dtTo;

    m.querySelector('#statsApply').addEventListener('click', function(){
      const selected = Array.from(m.querySelectorAll('.stats-chk:checked')).map(x=>x.dataset.domain);
      loadStats(selected, fromI.value, toI.value);
    });
  }

  async function loadStats(domains, from, to){
    const params = new URLSearchParams();
    params.set('action','overview');
    if (domains && domains.length) params.set('domains', domains.join(','));
    if (from) params.set('from', from);
    if (to) params.set('to', to);

    const res = await fetch('/editor/stats_api.php?'+params.toString(), {credentials:'same-origin'});
    const data = await res.json();
    if (!data || !data.ok) return;

    renderOverview(data.data);
  }

  function renderOverview(ov){
    const wrap = document.getElementById('statsSummary');
    const rowsEl = document.getElementById('statsRows');
    const totalSection = document.getElementById('statsTotalSection');
    const totalKpis = document.getElementById('statsTotalKpis');
    if (!wrap || !rowsEl) return;

    const totalVisitors = (ov.domains||[]).reduce((s,x)=>s+(x.unique_visitors||0),0);
    const totalLinks = (ov.domains||[]).reduce((s,x)=>s+(x.link_clicks||0),0);
    const totalFiles = (ov.domains||[]).reduce((s,x)=>s+(x.file_downloads||0),0);
    const totalPageviews = (ov.domains||[]).reduce((s,x)=>s+(x.pageviews||0),0);

    // Общая статистика
    if (totalSection && totalKpis) {
      totalSection.style.display = 'block';
      totalKpis.innerHTML = `
        <div class="stats-kpis">
          <div class="kpi">
            <div class="kpi__val">${fmt(totalVisitors)}</div>
            <div class="kpi__label">👥 Уникальных посетителей</div>
          </div>
          <div class="kpi">
            <div class="kpi__val">${fmt(totalPageviews)}</div>
            <div class="kpi__label">👁️ Просмотров страниц</div>
          </div>
          <div class="kpi">
            <div class="kpi__val">${fmt(totalLinks)}</div>
            <div class="kpi__label">🔗 Кликов по кнопкам</div>
          </div>
          <div class="kpi">
            <div class="kpi__val">${fmt(totalFiles)}</div>
            <div class="kpi__label">📥 Скачиваний файлов</div>
          </div>
        </div>
      `;
    }

    // Детальная статистика по доменам
    wrap.innerHTML = `
      <div class="stats-section__title">📊 Детальная статистика по доменам</div>
    `;

    rowsEl.innerHTML = '';
    if (!ov.domains || ov.domains.length===0) {
      rowsEl.innerHTML = '<tr><td colspan="7" class="stats-empty">Нет данных за выбранный период</td></tr>';
      return;
    }

    ov.domains.forEach(function(d){
      const countries = (d.countries||[]).map(c=>`${escapeHtml(c.country)} <span class="stats-badge">${fmt(c.count)}</span>`).join(' ');
      const devices = Object.keys(d.devices||{}).map(k=>{
        const icon = k==='Mobile'?'📱':k==='Tablet'?'💻':'🖥️';
        return `${icon} ${escapeHtml(k)}: ${fmt(d.devices[k])}`;
      }).join('<br>');
      const sources = (d.sources||[]).map(s=>
        `${s.source==='direct'?'🔗':'🌐'} ${escapeHtml(s.source)}: ${fmt(s.count)}`
      ).join('<br>');
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(d.domain)}</strong></td>
        <td><strong style="color:#2ea8ff">${fmt(d.unique_visitors)}</strong></td>
        <td>${fmt(d.link_clicks)}</td>
        <td>${fmt(d.file_downloads)}</td>
        <td><div class="stats-country-list">${countries||'—'}</div></td>
        <td>${devices||'—'}</td>
        <td>${sources||'—'}</td>
      `;
      rowsEl.appendChild(tr);
    });
  }

  function fmt(n){ return (n||0).toLocaleString('ru-RU'); }
  function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }

  onReady(addStatsButton);
})();