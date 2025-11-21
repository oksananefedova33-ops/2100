// ui/tg-forms/tg-form-presets.js
// Модуль сохранённых HTML‑кодов для генератора "Кнопка с формой → Telegram".
// Сохраняет коды в localStorage и встраивается в окно TgFormHtmlGenerator.

(function () {
  'use strict';

  var STORAGE_KEY = 'tgf_saved_codes_v1';

  function loadPresets() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr;
    } catch (e) {
      console.error('[tg-form-presets] load error:', e);
      return [];
    }
  }

  function savePresets(list) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list || []));
    } catch (e) {
      console.error('[tg-form-presets] save error:', e);
    }
  }

  function createId() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function shortMeta(html) {
    var len = (html || '').length;
    if (!len) return 'Пустой код';
    return len + ' символов';
  }

  function renderList(modal) {
    var listEl = modal.querySelector('[data-tgf-presets-list]');
    if (!listEl) return;

    var presets = loadPresets();
    listEl.innerHTML = '';

    if (!presets.length) {
      var empty = document.createElement('div');
      empty.className = 'tgf-presets-empty';
      empty.textContent = 'Пока нет сохранённых кодов.';
      listEl.appendChild(empty);
      return;
    }

    presets.forEach(function (preset) {
      var item = document.createElement('div');
      item.className = 'tgf-presets-item';
      item.setAttribute('data-id', preset.id);

      item.innerHTML =
        '<div class="tgf-presets-item-main">' +
          '<div class="tgf-presets-item-name"></div>' +
          '<div class="tgf-presets-item-meta"></div>' +
        '</div>' +
        '<div class="tgf-presets-item-actions">' +
          '<button type="button" data-preset-action="insert">Вставить</button>' +
          '<button type="button" data-preset-action="copy">Копировать</button>' +
          '<button type="button" data-preset-action="delete">Удалить</button>' +
        '</div>';

      item.querySelector('.tgf-presets-item-name').textContent =
        preset.name || 'Без названия';
      item.querySelector('.tgf-presets-item-meta').textContent = shortMeta(preset.html);

      listEl.appendChild(item);
    });
  }

  function enhanceModal(modal) {
    if (!modal || modal._tgfPresetsInited) return;
    modal._tgfPresetsInited = true;

    var textarea = modal.querySelector('textarea[name="formHtml"]');
    if (!textarea) return;

    var field = textarea.closest('.hb-field') || textarea.parentNode;

    var block = document.createElement('div');
    block.className = 'hb-field tgf-presets-block';
    block.innerHTML =
      '<div class="tgf-presets-header">' +
        '<div class="tgf-presets-title">Сохранённые коды</div>' +
        '<button type="button" class="hb-btn" data-preset-action="save-current">' +
          'Сохранить текущий HTML' +
        '</button>' +
      '</div>' +
      '<div class="tgf-presets-name-row">' +
        '<input type="text" class="tgf-presets-name" placeholder="Название кода">' +
      '</div>' +
      '<div class="tgf-presets-list" data-tgf-presets-list></div>';

    field.parentNode.insertBefore(block, field.nextSibling);

    var nameInput = block.querySelector('.tgf-presets-name');
    var listEl = block.querySelector('[data-tgf-presets-list]');

    // Клики по блоку пресетов
    block.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-preset-action]');
      if (!btn) return;

      var action = btn.getAttribute('data-preset-action');
      var presets = loadPresets();

      if (action === 'save-current') {
        var html = textarea.value || '';
        if (!html.trim()) {
          alert('Нечего сохранять — HTML формы пустой.');
          return;
        }

        var name = (nameInput.value || '').trim() || 'Без названия';

        presets.push({
          id: createId(),
          name: name,
          html: html,
          created: Date.now()
        });
        savePresets(presets);
        nameInput.value = '';
        renderList(modal);
        return;
      }

      // Действия над конкретным сохранённым кодом
      var item = btn.closest('.tgf-presets-item');
      if (!item) return;
      var id = item.getAttribute('data-id');
      var preset = presets.find(function (p) { return p.id === id; });
      if (!preset) return;

      if (action === 'insert') {
        // Вставляем код в основное поле HTML формы
        textarea.value = preset.html || '';
        textarea.focus();
      } else if (action === 'copy') {
        var text = preset.html || '';
        if (!text) return;

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).catch(function (err) {
            console.error('Clipboard error:', err);
          });
        } else {
          var tmp = document.createElement('textarea');
          tmp.style.position = 'fixed';
          tmp.style.opacity = '0';
          tmp.value = text;
          document.body.appendChild(tmp);
          tmp.select();
          try { document.execCommand('copy'); } catch (e) {}
          document.body.removeChild(tmp);
        }
      } else if (action === 'delete') {
        if (!confirm('Удалить сохранённый код?')) return;
        presets = presets.filter(function (p) { return p.id !== id; });
        savePresets(presets);
        renderList(modal);
      }
    });

    // Первая отрисовка списка
    renderList(modal);
  }

  function patchGenerator() {
    if (!window.TgFormHtmlGenerator) return;

    var proto = window.TgFormHtmlGenerator.prototype;
    if (proto._tgfPresetsPatched) return;
    proto._tgfPresetsPatched = true;

    var originalOpen = proto.openModal;
    proto.openModal = function (insertCallback) {
      originalOpen.call(this, insertCallback);
      try {
        enhanceModal(this.modal);
      } catch (e) {
        console.error('[tg-form-presets] enhance error:', e);
      }
    };
  }

  // Ждём, пока появится класс генератора
  function waitForGenerator() {
    if (window.TgFormHtmlGenerator) {
      patchGenerator();
    } else {
      setTimeout(waitForGenerator, 200);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForGenerator);
  } else {
    waitForGenerator();
  }
})();
