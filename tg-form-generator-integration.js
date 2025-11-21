// ui/tg-forms/tg-form-generator-integration.js

(function () {
  'use strict';

  // Ждем, пока загрузятся HtmlPreviewModal и TgFormHtmlGenerator
  function waitForDependencies() {
    return new Promise(function (resolve) {
      function check() {
        if (window.HtmlPreviewModal && window.TgFormHtmlGenerator) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      }
      check();
    });
  }

  // Вставка HTML в textarea на позиции курсора
  function insertHtmlAtCursor(textarea, html) {
    var start = textarea.selectionStart || 0;
    var end   = textarea.selectionEnd   || 0;
    var text  = textarea.value || '';

    var before = text.substring(0, start);
    var after  = text.substring(end);
    var insert = '\n' + html + '\n';

    textarea.value = before + insert + after;

    var newPos = start + insert.length;
    textarea.setSelectionRange(newPos, newPos);
    textarea.focus();

    // Триггерим input, чтобы обновился предпросмотр
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async function integrateWithHtmlPreview() {
    await waitForDependencies();

    // Берём текущий createModal (в котором уже патчит html-buttons)
    var originalCreateModal = window.HtmlPreviewModal.prototype.createModal;

    // Переопределяем createModal, добавляя нашу кнопку
    window.HtmlPreviewModal.prototype.createModal = function () {
      // Сначала вызываем оригинальный метод (создаёт модалку, тулбар и т.д.)
      originalCreateModal.call(this);

      var toolbar = this.modal.querySelector('.html-preview-toolbar');
      if (!toolbar) return;

      // Создаём кнопку "Форма → TG"
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'html-preview-toolbar-btn';
      btn.innerHTML = '📨 Форма → TG';
      btn.title = 'Создать кнопку, открывающую форму с отправкой в Telegram';

      var self = this;

      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();

        if (!window.TgFormHtmlGenerator) {
          alert('TgFormHtmlGenerator не загружен.');
          return;
        }

        var generator = new window.TgFormHtmlGenerator();

        // Открываем генератор, и вставляем сгенерированный HTML в textarea модалки
        generator.openModal(function (html) {
          var textarea = self.textarea || self.modal.querySelector('textarea');
          if (!textarea) return;

          insertHtmlAtCursor(textarea, html);
          if (typeof self.refreshPreview === 'function') {
            self.refreshPreview();
          }
        });
      });

      // Добавляем кнопку в конец панели
      toolbar.appendChild(btn);
    };

    console.log('✅ TG Form generator integrated into HTML Preview');
  }

  // Запуск интеграции после загрузки документа
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', integrateWithHtmlPreview);
  } else {
    integrateWithHtmlPreview();
  }
})();

