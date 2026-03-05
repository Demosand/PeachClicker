const app = {
    initData: '',
    tg: null,
    subLink: '',

    init() {
        this.cacheDOM();
        this.initTelegram();
    },

    cacheDOM() {
        this.loadingView = document.getElementById('loading-view');
        this.activeSubView = document.getElementById('active-sub-view');
        this.noSubView = document.getElementById('no-sub-view');

        this.navAvatar = document.getElementById('nav-avatar');
        this.navName = document.getElementById('nav-name');

        this.subStatusText = document.getElementById('sub-status-text');
        this.planName = document.getElementById('plan-name');
        this.expiryDate = document.getElementById('expiry-date');

        this.trafficPct = document.getElementById('traffic-pct');
        this.trafficFill = document.getElementById('traffic-fill');
        this.trafficText = document.getElementById('traffic-text');

        this.deviceCount = document.getElementById('device-count');
        this.deviceDots = document.getElementById('device-dots');
        this.deviceText = document.getElementById('device-text');
    },

    initTelegram() {
        if (window.Telegram && window.Telegram.WebApp) {
            this.tg = window.Telegram.WebApp;
            this.tg.expand();
            this.tg.ready();

            // Set App colors based on theme safely
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

            this.initData = this.tg.initData;

            // If testing outside TG or missing initData
            if (!this.initData) {
                console.warn('No initData found. Simulating for dev...');
                this.mockDevUser();
                return;
            }

            // Immediately populate navbar from initDataUnsafe for speed
            const user = this.tg.initDataUnsafe?.user;
            if (user) {
                this.populateNavbar(user);
            }

            this.fetchUserData();
        } else {
            console.error('Telegram WebApp SDK not found');
            this.subStatusText.textContent = "Ошибка: Запустите через Telegram";
            this.showView(this.noSubView);
        }
    },

    populateNavbar(user) {
        if (user.photo_url) {
            this.navAvatar.src = user.photo_url;
        } else {
            // Default placeholder if no avatar
            this.navAvatar.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236b7280'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E";
        }

        const firstName = user.first_name || '';
        const lastName = user.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim() || user.username || 'Пользователь';
        this.navName.textContent = fullName;
    },

    async fetchUserData() {
        try {
            const response = await fetch('/api/user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ initData: this.initData })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('API Response:', data);

            // Update navbar again just in case there's fresh info
            if (data.telegram_user) {
                this.populateNavbar(data.telegram_user);
            }

            if (data.has_subscription && data.subscription) {
                this.renderActiveSubscription(data.subscription);
            } else {
                this.showView(this.noSubView);
            }

        } catch (error) {
            console.error('Error fetching user data:', error);
            this.subStatusText.textContent = "Ошибка связи с сервером";
            this.showView(this.noSubView);
        }
    },

    renderActiveSubscription(sub) {
        // Set Sub Link mapping
        this.subLink = sub.sub_link || '';

        // Expiration format
        if (sub.expire_ts > 0) {
            const date = new Date(sub.expire_ts * 1000);
            const options = { day: 'numeric', month: 'long', year: 'numeric' };
            this.expiryDate.textContent = `Истекает: ${date.toLocaleDateString('ru-RU', options)}`;
        } else {
            this.expiryDate.textContent = 'Истекает: Безлимит';
        }

        // Traffic Stats
        const BYTES_IN_GB = 1073741824;
        let trafficText = "Безлимит";
        let trafficPct = "100%";
        let fillWidth = "100%";

        if (sub.limit_bytes > 0) {
            const limitGB = (sub.limit_bytes / BYTES_IN_GB).toFixed(1);
            const usedGB = (sub.used_bytes / BYTES_IN_GB).toFixed(2);
            let pct = (sub.used_bytes / sub.limit_bytes) * 100;
            if (pct > 100) pct = 100;

            trafficText = `${usedGB} / ${limitGB} GB`;
            trafficPct = `${Math.round(pct)}%`;
            fillWidth = `${pct}%`;
        } else {
            const usedGB = (sub.used_bytes / BYTES_IN_GB).toFixed(2);
            trafficText = `${usedGB} GB использовано`;
        }

        this.trafficText.textContent = trafficText;
        this.trafficPct.textContent = trafficPct;
        setTimeout(() => {
            this.trafficFill.style.width = fillWidth;
            if (sub.limit_bytes > 0 && (sub.used_bytes / sub.limit_bytes) > 0.9) {
                this.trafficFill.style.background = '#ef4444'; // Red if almost full
            }
        }, 100);

        // Device Stats
        const limit = sub.device_limit || 0;
        const active = sub.active_devices || 0;

        if (limit > 0) {
            this.deviceCount.textContent = `${active}/${limit}`;
            const available = limit - active;
            this.deviceText.textContent = available > 0 ? `${available} доступно` : 'Лимит исчерпан';

            // Build Dots
            this.deviceDots.innerHTML = '';
            for (let i = 0; i < limit; i++) {
                const dot = document.createElement('div');
                dot.className = `dot ${i < active ? 'active' : ''}`;
                this.deviceDots.appendChild(dot);
            }
        } else {
            this.deviceCount.textContent = `${active}/∞`;
            this.deviceText.textContent = 'Без ограничений';
            this.deviceDots.innerHTML = `<div class="dot active"></div><div class="dot active"></div><div class="dot active"></div>`;
        }

        this.subStatusText.textContent = "Ваши данные защищены";
        this.showView(this.activeSubView);
    },

    showView(viewElement) {
        // Hide all views
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
            v.classList.add('hidden');
        });

        // Show target
        viewElement.classList.remove('hidden');
        // Small timeout to allow display:block to apply before animating opacity
        setTimeout(() => {
            viewElement.classList.add('active');
        }, 50);
    },

    copyKey() {
        if (!this.subLink) return;

        const btn = document.querySelector('.copy-key-btn');
        const originalText = btn.textContent;

        // Use Telegram SDK CloudStorage clipboard or standard navigator
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(this.subLink);
        } else {
            // Fallback for older environments
            const textArea = document.createElement("textarea");
            textArea.value = this.subLink;
            textArea.style.position = "fixed";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
            } catch (err) { }
            document.body.removeChild(textArea);
        }

        btn.textContent = 'Скопировано! Откройте приложение happ';
        btn.style.background = '#10b981';
        btn.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.4)';

        // Provide Haptic Feedback
        if (this.tg && this.tg.HapticFeedback) {
            this.tg.HapticFeedback.notificationOccurred('success');
        }

        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
            btn.style.boxShadow = '';
        }, 3000);
    },

    closeToBot() {
        if (this.tg) {
            this.tg.close();
        }
    },

    openInstruction() {
        if (this.tg) {
            this.tg.openLink("https://t.me/custosvpn"); // Or replace with specific tutorial link
        }
    },

    mockDevUser() {
        // Mock view for browser testing without TG WebApp
        this.populateNavbar({
            first_name: "Test",
            last_name: "User",
            photo_url: "logo.jpg"
        });

        this.renderActiveSubscription({
            expire_ts: Math.floor(Date.now() / 1000) + 86400 * 30, // +30 days
            limit_bytes: 100 * 1024 * 1024 * 1024, // 100GB
            used_bytes: 45.5 * 1024 * 1024 * 1024, // 45.5GB
            device_limit: 4,
            active_devices: 2,
            sub_link: "vless://mock-link-for-dev",
            status: "ACTIVE"
        });
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
