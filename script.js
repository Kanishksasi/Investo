/* =============================================
   INVESTO — Beat Engine v6
   Autoplays through key story beats (hero → full
   diagram → CTA), pausing on each. Scroll up/down
   at any time to step manually between beats.
   ============================================= */
(function () {
    'use strict';

    // ---- Configuration ----
    const FRAME_DIR    = './frames-webp/';
    const FRAME_EXT    = '.webp';
    const TOTAL_FRAMES = 120;

    // How long a hero→diagram or diagram→cta transition takes to animate.
    const TRANSITION_MS = 3800;

    // Source frames are 1920×1080 — capping DPR at 2 was pushing the canvas backing
    // store past the source resolution on many retina laptops (pure upscale, no
    // quality gain, just wasted compositing work). 1.5 stays crisp and is cheaper.
    const DPR_CAP = 1.5;

    // The story beats: each is a resting point the sequence pauses on.
    // holdMs: how long to hold before auto-advancing (Infinity = stay).
    const BEATS = [
        { key: 'hero',     frame: 0,                 overlay: 'hero',       holdMs: 1800 },
        { key: 'diagram',  frame: TOTAL_FRAMES - 1,   overlay: 'diagram',    holdMs: 3400 },
        { key: 'cta',      frame: 0,                  overlay: 'cta',        holdMs: Infinity }
    ];
    // Overlay shown *during* the forward transition into a given beat index.
    const FORWARD_TRANSIT_OVERLAY = { 1: 'explode', 2: 'reassemble' };

    // ---- State ----
    const images        = [];
    let framesLoaded     = 0;
    let rafId            = null;
    let holdTimerId       = null;
    let currentFrame     = 0;     // float frame position currently drawn
    let currentBeatIdx   = 0;
    let lastOverlay      = null;
    let isTransitioning  = false;
    let ready            = false;
    let lastWheelTime    = 0;

    // ---- DOM ----
    const canvas     = document.getElementById('frame-canvas');
    // desynchronized:true lets the browser composite the canvas without waiting
    // for the main-thread vsync — removes one frame of latency on supported browsers
    const ctx        = canvas.getContext('2d', { alpha: false, desynchronized: true });
    const scrollCue  = document.getElementById('scroll-cue');
    const beatDots   = document.querySelectorAll('.beat-dot');
    const overlayEls = {
        hero:       document.getElementById('copy-hero'),
        explode:    document.getElementById('copy-explode'),
        diagram:    document.getElementById('copy-diagram'),
        reassemble: document.getElementById('copy-reassemble'),
        cta:        document.getElementById('copy-final-cta')
    };

    // ---- Helpers ----
    function pad3(n) { return String(n).padStart(3, '0'); }
    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    function framePath(i) { return FRAME_DIR + pad3(i + 1) + FRAME_EXT; }

    // ---- Preload ----
    function preload() {
        return new Promise(resolve => {
            const first = new Image();
            first.onload = () => {
                images[0] = first;
                framesLoaded = 1;
                resize();
                drawFrame(0);
                document.body.classList.add('loaded');

                let remaining = TOTAL_FRAMES - 1;
                if (remaining <= 0) { resolve(); return; }

                for (let i = 1; i < TOTAL_FRAMES; i++) {
                    (function (idx) {
                        const img = new Image();
                        img.onload  = () => { images[idx] = img; framesLoaded++; settle(); };
                        img.onerror = () => { settle(); };
                        img.src = framePath(idx);
                    })(i);
                }

                function settle() {
                    remaining--;
                    if (remaining <= 0) resolve();
                }
            };
            first.onerror = () => { document.body.classList.add('loaded'); resolve(); };
            first.src = framePath(0);
        });
    }

    // ---- Canvas sizing ----
    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
        const w   = window.innerWidth;
        const h   = window.innerHeight;
        canvas.width  = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width  = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (images[0]) drawFrame(currentFrame);
    }

    // ---- Draw — single crisp frame, no cross-fade ----
    // (Cross-fading two adjacent frames caused ghosting/glitching on fast-moving
    //  thin elements like the green connector lines during the explode/rotate beat.)
    function drawFrame(floatIdx) {
        const idx = Math.round(Math.max(0, Math.min(TOTAL_FRAMES - 1, floatIdx)));
        const img = images[idx];

        const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
        const cw  = canvas.width  / dpr;
        const ch  = canvas.height / dpr;

        ctx.fillStyle = '#080E07';
        ctx.fillRect(0, 0, cw, ch);

        if (!img || !img.complete || !img.naturalWidth) return;

        // Contain-fit the image
        const iw    = img.naturalWidth;
        const ih    = img.naturalHeight;
        const scale = Math.min(cw / iw, ch / ih);
        const dw    = iw * scale, dh = ih * scale;
        const dx    = (cw - dw) / 2,  dy = (ch - dh) / 2;

        ctx.globalAlpha = 1;
        ctx.drawImage(img, dx, dy, dw, dh);
    }

    // ---- Overlay management ----
    function setOverlay(key) {
        if (key === lastOverlay) return;
        if (lastOverlay && overlayEls[lastOverlay]) overlayEls[lastOverlay].classList.remove('visible');
        if (key && overlayEls[key]) overlayEls[key].classList.add('visible');
        lastOverlay = key;
    }

    function updateScrollCue() {
        if (!scrollCue) return;
        scrollCue.style.opacity = (currentBeatIdx === 0 && !isTransitioning) ? '1' : '0';
    }

    function updateBeatDots(activeIdx) {
        beatDots.forEach(dot => {
            dot.classList.toggle('active', Number(dot.dataset.beat) === activeIdx);
        });
    }

    function initBeatDots() {
        beatDots.forEach(dot => {
            dot.addEventListener('click', () => goToBeat(Number(dot.dataset.beat)));
        });
    }

    // ---- Beat transitions ----
    function clearHoldTimer() {
        if (holdTimerId) { clearTimeout(holdTimerId); holdTimerId = null; }
    }

    function scheduleHold() {
        clearHoldTimer();
        const beat = BEATS[currentBeatIdx];
        if (beat.holdMs === Infinity) return;
        holdTimerId = setTimeout(() => {
            if (currentBeatIdx < BEATS.length - 1) goToBeat(currentBeatIdx + 1);
        }, beat.holdMs);
    }

    function goToBeat(targetIdx) {
        if (targetIdx < 0 || targetIdx >= BEATS.length) return;
        if (targetIdx === currentBeatIdx && !isTransitioning) return;
        if (!ready) return;

        clearHoldTimer();
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

        const forward     = targetIdx > currentBeatIdx;
        const startFrame  = currentFrame;
        const endFrame    = BEATS[targetIdx].frame;
        const transitOverlay = forward ? (FORWARD_TRANSIT_OVERLAY[targetIdx] || null) : null;

        isTransitioning = true;
        setOverlay(transitOverlay);
        updateScrollCue();
        updateBeatDots(targetIdx);

        const startTime = performance.now();
        function step(now) {
            const t = Math.min(1, (now - startTime) / TRANSITION_MS);
            const eased = easeInOutCubic(t);
            currentFrame = startFrame + (endFrame - startFrame) * eased;
            drawFrame(currentFrame);

            if (t < 1) {
                rafId = requestAnimationFrame(step);
            } else {
                rafId = null;
                isTransitioning = false;
                currentBeatIdx = targetIdx;
                currentFrame = endFrame;
                setOverlay(BEATS[targetIdx].overlay);
                updateScrollCue();
                scheduleHold();
            }
        }
        rafId = requestAnimationFrame(step);
    }

    // ---- Scroll navigation — step between beats, no scroll-jacking ----
    function initWheelNav() {
        window.addEventListener('wheel', e => {
            if (!ready) return;
            const now = performance.now();
            if (now - lastWheelTime < 700) return;      // debounce one step per gesture
            if (Math.abs(e.deltaY) < 15) return;         // ignore tiny trackpad noise

            if (e.deltaY < 0 && currentBeatIdx > 0) {
                lastWheelTime = now;
                goToBeat(currentBeatIdx - 1);
            } else if (e.deltaY > 0 && currentBeatIdx < BEATS.length - 1) {
                lastWheelTime = now;
                goToBeat(currentBeatIdx + 1);
            }
        }, { passive: true });
    }

    // ---- Touch navigation (mobile) — swipe up/down to step between beats ----
    function initTouchNav() {
        const section = document.getElementById('canvas-section');
        if (!section) return;
        let touchStartY = null;
        let touchStartedInScrollableList = false;

        section.addEventListener('touchstart', e => {
            touchStartY = e.touches[0].clientY;
            // The diagram beat's feature list can scroll internally on short phone
            // screens — let that gesture scroll the list instead of changing beats.
            touchStartedInScrollableList = !!e.target.closest('.diagram-grid');
        }, { passive: true });

        section.addEventListener('touchend', e => {
            if (touchStartY === null || !ready || touchStartedInScrollableList) {
                touchStartY = null;
                touchStartedInScrollableList = false;
                return;
            }
            const touchEndY = e.changedTouches[0].clientY;
            const deltaY = touchStartY - touchEndY; // positive = swiped up
            touchStartY = null;

            const now = performance.now();
            if (now - lastWheelTime < 700) return;
            if (Math.abs(deltaY) < 40) return; // require a deliberate swipe

            if (deltaY > 0 && currentBeatIdx < BEATS.length - 1) {
                // swiped up — same gesture as scrolling down
                lastWheelTime = now;
                goToBeat(currentBeatIdx + 1);
            } else if (deltaY < 0 && currentBeatIdx > 0) {
                // swiped down — same gesture as scrolling up
                lastWheelTime = now;
                goToBeat(currentBeatIdx - 1);
            }
        }, { passive: true });
    }

    // ---- Intersection observers for below-canvas elements ----
    function observeSections() {
        const obs = new IntersectionObserver(entries => {
            entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in-view'); });
        }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });
        document.querySelectorAll('.card, .who-card, .pricing-card, .step, .demo-card')
            .forEach(el => obs.observe(el));
    }

    // ---- Animated stat counters ----
    function initStatCounters() {
        const nums = document.querySelectorAll('.stat-num');
        if (!nums.length) return;

        function animateCount(el) {
            const target = parseInt(el.dataset.countTo, 10) || 0;
            const suffix = el.dataset.suffix || '';
            const duration = 1200;
            const startTime = performance.now();

            function step(now) {
                const t = Math.min(1, (now - startTime) / duration);
                const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
                el.textContent = Math.round(target * eased) + suffix;
                if (t < 1) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        }

        const obs = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (e.isIntersecting) {
                    animateCount(e.target);
                    obs.unobserve(e.target);
                }
            });
        }, { threshold: 0.5 });
        nums.forEach(el => obs.observe(el));
    }

    // ---- FAQ accordion ----
    function initFAQ() {
        document.querySelectorAll('.faq-question').forEach(btn => {
            const answer = btn.nextElementSibling;
            btn.addEventListener('click', () => {
                const isOpen = btn.getAttribute('aria-expanded') === 'true';

                // Close any other open items for a clean single-open accordion
                document.querySelectorAll('.faq-question[aria-expanded="true"]').forEach(other => {
                    if (other !== btn) {
                        other.setAttribute('aria-expanded', 'false');
                        other.nextElementSibling.style.maxHeight = null;
                    }
                });

                btn.setAttribute('aria-expanded', String(!isOpen));
                answer.style.maxHeight = isOpen ? null : answer.scrollHeight + 'px';
            });
        });
    }

    // ---- Interactive demo — Daily Challenge quiz ----
    function initDemoQuiz() {
        const options  = document.querySelectorAll('.demo-option');
        const feedback = document.getElementById('demo-feedback');
        if (!options.length || !feedback) return;

        options.forEach(btn => {
            btn.addEventListener('click', () => {
                const wasCorrect = btn.dataset.correct === 'true';

                options.forEach(opt => {
                    opt.disabled = true;
                    if (opt.dataset.correct === 'true') {
                        opt.classList.add('is-correct');
                    } else if (opt === btn) {
                        opt.classList.add('is-incorrect');
                    }
                });

                feedback.textContent = wasCorrect
                    ? '+35 XP — nice! That\'s exactly the kind of call the app helps you build a habit around.'
                    : 'Not quite — the highlighted answer is the one that keeps your safety net intact while still letting you enjoy some of it.';
            }, { once: true });
        });
    }

    // ---- Nav hide on scroll down ----
    function initNav() {
        const nav = document.getElementById('main-nav');
        let lastY = 0;
        window.addEventListener('scroll', () => {
            const y = window.scrollY;
            nav.style.transform = (y > lastY && y > 120) ? 'translateY(-100%)' : 'translateY(0)';
            lastY = y;
        }, { passive: true });
    }

    // ---- Init ----
    function init() {
        resize();
        window.addEventListener('resize', resize, { passive: true });

        observeSections();
        initNav();
        initWheelNav();
        initTouchNav();
        initStatCounters();
        initFAQ();
        initDemoQuiz();
        initBeatDots();
        updateBeatDots(0);

        preload().then(() => {
            ready = true;
            setOverlay('hero');
            updateScrollCue();
            scheduleHold(); // start the hero hold → auto-advance timeline
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
