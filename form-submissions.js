// ui/form-submissions/form-submissions.js

(function(){
  'use strict';

  function onReady(fn){ 
    document.readyState==='loading' 
      ? document.addEventListener('DOMContentLoaded',fn) 
      : fn(); 
  }

  // Добавляем кнопку в toolbar
  function addFormsButton(){
    const toolbar = document.querySelector('.topbar');
    if (!toolbar || document.getElementById('btnForms')) return;

    const btn = document.createElement('button');
    btn.type='button';
    btn.id='btnForms';
    btn.textContent='📝 Формы';
    btn.className='btn';
    
    // Вставляем после кнопки "Статистика" или после "Экспорт"
    const statsBtn = toolbar.querySelector('#btnStats');
    const exportBtn = toolbar.querySelector('#btnExport');
    
    if (statsBtn) {
      statsBtn.parentNode.insertBefore(btn, statsBtn.nextSibling);
    } else if (exportBtn) {
      exportBtn.parentNode.insertBefore(btn, exportBtn.nextSibling);
    } else {
      toolbar.appendChild(btn);
    }
    
    btn.addEventListener('click', openModal);
  }

  // Открываем модалку
  function openModal(){
    const old = document.getElementById('formsModal');
    if (old) old.remove();

    const m = document.createElement('div');
    m.id='formsModal';
    m.className='fs-modal-back';
    m.innerHTML = `
      <div class="fs-modal-container">
        <div class="fs-modal-header">
          <div class="fs-modal-title">📝 Отправки форм</div>
          <button type="button" class="fs-close">×</button>
        </div>
        <div class="fs-modal-body">
          <div class="fs-filters">
            <label>С:</label>
            <input type="date" id="fsFrom">
            <label>По:</label>
            <input type="date" id="fsTo">
            <label>Домен:</label>
            <select id="fsDomain">
              <option value="">Все домены</option>
            </select>
            <button class="fs-btn" id="fsApply">Показать</button>
            <button class="fs-btn secondary" id="fsExportAll">📥 Экспорт .txt</button>
            <button class="fs-btn danger" id="fsDeleteAll">🗑️ Очистить всё</button>
          </div>
          
          <div class="fs-stats" id="fsStats"></div>
          
          <div class="fs-table-wrap">
            <table class="fs-table">
              <thead><tr>
                <th>Дата/Время</th>
                <th>Домен</th>
                <th>Форма</th>
                <th>Данные</th>
                <th>Посетитель</th>
                <th>Действия</th>
              </tr></thead>
              <tbody id="fsRows">
                <tr><td colspan="6" class="fs-empty">Загрузка...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(m);

    // Закрытие
    m.querySelector('.fs-close').addEventListener('click', ()=>m.remove());
    m.addEventListener('click', function(e){
      if (e.target === m) m.remove();
    });

    // Defaults: последние 30 дней
    const fromI = m.querySelector('#fsFrom');
    const toI = m.querySelector('#fsTo');
    const today = new Date();
    const dtTo = today.toISOString().slice(0,10);
    const fromD = new Date(today.getTime() - 29*24*3600*1000).toISOString().slice(0,10);
    fromI.value = fromD; 
    toI.value = dtTo;

    // Кнопки
    m.querySelector('#fsApply').addEventListener('click', function(){
      const domain = m.querySelector('#fsDomain').value;
      loadData(fromI.value, toI.value, domain);
    });

    m.querySelector('#fsExportAll').addEventListener('click', function(){
      const domain = m.querySelector('#fsDomain').value;
      exportAllTxt(fromI.value, toI.value, domain);
    });

    m.querySelector('#fsDeleteAll').addEventListener('click', function(){
      deleteAllData(fromI.value, toI.value);
    });

    // Загружаем домены и данные
    loadDomains();
    loadData(fromI.value, toI.value, '');
  }

  // Загружаем список доменов
  async function loadDomains(){
    try {
      const params = new URLSearchParams({ action: 'domains' });
      const res = await fetch('/ui/form-submissions/form-submissions-api.php?' + params.toString());
      const data = await res.json();
      
      if (!data || !data.ok) return;
      
      const select = document.getElementById('fsDomain');
      if (!select) return;
      
      select.innerHTML = '<option value="">Все домены</option>';
      (data.domains || []).forEach(function(d){
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        select.appendChild(opt);
      });
    } catch(e) {
      console.error('Error loading domains:', e);
    }
  }

  // Загружаем данные
  async function loadData(from, to, domain){
    try {
      const params = new URLSearchParams({
        action: 'list',
        from: from,
        to: to,
        domain: domain || ''
      });
      
      const res = await fetch('/ui/form-submissions/form-submissions-api.php?' + params.toString());
      const data = await res.json();
      
      if (!data || !data.ok) {
        console.error('API error:', data);
        return;
      }
      
      renderStats(data.stats || {});
      renderTable(data.submissions || []);
    } catch(e) {
      console.error('Error loading data:', e);
    }
  }

  // Рендерим статистику
  function renderStats(stats){
    const container = document.getElementById('fsStats');
    if (!container) return;

    const total = stats.total || 0;
    const domains = stats.domains || 0;
    const forms = stats.forms || 0;

    container.innerHTML = `
      <div class="fs-stat-card">
        <div class="fs-stat-value">${fmt(total)}</div>
        <div class="fs-stat-label">📊 Всего отправок</div>
      </div>
      <div class="fs-stat-card">
        <div class="fs-stat-value">${fmt(domains)}</div>
        <div class="fs-stat-label">🌐 Доменов</div>
      </div>
      <div class="fs-stat-card">
        <div class="fs-stat-value">${fmt(forms)}</div>
        <div class="fs-stat-label">📝 Форм</div>
      </div>
    `;
  }

  // Рендерим таблицу
  function renderTable(submissions){
    const tbody = document.getElementById('fsRows');
    if (!tbody) return;

    if (!submissions || submissions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="fs-empty">Нет данных за выбранный период</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    
    submissions.forEach(function(sub){
      const tr = document.createElement('tr');
      
      // Дата/Время
      const dtCell = document.createElement('td');
      dtCell.innerHTML = `<div class="fs-timestamp">${escHtml(formatDate(sub.ts))}</div>`;
      tr.appendChild(dtCell);

      // Домен
      const domainCell = document.createElement('td');
      domainCell.innerHTML = `<div class="fs-domain">${escHtml(sub.domain)}</div>`;
      tr.appendChild(domainCell);

      // Форма
      const formCell = document.createElement('td');
      formCell.innerHTML = `<div class="fs-form-title">${escHtml(sub.form_title)}</div>`;
      tr.appendChild(formCell);

      // Данные (preview)
      const dataCell = document.createElement('td');
      let fields = {};
      try {
        fields = JSON.parse(sub.fields_json || '{}');
      } catch(e) {}
      
      let preview = '<div class="fs-fields-preview">';
      let count = 0;
      for (let k in fields) {
        if (count >= 3) {
          preview += '<div class="fs-field-row"><span class="fs-field-name">...</span></div>';
          break;
        }
        const val = String(fields[k]).substring(0, 50);
        preview += `<div class="fs-field-row">
          <span class="fs-field-name">${escHtml(k)}:</span>
          <span class="fs-field-value">${escHtml(val)}</span>
        </div>`;
        count++;
      }
      preview += '</div>';
      dataCell.innerHTML = preview;
      tr.appendChild(dataCell);

      // Посетитель
      const visitorCell = document.createElement('td');
      visitorCell.innerHTML = `
        <div class="fs-visitor-info">
          <div><span class="fs-visitor-badge">IP:</span> ${escHtml(sub.ip)}</div>
          <div><span class="fs-visitor-badge">${escHtml(sub.country)}</span> ${escHtml(sub.city)}</div>
          <div><span class="fs-visitor-badge">${escHtml(sub.device)}</span> ${escHtml(sub.os)}</div>
        </div>
      `;
      tr.appendChild(visitorCell);

      // Действия
      const actionsCell = document.createElement('td');
      actionsCell.className = 'fs-actions-cell';
      actionsCell.innerHTML = `
        <button class="fs-action-btn" data-action="view" data-id="${sub.id}">👁️ Просмотр</button>
        <button class="fs-action-btn" data-action="download" data-id="${sub.id}">📥 .txt</button>
        <button class="fs-action-btn danger" data-action="delete" data-id="${sub.id}">🗑️</button>
      `;
      tr.appendChild(actionsCell);

      tbody.appendChild(tr);
    });

    // Обработчики кнопок действий
    tbody.addEventListener('click', function(e){
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');

      if (action === 'view') {
        viewDetail(id);
      } else if (action === 'download') {
        downloadOne(id);
      } else if (action === 'delete') {
        deleteOne(id);
      }
    });
  }

  // Детальный просмотр
  async function viewDetail(id){
    try {
      const params = new URLSearchParams({ action: 'get', id: id });
      const res = await fetch('/ui/form-submissions/form-submissions-api.php?' + params.toString());
      const data = await res.json();
      
      if (!data || !data.ok) {
        alert('Ошибка загрузки данных');
        return;
      }

      const sub = data.submission;
      if (!sub) return;

      const modal = document.createElement('div');
      modal.className = 'fs-detail-modal';
      
      let fields = {};
      try {
        fields = JSON.parse(sub.fields_json || '{}');
      } catch(e) {}

      let fieldsHtml = '<div class="fs-detail-fields">';
      for (let k in fields) {
        fieldsHtml += `
          <div class="fs-detail-field">
            <div class="fs-detail-field-name">${escHtml(k)}</div>
            <div class="fs-detail-field-value">${escHtml(String(fields[k]))}</div>
          </div>
        `;
      }
      fieldsHtml += '</div>';

      modal.innerHTML = `
        <div class="fs-detail-container">
          <div class="fs-detail-header">
            <div class="fs-detail-title">📝 ${escHtml(sub.form_title)}</div>
            <button type="button" class="fs-close">×</button>
          </div>
          <div class="fs-detail-body">
            <div class="fs-detail-section">
              <div class="fs-detail-section-title">📄 Информация</div>
              <div class="fs-detail-info">
                <div class="fs-detail-row">
                  <div class="fs-detail-label">Дата/Время:</div>
                  <div class="fs-detail-value">${escHtml(formatDate(sub.ts))}</div>
                </div>
                <div class="fs-detail-row">
                  <div class="fs-detail-label">Домен:</div>
                  <div class="fs-detail-value">${escHtml(sub.domain)}</div>
                </div>
                <div class="fs-detail-row">
                  <div class="fs-detail-label">Страница:</div>
                  <div class="fs-detail-value">${escHtml(sub.url)}</div>
                </div>
                <div class="fs-detail-row">
                  <div class="fs-detail-label">Реферер:</div>
                  <div class="fs-detail-value">${escHtml(sub.referrer || 'Прямой заход')}</div>
                </div>
              </div>
            </div>

            <div class="fs-detail-section">
              <div class="fs-detail-section-title">👤 Посетитель</div>
              <div class="fs-detail-info">
                <div class="fs-detail-row">
                  <div class="fs-detail-label">IP:</div>
                  <div class="fs-detail-value">${escHtml(sub.ip)}</div>
                </div>
                <div class="fs-detail-row">
                  <div class="fs-detail-label">Страна / Город:</div>
                  <div class="fs-detail-value">${escHtml(sub.country)} / ${escHtml(sub.city)}</div>
                </div>
                <div class="fs-detail-row">
                  <div class="fs-detail-label">Устройство:</div>
                  <div class="fs-detail-value">${escHtml(sub.device)}</div>
                </div>
                <div class="fs-detail-row">
                  <div class="fs-detail-label">ОС:</div>
                  <div class="fs-detail-value">${escHtml(sub.os)}</div>
                </div>
                <div class="fs-detail-row">
                  <div class="fs-detail-label">Браузер:</div>
                  <div class="fs-detail-value">${escHtml(sub.browser)}</div>
                </div>
              </div>
            </div>

            <div class="fs-detail-section">
              <div class="fs-detail-section-title">📋 Данные формы</div>
              ${fieldsHtml}
            </div>
          </div>
          <div class="fs-detail-footer">
            <button class="fs-btn secondary" data-close>Закрыть</button>
            <button class="fs-btn" data-download="${sub.id}">📥 Скачать .txt</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      modal.querySelector('.fs-close').addEventListener('click', ()=>modal.remove());
      modal.querySelector('[data-close]').addEventListener('click', ()=>modal.remove());
      modal.querySelector('[data-download]').addEventListener('click', function(){
        downloadOne(this.getAttribute('data-download'));
      });
      modal.addEventListener('click', function(e){
        if (e.target === modal) modal.remove();
      });

    } catch(e) {
      console.error('Error viewing detail:', e);
      alert('Ошибка просмотра');
    }
  }

  // Скачать одну отправку
  async function downloadOne(id){
    try {
      window.location.href = '/ui/form-submissions/form-submissions-api.php?action=download&id=' + id;
    } catch(e) {
      console.error('Error downloading:', e);
    }
  }

  // Экспорт всех в txt
  async function exportAllTxt(from, to, domain){
    try {
      const params = new URLSearchParams({
        action: 'export',
        from: from,
        to: to,
        domain: domain || ''
      });
      window.location.href = '/ui/form-submissions/form-submissions-api.php?' + params.toString();
    } catch(e) {
      console.error('Error exporting:', e);
    }
  }

  // Удалить одну отправку
  async function deleteOne(id){
    if (!confirm('Удалить эту отправку?')) return;

    try {
      const fd = new FormData();
      fd.append('action', 'delete');
      fd.append('id', id);

      const res = await fetch('/ui/form-submissions/form-submissions-api.php', {
        method: 'POST',
        body: fd
      });
      const data = await res.json();

      if (!data || !data.ok) {
        alert('Ошибка удаления');
        return;
      }

      // Перезагружаем данные
      const fromI = document.getElementById('fsFrom');
      const toI = document.getElementById('fsTo');
      const domainSel = document.getElementById('fsDomain');
      
      if (fromI && toI && domainSel) {
        loadData(fromI.value, toI.value, domainSel.value);
      }

    } catch(e) {
      console.error('Error deleting:', e);
      alert('Ошибка удаления');
    }
  }

  // Удалить все данные
  async function deleteAllData(from, to){
    if (!confirm('Удалить ВСЕ отправки форм за выбранный период?\n\nЭто действие нельзя отменить!')) return;

    try {
      const fd = new FormData();
      fd.append('action', 'deleteAll');
      fd.append('from', from);
      fd.append('to', to);

      const res = await fetch('/ui/form-submissions/form-submissions-api.php', {
        method: 'POST',
        body: fd
      });
      const data = await res.json();

      if (!data || !data.ok) {
        alert('Ошибка удаления');
        return;
      }

      alert('Данные удалены: ' + (data.deleted || 0) + ' записей');

      // Перезагружаем
      const domainSel = document.getElementById('fsDomain');
      loadData(from, to, domainSel ? domainSel.value : '');

    } catch(e) {
      console.error('Error deleting all:', e);
      alert('Ошибка удаления');
    }
  }

  // Утилиты
  function fmt(n){ return (n||0).toLocaleString('ru-RU'); }
  
  function escHtml(s){ 
    return String(s||'').replace(/[&<>"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); 
  }

  function formatDate(ts){
    try {
      const d = new Date(ts * 1000);
      const date = d.toLocaleDateString('ru-RU');
      const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      return `${date} ${time}`;
    } catch(e) {
      return String(ts);
    }
  }

  onReady(addFormsButton);
})();