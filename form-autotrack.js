// ui/tg-notify/form-autotrack.js

(function () {
  'use strict';

  // URL до PHP-обработчика
  function getApiUrl() {
    return (window.TG_NOTIFY_API || '/tg_notify_track.php').replace(/\/+$/, '');
  }

  // Собрать все поля формы в объект
  function collectFormData(form) {
    var data = {};
    var elements = form.querySelectorAll('input, textarea, select');

    elements.forEach(function (el) {
      if (!el.name) return;

      var name = el.name;
      var type = (el.type || '').toLowerCase();

      if (type === 'checkbox') {
        if (!data[name]) data[name] = [];
        if (el.checked) data[name].push(el.value || 'on');
      } else if (type === 'radio') {
        if (el.checked) data[name] = el.value;
      } else if (el.tagName === 'SELECT' && el.multiple) {
        var values = Array.from(el.selectedOptions).map(function (o) { return o.value; });
        data[name] = values;
      } else {
        data[name] = el.value;
      }
    });

    return data;
  }

  // Отправка формы в Telegram через tg_notify_track.php
  function sendFormToTelegram(form) {
    var fieldsObj = collectFormData(form);

    var fd = new FormData();
    fd.append('action', 'track');
    fd.append('type', 'form_any');

    fd.append('url', window.location.href);
    fd.append('page_title', document.title);
    fd.append('referrer', document.referrer);
    fd.append('domain', location.hostname);

    var title = form.getAttribute('data-tg-title')
      || form.getAttribute('data-tg-form-title')
      || 'Форма';

    fd.append('form_title', title);
    fd.append('fields_json', JSON.stringify(fieldsObj));

    return fetch(getApiUrl(), {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      body: fd
    });
  }

  // Глобальный обработчик submit для форм с data-tg-form
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || !form.matches('form[data-tg-form]')) return;

    e.preventDefault();

    sendFormToTelegram(form)
      .then(function (resp) {
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        alert('Форма отправлена, проверь Telegram.');
        // Если нужно стандартное поведение формы:
        // form.submit();
      })
      .catch(function (err) {
        console.error('Ошибка отправки формы в TG:', err);
        alert('Не удалось отправить форму, попробуйте ещё раз.');
      });
  });
})();
