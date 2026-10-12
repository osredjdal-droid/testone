/* Shohraty — «قلنالو الحقيقة» — deterministic renderer.
   Every frame is a pure function of time: window.render(t) sets all styles, so
   tools/render.mjs can step through frames one by one. All timings come from
   timeline.js (built from the ElevenLabs voice-over + Scribe word timings), so
   every card, chart and label lands on the word that names it.
   window.CUES lists the sound-design hits; tools/mix_audio.py places them. */
(() => {
  const TL = window.TL;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const eOut = k => 1 - Math.pow(1 - k, 3);
  const eInOut = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const eBack = k => { const c = 1.5; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
  const prog = (t, a, d) => clamp((t - a) / d);
  const $ = s => document.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';

  /* ---------- voice-over anchors ---------- */
  const LINE = n => TL.lines[n - 1];
  const W = (n, k = 0) => LINE(n).words[Math.min(k, LINE(n).words.length - 1)].t0;   // word start
  const WE = (n, k) => LINE(n).words[Math.min(k, LINE(n).words.length - 1)].t1;       // word end
  const LE = n => LINE(n).end;
  const at = s => { const [n, k] = s.split('.').map(Number); return W(n, k); };

  const CUES = [];
  const cue = (t, kind, gain = 1) => { CUES.push({ t: +t.toFixed(3), kind, gain }); return t; };

  const money = v => `${Math.round(v).toLocaleString('fr-FR')} $`;

  const LAYOUT = [];                                   // measurements that need final fonts
  const onLayout = fn => LAYOUT.push(fn);

  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function svgText(parent, x, y, txt, attrs = {}) {
    const ar = /[\u0600-\u06FF]/.test(txt);
    const e = svgEl('text', { x, y, 'text-anchor': 'middle', 'font-weight': 800, direction: ar ? 'rtl' : 'ltr',
      style: `unicode-bidi:isolate;font-family:${ar ? "'Noto Kufi Arabic'" : "'Roboto'"}`, ...attrs }, parent);
    e.textContent = txt;
    return e;
  }

  /* ---------- icons (Lucide-style, 24px grid, rounded strokes) ---------- */
  const ICONS = {
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    banknote: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    percent: '<line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    sliders: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
    arrowDown: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
    arrowUp: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    snowflake: '<line x1="2" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="22"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20 4-4 4 4"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    userX: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" x2="22" y1="8" y2="13"/><line x1="22" x2="17" y1="8" y2="13"/>',
    store: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/>',
    pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
    message: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    trending: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    trendingDown: '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>',
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    tag: '<path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    layers: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
    smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
    volumeX: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>',
    sofa: '<path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z"/><path d="M4 18v2"/><path d="M20 18v2"/>',
    ear: '<path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0"/><path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4"/>',
    coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
  };
  const iconSvg = (name, size, sw = 2) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex:none">${ICONS[name]}</svg>`;
  document.querySelectorAll('i[data-icon]').forEach(i => {
    i.outerHTML = iconSvg(i.dataset.icon, +i.dataset.size || 32, +i.dataset.sw || 2);
  });
  function svgIcon(parent, name, cx, cy, size, color, sw = 2.2) {
    const g = svgEl('svg', { x: cx - size / 2, y: cy - size / 2, width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: color, 'stroke-width': sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, parent);
    g.innerHTML = ICONS[name];
    return g;
  }
  // a pill label drawn in SVG (chart annotations)
  function svgPill(parent, cx, cy, txt, { fill = '#653DC7', color = '#fff', size = 30, icon, padX = 26, w } = {}) {
    const g = svgEl('g', {}, parent);
    const width = w || txt.length * size * 0.56 + padX * 2 + (icon ? size + 10 : 0);
    const h = size * 1.75;
    svgEl('rect', { x: cx - width / 2, y: cy - h / 2, width, height: h, rx: h / 2, fill }, g);
    const tx = icon ? cx - (size + 10) / 2 : cx;
    svgText(g, tx, cy + size * 0.36, txt, { 'font-size': size, fill: color });
    if (icon) svgIcon(g, icon, cx + width / 2 - padX - size / 2 + 4, cy, size, color, 2.6);
    return g;
  }

  /* ---------- animation helpers ---------- */
  function fadeUp(el, t, a, d = 0.45, dy = 34) {
    const k = eOut(prog(t, a, d));
    el.style.opacity = k;
    el.style.transform = k >= 1 ? 'none' : `translateY(${(1 - k) * dy}px)`;
    return k;
  }
  function popIn(el, t, a, d = 0.42, s0 = 0.8, base = '') {
    const k = prog(t, a, d);
    el.style.opacity = eOut(Math.min(1, k * 1.6));
    el.style.transform = `${base} scale(${lerp(s0, 1, eBack(k))})`;
    return k;
  }
  function draw(el, k) {
    const L = el.__len || (el.__len = el.getTotalLength());
    el.style.strokeDasharray = `${L} ${L + 2}`;
    el.style.strokeDashoffset = L * (1 - k);
  }
  function svgPop(el, t, a, d = 0.38, s0 = 0.5) {
    const k = prog(t, a, d);
    el.style.opacity = eOut(Math.min(1, k * 1.6));
    el.style.transformBox = 'fill-box';
    el.style.transformOrigin = 'center';
    el.style.transform = `scale(${lerp(s0, 1, eBack(k))})`;
    return k;
  }
  function dim(el, t, a, to = 0.42, d = 0.4) {
    const k = eOut(prog(t, a, d));
    el.style.opacity = lerp(1, to, k) * (+el.style.opacity || 1);
  }
  // reveal an SVG element right → left (RTL time axis) through a clip rectangle
  let clipN = 0;
  function clipReveal(svg, el, xL, xR) {
    const id = `clip${++clipN}`;
    const defs = svg.querySelector('defs') || svgEl('defs', {}, svg);
    const cp = svgEl('clipPath', { id }, defs);
    const r = svgEl('rect', { x: xR, y: -200, width: 0, height: 1200 }, cp);
    el.setAttribute('clip-path', `url(#${id})`);
    return k => { r.setAttribute('x', xR - k * (xR - xL)); r.setAttribute('width', k * (xR - xL) + 20); };
  }
  function count(el, t, a, d, from, to, fmt = money) {
    el.textContent = fmt(lerp(from, to, eInOut(prog(t, a, d))));
  }

  /* ---------- headline words that appear as they are spoken ---------- */
  function splitWords(root) {
    const words = [];
    const walk = node => {
      for (const ch of [...node.childNodes]) {
        if (ch.nodeType === 3) {
          const frag = document.createDocumentFragment();
          for (const part of ch.textContent.split(/(\s+)/)) {
            if (!part) continue;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); continue; }
            const s = document.createElement('span');
            s.className = 'w';
            s.textContent = part;
            frag.appendChild(s);
            words.push(s);
          }
          node.replaceChild(frag, ch);
        } else if (ch.nodeType === 1 && !ch.classList.contains('w')) {
          walk(ch);
        }
      }
    };
    walk(root);
    return words;
  }
  const SAY = [];
  document.querySelectorAll('.say[data-at]').forEach(el => {
    const [n, k] = el.dataset.at.split('.').map(Number);
    const map = el.dataset.map ? el.dataset.map.split(',').map(Number) : null;
    splitWords(el).forEach((w, i) => SAY.push({ el: w, t0: W(n, map ? map[i] : k + i) - 0.08 }));
  });
  function updateSay(t) {
    for (const w of SAY) {
      const k = eOut(prog(t, w.t0, 0.4));
      w.el.style.opacity = k;
      w.el.style.transform = k >= 1 ? 'none' : `translateY(${(1 - k) * 0.3}em)`;
      w.el.style.filter = k >= 1 ? 'none' : `blur(${(1 - k) * 6}px)`;
    }
  }

  /* ---------- karaoke captions (Shohraty CaptionPlate) ---------- */
  const NO_CAPTION = new Set([6, 7, 8, 11, 20]);   // the line is already on screen word for word
  const capRoot = $('#captions');
  const CAPS = TL.captions.filter(p => !NO_CAPTION.has(p.line)).map(p => {
    const el = document.createElement('div');
    el.className = 'cap';
    p.words.forEach((w, i) => {
      if (i) el.appendChild(document.createTextNode(' '));
      const s = document.createElement('span');
      s.className = 'cw';
      s.textContent = w.w;
      el.appendChild(s);
    });
    capRoot.appendChild(el);
    return { ...p, el, spans: [...el.querySelectorAll('.cw')] };
  });
  function updateCaptions(t) {
    for (const c of CAPS) {
      const kIn = eOut(prog(t, c.start, 0.18)), kOut = prog(t, c.end - 0.12, 0.12);
      const a = t < c.start || t > c.end ? 0 : kIn * (1 - kOut);
      c.el.style.display = a > 0 ? 'block' : 'none';
      if (a <= 0) continue;
      c.el.style.opacity = a;
      c.el.style.transform = `translateY(${(1 - kIn) * 18}px)`;
      c.spans.forEach((s, i) => {
        const w = c.words[i], nxt = c.words[i + 1];
        const end = nxt ? nxt.t0 : w.t1;
        s.className = t >= w.t0 - 0.03 && t < end - 0.03 ? 'cw on' : t >= end - 0.03 ? 'cw done' : 'cw';
      });
    }
  }

  /* ---------- decorative C-arc motif (from the logo) per scene ---------- */
  const ARCS = {
    s1: [990, 1760, 270], s2: [980, 1730, 300], s3: [80, 1740, 260], s4: [960, 1740, 330], s5: [990, 1760, 240],
    s6: [980, 1740, 280], s7: [950, 1730, 300], s8: [90, 1740, 270], s9: [990, 1740, 250], s10: [960, 1740, 330],
    s11: [100, 1740, 280], s12: [980, 1740, 260], s13: [880, 260, 320],
  };
  const arcEls = {};
  for (const s of TL.scenes) {
    const [cx, cy, r] = ARCS[s.id];
    const dark = s.kind === 'dark';
    const scene = document.getElementById(s.id);
    const svg = svgEl('svg', { class: 'arc', width: 1080, height: 1920, viewBox: '0 0 1080 1920', style: 'left:0;top:0' });
    scene.insertBefore(svg, scene.querySelector('.fg'));
    const c = svgEl('circle', { cx, cy, r, fill: 'none', stroke: dark ? '#7B55D9' : '#653DC7', 'stroke-opacity': dark ? 0.32 : 0.07,
      'stroke-width': r * 0.24, 'stroke-linecap': 'round', 'stroke-dasharray': `${2 * Math.PI * r * 0.72} ${2 * Math.PI * r * 0.28}` }, svg);
    const dot = dark ? svgEl('circle', { cx: cx + r * 0.93, cy: cy - r * 0.93, r: r * 0.085, fill: '#FFB400' }, svg) : null;
    arcEls[s.id] = { c, dot, cx, cy };
  }
  function updateArc(s, t) {
    const { c, dot, cx, cy } = arcEls[s.id];
    c.setAttribute('transform', `rotate(${-60 + (t - s.start) * 4} ${cx} ${cy})`);
    if (dot) dot.setAttribute('transform', `rotate(${(t - s.start) * 4} ${cx} ${cy})`);
  }

  /* =====================================================================
     Scene choreography — each scene computes its anchors once, registers
     its sound cues, and returns update(t, scene).
     ===================================================================== */
  const UPD = {};
  const grow = (el, k, axis = 'X') => { el.style.transformOrigin = axis === 'X' ? '100% 50%' : '50% 100%'; el.style.transform = `scale${axis}(${k})`; };
  const mixColor = (a, b, k) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], k))).join(',')})`;

  // Shohraty "Signature portrait" medallion (faceless duotone silhouette, gold rim)
  function portrait(el, size) {
    el.innerHTML = `<svg viewBox="0 0 120 120" width="${size}" height="${size}">
      <defs><linearGradient id="pbg" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#2D1B69"/><stop offset="1" stop-color="#120830"/></linearGradient>
      <linearGradient id="pcl" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#7B55D9"/><stop offset="1" stop-color="#3F2493"/></linearGradient>
      <clipPath id="pcp"><circle cx="60" cy="60" r="54"/></clipPath></defs>
      <circle cx="60" cy="60" r="58" fill="none" stroke="#FFB400" stroke-width="1.6"/>
      <circle cx="60" cy="60" r="54" fill="url(#pbg)"/>
      <g clip-path="url(#pcp)">
        <path d="M18 122 C18 98 36 88 60 88 C84 88 102 98 102 122 Z" fill="url(#pcl)"/>
        <ellipse cx="60" cy="58" rx="17" ry="20" fill="url(#pcl)"/>
        <path d="M43 50 C44 36 76 34 77 50 C70 44 52 44 43 50Z" fill="#1A0D45"/>
        <path d="M77 52 C80 62 76 72 70 77" fill="none" stroke="#FFB400" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>
        <path d="M86 92 C95 97 100 106 101 116" fill="none" stroke="#FFB400" stroke-width="1.4" stroke-linecap="round" opacity=".8"/>
      </g></svg>`;
  }

  // 01 — a client came to us and told us about his business; he asked for a marketing plan
  UPD.s1 = (() => {
    portrait($('#s1av'), 92);
    const rows = ['#s1r1', '#s1r2', '#s1r3'].map(q => $(q));
    const T = { card: W(1, 2) - 0.25, rows: [W(1, 6) - 0.12, W(1, 7) - 0.12, W(1, 8) - 0.12], chip: W(1, 11), ask: W(2, 0) - 0.12 };
    cue(T.card + 0.1, 'pop', 0.6); T.rows.forEach(r => cue(r, 'tick', 0.7)); cue(T.ask, 'pop2');
    return (t, s) => {
      fadeUp($('#s1card'), t, T.card, 0.5, 50);
      popIn($('#s1av'), t, T.card + 0.15, 0.45, 0.5);
      rows.forEach((r, i) => {
        const k = fadeUp(r, t, T.rows[i], 0.4, 24);
        r.querySelectorAll('.lines i').forEach((l, j) => grow(l, eOut(prog(t, T.rows[i] + 0.2 + j * 0.1, 0.5))));
        r.style.background = `rgba(255,255,255,${0.06 + 0.06 * Math.exp(-Math.max(0, t - T.rows[i] - 0.3) * 2) * (k > 0 ? 1 : 0)})`;
      });
      popIn($('#s1chip'), t, T.chip, 0.4, 0.6);
      const ka = prog(t, T.ask, 0.5);
      const ask = $('#s1ask');
      ask.style.opacity = eOut(Math.min(1, ka * 2));
      ask.style.transformOrigin = '100% 100%';
      ask.style.transform = `translateY(${(1 - eOut(ka)) * 30}px) scale(${lerp(0.6, 1, eBack(ka))})`;
    };
  })();

  // 02 — the simple option: take the info as it comes, build the plan on it, leave; if it works, fine
  UPD.s2 = (() => {
    const svg = $('#s2svg');
    const track = svgEl('path', { d: 'M870 500 H18', fill: 'none', stroke: 'rgba(101,61,199,0.18)', 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-dasharray': '2 16' }, svg);
    const chev = [601, 286].map(x => svgEl('path', { d: `M${x + 12} 170 L${x - 10} 192 L${x + 12} 214`, fill: 'none', stroke: '#653DC7', 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg));
    const dots = [...Array(7)].map(() => svgEl('rect', { width: 34, height: 18, rx: 6, y: 491, fill: '#B79BF0' }, svg));
    const cards = ['#s2a', '#s2b', '#s2c'].map(q => $(q));
    const T = { eb: W(3, 0) - 0.12, cards: [W(3, 6) - 0.12, W(3, 10) - 0.12, W(3, 13) - 0.12], ok: W(4, 0) - 0.15, mark: W(4, 3) - 0.1 };
    T.cards.forEach(c => cue(c, 'pop', 0.7)); cue(T.mark, 'pop2', 0.8);
    return (t, s) => {
      fadeUp($('#s2eb'), t, T.eb);
      cards.forEach((c, i) => popIn(c, t, T.cards[i], 0.42, 0.75));
      chev.forEach((c, i) => { c.style.opacity = eOut(prog(t, T.cards[i + 1] - 0.2, 0.3)); });
      const kt = eOut(prog(t, T.cards[0], 0.6));
      track.style.opacity = kt;
      dots.forEach((d, i) => {                       // a conveyor: information in, plan out, no questions asked
        const x = 860 - (((t - s.start) * 150 + i * 130) % 900);
        d.setAttribute('x', x);
        d.style.opacity = kt * clamp(Math.min(860 - x, x) / 60) * 0.9;
      });
      fadeUp($('#s2ok'), t, T.ok, 0.45, 30);
      const mk = $('#s2ok span');
      popIn(mk, t, T.mark, 0.4, 0.4);
    };
  })();

  // 03 — if it fails, the excuse is already written
  UPD.s3 = (() => {
    const T = { box: W(5, 3) - 0.25, n1: W(6, 0) - 0.2, you: W(6, 3) - 0.05, n2: W(7, 0) - 0.2 };
    cue(T.box, 'pop', 0.6); cue(T.n1 + 0.1, 'rise', 0.7); cue(T.n2 + 0.1, 'rise', 0.7); cue(T.you, 'tick', 0.9);
    const note = (el, t, a, rot) => {
      const k = prog(t, a, 0.6);
      el.style.opacity = eOut(Math.min(1, k * 2.5));
      el.style.transform = `translateY(${(1 - eOut(k)) * 420}px) rotate(${lerp(0, rot, eOut(k))}deg) scale(${lerp(0.55, 1, eBack(k))})`;
    };
    return t => {
      fadeUp($('#s3box'), t, T.box, 0.45, 40);
      note($('#s3n1'), t, T.n1, -2.5);
      note($('#s3n2'), t, T.n2, 2);
      const you = $('#s3n1 .you');
      const p = t >= T.you ? Math.exp(-(t - T.you) * 2.2) : 0;
      you.style.display = 'inline-block';
      you.style.transform = `scale(${1 + 0.25 * p})`;
      you.style.textShadow = `0 0 ${18 * p}px rgba(209,0,95,${0.5 * p})`;
    };
  })();

  // 04 — the easy road: no problem, no hard talk; the client is comfortable and we are covered
  UPD.s4 = (() => {
    const svg = $('#s4svg');
    const Y = 230;
    svgEl('path', { d: `M880 ${Y} H8`, fill: 'none', stroke: 'rgba(255,255,255,0.09)', 'stroke-width': 96, 'stroke-linecap': 'round' }, svg);
    const lane = svgEl('path', { d: `M860 ${Y} H28`, fill: 'none', stroke: 'rgba(255,180,0,0.65)', 'stroke-width': 6, 'stroke-dasharray': '28 22', 'stroke-linecap': 'round' }, svg);
    const laneReveal = clipReveal(svg, lane, 20, 870);
    const car = svgEl('g', {}, svg);
    svgEl('circle', { r: 26, fill: '#FFB400' }, car);
    svgEl('circle', { r: 46, fill: 'rgba(255,180,0,0.18)' }, car);
    const signs = [['ولا مشكلة', 640], ['ولا نقاش صعيب', 260]].map(([txt, x]) => {
      const g = svgEl('g', {}, svg);
      svgEl('line', { x1: x, y1: Y - 60, x2: x, y2: Y - 130, stroke: 'rgba(255,255,255,0.35)', 'stroke-width': 4, 'stroke-linecap': 'round' }, g);
      svgPill(g, x, Y - 160, txt, { fill: 'rgba(255,255,255,0.12)', color: '#fff', size: 32, icon: 'check', w: txt.length * 19 + 120 });
      return g;
    });
    const T = { lane: W(8, 1), s1: W(9, 2) - 0.1, s2: W(9, 6) - 0.1, a: W(10, 0) - 0.12, b: W(10, 3) - 0.12 };
    cue(T.s1, 'pop', 0.6); cue(T.s2, 'pop', 0.6); cue(T.a, 'pop', 0.7); cue(T.b, 'pop', 0.7);
    return (t, s) => {
      laneReveal(eInOut(prog(t, T.lane, 1.2)));
      const kc = prog(t, T.lane, 6);
      car.setAttribute('transform', `translate(${lerp(840, 60, kc)} ${Y})`);
      car.style.opacity = eOut(prog(t, T.lane, 0.4)) * (1 - prog(t, T.lane + 5.6, 0.4));
      svgPop(signs[0], t, T.s1); svgPop(signs[1], t, T.s2);
      fadeUp($('#s4a'), t, T.a, 0.45, 40);
      fadeUp($('#s4b'), t, T.b, 0.45, 40);
    };
  })();

  // 05 — but we chose another road: we told him the truth as it is
  UPD.s5 = (() => {
    const svg = $('#s5svg');
    const trunk = svgEl('path', { d: 'M840 500 C730 490 620 450 520 390', fill: 'none', stroke: '#653DC7', 'stroke-width': 18, 'stroke-linecap': 'round' }, svg);
    const easy = svgEl('path', { d: 'M520 390 C420 330 260 330 40 340', fill: 'none', stroke: '#C9C6D3', 'stroke-width': 18, 'stroke-linecap': 'round' }, svg);
    const other = svgEl('path', { d: 'M520 390 C440 300 330 170 130 70', fill: 'none', stroke: '#653DC7', 'stroke-width': 18, 'stroke-linecap': 'round' }, svg);
    const flag = svgEl('g', {}, svg);
    svgEl('line', { x1: 130, y1: 70, x2: 130, y2: -10, stroke: '#1A1A2E', 'stroke-width': 5, 'stroke-linecap': 'round' }, flag);
    svgEl('path', { d: 'M130 -10 L82 6 L130 22 Z', fill: '#653DC7' }, flag);
    const lEasy = svgPill(svg, 170, 400, 'الساهلة', { fill: '#ECEBF1', color: '#8A8A96', size: 30, w: 170 });
    const lOther = svgPill(svg, 330, 150, 'طريق آخر', { fill: '#653DC7', color: '#fff', size: 32, w: 210 });
    const T = { trunk: 0.1, easy: W(11, 0), other: W(11, 2) - 0.1, truth: W(12, 0) - 0.2 };
    cue(T.other + 0.1, 'rise', 0.9); cue(T.truth, 'pop2', 0.8);
    return (t, s) => {
      draw(trunk, eInOut(prog(t, s.start + T.trunk, 0.6)));
      draw(easy, eInOut(prog(t, T.easy, 0.6)));
      svgPop(lEasy, t, T.easy + 0.3);
      const fadeEasy = 1 - 0.55 * eOut(prog(t, T.other, 0.5));
      easy.style.opacity = fadeEasy; lEasy.style.opacity = +lEasy.style.opacity * fadeEasy;
      draw(other, eInOut(prog(t, T.other, 0.8)));
      svgPop(flag, t, T.other + 0.7, 0.4, 0.3);
      svgPop(lOther, t, T.other + 0.4);
      fadeUp($('#s5truth'), t, T.truth, 0.5, 40);
    };
  })();

  // 06 — the diagnosis: small audience, unclear offer, positioning that doesn't show the real value
  UPD.s6 = (() => {
    const P = [101, 61, 199];
    const ROWS = [
      { f: '#s6f1', c: '#s6c1', to: 0.28, col: [224, 134, 0], t: W(13, 1) - 0.15 },
      { f: '#s6f2', c: '#s6c2', to: 0.36, col: [224, 134, 0], t: W(14, 1) - 0.15 },
      { f: '#s6f3', c: '#s6c3', to: 0.22, col: [209, 0, 95], t: W(15, 3) - 0.15 },
    ];
    ROWS.forEach(r => cue(r.t + 0.1, 'drop', 0.7));
    return (t, s) => {
      fadeUp($('#s6eb'), t, s.start + 0.15);
      fadeUp($('#s6h'), t, s.start + 0.25, 0.45, 26);
      fadeUp($('#s6card'), t, s.start + 0.3, 0.5, 40);
      ROWS.forEach(r => {
        const k = eInOut(prog(t, r.t, 0.7));
        const f = $(r.f);
        f.style.width = `${lerp(100, r.to * 100, k) * eOut(prog(t, s.start + 0.4, 0.6))}%`;
        f.style.background = k > 0 ? mixColor(P, r.col, k) : '';
        popIn($(r.c), t, r.t + 0.35, 0.4, 0.6);
      });
    };
  })();

  // 07 — no client likes being told he's wrong… we almost kept quiet
  UPD.s7 = (() => {
    const TXT = 'راك غالط.';
    const txt = $('#s7txt'), caret = $('#s7caret');
    const T = { h: W(16, 0) - 0.15, box: W(16, 3) - 0.2, type0: W(16, 5), type1: WE(16, 7) + 0.1, del0: W(17, 0) + 0.1, del1: W(17, 2) + 0.2, quiet: W(17, 3) - 0.12 };
    const N = [...TXT].length;
    for (let i = 0; i < N; i++) cue(T.type0 + (i / N) * (T.type1 - T.type0), 'key', 0.6);
    cue(T.quiet, 'pop', 0.7);
    return t => {
      fadeUp($('#s7h'), t, T.h, 0.45, 26);
      fadeUp($('#s7box'), t, T.box, 0.45, 30);
      const typed = Math.floor(N * prog(t, T.type0, T.type1 - T.type0));
      const deleted = Math.floor(N * prog(t, T.del0, T.del1 - T.del0));
      txt.textContent = [...TXT].slice(0, Math.max(0, typed - deleted)).join('');
      caret.style.opacity = (t > T.type0 && t < T.type1) || (t > T.del0 && t < T.del1) ? 1 : (Math.floor(t * 2.2) % 2 ? 1 : 0.15);
      popIn($('#s7quiet'), t, T.quiet, 0.45, 0.6);
      fadeUp($('#s7dots'), t, T.quiet + 0.35, 0.35, 12);
      $('#s7dots').querySelectorAll('.d').forEach((d, i) => { d.style.transform = `translateY(${-8 * Math.max(0, Math.sin((t - T.quiet) * 6 - i * 0.9))}px)`; d.style.opacity = 0.5 + 0.5 * Math.max(0, Math.sin((t - T.quiet) * 6 - i * 0.9)); });
    };
  })();

  // 08 — staying quiet means building on a plan we know won't work: fine at first, damage later
  UPD.s8 = (() => {
    const svg = $('#s8svg');
    const B = 470;
    [140, 260, 380].forEach(y => svgEl('line', { x1: 30, y1: y, x2: 806, y2: y, stroke: 'rgba(101,61,199,0.07)', 'stroke-width': 2 }, svg));
    svgEl('line', { x1: 30, y1: B, x2: 806, y2: B, stroke: 'rgba(101,61,199,0.22)', 'stroke-width': 3 }, svg);
    const axis = svgEl('g', {}, svg);
    svgEl('path', { d: `M560 ${B + 52} H300 M318 ${B + 38} L300 ${B + 52} L318 ${B + 66}`, fill: 'none', stroke: 'rgba(101,61,199,0.45)', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, axis);
    svgText(axis, 640, B + 62, 'الوقت', { 'font-size': 28, fill: '#666' });
    const now = svgEl('path', { d: 'M790 300 C700 296 600 288 470 280', fill: 'none', stroke: '#653DC7', 'stroke-width': 9, 'stroke-linecap': 'round' }, svg);
    const dmg = svgEl('path', { d: 'M470 280 C380 276 320 300 250 350 S120 430 50 450', fill: 'none', stroke: '#D1005F', 'stroke-width': 9, 'stroke-linecap': 'round' }, svg);
    const okL = svgPill(svg, 640, 220, 'في وقتاها: ما يحسش بيها', { fill: 'rgba(101,61,199,0.10)', color: '#653DC7', size: 28, w: 360 });
    const mark = svgEl('g', {}, svg);
    svgEl('line', { x1: 470, y1: 120, x2: 470, y2: B, stroke: 'rgba(209,0,95,0.35)', 'stroke-width': 3, 'stroke-dasharray': '8 8' }, mark);
    const dmgL = svgPill(svg, 190, 300, 'الضرر', { fill: '#D1005F', color: '#fff', size: 32, icon: 'trendingDown', w: 190 });
    const cracks = svgEl('path', { d: 'M300 318 l-14 22 l16 8 l-12 24 M200 400 l-10 18 l14 6', fill: 'none', stroke: '#D1005F', 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.6 }, svg);
    const T = { sub: W(18, 3) - 0.15, card: W(18, 3), now0: W(18, 5), now1: WE(18, 11), dmg0: W(19, 0), dmg1: WE(19, 5) + 0.2, dmgL: W(19, 2), ok: W(19, 9) - 0.1 };
    cue(T.dmg0 + 0.1, 'drop', 0.9); cue(T.dmgL, 'thud', 0.5); cue(T.ok, 'pop', 0.6);
    return t => {
      fadeUp($('#s8sub'), t, T.sub, 0.4, 16);
      fadeUp($('#s8card'), t, T.card, 0.5, 40);
      draw(now, eInOut(prog(t, T.now0, T.now1 - T.now0)));
      draw(dmg, eInOut(prog(t, T.dmg0, T.dmg1 - T.dmg0)));
      dmg.style.opacity = t >= T.dmg0 ? 1 : 0;
      svgPop(mark, t, T.dmg0 - 0.1);
      svgPop(dmgL, t, T.dmgL);
      draw(cracks, eOut(prog(t, T.dmgL + 0.3, 0.5)));
      cracks.style.opacity = t >= T.dmgL + 0.3 ? 0.6 : 0;
      svgPop(okL, t, T.ok);
    };
  })();

  // 09 — we chose to say it from the start, even at the cost of our own comfort
  UPD.s9 = (() => {
    const svg = $('#s9svg');
    const C = [444, 130], HALF = 270, DROP = 300;
    svgEl('path', { d: 'M444 140 V590', stroke: '#2D1B69', 'stroke-width': 14, 'stroke-linecap': 'round' }, svg);
    svgEl('path', { d: 'M334 610 H554', stroke: '#2D1B69', 'stroke-width': 18, 'stroke-linecap': 'round' }, svg);
    const beam = svgEl('line', { stroke: '#2D1B69', 'stroke-width': 14, 'stroke-linecap': 'round' }, svg);
    const strings = [0, 1, 2, 3].map(() => svgEl('line', { stroke: 'rgba(45,27,105,0.45)', 'stroke-width': 3 }, svg));
    svgEl('circle', { cx: C[0], cy: C[1], r: 20, fill: '#FFB400', stroke: '#2D1B69', 'stroke-width': 6 }, svg);
    const L = $('#s9L'), R = $('#s9R');
    const T = { tilt: W(21, 2) - 0.1, chip: W(21, 7) - 0.1 };
    cue(T.tilt + 0.2, 'thud', 0.45); cue(T.chip, 'pop', 0.6);
    return (t, s) => {
      const settle = Math.sin((t - s.start) * 2.4) * 2 * Math.exp(-(t - s.start) * 0.8);
      const a = (lerp(0, 13, eInOut(prog(t, T.tilt, 0.9))) + settle) * Math.PI / 180;
      const ends = [-1, 1].map(sg => [C[0] + sg * HALF * Math.cos(a), C[1] + sg * HALF * Math.sin(a)]);
      beam.setAttribute('x1', ends[0][0]); beam.setAttribute('y1', ends[0][1]);
      beam.setAttribute('x2', ends[1][0]); beam.setAttribute('y2', ends[1][1]);
      [[L, ends[0]], [R, ends[1]]].forEach(([el, [x, y]], i) => {
        const plateY = y + DROP;
        el.style.left = `${x - 150}px`; el.style.right = 'auto';
        el.style.top = `${plateY - el.offsetHeight + 26}px`;
        strings[i * 2].setAttribute('x1', x); strings[i * 2].setAttribute('y1', y); strings[i * 2].setAttribute('x2', x - 140); strings[i * 2].setAttribute('y2', plateY);
        strings[i * 2 + 1].setAttribute('x1', x); strings[i * 2 + 1].setAttribute('y1', y); strings[i * 2 + 1].setAttribute('x2', x + 140); strings[i * 2 + 1].setAttribute('y2', plateY);
      });
      fadeUp($('#s9scale'), t, s.start + 0.2, 0.5, 40);
      popIn($('#s9chip'), t, T.chip, 0.4, 0.6);
    };
  })();

  // 10 — we sat with him, corrected the picture, built on the right foundation → result beyond expectations
  UPD.s10 = (() => {
    const svg = $('#s10svg');
    const B = 400;
    svgEl('line', { x1: 20, y1: B, x2: 816, y2: B, stroke: 'rgba(255,255,255,0.18)', 'stroke-width': 3 }, svg);
    [100, 200, 300].forEach(y => svgEl('line', { x1: 20, y1: y, x2: 816, y2: y, stroke: 'rgba(255,255,255,0.06)', 'stroke-width': 2 }, svg));
    const exp = svgEl('path', { d: 'M790 380 C600 350 400 300 40 250', fill: 'none', stroke: 'rgba(255,255,255,0.6)', 'stroke-width': 6, 'stroke-dasharray': '16 14', 'stroke-linecap': 'round' }, svg);
    const expReveal = clipReveal(svg, exp, 30, 800);
    const glow = svgEl('path', { d: 'M790 380 C600 360 420 260 300 170 S110 50 40 30', fill: 'none', stroke: 'rgba(255,180,0,0.25)', 'stroke-width': 24, 'stroke-linecap': 'round' }, svg);
    const res = svgEl('path', { d: 'M790 380 C600 360 420 260 300 170 S110 50 40 30', fill: 'none', stroke: '#FFB400', 'stroke-width': 9, 'stroke-linecap': 'round' }, svg);
    const end = svgEl('circle', { cx: 40, cy: 30, r: 16, fill: '#FFB400', stroke: '#2D1B69', 'stroke-width': 6 }, svg);
    const lRes = svgPill(svg, 200, 120, 'النتيجة', { fill: '#FFB400', color: '#1A1A2E', size: 32, icon: 'trending', w: 200 });
    const lExp = svgPill(svg, 250, 312, 'المتوقع', { fill: 'rgba(255,255,255,0.14)', color: '#fff', size: 28, w: 150 });
    const gap = svgEl('path', { d: 'M86 52 V238 M74 64 L86 50 L98 64', fill: 'none', stroke: '#FFB400', 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    const rows = ['#s10a', '#s10b', '#s10c'].map(q => $(q));
    const T = { rows: [W(22, 0) - 0.12, W(22, 2) - 0.12, W(22, 4) - 0.12], card: W(22, 7), res0: W(23, 1) - 0.1, res1: WE(23, 2) + 0.5, exp: W(23, 4) - 0.1 };
    T.rows.forEach(r => cue(r + 0.15, 'pop', 0.7)); cue(T.res0 + 0.1, 'rise', 1.0); cue(T.exp + 0.4, 'sparkle', 0.8);
    return t => {
      rows.forEach((r, i) => { fadeUp(r, t, T.rows[i], 0.42, 26); popIn(r.querySelector('.mk'), t, T.rows[i] + 0.15, 0.4, 0.3); });
      fadeUp($('#s10card'), t, T.card, 0.5, 40);
      const kr = eInOut(prog(t, T.res0, T.res1 - T.res0));
      draw(res, kr); draw(glow, kr);
      svgPop(end, t, T.res1 - 0.1); svgPop(lRes, t, T.res1 - 0.2);
      expReveal(eInOut(prog(t, T.exp, 0.8)));
      svgPop(lExp, t, T.exp + 0.5);
      draw(gap, eOut(prog(t, T.exp + 0.7, 0.4))); gap.style.opacity = t >= T.exp + 0.7 ? 1 : 0;
    };
  })();

  // 11 — the difference: an agency working for money vs an agency working to protect your business
  UPD.s11 = (() => {
    const T = { a: W(24, 3) - 0.12, b: W(25, 0) - 0.12, c: W(26, 0) - 0.12 };
    cue(T.a, 'pop', 0.5); cue(T.b, 'pop2', 0.9); cue(T.c, 'pop', 0.6);
    return t => {
      fadeUp($('#s11a'), t, T.a, 0.45, 30);
      dim($('#s11a'), t, T.b + 0.2, 0.55);
      const kb = prog(t, T.b, 0.5);
      const b = $('#s11b');
      b.style.opacity = eOut(Math.min(1, kb * 2));
      b.style.transform = `translateY(${(1 - eOut(kb)) * 30}px) scale(${lerp(0.85, 1.03, eBack(kb))})`;
      fadeUp($('#s11c'), t, T.c, 0.45, 30);
    };
  })();

  // 12 — want an honest opinion on your strategy, not flattery? get in touch
  UPD.s12 = (() => {
    const cur = $('#s12cur');
    let ctaBox = { x: 540, y: 1100 };
    onLayout(() => {
      const r = $('#s12cta').getBoundingClientRect(), st = $('#stage').getBoundingClientRect();
      ctaBox = { x: r.left - st.left + r.width * 0.35, y: r.top - st.top + r.height * 0.55 };
    });
    const T = { y: W(27, 2) - 0.1, n: W(27, 6) - 0.1, strike: WE(27, 7) - 0.05, cta: W(28, 0) - 0.15, cur: LE(28) + 0.15, click: LE(28) + 0.85 };
    cue(T.y, 'pop', 0.7); cue(T.n, 'pop', 0.5); cue(T.strike, 'scratch'); cue(T.cta, 'pop2'); cue(T.click, 'click');
    return t => {
      popIn($('#s12y'), t, T.y, 0.42, 0.7);
      popIn($('#s12n'), t, T.n, 0.42, 0.7);
      dim($('#s12n'), t, T.strike + 0.2, 0.6);
      $('#s12strike').style.transform = `scaleX(${eInOut(prog(t, T.strike, 0.35))})`;
      const press = t >= T.click && t < T.click + 0.18 ? 0.94 : 1;
      popIn($('#s12cta'), t, T.cta, 0.45, 0.7);
      $('#s12cta').style.transform += ` scale(${press})`;
      fadeUp($('#s12c'), t, T.cta + 0.3, 0.4, 16);
      const k = eInOut(prog(t, T.cur, T.click - T.cur));
      cur.style.opacity = eOut(prog(t, T.cur, 0.25));
      cur.style.left = `${lerp(ctaBox.x + 300, ctaBox.x, k) - 14}px`;
      cur.style.top = `${lerp(ctaBox.y + 380, ctaBox.y, k) - 14}px`;
      cur.style.transform = `scale(${press < 1 ? 0.86 : 1})`;
    };
  })();

  // 13 — end card
  UPD.s13 = (t, s) => {
    const a = s.start;
    const k = eOut(prog(t, a + 0.15, 0.5));
    $('#s13logo').style.opacity = k;
    $('#s13logo').style.transform = `scale(${lerp(0.94, 1, k)})`;
    fadeUp($('#s13eb'), t, a + 0.4);
    fadeUp($('#s13h'), t, a + 0.6, 0.5, 40);
    popIn($('#s13cta'), t, a + 1.0, 0.45, 0.85);
    fadeUp($('#s13c'), t, a + 1.3);
  };
  cue(TL.scenes[TL.scenes.length - 1].start + 0.1, 'chime');

  /* ---------- scene visibility & transitions ---------- */
  const SCENES = TL.scenes.map((s, i) => ({ ...s, el: document.getElementById(s.id), fg: document.querySelector(`#${s.id} > .fg`), next: TL.scenes[i + 1] }));
  function sceneState(s, t) {
    let a = s.trans === 'fade' ? eInOut(prog(t, s.start - 0.25, 0.5)) : (t >= s.start ? 1 : 0);
    let exit = 0;
    if (s.next) {
      if (s.next.trans === 'fade') {
        if (t >= s.next.start + 0.3) a = 0;
        exit = eInOut(prog(t, s.next.start - 0.38, 0.4));
      } else if (t >= s.next.start) a = 0;
    }
    return { a, exit };
  }

  const wipePanels = [...document.querySelectorAll('#wipe div')];
  const wipeTimes = TL.scenes.filter(s => s.trans === 'wipe').map(s => s.start);
  function updateWipe(t) {
    wipePanels.forEach((p, i) => {
      let shown = false;
      for (const tm of wipeTimes) {
        const a = tm - 0.5 - (2 - i) * 0.08;
        if (t < a || t > a + 1) continue;
        p.style.transform = `translateX(${lerp(1330, -2650, eInOut(prog(t, a, 1)))}px) skewX(-12deg)`;
        p.style.left = '0px';
        shown = true;
      }
      p.style.display = shown ? 'block' : 'none';
    });
  }

  const bug = $('#bug'), bugW = $('#bugW'), bugP = $('#bugP');
  const END = TL.scenes[TL.scenes.length - 1];
  function updateBug(t, states) {
    let dark = 0, endA = 0;
    states.forEach(({ s, a }) => {
      dark = dark * (1 - a) + (s.kind === 'dark' ? a : 0);
      if (s.id === END.id) endA = a;
    });
    bugW.style.opacity = dark;
    bugP.style.opacity = 1 - dark;
    bug.style.opacity = eOut(prog(t, 0.15, 0.5)) * (1 - endA);
  }

  window.render = t => {
    const states = [];
    for (const s of SCENES) {
      const { a, exit } = sceneState(s, t);
      states.push({ s, a });
      s.el.style.visibility = a > 0 ? 'visible' : 'hidden';
      s.el.style.opacity = a;
      if (a <= 0) continue;
      s.fg.style.opacity = 1 - exit;
      s.fg.style.transform = exit > 0 ? `translateY(${-30 * exit}px)` : 'none';
      updateArc(s, t);
      UPD[s.id](t, s);
    }
    updateSay(t);
    updateCaptions(t);
    updateWipe(t);
    updateBug(t, states);
  };

  window.CUES = CUES.sort((a, b) => a.t - b.t);
  window.renderReady = Promise.all([
    document.fonts.ready,
    ...[...document.images].map(img => (img.complete ? Promise.resolve() : new Promise(r => { img.onload = img.onerror = r; }))),
  ]).then(() => { LAYOUT.forEach(fn => fn()); window.render(0); return true; });
})();
