/* =============================================
   INVESTO — Site behaviour
   1. Hero + product tour: on large screens the hero pins while the scroll position
      plays it (headline → the green stage rises → the phone walks through four
      screens). Scrolling is never intercepted; it only drives the timeline.
      Smaller screens, reduced motion and no-JS get a plain stack with tabs.
   2. Navigation (solid on scroll, hide on scroll down, mobile menu, progress)
   3. Motion footer: curtain reveal, scroll-linked wordmark, magnetic buttons
   4. Enhancements: headline typing, split headings, reveal-on-scroll, typed figures,
      FAQ, the live quiz, phone bar
   ============================================= */
(function () {
    'use strict';

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer  = window.matchMedia('(hover: hover) and (pointer: fine)');
    const onMQ = (mq, fn) => { if (mq.addEventListener) mq.addEventListener('change', fn); else mq.addListener(fn); };

    const clamp01 = v => Math.max(0, Math.min(1, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const seg = (p, a, b, ease) => { const t = clamp01((p - a) / (b - a)); return ease ? ease(t) : t; };
    const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const easeOutQuart   = t => 1 - Math.pow(1 - t, 4);

    /* =========================================================
       1. HERO + PRODUCT TOUR
       ========================================================= */
    function initTour() {
        const hero   = document.getElementById('hero');
        const stage  = document.getElementById('stage');
        if (!hero || !stage) return;
        const copy   = document.getElementById('hero-copy');
        const panel  = document.getElementById('stage-panel');
        const brand  = document.getElementById('stage-brand');
        const wrap   = document.getElementById('device-wrap');
        const device = document.getElementById('device');
        const tCopy  = document.getElementById('tour-copy');
        const rail   = document.getElementById('tour-rail');
        const dim    = document.getElementById('stage-dim');
        const tabs   = Array.prototype.slice.call(document.querySelectorAll('#tour-rail .tab'));
        const steps  = Array.prototype.slice.call(document.querySelectorAll('#tour-copy .step'));
        if (!copy || !panel || !brand || !wrap || !device || !tCopy || !rail || !tabs.length) return;

        const SCREENS = steps.map(s => s.getAttribute('data-screen'));
        const N = steps.length;

        // Timeline (fractions of the pinned scroll)
        const SCROLL_VH  = 4.2;                // viewport heights the sequence takes
        const COVER_VH   = 1;                  // then the next section rises over the pinned stage (matches --cover)
        const STEP_START = 0.24, STEP_W = 0.165; // four steps → 0.24 … 0.90
        const OUT_START  = 0.93;

        const mq = window.matchMedia('(min-width: 1024px) and (min-height: 640px)');
        let active = false, target = 0, shown = 0, raf = null, vh = window.innerHeight, vw = window.innerWidth;
        let current = -1;
        let tiltX = 0, tiltY = 0, tX = 0, tY = 0, tiltRaf = null;

        /* ----- shared: which step / screen is showing ----- */
        function setStep(i) {
            if (i === current) return;
            current = i;
            steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
            tabs.forEach((t, k) => {
                const on = k === i;
                t.classList.toggle('is-active', on);
                t.setAttribute('aria-selected', on ? 'true' : 'false');
                t.tabIndex = on ? 0 : -1;
            });
            device.setAttribute('data-screen', i >= 0 ? SCREENS[i] : 'home');
        }

        /* ----- cinematic mode ----- */
        function heroTop() { return hero.getBoundingClientRect().top + window.scrollY; }
        // 0 → 1 across the tour, then on to (SCROLL_VH + COVER_VH) / SCROLL_VH while the next section covers the stage
        const MAX_S = (SCROLL_VH + COVER_VH) / SCROLL_VH;
        function progressFromScroll() { return Math.max(0, Math.min(MAX_S, (window.scrollY - heroTop()) / (vh * SCROLL_VH))); }
        const stepProgress = i => STEP_START + (i + 0.5) * STEP_W;

        function apply(s) {
            const p = clamp01(s);
            const q = clamp01((s - 1) * SCROLL_VH / COVER_VH);       // the cover phase
            // Headline goes soft and recedes *behind* the glass as it rises
            const hc = seg(p, 0, 0.2, easeInOutCubic);
            copy.style.transform = 'scale(' + (1 + 0.15 * hc).toFixed(4) + ')';
            copy.style.opacity = String((1 - 0.8 * hc).toFixed(3));
            copy.style.filter = hc > 0 ? 'blur(' + (20 * hc).toFixed(1) + 'px)' : '';
            copy.style.visibility = p >= 0.3 ? 'hidden' : 'visible';
            copy.style.pointerEvents = p > 0.04 ? 'none' : '';

            // A frosted slab rises over it, then fills the screen and turns solid;
            // at the end it settles back like a card being put away
            const rise   = seg(p, 0.02, 0.2, easeInOutCubic);
            const expand = seg(p, 0.15, 0.25, easeInOutCubic);
            const exit   = seg(p, OUT_START, 1, easeInOutCubic);
            const scale  = 0.86 + 0.14 * expand - 0.05 * exit;
            const radius = 48 * (1 - expand) + 40 * exit;
            panel.style.transform = 'translate3d(0,' + ((1 - rise) * vh * 1.02).toFixed(1) + 'px,0) scale(' + scale.toFixed(4) + ')';
            panel.style.borderRadius = radius.toFixed(1) + 'px';
            panel.style.setProperty('--solid', expand.toFixed(3));

            // Phone: from the hero's right-hand side to the stage's centre
            const m = seg(p, 0.03, 0.26, easeInOutCubic);
            const x = lerp(0.2 * vw, 0.09 * vw, m);
            const y = lerp(0.06 * vh, 0, m) - 0.1 * vh * exit - 0.12 * vh * easeInOutCubic(q);
            const sc = 1 - 0.06 * exit - 0.05 * q;         // never scaled up: keeps the UI crisp
            wrap.style.transform = 'translate3d(calc(-50% + ' + x.toFixed(1) + 'px), calc(-50% + ' + y.toFixed(1) + 'px),0) scale(' + sc.toFixed(4) + ')';
            wrap.style.opacity = q > 0 ? (1 - 0.7 * q).toFixed(3) : '';
            const ry = lerp(-17, 0, m) + tiltY * 7, rx = lerp(6, 0, m) - tiltX * 5, rz = lerp(2.2, 0, m);
            device.style.transform = 'rotateY(' + ry.toFixed(2) + 'deg) rotateX(' + rx.toFixed(2) + 'deg) rotateZ(' + rz.toFixed(2) + 'deg)';
            device.style.setProperty('--glint', (50 + ry * 2).toFixed(1) + '%');

            // Step copy + rail arrive once the stage is full
            const ui = seg(p, 0.24, 0.3, easeOutQuart) * (1 - exit);
            const bc = seg(p, 0.24, 0.36, easeOutQuart) * (1 - exit);
            brand.style.opacity = bc.toFixed(3);
            brand.style.transform = 'translateX(' + (50 * (1 - bc)).toFixed(1) + 'px) scale(' + (0.8 + 0.2 * bc).toFixed(4) + ')';
            tCopy.style.opacity = ui.toFixed(3);
            tCopy.style.transform = 'translate3d(' + (-28 * (1 - ui)).toFixed(1) + 'px,-50%,0)';
            rail.style.opacity = ui.toFixed(3);
            rail.style.transform = 'translate3d(' + (28 * (1 - ui)).toFixed(1) + 'px,-50%,0)';
            tCopy.style.pointerEvents = rail.style.pointerEvents = ui < 0.5 ? 'none' : '';

            // The next section rises over the stage: it settles back, rounds off and dims beneath
            const qe = easeInOutCubic(q);
            stage.style.transform = q > 0 ? 'scale(' + (1 - 0.08 * qe).toFixed(4) + ')' : '';
            stage.style.borderRadius = q > 0 ? (44 * qe).toFixed(1) + 'px' : '';
            if (dim) dim.style.opacity = (0.78 * qe).toFixed(3);

            // Which step?
            let idx = -1;
            if (p >= STEP_START - 0.015) idx = Math.max(0, Math.min(N - 1, Math.floor((p - STEP_START) / STEP_W)));
            setStep(idx);
        }

        function clearStyles() {
            [stage, copy, panel, brand, wrap, device, tCopy, rail, dim].forEach(el => el && el.removeAttribute('style'));
            hero.style.removeProperty('--cine-scroll');
        }
        function tick() {
            raf = null;
            const d = target - shown;
            if (Math.abs(d) < 0.0004) { shown = target; apply(shown); return; }
            shown += d * 0.16;                  // soft scrub, like a short lag
            apply(shown);
            raf = requestAnimationFrame(tick);
        }
        function onScroll() {
            if (!active) return;
            target = progressFromScroll();
            if (!raf) raf = requestAnimationFrame(tick);
        }
        function enable() {
            if (active) return;
            active = true;
            document.documentElement.classList.add('cine');
            vh = window.innerHeight; vw = window.innerWidth;
            hero.style.setProperty('--cine-scroll', ((SCROLL_VH + COVER_VH) * 100) + 'vh');
            current = -2;                         // force a refresh
            target = shown = progressFromScroll();
            apply(shown);
        }
        function disable() {
            if (!active && current !== -1) return;
            active = false;
            if (raf) { cancelAnimationFrame(raf); raf = null; }
            document.documentElement.classList.remove('cine');
            clearStyles();
            const keep = current >= 0 ? current : 0;
            current = -2;
            setStep(keep);
        }
        function update() { if (mq.matches && !reduceMotion.matches) enable(); else disable(); }

        /* ----- tabs (both modes) ----- */
        function go(i) {
            if (active) {
                const y = heroTop() + stepProgress(i) * vh * SCROLL_VH;
                window.scrollTo({ top: y, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
            } else {
                setStep(i);
            }
        }
        tabs.forEach((t, i) => t.addEventListener('click', () => go(i)));
        rail.addEventListener('keydown', e => {
            const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
            if (!(e.key in keys)) return;
            e.preventDefault();
            const i = Math.max(0, (current < 0 ? 0 : current)) + keys[e.key];
            const next = (i + N) % N;
            go(next); tabs[next].focus();
        });

        /* ----- init ----- */
        setStep(0);
        update();
        onMQ(mq, update);
        onMQ(reduceMotion, update);
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', () => { vh = window.innerHeight; vw = window.innerWidth; if (active) { target = shown = progressFromScroll(); apply(shown); } }, { passive: true });
        window.addEventListener('pageshow', () => { if (active) { target = shown = progressFromScroll(); apply(shown); } });

        // Pointer: the phone leans a little toward the cursor
        if (finePointer.matches) {
            const loop = () => {
                tiltRaf = null;
                tiltX += (tX - tiltX) * 0.07; tiltY += (tY - tiltY) * 0.07;
                if (active) apply(shown);
                if (Math.abs(tX - tiltX) > 0.002 || Math.abs(tY - tiltY) > 0.002) tiltRaf = requestAnimationFrame(loop);
            };
            window.addEventListener('pointermove', e => {
                if (!active || reduceMotion.matches || e.pointerType !== 'mouse') return;
                const r = panel.getBoundingClientRect();
                panel.style.setProperty('--mouse-x', (e.clientX - r.left).toFixed(0) + 'px');
                panel.style.setProperty('--mouse-y', (e.clientY - r.top).toFixed(0) + 'px');
                tY = (e.clientX / window.innerWidth - 0.5) * 2;
                tX = (e.clientY / window.innerHeight - 0.5) * 2;
                if (!tiltRaf && !raf) tiltRaf = requestAnimationFrame(loop);
            }, { passive: true });
        }
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
        let lastY = window.scrollY, queued = false;
        const compact = window.matchMedia('(max-width: 820px)');

        const menuOpen = () => menu && !menu.hidden;
        function setMenu(open) {
            if (!menu || !menuBtn) return;
            menu.hidden = !open;
            nav.classList.toggle('is-open', open);
            menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
            menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
            if (open) nav.classList.remove('nav--hidden');
        }
        function paint() {
            queued = false;
            const y = window.scrollY;
            nav.classList.toggle('is-solid', y > 24);
            // Phones hide the bar while reading (the bottom download bar keeps a store in reach);
            // wider screens keep it, so the store buttons are always one click away.
            const dy = y - lastY;
            if (!compact.matches) nav.classList.remove('nav--hidden');
            else if (!menuOpen()) {
                // Only react to real movement, so a decelerating smooth-scroll never flips the bar back
                if (dy > 2 && y > 160) nav.classList.add('nav--hidden');
                else if (dy < -2 || y <= 160) nav.classList.remove('nav--hidden');
            }
            if (Math.abs(dy) > 2 || y <= 160) lastY = y;
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
       3. MOTION FOOTER
       ========================================================= */
    function initFooterReveal() {
        const wrap   = document.getElementById('download');
        const footer = document.getElementById('footer');
        const giant  = document.getElementById('footer-giant');
        const top    = document.getElementById('footer-top');
        if (!wrap || !footer || !giant || !top) return;
        const mq = window.matchMedia('(min-width: 1024px)');
        let active = false, queued = false;

        function paint() {
            queued = false;
            if (!active) return;
            const r = wrap.getBoundingClientRect();
            const vh = window.innerHeight;
            // Settles a little before the very bottom, so landing on #download already looks finished
            const t = clamp01((vh - r.top) / Math.max(1, r.height) / 0.9);
            giant.style.setProperty('--fr', easeOutQuart(t).toFixed(4));
            top.style.setProperty('--fr2', easeOutQuart(clamp01((t - 0.3) / 0.7)).toFixed(4));
        }
        function update() {
            // Curtain only when the whole footer fits on screen; otherwise it is a normal footer
            const root = document.documentElement;
            active = false;
            if (mq.matches && !reduceMotion.matches) {
                root.classList.add('cine-footer');
                const cs = getComputedStyle(footer);
                const inner = footer.querySelector('.footer-inner');
                const bottom = footer.querySelector('.footer-bottom');
                const gap = inner ? parseFloat(getComputedStyle(inner).rowGap) || 0 : 0;
                const needed = top.offsetHeight + (bottom ? bottom.offsetHeight : 0) + gap + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
                active = needed <= window.innerHeight + 1;
            }
            root.classList.toggle('cine-footer', active);
            if (!active) { giant.style.removeProperty('--fr'); top.style.removeProperty('--fr2'); }
            else paint();
        }
        update();
        onMQ(mq, update);
        onMQ(reduceMotion, update);
        window.addEventListener('scroll', () => { if (active && !queued) { queued = true; requestAnimationFrame(paint); } }, { passive: true });
        window.addEventListener('resize', update, { passive: true });
        window.addEventListener('load', update);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(update);
    }

    // Magnetic buttons: nudge toward the cursor, spring back on leave (mouse only)
    function initMagnetic() {
        if (!finePointer.matches || reduceMotion.matches) return;
        document.querySelectorAll('.magnetic').forEach(el => {
            el.addEventListener('pointermove', e => {
                if (e.pointerType !== 'mouse') return;
                const r = el.getBoundingClientRect();
                el.style.setProperty('--mx', ((e.clientX - r.left - r.width / 2) * 0.28).toFixed(1) + 'px');
                el.style.setProperty('--my', ((e.clientY - r.top - r.height / 2) * 0.28).toFixed(1) + 'px');
                el.classList.add('is-mag');
            });
            el.addEventListener('pointerleave', () => {
                el.style.setProperty('--mx', '0px'); el.style.setProperty('--my', '0px');
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
       4. ENHANCEMENTS
       ========================================================= */
    // Reveal on scroll — content is visible by default; this only adds the entrance.
    function initReveal() {
        const els = document.querySelectorAll('.reveal, .split');
        if (!els.length) return;
        const showAll = () => els.forEach(el => el.classList.add('in-view'));
        if (!('IntersectionObserver' in window) || reduceMotion.matches) { showAll(); return; }

        // Siblings arrive one after another instead of all at once
        const seen = new Map();
        els.forEach(el => {
            if (!el.classList.contains('reveal')) return;
            const n = seen.get(el.parentElement) || 0;
            seen.set(el.parentElement, n + 1);
            if (n) el.style.setProperty('--d', Math.min(n, 5) * 90 + 'ms');
        });

        const obs = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (!e.isIntersecting) return;
                const el = e.target;
                el.classList.add('in-view');
                obs.unobserve(el);
                if (el.style.getPropertyValue('--d')) setTimeout(() => el.style.removeProperty('--d'), 1800);   // hover transitions shouldn't inherit the stagger
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        els.forEach(el => obs.observe(el));
        setTimeout(showAll, 6000);               // safety net
    }

    // Headings: split into words so each can rise out of its own clipped line.
    // The real text stays in the DOM (spaces and all), so it still reads and copies normally.
    function initSplitHeadings() {
        if (reduceMotion.matches || !('IntersectionObserver' in window)) return;
        document.querySelectorAll('.h2:not(.footer-h)').forEach(h => {
            let k = 0;
            const walk = node => {
                Array.prototype.slice.call(node.childNodes).forEach(n => {
                    if (n.nodeType === 3) {
                        const frag = document.createDocumentFragment();
                        n.textContent.split(/(\s+)/).forEach(tok => {
                            if (!tok) return;
                            if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
                            const w = document.createElement('span'); w.className = 'w';
                            const wi = document.createElement('span'); wi.className = 'wi'; wi.style.setProperty('--k', String(k++)); wi.textContent = tok;
                            w.appendChild(wi); frag.appendChild(w);
                        });
                        n.parentNode.replaceChild(frag, n);
                    } else if (n.nodeType === 1) walk(n);
                });
            };
            walk(h);
            h.classList.add('split');
        });
    }

    // Hero headline: typed in, character by character, with a gold caret.
    // Everything under it waits until it lands. Reduced motion (and no JS) just shows the text.
    function initHeroType() {
        const root = document.documentElement;
        const title = document.getElementById('hero-heading');
        const copy = document.getElementById('hero-copy');
        if (!title || !copy) { root.classList.remove('typing'); return; }
        if (reduceMotion.matches) { root.classList.remove('typing'); return; }

        const plain = title.textContent.replace(/\s+/g, ' ').trim();
        const chars = [];
        const walk = node => {
            Array.prototype.slice.call(node.childNodes).forEach(n => {
                if (n.nodeType === 3) {
                    const frag = document.createDocumentFragment();
                    n.textContent.split(/(\s+)/).forEach(tok => {
                        if (!tok) return;
                        if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
                        const w = document.createElement('span'); w.className = 'tw';
                        tok.split('').forEach(ch => {
                            const c = document.createElement('span'); c.className = 'tch'; c.textContent = ch; w.appendChild(c); chars.push(c);
                        });
                        frag.appendChild(w);
                    });
                    n.parentNode.replaceChild(frag, n);
                } else if (n.nodeType === 1) walk(n);
            });
        };
        const lineStarts = new Set();
        title.querySelectorAll('.hl').forEach(line => { lineStarts.add(chars.length); walk(line); line.setAttribute('aria-hidden', 'true'); });
        const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = plain; title.insertBefore(sr, title.firstChild);

        let done = false, timer = null, i = 0, prev = null;
        function finish() {
            if (done) return;
            done = true; clearTimeout(timer);
            chars.forEach(c => { c.classList.add('on'); c.classList.remove('caret'); });
            copy.classList.add('is-typed');
        }
        function step() {
            if (done) return;
            if (prev) prev.classList.remove('caret');
            if (i >= chars.length) {
                // hold the caret for a beat, then bring in the rest
                prev.classList.add('caret');
                timer = setTimeout(() => { prev.classList.remove('caret'); finish(); }, 520);
                return;
            }
            prev = chars[i++]; prev.classList.add('on', 'caret');
            const ch = prev.textContent;
            // a little human wobble; a longer breath at the end of a phrase
            let wait = 46 + Math.random() * 38;
            if (lineStarts.has(i)) wait += 190;
            if (ch === ',') wait += 120;
            timer = setTimeout(step, wait);
        }
        function start() {
            title.classList.add('is-built');
            timer = setTimeout(step, 380);
        }
        // Scrolling away shouldn't leave a half-typed headline behind
        window.addEventListener('scroll', () => { if (!done && window.scrollY > 40) finish(); }, { passive: true });
        // Wait for the display face so wrapping is final before anything is typed
        let started = false;
        const go = () => { if (!started) { started = true; start(); } };
        if (document.fonts && document.fonts.ready) { document.fonts.ready.then(go); setTimeout(go, 1200); } else go();
    }

    // Slow, gentle drift: the practice card and the 6th-place number move a touch against the scroll
    function initDrift() {
        if (reduceMotion.matches || !finePointer.matches && window.innerWidth < 1024) return;
        const items = Array.prototype.slice.call(document.querySelectorAll('[data-drift]'));
        if (!items.length) return;
        let queued = false;
        function paint() {
            queued = false;
            const vh = window.innerHeight;
            items.forEach(el => {
                const r = el.getBoundingClientRect();
                if (r.bottom < -200 || r.top > vh + 200) return;
                const t = (r.top + r.height / 2 - vh / 2) / vh;          // -1 … 1 around the middle of the screen
                el.style.translate = '0 ' + (t * parseFloat(el.dataset.drift)).toFixed(1) + 'px';
            });
        }
        window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(paint); } }, { passive: true });
        window.addEventListener('resize', paint, { passive: true });
        paint();
    }

    // Glass cards: the glare follows the cursor
    function initGlare() {
        if (!finePointer.matches || reduceMotion.matches) return;
        document.querySelectorAll('.pf').forEach(el => {
            el.addEventListener('pointermove', e => {
                if (e.pointerType !== 'mouse') return;
                const r = el.getBoundingClientRect();
                el.style.setProperty('--mouse-x', (e.clientX - r.left).toFixed(0) + 'px');
                el.style.setProperty('--mouse-y', (e.clientY - r.top).toFixed(0) + 'px');
            }, { passive: true });
        });
    }

    // Figures — type themselves in, digit by digit, when they scroll into view.
    // Without JS, with reduced motion, or without IntersectionObserver the final values stay as written.
    function initTypedFigures() {
        const nums = document.querySelectorAll('.num[data-count-to]');
        if (!nums.length || !('IntersectionObserver' in window) || reduceMotion.matches) return;

        nums.forEach(el => {
            const text = (el.dataset.countTo || '') + (el.dataset.suffix || '');
            el.textContent = '';
            const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = text; el.appendChild(sr);
            text.split('').forEach(ch => {
                const s = document.createElement('span'); s.className = 'tch'; s.setAttribute('aria-hidden', 'true'); s.textContent = ch; el.appendChild(s);
            });
        });

        function type(el, startDelay) {
            const chars = el.querySelectorAll('.tch');
            let i = 0, prev = null;
            const next = () => {
                if (prev) prev.classList.remove('caret');
                if (i >= chars.length) { setTimeout(() => prev && prev.classList.remove('caret'), 1400); return; }
                prev = chars[i++]; prev.classList.add('on', 'caret');
                setTimeout(next, 130 + Math.random() * 90);        // a little human wobble
            };
            setTimeout(next, startDelay);
        }
        const group = [];
        const obs = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (!e.isIntersecting) return;
                obs.unobserve(e.target);
                type(e.target, group.length * 380);               // figures start one after another
                group.push(e.target);
                setTimeout(() => { const k = group.indexOf(e.target); if (k > -1) group.splice(k, 1); }, 1200);
            });
        }, { threshold: 0.6 });
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
                if (!isOpen) { btn.setAttribute('aria-expanded', 'true'); if (item) item.classList.add('open'); }
            });
        });
    }

    // The live Daily Challenge — three real finance calls, reasoning explained either way
    function initQuiz() {
        const root = document.getElementById('quiz');
        if (!root) return;
        const $ = id => document.getElementById(id);
        const elQ = $('quiz-q'), elOpts = $('quiz-options'), elFb = $('quiz-feedback'), elNext = $('quiz-next');
        const elCount = $('quiz-count'), elXp = $('quiz-xp'), elSteps = $('quiz-steps').children;
        const elBody = $('quiz-body'), elDone = $('quiz-done'), elScore = $('quiz-score'), elMsg = $('quiz-msg');
        const XP = 35;

        const QUESTIONS = [
            { q: 'You get $50 for your birthday. You already have a $200 emergency fund and no debt. What’s the smartest first move?',
              o: ['Spend it all right away — you earned it', 'Split it: save some, spend some on something you’ll actually value', 'Lend it to a friend who says they’ll pay you back'], a: 1,
              yes: 'Your safety net is already covered, so a mix keeps things balanced: some for later, some to enjoy.',
              no: 'The best answer keeps your safety net intact while still letting you enjoy some of it.' },
            { q: 'You put $100 in an account that earns 10% a year, and the interest stays in the account. How much do you have after 2 years?',
              o: ['$110', '$120', '$121'], a: 2,
              yes: 'Year two’s interest is earned on $110, not just the original $100. That’s compounding.',
              no: 'Year one adds $10, making $110. Year two earns 10% on $110 — that’s $11 — so you land on $121. Interest earning interest is compounding.' },
            { q: 'What does your credit score mostly tell lenders?',
              o: ['How reliably you’ve paid back what you’ve borrowed', 'How much money you earn', 'How much money you’ve saved'], a: 0,
              yes: 'Scores are built from things like paying on time and how much of your limit you use — not income or savings.',
              no: 'It’s a track record of borrowing: paying on time, how much of your limit you use, and how long you’ve been at it. Income and savings don’t count.' }
        ];
        const total = QUESTIONS.length;
        let idx = 0, score = 0, answered = false;

        const icon = id => '<svg class="i" aria-hidden="true"><use href="#' + id + '"/></svg>';
        function setSteps() {
            Array.prototype.forEach.call(elSteps, (s, i) => { s.className = i < idx ? 'is-done' : (i === idx ? 'is-now' : ''); });
        }
        function render() {
            const item = QUESTIONS[idx];
            answered = false;
            elCount.textContent = 'Question ' + (idx + 1) + ' of ' + total;
            elQ.textContent = item.q;
            elFb.textContent = ''; elFb.className = 'quiz-feedback';
            elNext.hidden = true;
            elOpts.innerHTML = '';
            item.o.forEach((text, i) => {
                const b = document.createElement('button');
                b.type = 'button'; b.className = 'quiz-option'; b.dataset.i = String(i);
                b.innerHTML = '<span class="quiz-mark">' + icon('i-check') + '</span><span class="quiz-text"></span>';
                b.querySelector('.quiz-text').textContent = text;
                b.addEventListener('click', e => choose(i, e.detail === 0));
                elOpts.appendChild(b);
            });
            setSteps();
        }
        function choose(i, viaKeyboard) {
            if (answered) return;
            answered = true;
            const item = QUESTIONS[idx], ok = i === item.a;
            if (ok) { score++; elXp.textContent = (score * XP) + ' XP'; elXp.classList.remove('pop'); void elXp.offsetWidth; elXp.classList.add('pop'); }
            Array.prototype.forEach.call(elOpts.children, (b, k) => {
                b.disabled = true;
                const mark = b.querySelector('.quiz-mark');
                if (k === item.a) { b.classList.add('is-correct'); mark.innerHTML = icon('i-check'); }
                else if (k === i) { b.classList.add('is-wrong'); mark.innerHTML = icon('i-x'); }
                else b.classList.add('is-dim');
            });
            elFb.className = 'quiz-feedback ' + (ok ? 'ok' : 'no');
            elFb.innerHTML = '<strong></strong><span></span>';
            elFb.querySelector('strong').textContent = ok ? 'Nice call. +' + XP + ' XP' : 'Not quite.';
            elFb.querySelector('span').textContent = ok ? item.yes : item.no;
            elNext.innerHTML = (idx === total - 1 ? 'See your score ' : 'Next question ') + icon('i-arrow-r');
            elNext.hidden = false;
            if (viaKeyboard) elNext.focus({ preventScroll: true });
        }
        function finish() {
            root.style.minHeight = root.offsetHeight + 'px';   // the card keeps its height, so the page never jumps
            idx = total; setSteps();
            elBody.hidden = true; elDone.hidden = false;
            elScore.innerHTML = score + '/' + total + '<small>' + (score * XP) + ' XP</small>';
            elMsg.textContent = score === total
                ? 'A perfect run. This is the kind of thinking the app helps you turn into a habit — one good money decision a day.'
                : score > 0
                    ? 'Solid — and you now know exactly why the other one tripped you up. That’s what the lessons are for.'
                    : 'Everyone starts somewhere. That’s literally what the lessons are for — and nothing here costs a cent.';
        }
        elNext.addEventListener('click', () => { if (idx < total - 1) { idx++; render(); } else finish(); });
        $('quiz-reset').addEventListener('click', () => {
            idx = 0; score = 0; elXp.textContent = '0 XP';
            elDone.hidden = true; elBody.hidden = false; render();
            root.style.minHeight = '';
        });
        render();
    }

    // Email list — posts in place (Netlify Forms) and confirms right where you typed
    function initSignup() {
        const form = document.getElementById('footer-signup-form');
        const note = document.getElementById('footer-signup-note');
        if (!form || !note || !window.fetch) return;
        form.addEventListener('submit', e => {
            e.preventDefault();
            const btn = form.querySelector('button');
            btn.disabled = true; note.className = 'signup-note';
            fetch(form.getAttribute('action') || '/', {
                method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(new FormData(form)).toString()
            }).then(r => {
                if (!r.ok) throw new Error(String(r.status));
                form.reset(); note.textContent = 'You\u2019re on the list. Thanks!'; note.className = 'signup-note is-ok';
            }).catch(() => {
                note.textContent = 'Couldn\u2019t sign you up just now \u2014 please try again, or email investo.team@bruxelacademy.com.'; note.className = 'signup-note is-err';
            }).then(() => { btn.disabled = false; });
        });
    }

    // Phone download bar — shown once the hero's own store buttons have scrolled away,
    // hidden while the download section is on screen.
    function initGetBar() {
        const bar  = document.getElementById('get-bar');
        const copy = document.getElementById('hero-copy');
        if (!bar || !copy || !('IntersectionObserver' in window)) return;
        const covering = new Set();
        let past = false;
        const sync = () => bar.classList.toggle('show', past && covering.size === 0);
        new IntersectionObserver(([e]) => { past = !e.isIntersecting && e.boundingClientRect.top < 0; sync(); }).observe(copy);
        const io = new IntersectionObserver(entries => {
            entries.forEach(e => e.isIntersecting ? covering.add(e.target) : covering.delete(e.target));
            sync();
        });
        const dl = document.getElementById('download'); if (dl) io.observe(dl);
    }

    // ---- Init ----
    function init() {
        initHeroType();
        initNav();
        initSplitHeadings();
        initReveal();
        initTypedFigures();
        initFAQ();
        initQuiz();
        initSignup();
        initGetBar();
        initTour();
        initFooterReveal();
        initMagnetic();
        initBackToTop();
        initDrift();
        initGlare();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
