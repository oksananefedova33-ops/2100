// ui/tg-forms/tg-form-generator.js

(function () {
  'use strict';

  class TgFormHtmlGenerator {
    constructor() {}

    // вырезаем внутренности формы, если вставили <form>...</form>
    extractInnerForm(html) {
      var trimmed = (html || '').trim();
      if (!trimmed) return '';
      var match = trimmed.match(/<form[^>]*>([\s\S]*?)<\/form>/i);
      if (match) return match[1].trim();
      return trimmed;
    }

    openModal(insertCallback) {
      this.insertCallback = insertCallback;

      var back = document.createElement('div');
      back.className = 'hb-modal-back'; // стили уже есть в html-buttons.css

      var container = document.createElement('div');
      container.className = 'hb-modal-container';

      var header = document.createElement('div');
      header.className = 'hb-modal-header';
      header.innerHTML = `
        <h3>📨 Кнопка с формой → Telegram</h3>
        <button class="hb-modal-close" type="button">&times;</button>
      `;

      var body = document.createElement('div');
      body.className = 'hb-modal-body';
      body.innerHTML = `
        <div class="hb-field">
          <label>Текст кнопки</label>
          <input type="text" name="btnText" value="Открыть форму">
        </div>
        <div class="hb-field">
          <label>Цвет фона кнопки</label>
          <input type="color" name="btnBg" value="#667eea">
        </div>
        <div class="hb-field">
          <label>Цвет текста кнопки</label>
          <input type="color" name="btnColor" value="#ffffff">
        </div>
        <div class="hb-field">
          <label>Заголовок в модалке (опционально)</label>
          <input type="text" name="modalTitle" value="Заполните форму">
        </div>
        <div class="hb-field">
          <label>Название формы (то, что увидите в Telegram)</label>
          <input type="text" name="formTitle" value="Форма с сайта">
        </div>
        <div class="hb-field">
          <label>HTML формы</label>
          <textarea name="formHtml" style="min-height:180px;font-family:monospace;"></textarea>
          <small style="color:#6b7280;font-size:12px;">
            Можно вставить полный &lt;form&gt;...&lt;/form&gt; или только внутренности.
          </small>
        </div>
      `;

      var footer = document.createElement('div');
      footer.className = 'hb-modal-footer';
      footer.innerHTML = `
        <button class="hb-btn danger" type="button" data-action="cancel">Отмена</button>
        <button class="hb-btn primary" type="button" data-action="generate">Сгенерировать код</button>
      `;

      container.appendChild(header);
      container.appendChild(body);
      container.appendChild(footer);
      back.appendChild(container);

      this.modal = back;
      document.body.appendChild(back);

      this.attachEvents();
    }

    attachEvents() {
      var closeBtn = this.modal.querySelector('.hb-modal-close');
      var cancelBtn = this.modal.querySelector('[data-action="cancel"]');
      var generateBtn = this.modal.querySelector('[data-action="generate"]');

      closeBtn.addEventListener('click', () => this.close());
      cancelBtn.addEventListener('click', () => this.close());
      generateBtn.addEventListener('click', () => this.generate());

      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.close();
      });
    }

    generate() {
      var btnText = this.modal.querySelector('input[name="btnText"]').value || 'Открыть форму';
      var btnBg = this.modal.querySelector('input[name="btnBg"]').value || '#667eea';
      var btnColor = this.modal.querySelector('input[name="btnColor"]').value || '#ffffff';
      var modalTitle = this.modal.querySelector('input[name="modalTitle"]').value || '';
      var formTitle = this.modal.querySelector('input[name="formTitle"]').value || 'Форма с сайта';
      var formHtmlRaw = this.modal.querySelector('textarea[name="formHtml"]').value || '';

      var inner = this.extractInnerForm(formHtmlRaw);
      if (!inner) {
        alert('Вставьте HTML формы.');
        return;
      }

      var modalId = 'tgf-modal-' + Date.now();

      var lines = [];

      lines.push('<!-- Кнопка открытия модалки с формой -->');
      lines.push('<button');
      lines.push('  type="button"');
      lines.push('  class="tgf-open-btn"');
      lines.push('  data-tgf-open="' + modalId + '"');
      lines.push('  style="background:' + btnBg + ';color:' + btnColor + ';">');
      lines.push('  ' + btnText);
      lines.push('</button>');
      lines.push('');
      lines.push('<!-- Модальное окно с формой -->');
      lines.push('<div class="tgf-modal" id="' + modalId + '">');
      lines.push('  <div class="tgf-modal__dialog">');
      lines.push('    <button type="button" class="tgf-modal__close" data-tgf-close>&times;</button>');
      lines.push('    <div class="tgf-modal__body">');

      if (modalTitle) {
        lines.push('      <div class="tgf-modal__title">' + modalTitle + '</div>');
      }

      lines.push('      <form data-tg-form="1" data-tg-title="' + formTitle + '">');
      lines.push(inner.replace(/^/gm, '        '));
      lines.push('      </form>');
      lines.push('    </div>');
      lines.push('  </div>');
      lines.push('</div>');

      var html = lines.join('\n');

      if (this.insertCallback && typeof this.insertCallback === 'function') {
        this.insertCallback(html);
      }

      this.close();
    }

    close() {
      if (this.modal && this.modal.parentNode) {
        this.modal.parentNode.removeChild(this.modal);
      }
      this.modal = null;
      this.insertCallback = null;
    }
  }

  window.TgFormHtmlGenerator = TgFormHtmlGenerator;
})();
