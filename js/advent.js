const adventApp = (() => {
    // 7 Reward definitions with fake promo codes
    const rewards = [
        { day: 1, title: "Скидка 20₽ на любой заказ", promo: "DAY1-20RUB", icon: "⭐" },
        { day: 2, title: "Скидка 15₽ на звезды", promo: "DAY2-15STAR", icon: "✨" },
        { day: 3, title: "2 дня на любую подписку", promo: "DAY3-2CUSTOS", icon: "🎁" },
        { day: 4, title: "Скидка 25% на премиум", promo: "DAY4-25PREM", icon: "💎" },
        { day: 5, title: "2 дня на любую подписку", promo: "DAY5-2ALL", icon: "🎉" },
        { day: 6, title: "20% скидка кроме hi", promo: "DAY6-20NOHI", icon: "🚀" },
        { day: 7, title: "Новый сервер Швеция", promo: "DAY7-SWEDEN", icon: "🇸🇪" }
    ];

    let unlockedDay = parseInt(localStorage.getItem('adventUnlockedDay')) || 0; 

    function init() {
        const grid = document.getElementById('advent-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        rewards.forEach(r => {
            const isUnlocked = r.day <= unlockedDay;
            const isOpened = localStorage.getItem(`adventOpenedDay${r.day}`) === 'true';
            
            const cardWrapper = document.createElement('div');
            cardWrapper.className = 'advent-card-wrapper';
            cardWrapper.setAttribute('data-day', r.day);
            cardWrapper.id = `advent-card-${r.day}`;
            
            const card = document.createElement('div');
            card.className = `advent-card ${!isUnlocked ? 'locked' : ''} ${isOpened ? 'cleared' : ''}`;
            
            // HTML Cover (used for locked state or pre-canvas load)
            const coverLayer = document.createElement('div');
            coverLayer.className = 'advent-cover-layer';
            coverLayer.innerHTML = `
                <div class="advent-day-number">${r.day}</div>
                <div class="advent-cover-icon"></div>
                <div class="advent-cover-text">${!isUnlocked ? 'Приходи завтра' : 'Сотри слой!'}</div>
            `;
            
            // Reward Inner Content
            const rewardContent = document.createElement('div');
            rewardContent.className = 'advent-reward-content';
            rewardContent.innerHTML = `
                <div class="reward-icon">${r.icon}</div>
                <div class="reward-title">${r.title}</div>
                <div class="reward-promo">${r.promo}</div>
            `;
            
            card.appendChild(rewardContent);
            
            // Scratch Canvas
            const canvas = document.createElement('canvas');
            canvas.className = 'advent-scratch-canvas';
            card.appendChild(canvas);
            
            card.appendChild(coverLayer);
            cardWrapper.appendChild(card);
            grid.appendChild(cardWrapper);
            
            if (isUnlocked && !isOpened) {
                initScratchCard(canvas, r.day, coverLayer);
            }
        });
        
        initTiltEffect();
    }

    function initScratchCard(canvas, day, coverLayer) {
        const ctx = canvas.getContext('2d');
        let isDrawing = false;
        let isRevealed = false;
        
        const colors = {
            1: ['#111827', '#1f2937'],
            2: ['#06b6d4', '#0284c7'],
            3: ['#38bdf8', '#0369a1'],
            4: ['#3b82f6', '#1d4ed8'],
            5: ['#6366f1', '#4338ca'],
            6: ['#10b981', '#047857'],
            7: ['#a3e635', '#eab308']
        };

        const drawCover = () => {
            const rect = canvas.getBoundingClientRect();
            if(rect.width === 0 || rect.height === 0) {
                // Not visible yet, try again
                setTimeout(drawCover, 100);
                return;
            }
            
            const dpr = window.devicePixelRatio || 1;
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);
            
            const w = rect.width;
            const h = rect.height;

            const gradient = ctx.createLinearGradient(0, 0, w, h);
            gradient.addColorStop(0, colors[day]?.[0] || '#3b82f6');
            gradient.addColorStop(1, colors[day]?.[1] || '#1d4ed8');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, w, h);
            
            ctx.fillStyle = "white";
            ctx.font = "bold 36px 'Outfit', sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("?", w/2, h/2 - 10);
            
            ctx.font = "12px 'Outfit', sans-serif";
            ctx.fillText("Сотри слой", w/2, h - 24);
            
            ctx.fillStyle = "rgba(255,255,255,0.2)";
            ctx.beginPath();
            ctx.arc(w - 20, 20, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "white";
            ctx.font = "bold 12px 'Outfit', sans-serif";
            ctx.fillText(day.toString(), w - 20, 20);
            
            // Hide the HTML cover so canvas is primarily visible
            coverLayer.style.opacity = 0; 
        };

        // Initialize drawing layer
        setTimeout(drawCover, 150);

        function getMousePos(e) {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        }

        function scratch(e) {
            if (!isDrawing || isRevealed) return;
            e.preventDefault(); 
            
            const pos = getMousePos(e);
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 18, 0, Math.PI * 2, false);
            ctx.fill();
            
            checkPercent();
        }
        
        const checkPercent = debounce(() => {
            if (isRevealed) return;
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = imageData.data;
            let transparentPixels = 0;
            const stride = 4 * 4; 
            
            for (let i = 3; i < pixels.length; i += stride) {
                if (pixels[i] < 50) transparentPixels++; 
            }
            
            const percent = (transparentPixels / (pixels.length / stride)) * 100;
            
            if (percent > 45) { // 45% cleared -> trigger reveal
                isRevealed = true;
                revealDay(day);
            }
        }, 100);

        canvas.addEventListener('mousedown', (e) => { isDrawing = true; scratch(e); });
        canvas.addEventListener('mousemove', scratch);
        window.addEventListener('mouseup', () => { isDrawing = false; });
        
        canvas.addEventListener('touchstart', (e) => { isDrawing = true; scratch(e); }, {passive: false});
        canvas.addEventListener('touchmove', scratch, {passive: false});
        window.addEventListener('touchend', () => { isDrawing = false; });
    }

    function revealDay(day) {
        localStorage.setItem(`adventOpenedDay${day}`, 'true');
        const cardWrapper = document.getElementById(`advent-card-${day}`);
        const card = cardWrapper.querySelector('.advent-card');
        
        card.classList.add('cleared');
        
        const grid = document.getElementById('advent-grid');
        grid.classList.add('is-revealing');
        cardWrapper.classList.add('revealed-zoom');
        
        const closeBadge = document.createElement('div');
        closeBadge.className = 'close-reward-badge';
        closeBadge.innerText = 'Нажми чтобы закрыть';
        document.body.appendChild(closeBadge);
        
        const closeHandler = () => {
            grid.classList.remove('is-revealing');
            cardWrapper.classList.remove('revealed-zoom');
            closeBadge.remove();
            card.removeEventListener('click', closeHandler);
        };
        
        setTimeout(() => {
            card.addEventListener('click', closeHandler);
        }, 600); // Wait for zoom animation to end
    }

    function initTiltEffect() {
        const cards = document.querySelectorAll('.advent-card');
        
        const handleMove = (x, y) => {
            const grid = document.getElementById('advent-grid');
            if(grid.classList.contains('is-revealing')) return; // Disable tilt during reveal

            cards.forEach(card => {
                const rect = card.getBoundingClientRect();
                const cardX = rect.left + rect.width / 2;
                const cardY = rect.top + rect.height / 2;
                
                const mouseX = Math.max(-1, Math.min(1, (x - cardX) / (rect.width / 2)));
                const mouseY = Math.max(-1, Math.min(1, (y - cardY) / (rect.height / 2)));
                
                const factor = 12; // tilt amount
                card.style.setProperty('--rotate-y', `${mouseX * factor}deg`);
                card.style.setProperty('--rotate-x', `${mouseY * -factor}deg`);
                
                // Overlay position for holographic effect
                const bgX = Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100));
                const bgY = Math.max(0, Math.min(100, ((y - rect.top) / rect.height) * 100));
                card.style.setProperty('--x', `${bgX}%`);
                card.style.setProperty('--y', `${bgY}%`);
            });
        };

        document.getElementById('advent-modal').addEventListener('mousemove', (e) => {
            handleMove(e.clientX, e.clientY);
        });

        if (window.DeviceOrientationEvent) {
            window.addEventListener('deviceorientation', (e) => {
                if (!e.gamma || !e.beta) return;
                const x = (e.gamma / 45) * window.innerWidth / 2 + window.innerWidth / 2;
                const y = (e.beta / 45) * window.innerHeight / 2 + window.innerHeight / 2;
                handleMove(x, y);
            });
        }
    }

    // Utility
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => { clearTimeout(timeout); func(...args); };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    return {
        openModal: () => {
            document.getElementById('advent-modal').classList.remove('hidden');
            setTimeout(init, 50); // Small delay to ensure layout is computed
        },
        closeModal: () => {
            document.getElementById('advent-modal').classList.add('hidden');
        },
        unlockNextDay: () => {
            if (unlockedDay < 7) {
                unlockedDay++;
                localStorage.setItem('adventUnlockedDay', unlockedDay);
                init();
            } else {
                alert('Все дни уже открыты для теста!');
            }
        }
    };
})();
