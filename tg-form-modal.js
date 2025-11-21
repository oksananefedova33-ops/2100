// ui/tg-forms/tg-form-modal.js

(function () {
  'use strict';

  function fitModal(modal) {
    var dialog = modal.querySelector('.tgf-modal__dialog');
    if (!dialog) return;

    // сбрасываем старый масштаб
    dialog.style.transform = '';

    var viewportH = window.innerHeight || document.documentElement.clientHeight || 0;
    if (!viewportH) return;

    var rect = dialog.getBoundingClientRect();
    var height = rect.height;

    // максимальная доступная высота (оставим небольшой отступ сверху/снизу)
    var maxHeight = viewportH - 40;

    if (height > maxHeight && height > 0) {
      var scale = maxHeight / height;

      // чтобы совсем в соплю не уменьшать, поставим минимум
      if (scale < 0.6) scale = 0.6;

      dialog.style.transform = 'scale(' + scale + ')';
    }
  }

  function openModal(id) {
    var modal = document.getElementById(id);
    if (!modal) return;

    modal.classList.add('tgf-modal--visible');
    document.body.classList.add('tgf-modal-open');

    // подогнать размер под окно
    fitModal(modal);

    // сохраняем хэндлер, чтобы убрать потом
    function onResize() {
      if (modal.classList.contains('tgf-modal--visible')) {
        fitModal(modal);
      }
    }

    modal._tgfResizeHandler = onResize;
    window.addEventListener('resize', onResize);
  }

  function closeModal(modal) {
    modal.classList.remove('tgf-modal--visible');
    document.body.classList.remove('tgf-modal-open');

    var dialog = modal.querySelector('.tgf-modal__dialog');
    if (dialog) {
      dialog.style.transform = '';
    }

    if (modal._tgfResizeHandler) {
      window.removeEventListener('resize', modal._tgfResizeHandler);
      modal._tgfResizeHandler = null;
    }
  }

  document.addEventListener('click', function (e) {
    // открыть модалку
    var openBtn = e.target.closest('[data-tgf-open]');
    if (openBtn) {
      e.preventDefault();
      var id = openBtn.getAttribute('data-tgf-open');
      if (id) {
        openModal(id);
      }
      return;
    }

    // закрыть по крестику
    var closeBtn = e.target.closest('[data-tgf-close]');
    if (closeBtn) {
      e.preventDefault();
      var modal = closeBtn.closest('.tgf-modal');
      if (modal) closeModal(modal);
      return;
    }

    // закрыть по клику на фон
    if (e.target.classList.contains('tgf-modal')) {
      closeModal(e.target);
    }
  });
})();

