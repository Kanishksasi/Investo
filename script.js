/* =============================================
   INVESTO — Scroll Engine v3
   Frame-interpolated Canvas Scrollytelling
   ============================================= */
(function () {
    'use strict';

    // ---- Configuration ----
    // Frames 001→120: 001 = assembled phone, 120 = fully exploded
    // We play them in REVERSE so scroll forward = assemble→explode→reassemble
    const FRAME_DIR = './Video Frame Extractor 2026-05-12 9_45_05 GMT−5/';
    const TOTAL_FRAMES = 120;

    // Phases as 0→1 scroll fractions
    // hero: phone assembled, copy visible
    // explode: phone explodes outward (frames advance)
    // diagram: fully exploded, labels shown
    // reassemble: phone comes back (frames reverse)
    // cta: fully assembled, final CTA
    const PHASES = {
        hero:       [0.00, 0.08],
        explode:    [0.08, 0.38],
        diagram:    [0.40, 0.56],
        reassemble: [0.58, 0.84],
        cta:        [0.86, 1.00]
    };

    // ---- State ----
    const images   = [];
    let canvasReady = false;
    let currentIdx  = 0;       // float, interpolated
    let lastActive  = 'hero';

    // ---- DOM ----
    const canvas       = document.getElementById('frame-canvas');
    const ctx          = canvas.getContext('2d', { alpha: false });
    const section      = document.getElementById('canvas-section');
    const scrollCue    = document.getElementById('scroll-cue');
    const overlayEls   = {
        hero:       document.getElementById('copy-hero'),
        explode:    document.getElementById('copy-explode'),
        diagram:    document.getElementById('copy-diagram'),
        reassemble: document.getElementById('copy-reassemble'),
        cta:        document.getElementById('copy-final-cta')
    };

    // ---- Helpers ----
    function pad3(n) { return String(n).padStart(3, '0'); }

    function lerp(a, b, t) { return a + (b - a) * t; }

    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function phaseT(scrollP, phase) {
        const [s, e] = phase;
        return Math.max(0, Math.min(1, (scrollP - s) / (e - s)));
    }

    function getScrollProgress() {
        const rect  = section.getBoundingClientRect();
        const total = section.offsetHeight - window.innerHeight;
        return Math.max(0, Math.min(1, -rect.top / total));
    }

    // ---- Frame mapping ----
    // idx 0 = frame 001 (assembled), idx 119 = frame 120 (exploded)
    function framePath(i) {
        return FRAME_DIR + pad3(i + 1) + '.png';
    }

    function scrollToFrameIdx(p) {
        const max = TOTAL_FRAMES - 1;
        if (p <= PHASES.hero[1]) {
            return 0;
        }
        if (p <= PHASES.explode[1]) {
            // Ease into full explosion
            return easeInOutCubic(phaseT(p, PHASES.explode)) * max;
        }
        if (p <= PHASES.diagram[1]) {
            return max;
        }
        if (p <= PHASES.reassemble[1]) {
            // Ease back to assembled
            return (1 - easeInOutCubic(phaseT(p, PHASES.reassemble))) * max;
        }
        return 0;
    }

    // ---- Preload with priority ----
    function preload() {
        return new Promise(resolve => {
            let done = 0;
            const total = TOTAL_FRAMES;

            // Load first frame immediately so canvas shows fast
            const first = new Image();
            first.onload = () => {
                images[0] = first;
                resize();
                drawFrame(0);
                overlayEls.hero.classList.add('visible');
                document.body.classList.add('loaded');
                resolve(); // resolve early so RAF can start

                // Load rest in background
                for (let i = 1; i < total; i++) {
                    const img = new Image();
                    img.onload = img.onerror = () => {
                        done++;
                        if (done >= total - 1) canvasReady = true;
                    };
                    img.src = framePath(i);
                    images[i] = img;
                }
            };
            first.onerror = () => { document.body.classList.add('loaded'); resolve(); };
            first.src = framePath(0);
        });
    }

    // ---- Canvas sizing ----
    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap at 2x for perf
        const w = window.innerWidth;
        const h = window.innerHeight;
        canvas.width  = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width  = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (images[0]) drawFrame(currentIdx);
    }

    // ---- Draw: interpolate between two frames for butter-smooth motion ----
    function drawFrame(floatIdx) {
        currentIdx = floatIdx;
        const lo  = Math.floor(floatIdx);
        const hi  = Math.min(lo + 1, TOTAL_FRAMES - 1);
        const t   = floatIdx - lo;

        const imgLo = images[lo];
        const imgHi = images[hi];

        const cw = canvas.width  / (Math.min(window.devicePixelRatio || 1, 2));
        const ch = canvas.height / (Math.min(window.devicePixelRatio || 1, 2));

        ctx.fillStyle = '#080E07';
        ctx.fillRect(0, 0, cw, ch);

        if (!imgLo || !imgLo.complete || !imgLo.naturalWidth) return;

        // Compute contain rect
        const iw = imgLo.naturalWidth;
        const ih = imgLo.naturalHeight;
        const scale = Math.min(cw / iw, ch / ih);
        const dw = iw * scale, dh = ih * scale;
        const dx = (cw - dw) / 2, dy = (ch - dh) / 2;

        // Draw lower frame at full opacity
        ctx.globalAlpha = 1;
        ctx.drawImage(imgLo, dx, dy, dw, dh);

        // Cross-fade upper frame on top if loaded
        if (t > 0 && imgHi && imgHi.complete && imgHi.naturalWidth) {
            ctx.globalAlpha = t;
            ctx.drawImage(imgHi, dx, dy, dw, dh);
            ctx.globalAlpha = 1;
        }
    }

    // ---- Overlay management ----
    function getActiveOverlay(p) {
        if (p < PHASES.explode[0])                              return 'hero';
        if (p < PHASES.diagram[0]  - 0.01)                     return 'explode';
        if (p < PHASES.reassemble[0] - 0.01)                   return 'diagram';
        if (p < PHASES.cta[0]      - 0.01)                     return 'reassemble';
        return 'cta';
    }

    function updateOverlays(p) {
        const active = getActiveOverlay(p);
        if (active !== lastActive) {
            // Hide old
            if (overlayEls[lastActive]) overlayEls[lastActive].classList.remove('visible');
            // Show new
            if (overlayEls[active])    overlayEls[active].classList.add('visible');
            lastActive = active;
        }

        // Scroll cue fades out as soon as user starts scrolling
        if (scrollCue) {
            scrollCue.style.opacity = p < 0.03 ? '1' : p < 0.08 ? String(1 - (p - 0.03) / 0.05) : '0';
        }
    }

    // ---- RAF loop ----
    let rafScheduled = false;
    function tick() {
        rafScheduled = false;
        if (images[0]) {
            const p   = getScrollProgress();
            const idx = scrollToFrameIdx(p);
            drawFrame(idx);
            updateOverlays(p);
        }
        scheduleRaf();
    }

    function scheduleRaf() {
        if (!rafScheduled) {
            rafScheduled = true;
            requestAnimationFrame(tick);
        }
    }

    // ---- Intersection observers for below-canvas elements ----
    function observeSections() {
        const obs = new IntersectionObserver(entries => {
            entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in-view'); });
        }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });

        document.querySelectorAll('.card, .who-card, .pricing-card').forEach(el => obs.observe(el));
    }

    // ---- Nav hide on scroll down ----
    function initNav() {
        const nav = document.getElementById('main-nav');
        let lastY = 0;
        window.addEventListener('scroll', () => {
            const y = window.scrollY;
            if (y > lastY && y > 120) {
                nav.style.transform = 'translateY(-100%)';
            } else {
                nav.style.transform = 'translateY(0)';
            }
            lastY = y;
        }, { passive: true });
    }

    // ---- Init ----
    function init() {
        resize();
        window.addEventListener('resize', () => { resize(); }, { passive: true });

        preload().then(() => {
            canvasReady = true;
            scheduleRaf();
            observeSections();
            initNav();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
