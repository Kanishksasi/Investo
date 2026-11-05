/* =============================================
   INVESTO — Site behaviour
   1. Cinematic hero: on large screens the hero pins while the scroll position
      plays the sequence (headline → the card with the real app and its callouts
      → the download ask). Scrolling is never intercepted; it only drives the
      timeline. Smaller screens, reduced motion and no-JS get a plain stack.
   2. Motion footer: curtain reveal, scroll-linked parallax, magnetic pills.
   3. Navigation (hide on scroll, mobile menu, reading progress)
   4. Enhancements: reveal-on-scroll, stat count-up, FAQ, quiz, phone bar
   ============================================= */
(function () {
    'use strict';

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer  = window.matchMedia('(hover: hover) and (pointer: fine)');
    const onMQ = (mq, fn) => { if (mq.addEventListener) mq.addEventListener('change', fn); else mq.addListener(fn); };

    const clamp01 = v => Math.max(0, Math.min(1, v));
    const seg = (p, a, b, ease) => { const t = clamp01((p - a) / (b - a)); return ease ? ease(t) : t; };
    const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const easeInCubic    = t => t * t * t;
    const easeOutQuart   = t => 1 - Math.pow(1 - t, 4);
    const easeOutExpo    = t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    const easeInOutExpo  = t => t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
    const easeOutBack    = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

    /* =========================================================
       1. CINEMATIC HERO
       ========================================================= */
    function initCinematicHero() {
        const hero  = document.getElementById('hero');
        const pin   = document.getElementById('cine-pin');
        if (!hero || !pin) return;
        const text  = document.getElementById('copy-hero');
        const cta   = document.getElementById('copy-final-cta');
        const card  = document.getElementById('cine-card');
        const phone = document.getElementById('cine-phone');
        const phoneImg = document.getElementById('cine-phone-img');
        const copy  = document.getElementById('copy-explode');
        const brand = document.getElementById('cine-brand');
        const cue   = document.getElementById('scroll-cue');
        const nodes = Array.prototype.slice.call(document.querySelectorAll('#copy-diagram .diagram-node'));
        if (!text || !cta || !card || !phone || !copy || !brand) return;

        const SCROLL_VH = 3.8;               // how many viewport heights the sequence takes
        const mq = window.matchMedia('(min-width: 1024px) and (min-height: 640px)');
        let active = false, target = 0, shown = 0, raf = null, vh = window.innerHeight;

        function progressFromScroll() {
            const top = hero.getBoundingClientRect().top + window.scrollY;
            return clamp01((window.scrollY - top) / (vh * SCROLL_VH));
        }

        function apply(p) {
            // Headline recedes
            const t1 = seg(p, 0, 0.18, easeInOutCubic);
            text.style.transform = 'scale(' + (1 + 0.15 * t1) + ')';
            text.style.filter = 'blur(' + (20 * t1) + 'px)';
            text.style.opacity = String(1 - 0.8 * t1);
            text.style.visibility = p >= 0.66 ? 'hidden' : 'visible';
            text.style.pointerEvents = p > 0.06 ? 'none' : '';
            if (cue) { cue.style.visibility = p > 0.06 ? 'hidden' : ''; }

            // Card rises, fills the screen, later pulls back and leaves
            const rise   = seg(p, 0.00, 0.20, easeInOutCubic);
            const expand = seg(p, 0.18, 0.30, easeInOutCubic);
            const pull   = seg(p, 0.72, 0.83, easeInOutExpo);
            const fly    = seg(p, 0.83, 0.95, easeInCubic);
            const size   = 85 + 15 * expand - 15 * pull;
            const radius = 40 * (1 - expand) + 40 * pull;
            const cardY  = (vh + 200) * (1 - rise) - (vh + 300) * fly;
            card.style.transform = 'translate3d(0,' + cardY.toFixed(1) + 'px,0)';
            card.style.width = size + 'vw';
            card.style.height = size + 'vh';
            card.style.borderRadius = radius + 'px';
            card.style.opacity = String(1 - 0.6 * pull);   // the ask shows through as the card steps back
            card.style.visibility = p >= 0.999 ? 'hidden' : 'visible';

            // Inside the card: phone, callouts, tagline, brand
            const out = seg(p, 0.66, 0.73, easeInCubic);
            const m   = seg(p, 0.22, 0.42, easeOutExpo);
            phone.style.opacity = String(m * (1 - out));
            phone.style.transform =
                'translateY(' + (300 * (1 - m) - 40 * out) + 'px) translateZ(' + (-500 * (1 - m) - 200 * out) + 'px) ' +
                'rotateX(' + (50 * (1 - m)) + 'deg) rotateY(' + (-30 * (1 - m)) + 'deg) scale(' + ((0.6 + 0.4 * m) * (1 - 0.1 * out)) + ')';
            nodes.forEach((n, i) => {
                const ni = seg(p, 0.30 + i * 0.025, 0.44 + i * 0.025, easeOutBack);
                n.style.opacity = String(clamp01(ni) * (1 - out));
                n.style.transform = 'translateY(' + (100 * (1 - ni) - 40 * out) + 'px) scale(' + ((0.7 + 0.3 * ni) * (1 - 0.1 * out)) + ') rotate(' + (-10 * (1 - ni)) + 'deg)';
            });
            const c = seg(p, 0.40, 0.52, easeOutQuart);
            copy.style.opacity = String(c * (1 - out));
            copy.style.transform = 'translate(' + (-50 * (1 - c)) + 'px,' + (-40 * out) + 'px)';
            brand.style.opacity = String(c * (1 - out));
            brand.style.transform = 'translateX(' + (50 * (1 - c)) + 'px) scale(' + (0.8 + 0.2 * c) + ')';

            // The closing ask waits behind the card, then is uncovered
            const show = p >= 0.66;
            cta.style.visibility = show ? 'visible' : 'hidden';
            cta.style.opacity = show ? '1' : '0';
            cta.style.transform = 'scale(' + (0.8 + 0.2 * pull) + ')';
            cta.style.filter = 'blur(' + (30 * (1 - pull)) + 'px)';
            cta.style.pointerEvents = p > 0.9 ? 'auto' : 'none';
        }

        function clearStyles() {
            [text, cta, card, phone, copy, brand, cue].concat(nodes).forEach(el => { if (el) el.removeAttribute('style'); });
            if (phoneImg) phoneImg.removeAttribute('style');
            hero.style.removeProperty('--cine-scroll');
        }

        function tick() {
            raf = null;
            const d = target - shown;
            if (Math.abs(d) < 0.0005) { shown = target; apply(shown); return; }
            shown += d * 0.16;                 // soft scrub, like a 1s lag
            apply(shown);
            raf = requestAnimationFrame(tick);
        }
        function onScroll() {
            if (!active) return;
            target = progressFromScroll();
            if (reduceMotion.matches) { shown = target; apply(shown); return; }
            if (!raf) raf = requestAnimationFrame(tick);
        }

        function enable() {
            if (active) return;
            active = true;
            document.documentElement.classList.add('cine');
            vh = window.innerHeight;
            hero.style.setProperty('--cine-scroll', (SCROLL_VH * 100) + 'vh');
            target = shown = progressFromScroll();
            apply(shown);
        }
        function disable() {
            if (!active) return;
            active = false;
            if (raf) { cancelAnimationFrame(raf); raf = null; }
            document.documentElement.classList.remove('cine');
            clearStyles();
        }
        function update() { if (mq.matches && !reduceMotion.matches) enable(); else disable(); }

        update();
        onMQ(mq, update);
        onMQ(reduceMotion, update);
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', () => { vh = window.innerHeight; if (active) { target = shown = progressFromScroll(); apply(shown); } }, { passive: true });
        window.addEventListener('pageshow', () => { if (active) { target = shown = progressFromScroll(); apply(shown); } });

        // Pointer: the card's sheen follows the cursor and the phone tilts a little
        if (finePointer.matches) {
            let tx = 0, ty = 0, cx = 0, cy = 0, tiltRaf = null;
            function tiltTick() {
                tiltRaf = null;
                cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
                if (phoneImg) phoneImg.style.transform = 'rotateY(' + (cx * 12).toFixed(2) + 'deg) rotateX(' + (-cy * 12).toFixed(2) + 'deg)';
                if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) tiltRaf = requestAnimationFrame(tiltTick);
            }
            window.addEventListener('pointermove', e => {
                if (!active || reduceMotion.matches || e.pointerType !== 'mouse') return;
                if (window.scrollY > vh * (SCROLL_VH + 1)) return;
                const r = card.getBoundingClientRect();
                card.style.setProperty('--mouse-x', (e.clientX - r.left) + 'px');
                card.style.setProperty('--mouse-y', (e.clientY - r.top) + 'px');
                tx = (e.clientX / window.innerWidth - 0.5) * 2;
                ty = (e.clientY / window.innerHeight - 0.5) * 2;
                if (!tiltRaf) tiltRaf = requestAnimationFrame(tiltTick);
            }, { passive: true });
        }
    }

    /* =========================================================
       2. MOTION FOOTER
       ========================================================= */
    function initFooterReveal() {
        const wrap   = document.getElementById('footer-reveal');
        const giant  = document.getElementById('footer-giant');
        const top    = document.getElementById('footer-top');
        if (!wrap || !giant || !top) return;
        const mq = window.matchMedia('(min-width: 1024px) and (min-height: 720px)');
        let active = false, queued = false;

        function paint() {
            queued = false;
            if (!active) return;
            const r = wrap.getBoundingClientRect();
            const vh = window.innerHeight;
            const t = clamp01((vh - r.top) / Math.max(1, r.height));
            giant.style.setProperty('--fr', easeOutQuart(t).toFixed(4));
            top.style.setProperty('--fr2', easeOutQuart(clamp01((t - 0.3) / 0.7)).toFixed(4));
        }
        function update() {
            active = mq.matches && !reduceMotion.matches;
            document.documentElement.classList.toggle('cine-footer', active);
            if (!active) { giant.style.removeProperty('--fr'); top.style.removeProperty('--fr2'); }
            else paint();
        }
        update();
        onMQ(mq, update);
        onMQ(reduceMotion, update);
        window.addEventListener('scroll', () => { if (active && !queued) { queued = true; requestAnimationFrame(paint); } }, { passive: true });
        window.addEventListener('resize', update, { passive: true });
    }

    // Magnetic pills: nudge toward the cursor, spring back on leave (mouse only)
    function initMagnetic() {
        if (!finePointer.matches || reduceMotion.matches) return;
        document.querySelectorAll('.magnetic').forEach(el => {
            el.addEventListener('pointermove', e => {
                if (e.pointerType !== 'mouse') return;
                const r = el.getBoundingClientRect();
                const x = e.clientX - r.left - r.width / 2;
                const y = e.clientY - r.top - r.height / 2;
                el.style.setProperty('--mx', (x * 0.35).toFixed(1) + 'px');
                el.style.setProperty('--my', (y * 0.35).toFixed(1) + 'px');
                el.classList.add('is-mag');
            });
            el.addEventListener('pointerleave', () => {
                el.style.setProperty('--mx', '0px');
                el.style.setProperty('--my', '0px');
                el.classList.remove('is-mag');
            });
        });
    }

    function initBackToTop() {
        const btn = document.getElementById('footer-top-btn');
        if (!btn) return;
        btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' }));
    }

    /* =========================================================
       3. NAVIGATION
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
            onMQ(wide, () => { if (wide.matches) setMenu(false); });
        }
    }

    /* =========================================================
       4. ENHANCEMENTS
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
        ['download', 'footer-reveal'].forEach(id => { const el = document.getElementById(id); if (el) io.observe(el); });
    }

    // ---- Init ----
    function init() {
        initNav();
        initReveal();
        initStatCounters();
        initFAQ();
        initDemoQuiz();
        initGetBar();
        initCinematicHero();
        initFooterReveal();
        initMagnetic();
        initBackToTop();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
