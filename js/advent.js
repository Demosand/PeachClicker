/* ===================================================
   ADVENT CALENDAR — Subtle Tilt + Easy Scratch
   =================================================== */

const adventApp = (() => {
    const rewards = [
        { day: 1, title: 'Скидка 20₽ на любой заказ', promo: 'DAY1-20RUB', icon: '⭐' },
        { day: 2, title: 'Скидка 15₽ на звезды', promo: 'DAY2-15STAR', icon: '✨' },
        { day: 3, title: '2 дня на любую подписку Custos', promo: 'DAY3-2CUSTOS', icon: '🎁' },
        { day: 4, title: 'Скидка 25% на премиум', promo: 'DAY4-25PREM', icon: '💎' },
        { day: 5, title: '2 дня на любую подписку', promo: 'DAY5-2ALL', icon: '🎉' },
        { day: 6, title: '20% на все подписки кроме Hi', promo: 'DAY6-20NOHI', icon: '🚀' },
        { day: 7, title: 'Новый сервер Швеция во всех тарифах', promo: 'DAY7-SWEDEN', icon: '🇸🇪' }
    ];

    let unlockedDay = Math.max(1, parseInt(localStorage.getItem('adventUnlockedDay')) || 1);

    // ─── Build grid ───────────────────────────────────
    function init() {
        const grid = document.getElementById('advent-grid');
        if (!grid) return;
        grid.innerHTML = '';

        rewards.forEach(r => {
            const isUnlocked = r.day <= unlockedDay;
            const isOpened = localStorage.getItem(`adventOpenedDay${r.day}`) === 'true';

            const wrap = mk('div', 'advent-card-wrapper');
            wrap.setAttribute('data-day', r.day);
            wrap.id = `advent-card-${r.day}`;

            const card = mk('div', `advent-card${!isUnlocked ? ' locked' : ''}${isOpened ? ' cleared' : ''}`);

            // Surface
            card.appendChild(mk('div', 'advent-card-surface'));

            // Reward (under scratch)
            const reward = mk('div', 'advent-reward-content');
            reward.innerHTML = `
                <div class="reward-icon">${r.icon}</div>
                <div class="reward-title">${r.title}</div>
                <div class="reward-promo">${r.promo}</div>`;
            card.appendChild(reward);

            // Canvas
            const canvas = mk('canvas', 'advent-scratch-canvas');
            card.appendChild(canvas);

            // Cover
            const cover = mk('div', 'advent-cover-layer');
            cover.innerHTML = `
                <div class="advent-day-number">${r.day}</div>
                <div class="advent-cover-icon"></div>
                <div class="advent-cover-text">${isUnlocked ? 'Сотри слой!' : 'Приходи завтра'}</div>`;
            card.appendChild(cover);

            wrap.appendChild(card);
            grid.appendChild(wrap);

            if (isUnlocked && !isOpened) {
                requestAnimationFrame(() => initScratch(canvas, r.day, cover));
            }
        });

        initTilt();
    }

    // ─── EASY scratch-off ─────────────────────────────
    function initScratch(canvas, day, coverDiv) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        let drawing = false;
        let revealed = false;

        const blues = {
            1: ['#0d1b3e', '#1a3565'],
            2: ['#0f2048', '#1d4595'],
            3: ['#102552', '#2055ad'],
            4: ['#0e1e45', '#1e408e'],
            5: ['#0d1a40', '#1a3c85'],
            6: ['#0b1638', '#173575'],
            7: ['#0a1430', '#142e68']
        };

        function paint() {
            const rect = canvas.getBoundingClientRect();
            if (!rect.width || !rect.height) { setTimeout(paint, 60); return; }

            const dpr = window.devicePixelRatio || 1;
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);
            const w = rect.width, h = rect.height;

            const g = ctx.createLinearGradient(0, 0, w * 0.4, h);
            const c = blues[day] || blues[1];
            g.addColorStop(0, c[0]);
            g.addColorStop(1, c[1]);
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);

            // Subtle noise for texture
            for (let i = 0; i < 300; i++) {
                ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`;
                ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
            }

            // "?"
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = `bold ${Math.min(w, h) * 0.28}px 'Outfit', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', w / 2, h / 2 - 4);

            // Hint
            ctx.font = "500 9px 'Outfit', sans-serif";
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.fillText('Сотри пальцем', w / 2, h - 12);

            // Day badge
            const bx = w - 30, by = 6, bs = 22;
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            roundRect(ctx, bx, by, bs, bs, 7);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.font = "bold 10px 'Outfit', sans-serif";
            ctx.fillText(String(day), bx + bs / 2, by + bs / 2 + 1);

            coverDiv.style.opacity = '0';
        }

        setTimeout(paint, 80);

        function pos(e) {
            const r = canvas.getBoundingClientRect();
            const cx = e.touches ? e.touches[0].clientX : e.clientX;
            const cy = e.touches ? e.touches[0].clientY : e.clientY;
            return { x: cx - r.left, y: cy - r.top };
        }

        let lastPos = null;

        function scratch(e) {
            if (!drawing || revealed) return;
            e.preventDefault();
            const p = pos(e);

            ctx.globalCompositeOperation = 'destination-out';

            if (lastPos) {
                // Big thick stroke for EASY scratching
                ctx.lineWidth = 40;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(lastPos.x, lastPos.y);
                ctx.lineTo(p.x, p.y);
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
                ctx.fill();
            }
            lastPos = p;
            checkReveal();
        }

        // Very low threshold for easy reveal
        const checkReveal = debounce(() => {
            if (revealed) return;
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const d = img.data;
            let clear = 0;
            const step = 24;
            for (let i = 3; i < d.length; i += step) {
                if (d[i] < 30) clear++;
            }
            // Only 25% needs to be cleared
            if ((clear / (d.length / step)) > 0.25) {
                revealed = true;
                revealDay(day);
            }
        }, 50);

        canvas.addEventListener('mousedown', e => { drawing = true; lastPos = null; scratch(e); });
        canvas.addEventListener('mousemove', scratch);
        window.addEventListener('mouseup', () => { drawing = false; lastPos = null; });
        canvas.addEventListener('touchstart', e => { drawing = true; lastPos = null; scratch(e); }, { passive: false });
        canvas.addEventListener('touchmove', scratch, { passive: false });
        window.addEventListener('touchend', () => { drawing = false; lastPos = null; });
    }

    // ─── Reveal ───────────────────────────────────────
    function revealDay(day) {
        localStorage.setItem(`adventOpenedDay${day}`, 'true');
        const wrap = document.getElementById(`advent-card-${day}`);
        const card = wrap.querySelector('.advent-card');
        const grid = document.getElementById('advent-grid');

        card.classList.add('cleared');

        setTimeout(() => {
            grid.classList.add('is-revealing');
            wrap.classList.add('revealed-zoom');
            burstConfetti();

            const badge = mk('div', 'close-reward-badge');
            badge.textContent = 'Нажми чтобы закрыть';
            document.body.appendChild(badge);

            const close = () => {
                grid.classList.remove('is-revealing');
                wrap.classList.remove('revealed-zoom');
                badge.remove();
                card.removeEventListener('click', close);
            };
            setTimeout(() => card.addEventListener('click', close), 650);
        }, 180);
    }

    function burstConfetti() {
        const colors = ['#3b82f6', '#60a5fa', '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#818cf8', '#fff'];
        for (let i = 0; i < 45; i++) {
            const p = document.createElement('div');
            p.className = 'confetti-particle';
            p.style.left = `${Math.random() * 100}vw`;
            p.style.top = `${5 + Math.random() * 35}vh`;
            p.style.width = `${4 + Math.random() * 7}px`;
            p.style.height = `${4 + Math.random() * 7}px`;
            p.style.background = colors[Math.floor(Math.random() * colors.length)];
            p.style.animationDuration = `${1 + Math.random() * 1.8}s`;
            p.style.animationDelay = `${Math.random() * 0.4}s`;
            p.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
            document.body.appendChild(p);
            setTimeout(() => p.remove(), 3500);
        }
    }

    // ─── Subtle physical tilt (very gentle) ───────────
    function initTilt() {
        const modal = document.getElementById('advent-modal');
        if (!modal) return;

        let targetTiltX = 0;  // front-back
        let targetTiltY = 0;  // left-right
        let curTiltX = 0;
        let curTiltY = 0;
        let rafId = null;

        const MAX_TILT = 3; // Very subtle — max 3 degrees

        function loop() {
            curTiltX += (targetTiltX - curTiltX) * 0.06;
            curTiltY += (targetTiltY - curTiltY) * 0.06;

            const cards = modal.querySelectorAll('.advent-card:not(.cleared)');
            for (const card of cards) {
                card.style.setProperty('--tilt-x', curTiltX.toFixed(2));
                card.style.setProperty('--tilt-y', curTiltY.toFixed(2));
            }

            rafId = requestAnimationFrame(loop);
        }

        rafId = requestAnimationFrame(loop);

        // Device orientation for phone tilt
        if (window.DeviceOrientationEvent) {
            const tryPerm = () => {
                if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                    DeviceOrientationEvent.requestPermission().catch(() => { });
                }
            };
            modal.addEventListener('touchstart', tryPerm, { once: true });

            window.addEventListener('deviceorientation', e => {
                if (e.gamma == null || e.beta == null) return;
                // gamma: -90..90 (left-right), beta: -180..180 (front-back)
                // Map to very subtle range
                targetTiltY = clamp((e.gamma / 45) * MAX_TILT, -MAX_TILT, MAX_TILT);
                targetTiltX = clamp(((e.beta - 40) / 45) * -MAX_TILT, -MAX_TILT, MAX_TILT);
            });
        }

        // Mouse fallback: very subtle tilt on hover
        modal.addEventListener('mousemove', e => {
            const r = modal.getBoundingClientRect();
            const nx = ((e.clientX - r.left) / r.width - 0.5) * 2;  // -1 to 1
            const ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
            targetTiltY = nx * MAX_TILT;
            targetTiltX = -ny * MAX_TILT;
        });

        modal.addEventListener('mouseleave', () => {
            targetTiltX = 0;
            targetTiltY = 0;
        });

        // Pause/resume on modal visibility
        const obs = new MutationObserver(() => {
            if (modal.classList.contains('hidden')) {
                if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
                targetTiltX = 0; targetTiltY = 0; curTiltX = 0; curTiltY = 0;
            } else if (!rafId) {
                rafId = requestAnimationFrame(loop);
            }
        });
        obs.observe(modal, { attributes: true, attributeFilter: ['class'] });
    }

    // ─── Utils ────────────────────────────────────────
    function mk(tag, cls) {
        const el = document.createElement(tag);
        if (cls) el.className = cls;
        return el;
    }

    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

    function debounce(fn, ms) {
        let t;
        return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
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

    // ─── Public ───────────────────────────────────────
    return {
        openModal() {
            document.getElementById('advent-modal').classList.remove('hidden');
            setTimeout(init, 50);
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
                const btn = document.querySelector('.advent-test-btn');
                if (btn) { btn.style.opacity = '0.5'; setTimeout(() => btn.style.opacity = '1', 500); }
            }
        }
    };
})();
