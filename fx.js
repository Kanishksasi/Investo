/* =============================================
   INVESTO effects layer. Loaded after script.js; the page works without it.
   1. Inertia scroll (Lenis), with in-page links routed through it
   2. The living background: a WebGL2 field of engraved, flowing guilloche lines, the same kind of
      engraving printed on banknotes. It reacts to scroll, the cursor, and the practice story's mood.
   3. Scroll velocity, handed to the elements that skew with it
   4. Scrubbed text: a paragraph lights up word by word as you read down it
   Phones and reduced motion get a still frame of the background and native scrolling.
   ============================================= */
(function () {
    'use strict';

    const root = document.documentElement;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const coarse = window.matchMedia('(pointer: coarse)');
    const clamp01 = v => Math.max(0, Math.min(1, v));
    const lerp = (a, b, t) => a + (b - a) * t;

    /* ---------- 1. Inertia scroll ---------- */
    let lenis = null;
    function initLenis() {
        if (!window.Lenis || reduce.matches || coarse.matches) return;
        lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 0.95, smoothWheel: true });
        window.__lenis = lenis;
        if (root.classList.contains('loading')) {
            lenis.stop();
            document.addEventListener('investo:ready', () => lenis && lenis.start(), { once: true });
        }
        // In-page links glide instead of jumping, and land clear of the nav
        document.addEventListener('click', e => {
            const a = e.target.closest && e.target.closest('a[href^="#"]');
            if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
            const id = a.getAttribute('href');
            if (!id || id === '#') return;
            const el = id === '#top' ? null : document.querySelector(id);
            if (id !== '#top' && !el) return;
            e.preventDefault();
            const nav = document.getElementById('main-nav');
            lenis.scrollTo(el || 0, { offset: el ? -((nav ? nav.offsetHeight : 68) + 8) : 0, duration: 1.7, easing: t => 1 - Math.pow(1 - t, 4) });
            if (history.replaceState) history.replaceState(null, '', id);
        });
    }

    /* ---------- 3. Scroll velocity ---------- */
    const velEls = Array.prototype.slice.call(document.querySelectorAll('[data-vel]'));
    let lastY = window.scrollY, vel = 0, lastV = 0;
    function updateVel() {
        const y = window.scrollY;
        vel = lerp(vel, y - lastY, 0.16);
        lastY = y;
        const v = Math.max(-1, Math.min(1, vel / 46));
        if (Math.abs(v - lastV) < 0.004) return;
        lastV = v;
        const s = v.toFixed(3);
        for (let i = 0; i < velEls.length; i++) velEls[i].style.setProperty('--vel', s);
    }

    /* ---------- 2. The living background ---------- */
    const VS = '#version 300 es\nvoid main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }';
    const FS = `#version 300 es
precision highp float;
out vec4 o;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uScroll;
uniform float uMood;

vec2 h2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return -1.0 + 2.0 * fract(sin(p) * 43758.5453123); }
float gn(vec2 p){
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(dot(h2(i), f), dot(h2(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
               mix(dot(h2(i + vec2(0, 1)), f - vec2(0, 1)), dot(h2(i + vec2(1, 1)), f - vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p){
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 4; i++) { s += a * gn(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= 0.5; }
    return s;
}
// a hairline wherever k crosses a whole number, kept about one pixel wide however it is scaled
vec3 emeraldGlow(float f, float ridge){ return vec3(0.05, 0.20, 0.11) * ridge * ridge * 0.6; }
float contour(float k, float width){
    float d = abs(fract(k + 0.5) - 0.5);
    float w = fwidth(k);
    float fade = 1.0 - smoothstep(0.30, 0.60, w);              // lines too tight to resolve dissolve instead of turning to mush
    return (1.0 - smoothstep(0.0, w * width, d)) * fade;
}

void main(){
    vec2 uv = gl_FragCoord.xy / uRes;
    float asp = uRes.x / uRes.y;
    vec2 ps = (uv - 0.5) * vec2(asp, 1.0) * 1.55;
    vec2 ms = (uMouse - 0.5) * vec2(asp, 1.0) * 1.55;
    float md = length(ps - ms);
    vec2 p = ps + (ps - ms) * exp(-md * md * 5.0) * 0.22;      // the cursor pushes the lines aside
    p.y -= uScroll * 0.00042;                                   // scrolling carries the field with it

    float t = uTime * 0.05;
    vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));
    float f = fbm(p + 2.4 * q + vec2(1.7, 9.2) + 0.6 * t);

    // a second field, turned and warped differently: where the two sets of hairlines cross they interfere,
    // the same moire that makes banknote engraving shimmer
    vec2 p2 = mat2(0.80, 0.60, -0.60, 0.80) * p * 1.15 + vec2(3.7, 1.9);
    float f2 = fbm(p2 + 2.0 * q.yx + 0.5 * t);
    float l1 = contour(f * 22.0 + q.x * 4.0, 1.1);
    float l2 = contour(f2 * 27.0 + q.y * 4.0, 1.0);

    vec3 deep = vec3(0.012, 0.045, 0.028);
    vec3 mid  = vec3(0.030, 0.115, 0.062);
    vec3 emerald = vec3(0.16, 0.62, 0.36);
    vec3 gold = vec3(0.90, 0.72, 0.32);
    vec3 rust = vec3(0.86, 0.32, 0.20);
    vec3 warm = uMood >= 0.0 ? gold : rust;
    vec3 lineCol = mix(emerald, warm, abs(uMood) * 0.85);

    float g = smoothstep(-0.35, 0.45, f);
    float ridge = smoothstep(0.1, 0.5, f);
    vec3 col = mix(deep, mid, g);
    col += lineCol * l1 * (0.20 + 0.28 * ridge);
    col += lineCol * l2 * (0.09 + 0.10 * (1.0 - ridge));
    col += gold * l1 * smoothstep(0.30, 0.55, f) * 0.30 * (1.0 - abs(uMood) * 0.5);   // the engraving catches a little gold on its crests
    col += emeraldGlow(f, ridge);
    col += warm * abs(uMood) * 0.05 * g;
    col += vec3(0.08, 0.30, 0.18) * exp(-md * md * 3.0) * 0.45;

    float vg = smoothstep(1.25, 0.25, length((uv - 0.5) * vec2(1.0, 1.15)));
    col *= mix(0.55, 1.0, vg);
    col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
    o = vec4(col, 1.0);
}`;

    function initBG() {
        const canvas = document.getElementById('bg');
        if (!canvas) return null;
        const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
        if (!gl) { canvas.remove(); return null; }
        const shader = (type, src) => {
            const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
            return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
        };
        const vs = shader(gl.VERTEX_SHADER, VS), fs = shader(gl.FRAGMENT_SHADER, FS);
        if (!vs || !fs) { canvas.remove(); return null; }
        const prog = gl.createProgram();
        gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return null; }
        gl.useProgram(prog);
        const U = n => gl.getUniformLocation(prog, n);
        const uRes = U('uRes'), uTime = U('uTime'), uMouse = U('uMouse'), uScroll = U('uScroll'), uMood = U('uMood');

        let scale = coarse.matches ? 0.5 : 0.7, lastW = 0, lastH = 0;
        function resize(force) {
            const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
            const w = Math.max(2, Math.round(window.innerWidth * dpr * scale));
            const h = Math.max(2, Math.round(window.innerHeight * dpr * scale));
            // phone toolbars grow and shrink the viewport while scrolling; ignore small height changes
            if (!force && w === lastW && Math.abs(h - lastH) < 120) return;
            lastW = w; lastH = h;
            canvas.width = w; canvas.height = h;
            gl.viewport(0, 0, w, h);
            gl.uniform2f(uRes, w, h);
        }
        resize(true);
        canvas.classList.add('is-live');
        root.classList.add('has-bg');

        const mouse = { x: 0.62, y: 0.55, tx: 0.62, ty: 0.55 };
        window.addEventListener('pointermove', e => {
            if (e.pointerType !== 'mouse') return;
            mouse.tx = e.clientX / window.innerWidth; mouse.ty = 1 - e.clientY / window.innerHeight;
        }, { passive: true });

        let mood = 0, moodTarget = 0;
        document.addEventListener('investo:mood', e => { moodTarget = e.detail || 0; });

        let ema = 16, frames = 0;
        function draw(t, dt) {
            mouse.x = lerp(mouse.x, mouse.tx, 0.06); mouse.y = lerp(mouse.y, mouse.ty, 0.06);
            mood = lerp(mood, moodTarget, 0.035);
            gl.uniform1f(uTime, reduce.matches ? 18.0 : t / 1000);
            gl.uniform2f(uMouse, mouse.x, mouse.y);
            gl.uniform1f(uScroll, window.scrollY);
            gl.uniform1f(uMood, mood);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            // If the machine is struggling, drop the resolution (the lines stay soft and thin)
            ema = ema * 0.95 + dt * 0.05; frames++;
            if (frames > 90 && ema > 30 && scale > 0.4) { scale = Math.max(0.4, scale - 0.12); resize(true); frames = 0; ema = 16; }
        }
        window.addEventListener('resize', () => { resize(false); if (reduce.matches) draw(0, 16); }, { passive: true });
        return { draw };
    }

    /* ---------- 4. Scrubbed text ---------- */
    function initFill() {
        const els = Array.prototype.slice.call(document.querySelectorAll('[data-fill]'));
        if (!els.length || reduce.matches) return;
        els.forEach(el => {
            let i = 0;
            const walk = node => {
                Array.prototype.slice.call(node.childNodes).forEach(n => {
                    if (n.nodeType === 3) {
                        const frag = document.createDocumentFragment();
                        n.textContent.split(/(\s+)/).forEach(tok => {
                            if (!tok) return;
                            if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
                            const w = document.createElement('span'); w.className = 'fw'; w.style.setProperty('--i', String(i++)); w.textContent = tok;
                            frag.appendChild(w);
                        });
                        n.parentNode.replaceChild(frag, n);
                    } else if (n.nodeType === 1) walk(n);
                });
            };
            walk(el);
            el.style.setProperty('--n', String(i));
            el.style.setProperty('--p', '0');
        });
        let queued = false;
        function paint() {
            queued = false;
            const vh = window.innerHeight;
            els.forEach(el => {
                const r = el.getBoundingClientRect();
                if (r.bottom < -100 || r.top > vh + 100) return;
                el.style.setProperty('--p', clamp01((vh * 0.88 - r.top) / (vh * 0.5 + r.height * 0.7)).toFixed(4));
            });
        }
        window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(paint); } }, { passive: true });
        window.addEventListener('resize', paint, { passive: true });
        paint();
    }

    /* ---------- 5. Tilt: a card turns toward the cursor, with a glare that follows it ---------- */
    function initTilt() {
        if (coarse.matches || reduce.matches) return;
        document.querySelectorAll('[data-tilt]').forEach(el => {
            let raf = null, tx = 0, ty = 0, cx = 0, cy = 0;
            const loop = () => {
                raf = null;
                cx = lerp(cx, tx, 0.12); cy = lerp(cy, ty, 0.12);
                el.style.setProperty('--rx', (cy * -6).toFixed(2) + 'deg');
                el.style.setProperty('--ry', (cx * 8).toFixed(2) + 'deg');
                if (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002) raf = requestAnimationFrame(loop);
            };
            el.addEventListener('pointermove', e => {
                if (e.pointerType !== 'mouse') return;
                const r = el.getBoundingClientRect();
                tx = ((e.clientX - r.left) / r.width - 0.5) * 2; ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
                el.style.setProperty('--gx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
                el.style.setProperty('--gy', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
                if (!raf) raf = requestAnimationFrame(loop);
            }, { passive: true });
            el.addEventListener('pointerleave', () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(loop); });
        });
    }

    /* ---------- Go ---------- */
    function init() {
        initLenis();
        initFill();
        initTilt();
        const bg = initBG();
        let last = performance.now();
        if (reduce.matches) { if (bg) bg.draw(0, 16); return; }
        function frame(t) {
            const dt = t - last; last = t;
            if (lenis) lenis.raf(t);
            updateVel();
            if (bg) bg.draw(t, dt);
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
