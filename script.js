/* =============================================
   investo. site behaviour
   No scroll libraries: scrolling is native, and scroll-linked depth is CSS.
   This file runs the nav, reveals, the hold-or-sell example, the Daily Challenge,
   the compound growth simulator, the FAQ and the signup form, plus a fallback that
   scrubs the scroll-linked CSS animations where the browser cannot do it natively.
   ============================================= */
(function () {
    'use strict';
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasIO = 'IntersectionObserver' in window;
    const $ = id => document.getElementById(id);
    const $$ = (s, el) => Array.prototype.slice.call((el || document).querySelectorAll(s));
    const money = (v, cents) => v.toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });

    // ---- Nav ----
    function initNav() {
        const nav = $('main-nav');
        if (!nav) return;
        const btn = $('nav-menu-btn'), menu = $('nav-menu');
        if (hasIO) {
            const sentinel = document.createElement('i');
            sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:16px;pointer-events:none';
            document.body.prepend(sentinel);
            new IntersectionObserver(([e]) => nav.classList.toggle('is-scrolled', !e.isIntersecting)).observe(sentinel);
        }
        function setOpen(open) {
            nav.classList.toggle('is-open', open);
            menu.hidden = !open;
            btn.setAttribute('aria-expanded', String(open));
            btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
            document.documentElement.style.overflow = open ? 'hidden' : '';
        }
        if (btn && menu) {
            btn.addEventListener('click', () => setOpen(menu.hidden));
            menu.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
            document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { setOpen(false); btn.focus(); } });
            window.matchMedia('(min-width: 961px)').addEventListener('change', e => { if (e.matches) setOpen(false); });
        }
        const links = $$('.nav-link[href^="#"]');
        if (links.length && hasIO) {
            const io = new IntersectionObserver(entries => {
                entries.forEach(e => {
                    if (!e.isIntersecting) return;
                    links.forEach(l => l.classList.toggle('is-current', l.getAttribute('href') === '#' + e.target.id));
                });
            }, { rootMargin: '-45% 0px -50% 0px' });
            links.forEach(l => { const t = document.querySelector(l.getAttribute('href')); if (t) io.observe(t); });
        }
    }

    // ---- Reveals: blocks rise once; headings rise word by word out of their own line ----
    function splitWords(el) {
        let n = 0;
        (function walk(node) {
            Array.prototype.slice.call(node.childNodes).forEach(c => {
                if (c.nodeType === 3) {
                    const frag = document.createDocumentFragment();
                    c.textContent.split(/(\s+)/).forEach(part => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                        const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
                        const inner = document.createElement('span'); inner.textContent = part; inner.style.setProperty('--wi', n++);
                        w.appendChild(inner); frag.appendChild(w);
                    });
                    node.replaceChild(frag, c);
                } else if (c.nodeType === 1) walk(c);
            });
        })(el);
    }
    function initReveal() {
        const heads = $$('.split'), els = $$('.rv');
        heads.forEach(el => { el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim()); splitWords(el); });
        const all = heads.concat(els);
        if (!hasIO || calm) { all.forEach(el => el.classList.add('in')); return; }
        const io = new IntersectionObserver(entries => {
            let i = 0;
            entries.forEach(e => {
                if (!e.isIntersecting) return;
                if (e.target.classList.contains('rv')) e.target.style.setProperty('--i', i++);
                e.target.classList.add('in');
                io.unobserve(e.target);
            });
        }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
        all.forEach(el => io.observe(el));
    }

    // ---- The story paragraph is split into words so CSS can light them in order ----
    function initFill() {
        $$('[data-fill]').forEach(el => {
            const words = el.textContent.trim().split(/\s+/);
            el.setAttribute('aria-label', el.textContent.trim());
            el.style.setProperty('--n', words.length);
            const hl = (el.dataset.hl || '').trim().split(/\s+/), at = el.dataset.hl ? words.findIndex((w, i) => hl.every((h, k) => words[i + k] === h)) : -1;
            el.innerHTML = words.map((w, i) => '<span class="fw' + (at >= 0 && i >= at && i < at + hl.length ? ' fw-hl' : '') + '" aria-hidden="true" style="--i:' + i + '">' + w + '</span>').join(' ');
        });
    }

    // ---- Scroll-linked motion for browsers without scroll timelines:
    //      the same CSS animations, paused, scrubbed here by scroll position. ----
    function initScrub() {
        const root = document.documentElement;
        if (!root.classList.contains('sdm') || root.classList.contains('sd-native')) return;
        let items = [], vh = window.innerHeight, queued = false;
        const pageTop = el => { let y = 0; for (let n = el; n; n = n.offsetParent) y += n.offsetTop; return y; };
        function measure() {
            vh = window.innerHeight;
            items = [];
            $$('[data-sd]').forEach(el => {
                const anims = el.getAnimations().filter(a => a.animationName && a.playState !== 'finished' || a.animationName);
                if (!anims.length) return;
                const cs = getComputedStyle(el), type = el.dataset.sd;
                const a = (parseFloat(cs.getPropertyValue('--a')) || 0) / 100;
                const bRaw = parseFloat(cs.getPropertyValue('--b'));
                const b = (isNaN(bRaw) ? 100 : bRaw) / 100;
                const ref = type === 'scene' ? el.closest('.scene') : el;
                if (!ref) return;
                // Measure without the element's own scrubbed offset: use the layout box of a stable ancestor for moved elements
                const box = type === 'scene' ? ref : (el.parentElement || el);
                const top = pageTop(box), h = box.offsetHeight;
                let start, end;
                if (type === 'scene') { start = top; end = top + h - vh; }
                else if (type === 'enter') { start = top - vh; end = top - vh + Math.min(h, vh); }
                else { start = top - vh; end = top + h; }
                const len = end - start;
                items.push({ anims: anims.filter(x => x.animationName), from: start + len * a, to: start + len * b });
            });
            apply();
        }
        function apply() {
            queued = false;
            const y = window.scrollY;
            for (let i = 0; i < items.length; i++) {
                const it = items[i], p = Math.min(Math.max((y - it.from) / ((it.to - it.from) || 1), 0), 1);
                for (let k = 0; k < it.anims.length; k++) it.anims[k].currentTime = p * 999.9;
            }
        }
        const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(apply); } };
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', measure);
        window.addEventListener('load', measure);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
        measure();
    }

    // ---- Pointer niceties on fine pointers: light that follows the cursor, buttons that lean toward it ----
    function initPointer() {
        if (calm || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        $$('.spot').forEach(el => {
            el.addEventListener('pointermove', e => {
                const r = el.getBoundingClientRect();
                el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
                el.style.setProperty('--my', (e.clientY - r.top) + 'px');
            });
        });
        $$('.magnetic').forEach(el => {
            el.addEventListener('pointermove', e => {
                const r = el.getBoundingClientRect();
                const dx = (e.clientX - r.left - r.width / 2) / r.width, dy = (e.clientY - r.top - r.height / 2) / r.height;
                el.style.transform = 'translate(' + (dx * 10).toFixed(1) + 'px,' + (dy * 8 - 2).toFixed(1) + 'px)';
            });
            el.addEventListener('pointerleave', () => { el.style.transform = ''; });
        });
    }

    // ---- FAQ accordion ----
    function initFaq() {
        $$('.qa').forEach(qa => {
            const btn = qa.querySelector('.qa-q');
            if (!btn) return;
            btn.addEventListener('click', () => {
                const open = !qa.classList.contains('open');
                qa.classList.toggle('open', open);
                btn.setAttribute('aria-expanded', String(open));
            });
        });
    }

    // ---- Figures count up once ----
    function initCounts() {
        const nums = $$('[data-count-to]');
        if (!nums.length || !hasIO || calm) return;
        const io = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (!e.isIntersecting) return;
                io.unobserve(e.target);
                const el = e.target, to = +el.dataset.countTo, suffix = el.dataset.suffix || '';
                const t0 = performance.now(), dur = 1400;
                (function tick(now) {
                    const p = Math.min((now - t0) / dur, 1), eased = 1 - Math.pow(1 - p, 4);
                    el.textContent = Math.round(to * eased) + suffix;
                    if (p < 1) requestAnimationFrame(tick);
                })(t0);
            });
        }, { threshold: 0.6 });
        nums.forEach(el => io.observe(el));
    }

    // ---- Hold or sell: an example portfolio that stops at the dip and asks ----
    const PTS = [[0, 263.2], [66, 241.6], [132, 274], [198, 212.8], [264, 227.2], [330, 162.4], [396, 191.2], [462, 256], [528, 313.6], [594, 234.4], [660, 248.8], [726, 169.6], [792, 140.8], [858, 184], [924, 119.2], [990, 133.6], [1056, 68.8], [1122, 90.4], [1200, 40]];
    const DIP_I = 8, DIP_D = PTS[DIP_I][0] / 1200, START = 10000, PER_PX = 8;
    const pathOf = pts => pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ',' + p[1]).join(' ');
    const yOn = (pts, x) => {
        for (let i = 1; i < pts.length; i++) {
            if (x <= pts[i][0]) { const a = pts[i - 1], b = pts[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); }
        }
        return pts[pts.length - 1][1];
    };
    function initDip() {
        const root = $('dip');
        if (!root) return;
        const you = $('dip-you'), market = $('dip-market'), dot = $('dip-dot');
        const line = $('dip-line'), area = $('dip-area'), val = $('dip-value'), delta = $('dip-delta'), label = $('dip-label');
        const msg = $('dip-msg'), hold = $('dip-hold'), sell = $('dip-sell'), replay = $('dip-replay');
        const SOLD = PTS.slice(0, DIP_I + 1).concat([[1200, PTS[DIP_I][1]]]);
        let pts = PTS, raf = 0, started = false;
        $('dip-market-line').setAttribute('d', pathOf(PTS));

        function setLine(p) { pts = p; line.setAttribute('d', pathOf(p)); area.setAttribute('d', pathOf(p) + ' L1200,400 L0,400 Z'); }
        function render(d) {
            const y = yOn(pts, d * 1200), v = START + (PTS[0][1] - y) * PER_PX;
            you.style.setProperty('--d', d.toFixed(4)); market.style.setProperty('--d', d.toFixed(4));
            dot.style.left = (d * 100) + '%'; dot.style.top = (y / 400 * 100) + '%';
            const whole = Math.floor(v + 0.005), cents = Math.round((v - whole) * 100);
            val.innerHTML = '$' + money(whole) + '<span>.' + String(Math.max(cents, 0)).padStart(2, '0') + '</span>';
            const pct = (v - START) / START * 100, down = v < START - 0.5;
            val.classList.toggle('is-down', down); delta.classList.toggle('is-down', down);
            delta.textContent = d === 0 ? ' ' : (pct >= 0 ? '+' : '-') + Math.abs(pct).toFixed(2) + '%';
            label.textContent = d === 0 ? 'Starting balance, practice money' : 'Practice balance';
            return v;
        }
        function run(from, to, ms, done) {
            cancelAnimationFrame(raf);
            if (calm) { render(to); done(); return; }
            const t0 = performance.now();
            (function tick(now) {
                const p = Math.min((now - t0) / ms, 1), e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
                render(from + (to - from) * e);
                if (p < 1) raf = requestAnimationFrame(tick); else done();
            })(t0);
        }
        function show(a, b, c) { hold.hidden = !a; sell.hidden = !b; replay.hidden = !c; }
        function ask() {
            root.classList.add('is-asking');
            const v = START + (PTS[0][1] - PTS[DIP_I][1]) * PER_PX;
            msg.textContent = 'Your portfolio just dropped to $' + money(v, true) + '. What do you do?';
            show(true, true, false);
        }
        function play() {
            root.classList.remove('is-sold', 'is-asking');
            setLine(PTS); show(false, false, false);
            msg.textContent = 'You buy at real market prices. Then the market does what it does.';
            run(0, DIP_D, 3400, ask);
        }
        function decide(sold) {
            root.classList.remove('is-asking');
            root.classList.toggle('is-sold', sold);
            setLine(sold ? SOLD : PTS); show(false, false, false);
            msg.textContent = sold ? 'You sell. The market keeps moving without you.' : 'You hold. It is not comfortable.';
            run(DIP_D, 1, 3400, () => {
                msg.textContent = sold
                    ? 'You locked in the loss, and this time the market recovered without you. In the app, that mistake costs nothing.'
                    : 'This time the dip passed. They do not always, and learning to sit with that is the point of practice money.';
                show(false, false, true); replay.focus({ preventScroll: true });
            });
        }
        hold.addEventListener('click', () => decide(false));
        sell.addEventListener('click', () => decide(true));
        replay.addEventListener('click', play);
        setLine(PTS); render(0);
        if (hasIO) {
            new IntersectionObserver((entries, io) => {
                if (!entries[0].isIntersecting || started) return;
                started = true; io.disconnect(); play();
            }, { threshold: 0.4 }).observe($('dip-chart'));
        } else play();
    }

    // ---- Compound growth: monthly contributions at a fixed yearly return ----
    function initSim() {
        const root = $('sim');
        if (!root) return;
        const m = $('sim-m'), y = $('sim-y'), r = $('sim-r');
        const fill = el => el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min) * 100) + '%');
        function update() {
            const pm = +m.value, years = +y.value, rate = +r.value / 100, i = rate / 12;
            const fv = n => pm * (Math.pow(1 + i, n) - 1) / i;
            const end = fv(years * 12), paid = pm * years * 12;
            $('sim-m-o').textContent = '$' + pm;
            $('sim-y-o').textContent = years + ' years';
            $('sim-r-o').textContent = (+r.value) + '%';
            $('sim-value').textContent = '$' + money(Math.round(end));
            $('sim-sub').innerHTML = 'You put in <b>$' + money(paid) + '</b>. Growth adds <b>$' + money(Math.round(end - paid)) + '</b>.';
            const W = 400, H = 150, top = 8, pts = [], paidPts = [];
            for (let k = 0; k <= 40; k++) {
                const n = years * 12 * k / 40, x = (W * k / 40).toFixed(1);
                pts.push(x + ',' + (H - (H - top) * fv(n) / end).toFixed(1));
                paidPts.push(x + ',' + (H - (H - top) * (pm * n) / end).toFixed(1));
            }
            $('sim-line').setAttribute('d', 'M' + pts.join(' L'));
            $('sim-area').setAttribute('d', 'M' + pts.join(' L') + ' L' + W + ',' + H + ' L0,' + H + ' Z');
            $('sim-paid').setAttribute('d', 'M' + paidPts.join(' L'));
            [m, y, r].forEach(fill);
        }
        [m, y, r].forEach(el => el.addEventListener('input', update));
        update();
    }

    // ---- The live Daily Challenge: three finance calls, reasoning explained either way ----
    function initQuiz() {
        const root = $('quiz');
        if (!root) return;
        const elQ = $('quiz-q'), elOpts = $('quiz-options'), elFb = $('quiz-feedback'), elNext = $('quiz-next');
        const elCount = $('quiz-count'), elXp = $('quiz-xp'), elSteps = $('quiz-steps').children;
        const elBody = $('quiz-body'), elDone = $('quiz-done'), elScore = $('quiz-score'), elMsg = $('quiz-msg');
        const XP = 25;

        const QUESTIONS = [
            { q: 'You get $50 for your birthday. You already have a $200 emergency fund and no debt. What’s the smartest first move?',
              o: ['Spend it all right away, you earned it', 'Split it: save some, spend some on something you’ll actually value', 'Lend it to a friend who says they’ll pay you back'], a: 1,
              yes: 'Your safety net is already covered, so a mix keeps things balanced: some for later, some to enjoy.',
              no: 'The best answer keeps your safety net intact while still letting you enjoy some of it.' },
            { q: 'You put $100 in an account that earns 10% a year, and the interest stays in the account. How much do you have after 2 years?',
              o: ['$110', '$120', '$121'], a: 2,
              yes: 'Year two’s interest is earned on $110, not just the original $100. That’s compounding.',
              no: 'Year one adds $10, making $110. Year two earns 10% on $110, which is $11, so you land on $121. Interest earning interest is compounding.' },
            { q: 'What does your credit score mostly tell lenders?',
              o: ['How reliably you’ve paid back what you’ve borrowed', 'How much money you earn', 'How much money you’ve saved'], a: 0,
              yes: 'Scores are built from things like paying on time and how much of your limit you use, not income or savings.',
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
                ? 'A perfect run. This is the kind of thinking the app helps you turn into a habit, one good money decision a day.'
                : score > 0
                    ? 'Solid. You now know exactly why the other one tripped you up. That’s what the lessons are for.'
                    : 'Everyone starts somewhere. That’s literally what the lessons are for, and nothing here costs a cent.';
        }
        elNext.addEventListener('click', () => { if (idx < total - 1) { idx++; render(); } else finish(); });
        $('quiz-reset').addEventListener('click', () => {
            idx = 0; score = 0; elXp.textContent = '0 XP';
            elDone.hidden = true; elBody.hidden = false; render();
            root.style.minHeight = '';
        });
        render();
    }

    // ---- Email list: posts in place (Netlify Forms) and confirms right where you typed ----
    function initSignup() {
        const form = $('footer-signup-form');
        const note = $('footer-signup-note');
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
                form.reset(); note.textContent = 'You’re on the list. Thanks!'; note.className = 'signup-note is-ok';
            }).catch(() => {
                note.textContent = 'Couldn’t sign you up just now. Please try again, or email investo.team@bruxelacademy.com.'; note.className = 'signup-note is-err';
            }).then(() => { btn.disabled = false; });
        });
    }

    // ---- Phone download bar: after the hero's own buttons leave, until the download section ----
    function initGetBar() {
        const bar = $('get-bar'), copy = $('hero-copy'), dl = $('download');
        if (!bar || !copy || !hasIO) return;
        let past = false, atEnd = false;
        const sync = () => bar.classList.toggle('show', past && !atEnd);
        new IntersectionObserver(([e]) => { past = !e.isIntersecting && e.boundingClientRect.top < 0; sync(); }).observe(copy);
        if (dl) new IntersectionObserver(([e]) => { atEnd = e.isIntersecting; sync(); }).observe(dl);
    }

    function initBackToTop() {
        const b = $('footer-top-btn');
        if (b) b.addEventListener('click', () => window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' }));
    }

    function init() {
        document.documentElement.classList.add('ready');
        initNav(); initFill(); initReveal(); initCounts(); initFaq(); initPointer();
        initDip(); initSim(); initQuiz(); initSignup(); initGetBar(); initBackToTop();
        initScrub();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
