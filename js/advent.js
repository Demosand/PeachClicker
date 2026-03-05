/* ===================================================
   ADVENT CALENDAR — Premium Holographic Scratch-Off
   =================================================== */

const adventApp = (() => {
    // ─── Rewards ──────────────────────────────────────
    const rewards = [
        { day: 1, title: 'Скидка 20₽ на любой заказ', promo: 'DAY1-20RUB', icon: '⭐' },
        { day: 2, title: 'Скидка 15₽ на звезды', promo: 'DAY2-15STAR', icon: '✨' },
        { day: 3, title: '2 дня на любую подписку Custos', promo: 'DAY3-2CUSTOS', icon: '🎁' },
        { day: 4, title: 'Скидка 25% на премиум', promo: 'DAY4-25PREM', icon: '💎' },
        { day: 5, title: '2 дня на любую подписку', promo: 'DAY5-2ALL', icon: '🎉' },
        { day: 6, title: '20% на все подписки кроме Hi', promo: 'DAY6-20NOHI', icon: '🚀' },
        { day: 7, title: 'Новый сервер Швеция во всех тарифах', promo: 'DAY7-SWEDEN', icon: '🇸🇪' }
    ];

    let unlockedDay = parseInt(localStorage.getItem('adventUnlockedDay')) || 0;

    // ─── Build the grid ───────────────────────────────
    function init() {
        const grid = document.getElementById('advent-grid');
        if (!grid) return;
        grid.innerHTML = '';

        rewards.forEach(r => {
            const isUnlocked = r.day <= unlockedDay;
            const isOpened = localStorage.getItem(`adventOpenedDay${r.day}`) === 'true';

            // Wrapper
            const wrap = el('div', 'advent-card-wrapper');
            wrap.setAttribute('data-day', r.day);
            wrap.id = `advent-card-${r.day}`;

            // Card
            const card = el('div', `advent-card${!isUnlocked ? ' locked' : ''}${isOpened ? ' cleared' : ''}`);

            // 1) Base surface with texture
            card.appendChild(el('div', 'advent-card-surface'));

            // 2) Reward content (always present, hidden under scratch)
            const reward = el('div', 'advent-reward-content');
            reward.innerHTML = `
                <div class="reward-icon">${r.icon}</div>
                <div class="reward-title">${r.title}</div>
                <div class="reward-promo">${r.promo}</div>`;
            card.appendChild(reward);

            // 3) Holographic layers
            card.appendChild(el('div', 'advent-holo-layer'));
            card.appendChild(el('div', 'advent-holo-spot'));
            card.appendChild(el('div', 'advent-sparkle-layer'));

            // 4) Scratch canvas
            const canvas = el('canvas', 'advent-scratch-canvas');
            card.appendChild(canvas);

            // 5) Cover (locked state / finger-hint)
            const cover = el('div', 'advent-cover-layer');
            cover.innerHTML = `
                <div class="advent-day-number">${r.day}</div>
                <div class="advent-cover-icon"></div>
                <div class="advent-cover-text">${!isUnlocked ? 'Приходи завтра' : 'Сотри слой!'}</div>`;
            card.appendChild(cover);

            wrap.appendChild(card);
            grid.appendChild(wrap);

            // Init scratch if ready
            if (isUnlocked && !isOpened) {
                requestAnimationFrame(() => initScratch(canvas, r.day, cover));
            }
        });

        initHolographic();
    }

    // ─── Scratch-off logic ────────────────────────────
    function initScratch(canvas, day, coverDiv) {
        const ctx = canvas.getContext('2d');
        let drawing = false;
        let revealed = false;

        // Color stops per day (blue shades matching CSS)
        const palettes = {
            1: ['#0f172a', '#1e3a5f'],
            2: ['#0e2352', '#1a50a0'],
            3: ['#102a5e', '#1d5bc0'],
            4: ['#0e2048', '#2050b0'],
            5: ['#0d1c44', '#1c4898'],
            6: ['#0b1838', '#183e88'],
            7: ['#091430', '#152e70']
        };

        function paint() {
            const rect = canvas.getBoundingClientRect();
            if (!rect.width || !rect.height) { setTimeout(paint, 80); return; }

            const dpr = window.devicePixelRatio || 1;
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);

            const w = rect.width, h = rect.height;
            const grad = ctx.createLinearGradient(0, 0, w, h);
            const c = palettes[day] || palettes[1];
            grad.addColorStop(0, c[0]);
            grad.addColorStop(1, c[1]);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);

            // Noise dots for textured feel
            for (let i = 0; i < 300; i++) {
                const nx = Math.random() * w;
                const ny = Math.random() * h;
                ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.07})`;
                ctx.fillRect(nx, ny, 1, 1);
            }

            // "?" symbol
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.font = "bold 34px 'Outfit', sans-serif";
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', w / 2, h / 2 - 6);

            // Hint
            ctx.font = "500 10px 'Outfit', sans-serif";
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillText('Сотри пальцем ↑', w / 2, h - 14);

            // Day badge
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            roundRect(ctx, w - 32, 6, 24, 24, 8); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.font = "bold 11px 'Outfit', sans-serif";
            ctx.fillText(String(day), w - 20, 20);

            coverDiv.style.opacity = '0';
        }

        setTimeout(paint, 120);

        // ───── Touch / Mouse handlers ─────
        function pos(e) {
            const r = canvas.getBoundingClientRect();
            const cx = e.touches ? e.touches[0].clientX : e.clientX;
            const cy = e.touches ? e.touches[0].clientY : e.clientY;
            return { x: cx - r.left, y: cy - r.top };
        }

        function scratch(e) {
            if (!drawing || revealed) return;
            e.preventDefault();
            const p = pos(e);
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
            ctx.fill();
            checkReveal();
        }

        const checkReveal = debounce(() => {
            if (revealed) return;
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const d = img.data;
            let transparent = 0;
            const step = 16;  // sample every 4th pixel
            for (let i = 3; i < d.length; i += step) {
                if (d[i] < 40) transparent++;
            }
            if ((transparent / (d.length / step)) > 0.40) {
                revealed = true;
                revealDay(day);
            }
        }, 80);

        canvas.addEventListener('mousedown', e => { drawing = true; scratch(e); });
        canvas.addEventListener('mousemove', scratch);
        window.addEventListener('mouseup', () => { drawing = false; });
        canvas.addEventListener('touchstart', e => { drawing = true; scratch(e); }, { passive: false });
        canvas.addEventListener('touchmove', scratch, { passive: false });
        window.addEventListener('touchend', () => { drawing = false; });
    }

    // ─── Reveal animation ─────────────────────────────
    function revealDay(day) {
        localStorage.setItem(`adventOpenedDay${day}`, 'true');
        const wrap = document.getElementById(`advent-card-${day}`);
        const card = wrap.querySelector('.advent-card');
        const grid = document.getElementById('advent-grid');

        card.classList.add('cleared');

        // Short pulse before zoom
        setTimeout(() => {
            grid.classList.add('is-revealing');
            wrap.classList.add('revealed-zoom');
            spawnConfetti();

            const badge = el('div', 'close-reward-badge');
            badge.textContent = 'Нажми чтобы закрыть';
            document.body.appendChild(badge);

            const close = () => {
                grid.classList.remove('is-revealing');
                wrap.classList.remove('revealed-zoom');
                badge.remove();
                card.removeEventListener('click', close);
            };
            setTimeout(() => card.addEventListener('click', close), 650);
        }, 200);
    }

    // ─── Confetti burst ───────────────────────────────
    function spawnConfetti() {
        const colors = ['#3b82f6', '#60a5fa', '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#818cf8'];
        for (let i = 0; i < 40; i++) {
            const p = document.createElement('div');
            p.className = 'confetti-particle';
            p.style.left = `${Math.random() * 100}vw`;
            p.style.top = `${10 + Math.random() * 30}vh`;
            p.style.width = `${5 + Math.random() * 6}px`;
            p.style.height = `${5 + Math.random() * 6}px`;
            p.style.background = colors[Math.floor(Math.random() * colors.length)];
            p.style.animationDuration = `${1.2 + Math.random() * 1.5}s`;
            p.style.animationDelay = `${Math.random() * 0.3}s`;
            p.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
            document.body.appendChild(p);
            setTimeout(() => p.remove(), 3000);
        }
    }

    // ─── Holographic tilt effect (gradient only) ──────
    function initHolographic() {
        const modal = document.getElementById('advent-modal');
        if (!modal) return;

        let rafId = null;
        let targetX = 50, targetY = 50;
        let currentX = 50, currentY = 50;

        function updateCards() {
            // Smooth interpolation
            currentX += (targetX - currentX) * 0.12;
            currentY += (targetY - currentY) * 0.12;

            const cards = modal.querySelectorAll('.advent-card:not(.locked)');
            cards.forEach(card => {
                card.style.setProperty('--holo-x', `${currentX}%`);
                card.style.setProperty('--holo-y', `${currentY}%`);
                card.style.setProperty('--holo-x-num', currentX);
            });

            rafId = requestAnimationFrame(updateCards);
        }
        rafId = requestAnimationFrame(updateCards);

        // Mouse
        modal.addEventListener('mousemove', e => {
            const rect = modal.getBoundingClientRect();
            targetX = ((e.clientX - rect.left) / rect.width) * 100;
            targetY = ((e.clientY - rect.top) / rect.height) * 100;
        });

        // Device orientation (phone tilt → gradient movement)
        if (window.DeviceOrientationEvent) {
            // Try to request permission on iOS 13+
            const requestPerm = () => {
                if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                    DeviceOrientationEvent.requestPermission().catch(() => { });
                }
            };
            modal.addEventListener('touchstart', requestPerm, { once: true });

            window.addEventListener('deviceorientation', e => {
                if (e.gamma == null || e.beta == null) return;
                // gamma: -90..90 (left-right), beta: -180..180 (front-back)
                targetX = Math.max(0, Math.min(100, 50 + (e.gamma / 30) * 50));
                targetY = Math.max(0, Math.min(100, 50 + ((e.beta - 40) / 30) * 50));
            });
        }

        // Cleanup if modal is closed
        const observer = new MutationObserver(() => {
            if (modal.classList.contains('hidden') && rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            } else if (!modal.classList.contains('hidden') && !rafId) {
                rafId = requestAnimationFrame(updateCards);
            }
        });
        observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    }

    // ─── Utilities ────────────────────────────────────
    function el(tag, cls) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        return e;
    }

    function debounce(fn, ms) {
        let t;
        return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    // ─── Public API ───────────────────────────────────
    return {
        openModal() {
            const m = document.getElementById('advent-modal');
            m.classList.remove('hidden');
            setTimeout(init, 60);
        },
        closeModal() {
            document.getElementById('advent-modal').classList.add('hidden');
        },
        unlockNextDay() {
            if (unlockedDay < 7) {
                unlockedDay++;
                localStorage.setItem('adventUnlockedDay', unlockedDay);
                init();
            } else {
                // Quick visual feedback
                const btn = document.querySelector('.advent-test-btn');
                if (btn) { btn.style.opacity = '0.5'; setTimeout(() => btn.style.opacity = '1', 600); }
            }
        }
    };
})();
