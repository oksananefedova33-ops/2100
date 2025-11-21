// /ui/export-stats-domain/export-stats-domain.js
/**
 * Модуль добавления поля "Домен для статистики" в модалку экспорта.
 * 
 * Проблема: При экспорте tracker.js записывает абсолютный URL конструктора.
 * Если конструктор переехал — статистика не работает.
 * 
 * Решение: Позволить указать домен для статистики при каждом экспорте.
 */

(function () {
  'use strict';

  function injectStatsDomainField() {
    const dlg = document.querySelector('.xmodal__dlg');
    if (!dlg) return;

    // Якорь для вставки — ищем строку с основным языком (поле expLang)
    const langInput = document.getElementById('expLang');
    if (!langInput) return;

    const anchorRow = langInput.closest('.xmodal__row');
    if (!anchorRow) return;

    // Проверяем что поле не добавлено уже
    if (document.getElementById('expStatsDomain')) return;

    // Восстанавливаем сохранённое значение или используем текущий домен конструктора
    const currentHost = window.location.hostname;
    const savedDomain = localStorage.getItem('export_stats_domain') || currentHost;

    // Создаём новую строку в модалке
    const row = document.createElement('div');
    row.className = 'xmodal__row';
    row.innerHTML = `
      <label>📊 Домен для статистики</label>
      <input 
        type="text" 
        id="expStatsDomain" 
        placeholder="конструктор.ru или analytics.конструктор.ru"
        value="${escapeHtml(savedDomain)}"
        title="На этот домен будут приходить запросы трекинга от экспортированного сайта. Обычно домен конструктора или его поддомен для статистики."
        style="width: 100%; padding: 8px 12px; background: #0f1723; color: #ffffff; border: 1px solid #2d4263; border-radius: 8px; font-size: 13px; box-sizing: border-box;"
      >
      <div style="font-size: 12px; color: #9fb2c6; margin-top: 6px; line-height: 1.4;">
        ℹ️ Укажите домен конструктора, на который будут приходить данные статистики посещений, кликов и загрузок файлов
      </div>
    `;

    anchorRow.insertAdjacentElement('afterend', row);

    // Сохраняем значение при изменении
    const input = row.querySelector('#expStatsDomain');
    input.addEventListener('change', () => {
      const val = (input.value || '').trim() || currentHost;
      localStorage.setItem('export_stats_domain', val);
    });

    // Перехватываем функцию сбора параметров
    const originalCollect = window.__collectExportParams;
    window.__collectExportParams = function() {
      // Вызываем оригинальную функцию если она есть (могут быть другие расширения)
      const params = (originalCollect && typeof originalCollect === 'function') 
        ? originalCollect() 
        : {};
      
      // Добавляем параметр домена для статистики
      const statsDomain = (input.value || '').trim() || currentHost;
      params.stats_domain = statsDomain;
      
      return params;
    };
  }

  function patchOpenExportModal() {
    const orig = window.openExportModal;
    if (!orig) return;
    
    window.openExportModal = function () {
      // Вызываем оригинальную функцию
      orig.apply(this, arguments);
      
      // После отрисовки модалки вшиваем наше поле
      setTimeout(injectStatsDomainField, 0);
    };
  }

  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text || '').replace(/[&<>"']/g, m => map[m]);
  }

  // Инициализация
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchOpenExportModal);
  } else {
    patchOpenExportModal();
  }
})();