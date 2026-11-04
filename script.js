/* =============================================
   INVESTO — Site behaviour
   1. Sequence stage: three resting beats (overview → feature diagram → download)
      played on a contained canvas. Autoplays only while the stage is on screen,
      pauses on hover/focus, and hands control to the visitor the moment they
      touch a dot or arrow. Page scrolling is never intercepted.
   2. Navigation (hide on scroll, mobile menu, reading progress)
   3. Progressive enhancements: reveal-on-scroll, stat count-up, FAQ, quiz, phone bar
   ============================================= */
(function () {
    'use strict';

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const saveData     = !!(navigator.connection && navigator.connection.saveData);

    /* =========================================================
       1. SEQUENCE STAGE
       ========================================================= */
    // Phones get a 960×540 set (~5.5MB vs ~35MB). Must match the media-conditional
    // preloads in index.html so the two resting frames are reused from cache.
    const FRAME_DIR    = window.matchMedia('(max-width: 820px)').matches ? './frames-webp-m/' : './frames-webp/';
    const FRAME_EXT    = '.webp';
    const TOTAL_FRAMES = 120;
    const LAST         = TOTAL_FRAMES - 1;
    const TRANSITION_MS = 2600;   // full frame scrub between beats
    const XFADE_MS      = 650;    // fallback when the in-between frames aren't loaded

    const BEATS = [
        { frame: 0,    overlay: 'explode', holdMs: 5200 },
        { frame: LAST, overlay: 'diagram', holdMs: 7800 },
        { frame: 0,    overlay: 'cta',     holdMs: Infinity }
    ];

    // Below 820px the captions sit under the stage instead of over it (see styles.css)
    const stackedLayout = window.matchMedia('(max-width: 820px)');
    const stage    = document.getElementById('stage');
    const overlayBox = document.getElementById('stage-overlays');
    const canvas   = document.getElementById('frame-canvas');
    const overlays = {
        explode: document.getElementById('copy-explode'),
        diagram: document.getElementById('copy-diagram'),
        cta:     document.getElementById('copy-final-cta')
    };
    const dots     = Array.prototype.slice.call(document.querySelectorAll('.beat-dot'));
    const prevBtn  = document.getElementById('beat-prev');
    const nextBtn  = document.getElementById('beat-next');
    const section  = document.getElementById('canvas-section');

    const images   = [];
    let loadedCount = 0;
    let restReady   = false;      // frames 0 and LAST drawn — the stage can show a beat
    let allLoading  = false;
    let ctx         = null;

    let currentBeat   = 0;
    let currentFrame  = 0;
    let transitioning = false;
    let rafId         = null;
    let holdTimer     = null;
    let userControls  = false;    // once the visitor steps manually, autoplay stays off
    let inView        = false;
    let hovering      = false;
    let focused       = false;

    function framePath(i) { return FRAME_DIR + String(i + 1).padStart(3, '0') + FRAME_EXT; }
    function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

    function loadImage(i) {
        return new Promise(resolve => {
            if (images[i]) { resolve(images[i]); return; }
            const img = new Image();
            img.decoding = 'async';
            img.onload  = () => { images[i] = img; loadedCount++; resolve(img); };
            img.onerror = () => resolve(null);
            img.src = framePath(i);
        });
    }

    // ---- Canvas sizing & drawing ----
    function resizeCanvas() {
        if (!canvas || !ctx || !stage) return;
        const w = stage.clientWidth, h = stage.clientHeight;
        if (!w || !h) return;
        // Never allocate more backing pixels than the 1920px source can fill
        const dpr = Math.min(window.devicePixelRatio || 1, 2, 1920 / w);
        canvas.width  = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawFrame(currentFrame);
    }

    function fit(img, cw, ch) {
        const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight); // cover: stage is already 16:9
        const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
        return [(cw - dw) / 2, (ch - dh) / 2, dw, dh];
    }

    function drawFrame(floatIdx) {
        if (!ctx) return;
        const idx = Math.round(Math.max(0, Math.min(LAST, floatIdx)));
        const img = images[idx];
        const cw = stage.clientWidth, ch = stage.clientHeight;
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#080E07';
        ctx.fillRect(0, 0, cw, ch);
        if (!img || !img.naturalWidth) return;
        const r = fit(img, cw, ch);
        ctx.drawImage(img, r[0], r[1], r[2], r[3]);
    }

    function drawBlend(a, b, t) {
        if (!ctx) return;
        const cw = stage.clientWidth, ch = stage.clientHeight;
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#080E07';
        ctx.fillRect(0, 0, cw, ch);
        const ia = images[a], ib = images[b];
        if (ia && ia.naturalWidth) { ctx.globalAlpha = 1; const r = fit(ia, cw, ch); ctx.drawImage(ia, r[0], r[1], r[2], r[3]); }
        if (ib && ib.naturalWidth) { ctx.globalAlpha = t; const r = fit(ib, cw, ch); ctx.drawImage(ib, r[0], r[1], r[2], r[3]); }
        ctx.globalAlpha = 1;
    }

    // ---- Overlays, dots, arrows ----
    function setOverlay(key, transit) {
        Object.keys(overlays).forEach(k => {
            const el = overlays[k];
            if (!el) return;
            el.classList.toggle('visible', k === key);
            el.classList.toggle('is-transit', k === key && !!transit);
        });
        syncCaptionHeight();
    }

    // Stacked layout: the caption area follows the active beat's height instead of
    // reserving room for the tallest one, and eases between the two sizes.
    function syncCaptionHeight() {
        if (!overlayBox) return;
        if (!stackedLayout.matches) { overlayBox.style.height = ''; return; }
        const active = Object.keys(overlays).map(k => overlays[k]).find(el => el && el.classList.contains('visible'));
        overlayBox.style.height = active ? active.offsetHeight + 'px' : '0px';
    }

    function updateControls(activeIdx) {
        dots.forEach(dot => {
            const on = Number(dot.dataset.beat) === activeIdx;
            dot.classList.toggle('active', on);
            dot.setAttribute('aria-selected', on ? 'true' : 'false');
            dot.tabIndex = on ? 0 : -1;
        });
        if (prevBtn) prevBtn.disabled = activeIdx === 0;
        if (nextBtn) nextBtn.disabled = activeIdx === BEATS.length - 1;
    }

    // ---- Autoplay ----
    function clearHold() { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } }
    function autoplayAllowed() {
        return !userControls && inView && !hovering && !focused && !reduceMotion.matches && document.visibilityState === 'visible';
    }
    function scheduleHold() {
        clearHold();
        const beat = BEATS[currentBeat];
        if (beat.holdMs === Infinity || !autoplayAllowed() || transitioning) return;
        holdTimer = setTimeout(() => {
            if (autoplayAllowed() && currentBeat < BEATS.length - 1) goToBeat(currentBeat + 1, false);
        }, beat.holdMs);
    }

    // ---- Beat transitions ----
    function goToBeat(targetIdx, byUser) {
        if (targetIdx < 0 || targetIdx >= BEATS.length) return;
        if (byUser) userControls = true;
        clearHold();
        if (targetIdx === currentBeat && !transitioning) { scheduleHold(); return; }
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

        const forward    = targetIdx > currentBeat;
        const from       = BEATS[currentBeat];
        const startFrame = currentFrame;
        const endFrame   = BEATS[targetIdx].frame;
        const target     = BEATS[targetIdx];
        const canScrub   = restReady && loadedCount >= TOTAL_FRAMES && !reduceMotion.matches;
        const sameFrame  = Math.round(startFrame) === endFrame;
        const scrubMs    = stackedLayout.matches ? 1800 : TRANSITION_MS;
        const duration   = reduceMotion.matches ? 0 : (sameFrame ? 0 : (canScrub ? scrubMs : XFADE_MS));

        transitioning = true;
        currentBeat = targetIdx;              // state is the destination, so controls never lie
        updateControls(targetIdx);

        // During the frames' move: the reassemble statement rides on top of the explode-out,
        // otherwise the current caption stays put — except the download panel's scrim, which
        // would hide the animation when it sits over the stage.
        if (target.overlay === 'cta' && forward && duration > 0) setOverlay('cta', true);
        else if (from.overlay === 'cta' && !stackedLayout.matches) setOverlay(null);

        const finish = () => {
            rafId = null;
            transitioning = false;
            currentFrame = endFrame;
            drawFrame(endFrame);
            setOverlay(target.overlay, false);
            scheduleHold();
        };

        if (duration === 0) { finish(); return; }

        const t0 = performance.now();
        const a  = Math.round(startFrame);
        function step(now) {
            const t = Math.min(1, (now - t0) / duration);
            if (canScrub) {
                currentFrame = startFrame + (endFrame - startFrame) * easeInOutCubic(t);
                drawFrame(currentFrame);
            } else {
                drawBlend(a, endFrame, easeInOutCubic(t));
            }
            if (t < 1) rafId = requestAnimationFrame(step);
            else finish();
        }
        rafId = requestAnimationFrame(step);
    }

    // ---- Loading ----
    function loadRestFrames() {
        return Promise.all([loadImage(0), loadImage(LAST)]).then(() => {
            if (!images[0]) return;                       // keep the <picture> fallback visible
            restReady = true;
            resizeCanvas();
            drawFrame(BEATS[currentBeat].frame);
            stage.classList.add('is-drawn');
        });
    }

    function loadAllFrames() {
        if (allLoading || saveData || reduceMotion.matches) return;
        allLoading = true;
        const queue = [];
        for (let i = 1; i < LAST; i++) queue.push(i);
        const CONCURRENCY = 6;
        function next() {
            if (!queue.length) return Promise.resolve();
            return loadImage(queue.shift()).then(next);
        }
        const workers = [];
        for (let k = 0; k < CONCURRENCY; k++) workers.push(next());
    }

    function initStage() {
        if (!stage || !canvas) return;
        ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        setOverlay(BEATS[0].overlay, false);
        updateControls(0);

        dots.forEach(dot => dot.addEventListener('click', () => goToBeat(Number(dot.dataset.beat), true)));
        if (prevBtn) prevBtn.addEventListener('click', () => goToBeat(currentBeat - 1, true));
        if (nextBtn) nextBtn.addEventListener('click', () => goToBeat(currentBeat + 1, true));

        const dotList = document.getElementById('beat-dots');
        if (dotList) {
            dotList.addEventListener('keydown', e => {
                let target = null;
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') target = Math.min(BEATS.length - 1, currentBeat + 1);
                else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') target = Math.max(0, currentBeat - 1);
                else if (e.key === 'Home') target = 0;
                else if (e.key === 'End') target = BEATS.length - 1;
                if (target === null) return;
                e.preventDefault();
                goToBeat(target, true);
                if (dots[target]) dots[target].focus();
            });
        }

        // Pause while the pointer or keyboard focus is on the stage
        const host = document.getElementById('canvas-sticky') || stage;
        host.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { hovering = true; clearHold(); } });
        host.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { hovering = false; scheduleHold(); } });
        host.addEventListener('focusin',  () => { focused = true; clearHold(); });
        host.addEventListener('focusout', () => { focused = false; scheduleHold(); });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') scheduleHold(); else clearHold();
        });

        if ('ResizeObserver' in window) {
            new ResizeObserver(resizeCanvas).observe(stage);
            const ro = new ResizeObserver(syncCaptionHeight);
            Object.keys(overlays).forEach(k => { if (overlays[k]) ro.observe(overlays[k]); });
        } else {
            window.addEventListener('resize', () => { resizeCanvas(); syncCaptionHeight(); }, { passive: true });
        }
        const onLayoutChange = () => syncCaptionHeight();
        if (stackedLayout.addEventListener) stackedLayout.addEventListener('change', onLayoutChange); else stackedLayout.addListener(onLayoutChange);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncCaptionHeight);
        // Enable the height easing only after the first measurement, so load doesn't animate
        requestAnimationFrame(() => { if (overlayBox) overlayBox.classList.add('is-measured'); });

        if ('IntersectionObserver' in window) {
            // Autoplay only while at least half the stage is on screen
            new IntersectionObserver(([e]) => {
                inView = e.isIntersecting;
                if (inView) scheduleHold(); else clearHold();
            }, { threshold: 0.5 }).observe(stage);
            // Fetch the in-between frames once the stage is about a screen away
            const near = new IntersectionObserver(([e]) => {
                if (e.isIntersecting) { loadAllFrames(); near.disconnect(); }
            }, { rootMargin: '120% 0px' });
            near.observe(stage);
        } else {
            inView = true;
            window.addEventListener('load', loadAllFrames);
        }

        loadRestFrames().then(() => scheduleHold());
    }

    /* =========================================================
       2. NAVIGATION
       ========================================================= */
    function initNav() {
        const nav      = document.getElementById('main-nav');
        const progress = document.getElementById('scroll-progress');
        const menuBtn  = document.getElementById('nav-menu-btn');
        const menu     = document.getElementById('nav-menu');
        if (!nav) return;
        let lastY = window.scrollY;
        let queued = false;

        function menuOpen() { return menu && !menu.hidden; }
        function setMenu(open) {
            if (!menu || !menuBtn) return;
            menu.hidden = !open;
            menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
            menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
            if (open) nav.classList.remove('nav--hidden');
        }

        function paint() {
            queued = false;
            const y = window.scrollY;
            if (!menuOpen()) nav.classList.toggle('nav--hidden', y > lastY && y > 140);
            lastY = y;
            if (progress) {
                const max = document.documentElement.scrollHeight - window.innerHeight;
                progress.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';
            }
        }
        window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(paint); } }, { passive: true });
        paint();

        if (menuBtn && menu) {
            menuBtn.addEventListener('click', () => setMenu(!menuOpen()));
            menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
            document.addEventListener('keydown', e => { if (e.key === 'Escape' && menuOpen()) { setMenu(false); menuBtn.focus(); } });
            document.addEventListener('click', e => { if (menuOpen() && !nav.contains(e.target)) setMenu(false); });
            const wide = window.matchMedia('(min-width: 901px)');
            const onWide = () => { if (wide.matches) setMenu(false); };
            if (wide.addEventListener) wide.addEventListener('change', onWide); else wide.addListener(onWide);
        }
    }

    /* =========================================================
       3. ENHANCEMENTS
       ========================================================= */
    // Reveal on scroll — content is visible by default; this only adds the entrance.
    function initReveal() {
        const els = document.querySelectorAll('.reveal');
        if (!els.length) return;
        const showAll = () => els.forEach(el => el.classList.add('in-view'));
        if (!('IntersectionObserver' in window) || reduceMotion.matches) { showAll(); return; }
        const obs = new IntersectionObserver(entries => {
            entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in-view'); obs.unobserve(e.target); } });
        }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });
        els.forEach(el => obs.observe(el));
        // Safety net: nothing stays hidden if the observer never fires
        setTimeout(showAll, 2500);
    }

    // Stat counters — the final values are in the HTML; this just counts up to them once.
    function initStatCounters() {
        const nums = document.querySelectorAll('.stat-num[data-count-to]');
        if (!nums.length || !('IntersectionObserver' in window) || reduceMotion.matches) return;

        function animate(el) {
            const target = parseInt(el.dataset.countTo, 10);
            const suffix = el.dataset.suffix || '';
            if (isNaN(target)) return;
            const duration = 1100;
            const t0 = performance.now();
            function step(now) {
                const t = Math.min(1, (now - t0) / duration);
                const eased = 1 - Math.pow(1 - t, 3);
                el.textContent = (t < 1 ? Math.round(target * eased) : target) + suffix;
                if (t < 1) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        }
        const obs = new IntersectionObserver(entries => {
            entries.forEach(e => { if (e.isIntersecting) { animate(e.target); obs.unobserve(e.target); } });
        }, { threshold: 0.4 });
        nums.forEach(el => obs.observe(el));
    }

    // FAQ accordion — single open item, proper expanded state
    function initFAQ() {
        const buttons = document.querySelectorAll('.faq-question');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const item = btn.closest('.faq-item');
                const isOpen = btn.getAttribute('aria-expanded') === 'true';
                buttons.forEach(other => {
                    other.setAttribute('aria-expanded', 'false');
                    const oi = other.closest('.faq-item');
                    if (oi) oi.classList.remove('open');
                });
                if (!isOpen) {
                    btn.setAttribute('aria-expanded', 'true');
                    if (item) item.classList.add('open');
                }
            });
        });
    }

    // Interactive demo — Daily Challenge quiz
    function initDemoQuiz() {
        const options  = document.querySelectorAll('.demo-option');
        const feedback = document.getElementById('demo-feedback');
        if (!options.length || !feedback) return;

        options.forEach(btn => {
            btn.addEventListener('click', () => {
                const wasCorrect = btn.dataset.correct === 'true';
                options.forEach(opt => {
                    opt.disabled = true;
                    if (opt.dataset.correct === 'true') opt.classList.add('is-correct');
                    else if (opt === btn) opt.classList.add('is-incorrect');
                });
                feedback.textContent = wasCorrect
                    ? '+35 XP — nice! That\'s exactly the kind of call the app helps you build a habit around.'
                    : 'Not quite — the highlighted answer is the one that keeps your safety net intact while still letting you enjoy some of it.';
            }, { once: true });
        });
    }

    // Phone download bar — shown once past the hero, hidden while a section that
    // already has store buttons (Download, footer) is on screen.
    function initGetBar() {
        const bar  = document.getElementById('get-bar');
        const hero = document.getElementById('hero');
        if (!bar || !hero || !('IntersectionObserver' in window)) return;
        const covering = new Set();
        let pastHero = false;
        const sync = () => bar.classList.toggle('show', pastHero && covering.size === 0);

        new IntersectionObserver(([e]) => {
            pastHero = !e.isIntersecting && e.boundingClientRect.top < 0;
            sync();
        }).observe(hero);

        const io = new IntersectionObserver(entries => {
            entries.forEach(e => e.isIntersecting ? covering.add(e.target) : covering.delete(e.target));
            sync();
        });
        ['download', 'footer'].forEach(id => { const el = document.getElementById(id); if (el) io.observe(el); });
    }

    // ---- Init ----
    function init() {
        initNav();
        initReveal();
        initStatCounters();
        initFAQ();
        initDemoQuiz();
        initGetBar();
        initStage();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
