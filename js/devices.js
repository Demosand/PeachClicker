const appDevices = {
    tg: null,
    initData: '',
    devices: [],
    deviceIdToDelete: null,

    init() {
        this.cacheDOM();
        this.initTelegram();
    },

    cacheDOM() {
        this.container = document.getElementById('devices-container');
        this.modal = document.getElementById('delete-modal');
        this.confirmBtn = document.getElementById('confirm-delete-btn');

        this.confirmBtn.addEventListener('click', () => this.deleteDeviceConfirmed());
    },

    initTelegram() {
        if (window.Telegram && window.Telegram.WebApp) {
            this.tg = window.Telegram.WebApp;
            this.tg.expand();
            this.tg.ready();

            try {
                if (this.tg.isVersionAtLeast && this.tg.isVersionAtLeast('6.1')) {
                    this.tg.setHeaderColor('#fafafa');
                    this.tg.setBackgroundColor('#fafafa');
                } else {
                    this.tg.setHeaderColor('bg_color');
                    this.tg.setBackgroundColor('bg_color');
                }
            } catch (e) {
                console.warn('Failed to set colors:', e);
            }

            // check URL params first for initData
            const urlParams = new URLSearchParams(window.location.search);
            this.initData = urlParams.get('initData') || this.tg.initData;
        }

        if (!this.initData) {
            console.warn('[Custos Devices] No initData, mocking...');
            this.mockDevices();
        } else {
            this.fetchDevices();
        }
    },

    async fetchDevices() {
        try {
            const response = await fetch('/api/devices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initData: this.initData })
            });

            if (!response.ok) {
                this.renderError('Не удалось загрузить устройства. Код: ' + response.status);
                return;
            }

            const data = await response.json();
            this.devices = data.devices || [];
            this.renderDevices();
        } catch (error) {
            console.error('[Custos Devices] Fetch error:', error);
            this.renderError('Ошибка связи с сервером.');
        }
    },

    renderDevices() {
        if (this.devices.length === 0) {
            this.container.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.5; margin-bottom: 16px;">
                        <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                    </svg>
                    <h3 style="font-size: 18px; color: var(--text-main); margin-bottom: 8px;">Нет активных устройств</h3>
                    <p>Подключите устройство, и оно появится в этом списке.</p>
                </div>
            `;
            return;
        }

        this.container.innerHTML = '';
        this.devices.forEach(dev => {
            const el = document.createElement('div');
            el.className = 'device-item glass';
            el.setAttribute('data-device-id', dev.id);

            // Determine Icon (Mobile vs Desktop)
            let iconSvg = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                <line x1="12" y1="18" x2="12.01" y2="18"></line>
            </svg>`; // Default Phone

            const nameLower = (dev.name || '').toLowerCase();
            if (nameLower.includes('windows') || nameLower.includes('mac') || nameLower.includes('pc') || nameLower.includes('desktop')) {
                iconSvg = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>`;
            }

            const dateStr = dev.last_active ? new Date(dev.last_active).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Недавно';

            el.innerHTML = `
                <div class="device-icon">
                    ${iconSvg}
                </div>
                <div class="device-info">
                    <div class="device-name">${dev.name || 'Неизвестное устройство'}</div>
                    <div class="device-date">Активно: ${dateStr}</div>
                </div>
                <button class="delete-btn" onclick="appDevices.openModal('${dev.id}')">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            `;
            this.container.appendChild(el);
        });
    },

    renderError(msg) {
        this.container.innerHTML = `
            <div class="empty-state">
                <p style="color: #ef4444;">${msg}</p>
            </div>
        `;
    },

    openModal(deviceId) {
        this.deviceIdToDelete = deviceId;
        this.modal.classList.add('active');
        // Reset button state
        this.confirmBtn.innerHTML = 'Удалить';
        this.confirmBtn.classList.remove('loading');
        this.confirmBtn.disabled = false;
        if (this.tg && this.tg.HapticFeedback) {
            this.tg.HapticFeedback.impactOccurred('medium');
        }
    },

    closeModal() {
        this.deviceIdToDelete = null;
        this.modal.classList.remove('active');
    },

    async deleteDeviceConfirmed() {
        if (!this.deviceIdToDelete) return;

        // Show animated spinner SVG in red button
        this.confirmBtn.classList.add('loading');
        this.confirmBtn.disabled = true;
        this.confirmBtn.innerHTML = `
            <svg class="spinner-svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
                <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>`;

        try {
            const response = await fetch('/api/devices/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    initData: this.initData,
                    deviceId: this.deviceIdToDelete
                })
            });

            const data = await response.json();
            console.log('[Devices] Delete response:', response.status, JSON.stringify(data));

            if (response.ok) {
                const deletedId = this.deviceIdToDelete;
                this.closeModal();

                if (this.tg && this.tg.HapticFeedback) {
                    this.tg.HapticFeedback.notificationOccurred('success');
                }

                // Animate the device item out
                const deviceEl = this.container.querySelector(`[data-device-id="${deletedId}"]`);
                if (deviceEl) {
                    deviceEl.classList.add('device-removing');
                    // Wait for animation, then re-fetch
                    await new Promise(r => setTimeout(r, 500));
                }

                await this.fetchDevices();
            } else {
                console.error('[Devices] Delete failed:', data);
                // Reset button
                this.confirmBtn.innerHTML = 'Удалить';
                this.confirmBtn.classList.remove('loading');
                this.confirmBtn.disabled = false;
                alert('Ошибка при удалении: ' + (data.error || response.status));
            }
        } catch (err) {
            console.error('[Devices] Delete error:', err);
            this.confirmBtn.innerHTML = 'Удалить';
            this.confirmBtn.classList.remove('loading');
            this.confirmBtn.disabled = false;
            alert('Ошибка сети при удалении');
        }
    },

    goBack() {
        if (document.referrer && document.referrer.includes('cus.ru')) {
            window.history.back();
        } else {
            window.location.href = 'index.html';
        }
    },

    mockDevices() {
        this.devices = [
            { id: "1", name: "iPhone 14 Pro", last_active: new Date().toISOString() },
            { id: "2", name: "MacBook Air M2", last_active: new Date(Date.now() - 86400000).toISOString() },
            { id: "3", name: "Windows PC Desktop", last_active: new Date(Date.now() - 1200000).toISOString() }
        ];
        this.renderDevices();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    appDevices.init();
});
