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
        this.bottomNavbar = document.getElementById('bottom-navbar');

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

        this.loadingStatus = document.getElementById('loading-status');
        this.loadingDetail = document.getElementById('loading-detail');
    },

    setLoadingStatus(text, detail) {
        // Obsolete as loading is now in loading.html
    },

    hideLoading(callback) {
        if (this.loadingView) {
            this.loadingView.style.opacity = '0';
            setTimeout(() => {
                this.loadingView.style.display = 'none';
                if (typeof callback === 'function') callback();
            }, 300);
        } else if (typeof callback === 'function') {
            callback();
        }
    },

    hideNavbar() {
        if (this.bottomNavbar) {
            this.bottomNavbar.classList.add('fade-out');
        }
    },

    initTelegram() {
        if (window.Telegram && window.Telegram.WebApp) {
            this.tg = window.Telegram.WebApp;
            this.tg.expand();
            this.tg.ready();

            // Set App colors safely
            const savedTheme = localStorage.getItem('theme') || 'light';
            try {
                if (this.tg.isVersionAtLeast && this.tg.isVersionAtLeast('6.1')) {
                    if (savedTheme === 'dark') {
                        this.tg.setHeaderColor('#0a0e17');
                        this.tg.setBackgroundColor('#0a0e17');
                    } else {
                        this.tg.setHeaderColor('#fafafa');
                        this.tg.setBackgroundColor('#fafafa');
                    }
                } else {
                    this.tg.setHeaderColor('bg_color');
                    this.tg.setBackgroundColor('bg_color');
                }
            } catch (e) {
                console.warn('Failed to set colors:', e);
            }

            this.initData = this.tg.initData;

            console.log('[Custos] SDK Version:', this.tg.version);
            console.log('[Custos] initData length:', this.initData ? this.initData.length : 0);
            console.log('[Custos] initDataUnsafe:', JSON.stringify(this.tg.initDataUnsafe));

            // If testing outside TG or missing initData
            if (!this.initData) {
                console.warn('[Custos] No initData found. Simulating for dev...');
                this.setLoadingStatus('Dev Mode', 'initData отсутствует');
                this.mockDevUser();
                return;
            }

            // Immediately populate navbar from initDataUnsafe for speed
            const user = this.tg.initDataUnsafe?.user;
            if (user) {
                this.populateNavbar(user);
                this.setLoadingStatus('Загрузка данных...', `ID: ${user.id}`);
            } else {
                this.setLoadingStatus('Загрузка данных...', '');
            }

            this.fetchUserData();
        } else {
            console.error('[Custos] Telegram WebApp SDK not found');
            this.setLoadingStatus('Ошибка', 'Telegram SDK не найден');
            setTimeout(() => {
                this.subStatusText.textContent = "Ошибка: Запустите через Telegram";
                this.showView(this.noSubView);
            }, 1500);
        }
    },

    populateNavbar(user) {
        if (user.photo_url) {
            this.navAvatar.src = user.photo_url;
        } else {
            this.navAvatar.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236b7280'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E";
        }

        const firstName = user.first_name || '';
        const lastName = user.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim() || user.username || 'Пользователь';
        this.navName.textContent = fullName;
    },

    async fetchUserData() {
        try {
            this.setLoadingStatus('Синхронизация...', 'Отправка запроса');

            console.log('[Custos] Sending initData to /api/user, length:', this.initData.length);

            // 15-second timeout to prevent infinite sync
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);

            const response = await fetch('/api/user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                signal: controller.signal,
                body: JSON.stringify({ initData: this.initData })
            });

            clearTimeout(timeout);

            console.log('[Custos] Response status:', response.status);

            if (!response.ok) {
                const errorBody = await response.text();
                console.error('[Custos] Server error:', response.status, errorBody);
                this.setLoadingStatus('Ошибка сервера', `Код: ${response.status}`);

                setTimeout(() => {
                    this.subStatusText.textContent = `Ошибка сервера (${response.status})`;
                    this.showView(this.noSubView);
                }, 2000);
                return;
            }

            const data = await response.json();
            console.log('[Custos] API Response:', JSON.stringify(data));

            if (data.telegram_user) {
                this.populateNavbar(data.telegram_user);
            }

            if (data.has_subscription && data.subscription) {
                // Check if user has already seen the animation this session
                const hasVisited = sessionStorage.getItem('hasVisitedIndex');
                const animDuration = hasVisited ? 0 : 2000;
                sessionStorage.setItem('hasVisitedIndex', 'true');

                // Wait for animation to finish
                setTimeout(() => {
                    this.hideLoading(() => {
                        this.showView(this.activeSubView);
                        this.renderActiveSubscription(data.subscription, data.queued_subs || []);
                    });
                }, animDuration);
            } else {
                // Wait for the animation to play before fading out and redirecting
                setTimeout(() => {
                    this.hideNavbar();
                    this.hideLoading(() => {
                        window.location.replace("no-sub.html");
                    });
                }, 2000);
            }

        } catch (error) {
            clearTimeout && clearTimeout(this._fetchTimeout);
            console.error('[Custos] Fetch error:', error);

            const isTimeout = error.name === 'AbortError';
            const statusMsg = isTimeout ? 'Превышено время ожидания' : 'Ошибка связи';
            const detailMsg = isTimeout ? 'Сервер не отвечает' : (error.message || 'Проверьте подключение');
            this.setLoadingStatus(statusMsg, detailMsg);

            setTimeout(() => {
                if (this.subStatusText) this.subStatusText.textContent = isTimeout ? "Сервер не отвечает. Попробуйте позже." : "Ошибка связи с сервером";
                this.hideNavbar();
                this.hideLoading(() => {
                    window.location.replace("no-sub.html");
                });
            }, 1000);
        }
    },

    renderActiveSubscription(sub, queuedSubs) {
        // Set Sub Link mapping
        this.subLink = sub.sub_link || '';

        console.log('[Custos] Plan name from server:', sub.name, '| plan_slug:', sub.plan_slug);
        console.log('[Custos] Queued subs received:', JSON.stringify(queuedSubs));

        // Set Plan Name (strip emojis)
        const rawName = sub.name || 'VPN Доступ';
        this.planName.textContent = rawName.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '').trim();

        // Show server info for Custom plans
        let customInfoEl = document.getElementById('custom-plan-info');
        if (!customInfoEl) {
            customInfoEl = document.createElement('div');
            customInfoEl.id = 'custom-plan-info';
            customInfoEl.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-top: 6px; padding: 8px 12px; border-radius: 12px; background: rgba(99, 102, 241, 0.06); border: 1px solid rgba(99, 102, 241, 0.12);';
            this.planName.parentNode.insertBefore(customInfoEl, this.planName.nextSibling);
        }
        if (sub.plan_slug === 'custom' && sub.server_name) {
            customInfoEl.innerHTML = `
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                <span style="font-size: 13px; font-weight: 600; color: var(--text-main);">${sub.server_name}</span>
            `;
            customInfoEl.style.display = 'flex';
        } else {
            customInfoEl.style.display = 'none';
        }

        // Expiration format
        if (sub.expire_ts > 0) {
            const date = new Date(sub.expire_ts * 1000);
            const options = { day: 'numeric', month: 'long', year: 'numeric' };
            this.expiryDate.textContent = `Истекает: ${date.toLocaleDateString('ru-RU', options)}`;

            const now = Math.floor(Date.now() / 1000);
            const daysLeft = (sub.expire_ts - now) / 86400;
            if (daysLeft <= 3 && sub.name !== "Hi") {
                this.expiryDate.style.color = '#ef4444';
            } else {
                this.expiryDate.style.color = 'var(--text-muted)';
            }
        } else {
            this.expiryDate.textContent = 'Истекает: Безлимит';
            this.expiryDate.style.color = 'var(--text-muted)';
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
            const BYTES_IN_TB = 1099511627776; // 1 TB
            const usedGB = (sub.used_bytes / BYTES_IN_GB).toFixed(2);
            let pct = (sub.used_bytes / BYTES_IN_TB) * 100;
            if (pct > 100) pct = 100;

            trafficText = `${usedGB} GB использовано`;
            trafficPct = "∞";
            fillWidth = `${pct}%`;
        }

        this.trafficText.textContent = trafficText;
        this.trafficPct.textContent = trafficPct;
        setTimeout(() => {
            this.trafficFill.style.width = fillWidth;
            if (sub.limit_bytes > 0 && (sub.used_bytes / sub.limit_bytes) > 0.9) {
                this.trafficFill.style.background = '#ef4444';
            }
        }, 100);

        // Device Stats
        const limit = sub.device_limit || 0;
        const active = sub.active_devices || 0;

        if (limit > 0) {
            this.deviceCount.textContent = `${active}/${limit}`;
            const available = limit - active;
            this.deviceText.textContent = available > 0 ? `${available} доступно` : 'Лимит исчерпан';

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

        // Handle Queued Subs
        const queuedContainer = document.getElementById('queued-sub-container');
        const renewBtn = document.getElementById('renew-button');

        if (queuedSubs && queuedSubs.length > 0) {
            queuedContainer.style.display = 'block';

            let totalQueuedDays = 0;
            queuedSubs.forEach(q => { totalQueuedDays += (q.days || 30); });

            // Plan name mapping
            const planNames = {
                'hi': 'Hi', 'base': 'Base', 'premium': 'Premium', 'custom': 'Custom'
            };
            const qPlanName = queuedSubs[0].plan_name || 'base';
            const qPlanDisplay = planNames[qPlanName] || qPlanName;

            // Custom plan extra details
            let customDetailsHtml = '';
            if (qPlanName === 'custom') {
                const serverName = queuedSubs[0].server_name;
                const deviceCount = queuedSubs[0].device_count;
                if (serverName || deviceCount) {
                    customDetailsHtml = `
                        <div style="
                            font-size: 13px;
                            color: var(--text-muted);
                            line-height: 1.7;
                            padding-left: 52px;
                            margin-bottom: 10px;
                        ">
                            ${serverName ? `🌍 Сервер: <b style="color: var(--text-main);">${serverName}</b><br>` : ''}
                            ${deviceCount ? `📱 Устройств: <b style="color: var(--text-main);">${deviceCount}</b>` : ''}
                        </div>
                    `;
                }
            }

            queuedContainer.innerHTML = `
                <div style="
                    margin-top: 16px;
                    padding: 20px;
                    border-radius: 20px;
                    background: linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(16, 185, 129, 0.02) 100%);
                    border: 1px solid rgba(16, 185, 129, 0.2);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    position: relative;
                    overflow: hidden;
                ">
                    <!-- Subtle green glow in corner -->
                    <div style="
                        position: absolute; top: -20px; right: -20px;
                        width: 80px; height: 80px;
                        background: radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%);
                        pointer-events: none;
                    "></div>

                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px;">
                        <div style="
                            width: 40px; height: 40px;
                            border-radius: 12px;
                            background: rgba(16, 185, 129, 0.12);
                            display: flex; align-items: center; justify-content: center;
                            flex-shrink: 0;
                        ">
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                        </div>
                        <div style="flex-grow: 1;">
                            <div style="font-weight: 700; font-size: 15px; color: var(--text-main); letter-spacing: -0.3px;">
                                Следующая: ${qPlanDisplay}
                            </div>
                            <div style="font-size: 13px; color: #10b981; font-weight: 600; margin-top: 2px;">
                                +${totalQueuedDays} дней
                            </div>
                        </div>
                        <div style="
                            padding: 4px 10px;
                            border-radius: 20px;
                            background: rgba(16, 185, 129, 0.1);
                            color: #10b981;
                            font-size: 10px;
                            font-weight: 700;
                            letter-spacing: 0.5px;
                            white-space: nowrap;
                            margin-left: auto;
                            flex-shrink: 0;
                        ">В ОЧЕРЕДИ</div>
                    </div>

                    ${customDetailsHtml}

                    <div style="
                        font-size: 13px;
                        color: var(--text-muted);
                        line-height: 1.5;
                        padding-left: 52px;
                    ">Подписка автоматически активируется после окончания текущей.</div>
                </div>
            `;

            // Dashed green transparent "Продлена" button
            renewBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Продлена`;
            renewBtn.style.background = 'transparent';
            renewBtn.style.color = '#10b981';
            renewBtn.style.border = '2px dashed #10b981';
            renewBtn.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.08)';
            renewBtn.style.display = 'flex';
            renewBtn.style.alignItems = 'center';
            renewBtn.style.justifyContent = 'center';
            renewBtn.style.pointerEvents = 'none';
            renewBtn.style.opacity = '1';
        } else {
            queuedContainer.style.display = 'none';
            queuedContainer.innerHTML = '';

            renewBtn.innerHTML = 'Продлить';
            renewBtn.style.background = '#10b981';
            renewBtn.style.color = 'white';
            renewBtn.style.border = 'none';
            renewBtn.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.4)';
            renewBtn.style.display = '';
            renewBtn.style.pointerEvents = '';
            renewBtn.style.opacity = '';
        }

        this.subStatusText.textContent = "Ваши данные защищены";
        this.subStatusText.style.color = 'var(--text-muted)';
        this.showView(this.activeSubView);
    },

    showView(viewElement) {
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
            v.classList.add('hidden');
        });

        viewElement.classList.remove('hidden');
        setTimeout(() => {
            viewElement.classList.add('active');
        }, 50);
    },

    copyKey() {
        if (!this.subLink) return;

        const btn = document.querySelector('.copy-key-btn');
        const originalText = btn.textContent;

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(this.subLink);
        } else {
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

        btn.textContent = 'Скопировано! Откройте приложение Happ';
        btn.style.background = '#10b981';
        btn.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.4)';

        if (this.tg && this.tg.HapticFeedback) {
            this.tg.HapticFeedback.impactOccurred('heavy');
            setTimeout(() => {
                this.tg.HapticFeedback.notificationOccurred('success');
            }, 100);
        }

        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
            btn.style.boxShadow = '';
        }, 3000);
    },

    closeToBot() {
        if (this.tg) {
            this.tg.openTelegramLink("https://t.me/CustosVPN_Bot?start=tariffs");
            this.tg.close();
        }
    },

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);

        if (this.tg && this.tg.isVersionAtLeast && this.tg.isVersionAtLeast('6.1')) {
            try {
                if (newTheme === 'dark') {
                    this.tg.setHeaderColor('#0a0e17');
                    this.tg.setBackgroundColor('#0a0e17');
                } else {
                    this.tg.setHeaderColor('#fafafa');
                    this.tg.setBackgroundColor('#fafafa');
                }
            } catch (e) { }
        }
    },

    renewSub() {
        if (this.tg) {
            this.tg.openTelegramLink("https://t.me/CustosVPN_Bot?start=tariffs");
            this.tg.close();
        }
    },

    openDevices() {
        if (this.tg) {
            window.location.href = `devices.html?initData=${encodeURIComponent(this.initData)}`;
        } else {
            window.location.href = 'devices.html';
        }
    },

    openSupport() {
        if (this.tg) {
            this.tg.openLink("https://t.me/CustosHelpRobot");
        } else {
            window.location.href = "https://t.me/CustosHelpRobot";
        }
    },

    mockDevUser() {
        this.populateNavbar({
            first_name: "Test",
            last_name: "User",
            photo_url: "logo.jpg"
        });

        this.renderActiveSubscription({
            expire_ts: Math.floor(Date.now() / 1000) + 86400 * 30,
            limit_bytes: 100 * 1024 * 1024 * 1024,
            used_bytes: 45.5 * 1024 * 1024 * 1024,
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
