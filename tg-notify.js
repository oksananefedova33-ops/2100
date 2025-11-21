(function(){
    'use strict';
    
    let settings = {
        chatId: '',
        botToken: '',
        notifications: {
            visits: false,
            downloads: false,
            links: false
        }
    };
    
    // Добавляем кнопку в тулбар
    function addNotifyButton() {
        const toolbar = document.querySelector('.topbar');
        if (!toolbar || document.getElementById('btnTgNotify')) return;
        
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'btnTgNotify';
        btn.className = 'btn'; // Используем только стандартный класс btn
        btn.textContent = '🔔 Уведомления';
        btn.addEventListener('click', openNotifyModal);
        
        const exportBtn = toolbar.querySelector('#btnExport');
        if (exportBtn) {
            exportBtn.parentNode.insertBefore(btn, exportBtn.nextSibling);
        } else {
            toolbar.appendChild(btn);
        }
    }
    
    // Создаем модальное окно
    function createModal() {
        if (document.getElementById('tgModalBackdrop')) return;
        
        const backdrop = document.createElement('div');
        backdrop.id = 'tgModalBackdrop';
        backdrop.className = 'tg-backdrop hidden';
        
        const modal = document.createElement('div');
        modal.className = 'tg-modal';
        
        modal.innerHTML = `
            <div class="tg-modal__header">
                <div class="tg-modal__title">🔔 Настройка уведомлений Telegram</div>
                <button type="button" class="tg-close">×</button>
            </div>
            <div class="tg-modal__body">
                <div class="tg-section">
                    <label class="tg-label">ID чата Telegram:</label>
                    <input type="text" class="tg-input" id="tgChatId" placeholder="Например: -1001234567890">
                    <div class="tg-checkbox-desc">Получите ID чата у бота @userinfobot</div>
                </div>
                
                <div class="tg-section">
                    <label class="tg-label">Токен бота:</label>
                    <input type="password" class="tg-input" id="tgBotToken" placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz">
                    <div class="tg-checkbox-desc">Получите токен у @BotFather</div>
                </div>
                
                <div class="tg-section">
                    <label class="tg-label">Типы уведомлений:</label>
                    <div class="tg-checkbox-group">
                        <label class="tg-checkbox-item">
                            <input type="checkbox" class="tg-checkbox" id="tgNotifyVisits">
                            <span class="tg-checkbox-label">📊 Посещение сайта</span>
                        </label>
                        <div class="tg-checkbox-desc">Уведомления о каждом посещении любой страницы</div>
                        
                        <label class="tg-checkbox-item">
                            <input type="checkbox" class="tg-checkbox" id="tgNotifyDownloads">
                            <span class="tg-checkbox-label">📥 Скачивание файла</span>
                        </label>
                        <div class="tg-checkbox-desc">Когда посетитель скачивает файл через кнопку-файл</div>
                        
                        <label class="tg-checkbox-item">
                            <input type="checkbox" class="tg-checkbox" id="tgNotifyLinks">
                            <span class="tg-checkbox-label">🔗 Переход по ссылке</span>
                        </label>
                        <div class="tg-checkbox-desc">Когда посетитель нажимает на кнопку-ссылку</div>
                    </div>
                </div>
                
                <div class="tg-section">
                    <div class="tg-buttons">
                        <button type="button" class="tg-btn primary" id="tgSaveSettings">💾 Сохранить настройки</button>
                        <button type="button" class="tg-btn" id="tgTestNotify">🚀 Тестовое уведомление</button>
                        <button type="button" class="tg-btn danger" id="tgDeleteSettings">🗑️ Удалить настройки</button>
                    </div>
                    <div id="tgStatus"></div>
                </div>
            </div>
        `;
        
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);
        
        // Обработчики
        modal.querySelector('.tg-close').addEventListener('click', closeModal);
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) closeModal();
        });
        
        document.getElementById('tgSaveSettings').addEventListener('click', saveSettings);
        document.getElementById('tgTestNotify').addEventListener('click', testNotification);
        document.getElementById('tgDeleteSettings').addEventListener('click', deleteSettings);
    }
    
    function openNotifyModal() {
        createModal();
        loadSettings();
        document.getElementById('tgModalBackdrop').classList.remove('hidden');
    }
    
    function closeModal() {
        document.getElementById('tgModalBackdrop').classList.add('hidden');
    }
    
    function showStatus(message, type = 'success') {
        const status = document.getElementById('tgStatus');
        status.className = 'tg-status ' + type;
        status.textContent = message;
        setTimeout(() => {
            status.textContent = '';
            status.className = '';
        }, 3000);
    }
    
    async function loadSettings() {
        try {
            const response = await fetch('/editor/tg_notify_api.php?action=getSettings');
            const data = await response.json();
            
            if (data.ok && data.settings) {
                document.getElementById('tgChatId').value = data.settings.chat_id || '';
                document.getElementById('tgBotToken').value = data.settings.bot_token || '';
                document.getElementById('tgNotifyVisits').checked = data.settings.notify_visits === '1';
                document.getElementById('tgNotifyDownloads').checked = data.settings.notify_downloads === '1';
                document.getElementById('tgNotifyLinks').checked = data.settings.notify_links === '1';
            }
        } catch (error) {
            showStatus('Ошибка загрузки настроек', 'error');
        }
    }
    
    async function saveSettings() {
        const chatId = document.getElementById('tgChatId').value.trim();
        const botToken = document.getElementById('tgBotToken').value.trim();
        
        if (!chatId || !botToken) {
            showStatus('Заполните ID чата и токен бота', 'error');
            return;
        }
        
        const fd = new FormData();
        fd.append('action', 'saveSettings');
        fd.append('chat_id', chatId);
        fd.append('bot_token', botToken);
        fd.append('notify_visits', document.getElementById('tgNotifyVisits').checked ? '1' : '0');
        fd.append('notify_downloads', document.getElementById('tgNotifyDownloads').checked ? '1' : '0');
        fd.append('notify_links', document.getElementById('tgNotifyLinks').checked ? '1' : '0');
        
        try {
            const response = await fetch('/editor/tg_notify_api.php', {
                method: 'POST',
                body: fd
            });
            const data = await response.json();
            
            if (data.ok) {
                showStatus('Настройки сохранены', 'success');
            } else {
                showStatus(data.error || 'Ошибка сохранения', 'error');
            }
        } catch (error) {
            showStatus('Ошибка: ' + error.message, 'error');
        }
    }
    
    async function testNotification() {
        try {
            const response = await fetch('/editor/tg_notify_api.php?action=test');
            const data = await response.json();
            
            if (data.ok) {
                showStatus('Тестовое уведомление отправлено', 'success');
            } else {
                showStatus(data.error || 'Ошибка отправки', 'error');
            }
        } catch (error) {
            showStatus('Ошибка: ' + error.message, 'error');
        }
    }
    
    async function deleteSettings() {
        if (!confirm('Удалить все настройки уведомлений?')) return;
        
        const fd = new FormData();
        fd.append('action', 'deleteSettings');
        
        try {
            const response = await fetch('/editor/tg_notify_api.php', {
                method: 'POST',
                body: fd
            });
            const data = await response.json();
            
            if (data.ok) {
                showStatus('Настройки удалены', 'success');
                document.getElementById('tgChatId').value = '';
                document.getElementById('tgBotToken').value = '';
                document.getElementById('tgNotifyVisits').checked = false;
                document.getElementById('tgNotifyDownloads').checked = false;
                document.getElementById('tgNotifyLinks').checked = false;
            }
        } catch (error) {
            showStatus('Ошибка: ' + error.message, 'error');
        }
    }
    
    // Инициализация
    document.addEventListener('DOMContentLoaded', function() {
        addNotifyButton();
    });
})();