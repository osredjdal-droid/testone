/* Shohraty — «نسبة العائد ولا الربح؟» — deterministic renderer.
   Every frame is a pure function of time: window.render(t) sets all styles, so
   tools/render.mjs can step through frames one by one. All timings come from
   timeline.js (built from the ElevenLabs voice-over + Scribe word timings), so
   every number, bar and label lands on the word that names it.
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
  const NO_CAPTION = new Set([13]);            // the line is already the headline on screen
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
    s1: [990, 1760, 270], s2: [980, 1730, 300], s3: [80, 1740, 260], s4: [960, 1730, 330], s5: [990, 1760, 240],
    s6: [980, 1740, 280], s7: [950, 1730, 300], s8: [90, 1740, 270], s9: [990, 1740, 250], s10: [960, 1740, 330],
    s11: [100, 1740, 280], s12: [880, 260, 320],
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

  // 01 — the hook: can 3× beat 6×? Both numbers wait as ghosts and fill with colour as they are spoken.
  UPD.s1 = (() => {
    const T = { chip: 0.2, ghost: 0.15, eb: W(1, 5) - 0.12, a: W(1, 7) - 0.06, mid: W(1, 11) - 0.08, b: W(1, 15) - 0.06, q: W(1, 16) + 0.15 };
    cue(T.chip, 'pop', 0.6); cue(T.a, 'rise', 0.8); cue(T.b, 'rise', 0.7); cue(T.q, 'pop2');
    const chip = $('#s1chip'), eb = $('#s1eb'), a = $('#s1a'), mid = $('#s1mid'), b = $('#s1b'), q = $('#s1q');
    const fillA = a.querySelector('.fill'), fillB = b.querySelector('.fill');
    const bump = (t, t0) => Math.sin(Math.PI * clamp((t - t0) / 0.35)) * 0.06;
    return t => {
      popIn(chip, t, T.chip);
      fadeUp(eb, t, T.eb);
      const kg = eOut(prog(t, T.ghost, 0.7));
      const emph = eInOut(prog(t, T.mid, 0.6));                   // "أحسن": 3× swells, 6× gives way
      const ka = eInOut(prog(t, T.a, 0.6));
      a.style.opacity = kg;
      fillA.style.clipPath = ka >= 1 ? 'none' : `inset(${(1 - ka) * 100}% 0 0 0)`;      // no clip once full, so the glow isn't boxed
      fillA.style.textShadow = `0 0 ${60 * emph}px rgba(255,180,0,${0.45 * emph})`;
      a.style.transform = `translateY(${Math.sin(t * 1.4) * 5 + (1 - kg) * 30}px) scale(${(1 + bump(t, T.a + 0.4) + 0.05 * emph)})`;
      fadeUp(mid, t, T.mid, 0.45, 26);
      const kb = eInOut(prog(t, T.b, 0.6));
      b.style.opacity = kg;
      fillB.style.clipPath = kb >= 1 ? 'none' : `inset(${(1 - kb) * 100}% 0 0 0)`;
      b.style.transform = `translateY(${Math.sin(t * 1.4 + 1.8) * 5 + (1 - kg) * 30}px) scale(${lerp(1, 0.94, emph) + bump(t, T.b + 0.4)})`;
      const kq = prog(t, T.q, 0.5);
      q.style.opacity = eOut(Math.min(1, kq * 2));
      q.style.transform = `rotate(${lerp(-40, -10, eBack(kq))}deg) scale(${lerp(0.3, 1, eBack(kq))})`;
    };
  })();

  // 02 — campaign one: 1 000 $ spent, 6 000 $ back, every dollar returned six, 6×, "best campaign"
  UPD.s2 = (() => {
    const six = $('#s2six');
    for (let i = 0; i < 6; i++) { const c = document.createElement('div'); c.className = 'coin'; c.textContent = '$'; c.style.width = c.style.height = '84px'; c.style.fontSize = '40px'; six.appendChild(c); }
    const coins = [...six.children];
    const ratio = $('#s2ratio');
    const sparkG = document.createElement('div');                   // little yellow sparkles around 6×
    sparkG.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    ratio.style.position = 'relative';
    ratio.appendChild(sparkG);
    const SP = [[90, 18, 34], [40, 70, 22], [210, 10, 26], [250, 120, 30], [150, 150, 20], [20, 150, 26]];
    const sparks = SP.map(([x, y, s]) => {
      const e = document.createElement('div');
      e.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${s}px;height:${s}px;color:#FFB400`;
      e.innerHTML = `<svg viewBox="0 0 24 24" width="${s}" height="${s}"><path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0Z" fill="currentColor"/></svg>`;
      sparkG.appendChild(e);
      return e;
    });
    const T = {
      eb: W(2, 0) - 0.15, card: W(3, 0) - 0.2, h: W(3, 5) - 0.1, f1: W(3, 1), f2: W(4, 0) - 0.05,
      c0: W(5, 1) - 0.1, arr: W(5, 4) - 0.1, six: W(5, 5) - 0.05, ratio: W(6, 0) - 0.2, num: W(6, 2) - 0.1,
      spark: W(7, 0), stamp: W(7, 4) - 0.05,
    };
    cue(T.eb, 'pop', 0.6); cue(T.f1 + 0.1, 'rise', 0.5); cue(T.f2 + 0.1, 'rise', 0.8); cue(T.c0, 'pop', 0.7);
    coins.forEach((_, i) => cue(T.six + i * 0.08, 'tick', 0.55));
    cue(T.num, 'pop'); cue(T.spark, 'sparkle'); cue(T.stamp, 'stamp');
    return (t, s) => {
      popIn($('#s2icon'), t, T.eb, 0.45, 0.6);
      fadeUp($('#s2eb'), t, T.eb + 0.1);
      fadeUp($('#s2h'), t, T.h);
      fadeUp($('#s2card'), t, T.card, 0.5, 50);
      const d1 = W(3, 4) - T.f1 + 0.2;
      $('#s2f1').style.width = `${(100 / 6) * eInOut(prog(t, T.f1, d1))}%`;
      count($('#s2v1'), t, T.f1, d1, 0, 1000);
      const d2 = WE(4, 2) - T.f2 + 0.1;
      $('#s2f2').style.width = `${100 * eInOut(prog(t, T.f2, d2))}%`;
      count($('#s2v2'), t, T.f2, d2, 0, 6000);
      popIn($('#s2c0'), t, T.c0, 0.4, 0.4);
      draw($('#s2arr path'), eInOut(prog(t, T.arr, 0.35)));
      $('#s2arr').style.opacity = t >= T.arr ? 1 : 0;
      coins.forEach((c, i) => popIn(c, t, T.six + i * 0.08, 0.35, 0.3));
      fadeUp(ratio, t, T.ratio, 0.5, 40);
      const num = ratio.querySelector('.big-num');
      popIn(num, t, T.num, 0.45, 0.5);
      const pulse = Math.exp(-Math.max(0, t - T.spark) * 3) * (t >= T.spark ? 1 : 0);
      ratio.style.boxShadow = `0 20px 50px rgba(101,61,199,0.30), 0 0 0 ${10 * pulse}px rgba(255,180,0,${0.35 * pulse})`;
      sparks.forEach((e, i) => {
        const k = prog(t, T.spark + i * 0.06, 0.5);
        e.style.opacity = k > 0 ? 0.95 * Math.min(1, k * 3) * (0.65 + 0.35 * Math.sin(t * 5 + i)) : 0;
        e.style.transform = `scale(${eBack(k)}) rotate(${t * 40 + i * 30}deg)`;
      });
      const ks = prog(t, T.stamp, 0.32);
      const st = $('#s2stamp');
      st.style.opacity = ks > 0 ? 1 : 0;
      st.style.transform = `rotate(-8deg) scale(${lerp(1.9, 1, eOut(ks))})`;
    };
  })();

  // 03 — scale the budget: 1 000 → 4 000 $, 12 000 $ back, ratio drops to 3×, the urge to cut back
  UPD.s3 = (() => {
    const sl = $('#s3sl'), knob = $('#s3knob'), on = $('#s3on');
    const RW = 808, L0 = 30, R0 = RW - 30;                           // rail inner edges (slider-local)
    const VMAX = 5000;
    const xOf = v => R0 - (v / VMAX) * (R0 - L0);                     // RTL: 0 on the right
    for (let v = 1000; v <= 5000; v += 1000) {
      const tk = document.createElement('div');
      tk.className = 'tick';
      tk.style.left = `${xOf(v)}px`;
      tk.textContent = `${v / 1000}k`;
      sl.appendChild(tk);
    }
    const T = {
      eb: W(8, 0) - 0.12, h: W(8, 1) - 0.1, up: W(8, 1), upD: WE(8, 2) - W(8, 1) + 0.3,
      card: W(9, 0) - 0.35, f1: W(9, 1) - 0.05, f2: W(10, 1) - 0.1, ratio: W(11, 0) - 0.3, drop: W(11, 2) - 0.05,
      warn: W(12, 1) - 0.1, curIn: W(12, 4) - 0.1, grab: W(12, 5) - 0.1, rel: W(12, 7) + 0.1, fix: W(12, 8) - 0.1,
    };
    cue(T.up, 'rise'); cue(T.f1 + 0.1, 'rise', 0.5); cue(T.f2 + 0.1, 'rise', 0.8); cue(T.drop, 'drop');
    cue(T.warn, 'pop', 0.7); cue(T.grab, 'click'); cue(T.fix, 'pop', 0.7);
    // stage coordinates of the knob track, for the cursor
    const cur = $('#s3cur');
    let railBox = { x: 0, y: 0 };
    onLayout(() => {
      const r = sl.getBoundingClientRect(), st = $('#stage').getBoundingClientRect();
      railBox = { x: r.left - st.left, y: r.top - st.top };
    });
    const knobStage = v => [railBox.x + xOf(v), railBox.y + 48];
    return (t, s) => {
      fadeUp($('#s3eb'), t, T.eb);
      fadeUp($('#s3h'), t, T.h);
      fadeUp($('#s3slcard'), t, s.start + 0.15, 0.5, 40);
      const kUp = eInOut(prog(t, T.up, T.upD));
      const kDown = eInOut(prog(t, T.grab + 0.15, T.rel - T.grab));
      const v = lerp(1000, 4000, kUp) - 2500 * kDown;
      knob.style.left = `${xOf(v)}px`;
      on.style.left = `${xOf(v)}px`;
      $('#s3bv').textContent = money(Math.round(v / 50) * 50);
      fadeUp($('#s3card'), t, T.card, 0.5, 40);
      const d1 = WE(9, 2) - T.f1;
      $('#s3f1').style.width = `${(100 / 3) * eInOut(prog(t, T.f1, d1))}%`;
      count($('#s3v1'), t, T.f1, d1, 0, 4000);
      const d2 = WE(10, 3) - T.f2;
      $('#s3f2').style.width = `${100 * eInOut(prog(t, T.f2, d2))}%`;
      count($('#s3v2'), t, T.f2, d2, 0, 12000);
      fadeUp($('#s3ratio'), t, T.ratio, 0.5, 40);
      const kd = eInOut(prog(t, T.drop, 0.55));
      $('#s3r6').style.opacity = 1 - kd;
      $('#s3r6').style.transform = `translateY(${kd * 70}px)`;
      $('#s3r3').style.opacity = kd;
      $('#s3r3').style.transform = `translateY(${(kd - 1) * 70}px)`;
      popIn($('#s3down'), t, T.drop + 0.2, 0.4, 0.5);
      popIn($('#s3warn'), t, T.warn, 0.4, 0.6);
      // the cursor glides to the knob, grabs it and drags the budget back down
      const [kx0, ky] = knobStage(4000), [kx1] = knobStage(1500);
      const kIn = eInOut(prog(t, T.curIn, T.grab - T.curIn));
      const x = lerp(kx0 + 260, kx0, kIn) + (kx1 - kx0) * kDown;
      const y = lerp(ky + 420, ky, kIn);
      const press = t >= T.grab && t < T.rel ? 0.88 : 1;
      cur.style.opacity = eOut(prog(t, T.curIn, 0.25)) * (1 - eOut(prog(t, T.rel + 0.6, 0.3)));
      cur.style.left = `${x - 14}px`;
      cur.style.top = `${y - 14}px`;
      cur.style.transform = `scale(${press})`;
      knob.style.transform = t >= T.grab && t < T.rel ? 'scale(1.12)' : 'none';
      popIn($('#s3fix'), t, T.fix, 0.4, 0.6);
    };
  })();

  // 04 — "هنا الغلطة."
  UPD.s4 = (() => {
    const T = { x: W(13, 0) - 0.2 };
    cue(T.x, 'thud');
    return t => {
      const el = $('#s4x');
      const k = prog(t, T.x, 0.4);
      const shake = Math.exp(-Math.max(0, t - T.x - 0.15) * 9) * (t > T.x + 0.15 ? 1 : 0);
      el.style.opacity = eOut(Math.min(1, k * 2));
      el.style.transform = `translate(${Math.sin(t * 90) * 14 * shake}px, ${Math.cos(t * 77) * 8 * shake}px) scale(${lerp(0.4, 1, eBack(k))})`;
    };
  })();

  // 05 — the real profit: 5 000 $ vs 8 000 $ → +3 000 $
  UPD.s5 = (() => {
    const svg = $('#s5svg');
    const B = 670, HA = 250, HB = 400, XA = 680, XB = 220, BW = 180;
    const level = svgEl('path', { d: `M${XA - BW / 2 - 6} ${B - HA} H${XB - BW / 2 - 14}`, fill: 'none', stroke: '#653DC7', 'stroke-width': 4, 'stroke-dasharray': '12 10', 'stroke-linecap': 'round', opacity: 0.7 }, svg);
    const brX = XB + BW / 2 + 10;
    const bracket = svgEl('path', { d: `M${brX} ${B - HB + 4} h14 V${B - HA - 4} h-14`, fill: 'none', stroke: '#653DC7', 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    const T = {
      card: W(14, 2) - 0.2, la: W(15, 1) - 0.1, ea: W(15, 2), ba: W(15, 3) - 0.1, lb: W(16, 1) - 0.1, eb: W(16, 2), bb: W(16, 3) - 0.1,
      hl: W(17, 0) - 0.1, level: W(17, 4) - 0.2, br: W(17, 5) - 0.1, plus: W(17, 6) - 0.1,
    };
    cue(T.la, 'pop', 0.6); cue(T.ba + 0.15, 'rise', 0.6); cue(W(15, 4), 'cash', 0.8);
    cue(T.lb, 'pop', 0.6); cue(T.bb + 0.15, 'rise', 0.8); cue(W(16, 4), 'cash', 0.9);
    cue(T.plus, 'cash', 1.1);
    return t => {
      fadeUp($('#s5card'), t, T.card, 0.5, 50);
      popIn($('#s5la'), t, T.la, 0.4, 0.6, 'translateX(-50%)');
      fadeUp($('#s5ea'), t, T.ea, 0.35, 16);
      const da = WE(15, 5) - T.ba;
      $('#s5ba').style.height = `${HA * eInOut(prog(t, T.ba, da))}px`;
      count($('#s5pa'), t, T.ba, da, 0, 5000);
      fadeUp($('#s5pa'), t, T.ba, 0.3, 10);
      popIn($('#s5lb'), t, T.lb, 0.4, 0.6, 'translateX(-50%)');
      fadeUp($('#s5eb'), t, T.eb, 0.35, 16);
      const db = WE(16, 5) - T.bb;
      $('#s5bb').style.height = `${HB * eInOut(prog(t, T.bb, db))}px`;
      count($('#s5pb'), t, T.bb, db, 0, 8000);
      fadeUp($('#s5pb'), t, T.bb, 0.3, 10);
      // "the campaign you felt was weaker" — spotlight the 3× column
      const hl = eOut(prog(t, T.hl, 0.4));
      $('#s5lb').classList.toggle('solid', hl > 0.5);
      $('#s5bb').style.boxShadow = `0 0 0 ${8 * hl}px rgba(101,61,199,0.15), 0 20px 40px rgba(101,61,199,${0.25 * hl})`;
      draw(level, eInOut(prog(t, T.level, 0.5)));
      level.style.opacity = t >= T.level ? 0.7 : 0;
      draw(bracket, eInOut(prog(t, T.br, 0.35)));
      bracket.style.opacity = t >= T.br ? 1 : 0;
      popIn($('#s5plus'), t, T.plus, 0.45, 0.5, 'translate(-50%,-50%)');
    };
  })();

  // 06 — a ratio is relative; profit is real money
  UPD.s6 = (() => {
    const termsA = [...$('#s6fa').children], termsB = [...$('#s6fb').children], termsC = [...$('#s6fc').children];
    const T = { a: W(18, 0) - 0.25, ta: W(18, 2) - 0.1, fa: W(18, 3), b: W(19, 0) - 0.25, tb: W(19, 1) - 0.1, fb: W(20, 0) - 0.15, fc: W(20, 1) - 0.1 };
    cue(T.ta, 'pop', 0.7); cue(T.tb, 'pop', 0.9); cue(T.fc, 'cash', 0.9);
    return t => {
      fadeUp($('#s6a'), t, T.a, 0.5, 40);
      popIn($('#s6ta'), t, T.ta, 0.4, 0.6);
      termsA.forEach((e, i) => popIn(e, t, T.fa + i * 0.12, 0.35, 0.6));
      dim($('#s6a'), t, T.b + 0.2, 0.45);
      fadeUp($('#s6b'), t, T.b, 0.5, 40);
      popIn($('#s6tb'), t, T.tb, 0.4, 0.6);
      termsB.forEach((e, i) => popIn(e, t, T.fb + i * 0.12, 0.35, 0.6));
      termsC.forEach((e, i) => popIn(e, t, T.fc + i * 0.14, 0.4, 0.6));
    };
  })();

  // 07 — the ratio can fall while the profit grows
  UPD.s7 = (() => {
    const svg = $('#s7svg');
    const X = v => 770 - ((v - 1000) / 3000) * 680;                 // RTL: budget grows right → left
    const yR = r => 440 - ((r - 2) / 4.5) * 360, yP = p => 440 - ((p - 4000) / 4500) * 360;
    const B = [1000, 2000, 3000, 4000];
    const R = B.map(b => (6000 * Math.sqrt(b / 1000)) / b);           // diminishing returns: 6×, 4.2×, 3.5×, 3×
    const Pf = B.map(b => 6000 * Math.sqrt(b / 1000) - b);           // 5 000, 6 485, 7 392, 8 000 $
    [120, 230, 340].forEach(y => svgEl('line', { x1: 40, y1: y, x2: 800, y2: y, stroke: 'rgba(101,61,199,0.07)', 'stroke-width': 2 }, svg));
    svgEl('line', { x1: 40, y1: 440, x2: 800, y2: 440, stroke: 'rgba(101,61,199,0.22)', 'stroke-width': 3 }, svg);
    B.forEach(b => svgText(svg, X(b), 482, `${b / 1000}k $`, { 'font-family': 'Roboto', 'font-size': 26, 'font-weight': 700, fill: '#737373', direction: 'ltr' }));
    const axis = svgEl('g', {}, svg);
    svgEl('path', { d: 'M560 528 H300 M318 514 L300 528 L318 542', fill: 'none', stroke: 'rgba(101,61,199,0.45)', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, axis);
    svgText(axis, 650, 538, 'الميزانية', { 'font-size': 28, fill: '#666' });
    const smooth = pts => {
      let d = `M${pts[0][0]} ${pts[0][1]}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
        d += ` C${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`;
      }
      return d;
    };
    const rPts = B.map((b, i) => [X(b), yR(R[i])]), pPts = B.map((b, i) => [X(b), yP(Pf[i])]);
    const rLine = svgEl('path', { d: smooth(rPts), fill: 'none', stroke: '#E08600', 'stroke-width': 7, 'stroke-dasharray': '16 13', 'stroke-linecap': 'round' }, svg);
    const rReveal = clipReveal(svg, rLine, 60, 790);
    const pArea = svgEl('path', { d: `${smooth(pPts)} L${pPts[3][0]} 440 L${pPts[0][0]} 440 Z`, fill: 'rgba(101,61,199,0.08)' }, svg);
    const pLine = svgEl('path', { d: smooth(pPts), fill: 'none', stroke: '#653DC7', 'stroke-width': 9, 'stroke-linecap': 'round' }, svg);
    const rDots = rPts.map(([x, y]) => svgEl('circle', { cx: x, cy: y, r: 10, fill: '#fff', stroke: '#E08600', 'stroke-width': 5 }, svg));
    const pDots = pPts.map(([x, y]) => svgEl('circle', { cx: x, cy: y, r: 12, fill: '#653DC7', stroke: '#fff', 'stroke-width': 5 }, svg));
    const rL0 = svgPill(svg, rPts[0][0] - 10, rPts[0][1] - 48, '6×', { fill: 'rgba(224,134,0,0.14)', color: '#9A5D00', size: 30, w: 96 });
    const rL1 = svgPill(svg, rPts[3][0] + 10, rPts[3][1] + 50, '3×', { fill: '#E08600', color: '#fff', size: 30, w: 96, icon: 'arrowDown' });
    const pL0 = svgPill(svg, pPts[0][0] - 30, pPts[0][1] + 52, '5 000 $', { fill: 'rgba(101,61,199,0.10)', color: '#653DC7', size: 28, w: 150 });
    const pL1 = svgPill(svg, pPts[3][0] + 40, pPts[3][1] - 52, '8 000 $', { fill: '#653DC7', color: '#fff', size: 28, w: 196, icon: 'arrowUp' });
    const T = { card: 0, h1: W(21, 0) - 0.15, r0: W(21, 0), r1: WE(21, 2), h2: W(21, 3) - 0.1, p0: W(21, 3), p1: WE(21, 4) + 0.3, same: W(21, 5) - 0.05 };
    cue(T.r0 + 0.1, 'drop', 0.7); cue(T.p0 + 0.1, 'rise', 0.9); cue(T.same + 0.1, 'sparkle', 0.7);
    return (t, s) => {
      fadeUp($('#s7h1'), t, T.h1, 0.4, 20);
      fadeUp($('#s7h2'), t, T.h2, 0.4, 20);
      fadeUp($('#s7card'), t, s.start + 0.1, 0.5, 40);
      fadeUp($('#s7lg1'), t, T.r0 - 0.1, 0.3, 10);
      fadeUp($('#s7lg2'), t, T.p0 - 0.1, 0.3, 10);
      const kr = eInOut(prog(t, T.r0, T.r1 - T.r0));
      rReveal(kr);
      rDots.forEach((d, i) => svgPop(d, t, T.r0 + (i / 3) * (T.r1 - T.r0) - 0.05, 0.3));
      svgPop(rL0, t, T.r0 - 0.05);
      svgPop(rL1, t, T.r1 - 0.15);
      const kp = eInOut(prog(t, T.p0, T.p1 - T.p0));
      draw(pLine, kp);
      pArea.style.opacity = kp;
      pDots.forEach((d, i) => svgPop(d, t, T.p0 + (i / 3) * (T.p1 - T.p0) - 0.05, 0.3));
      svgPop(pL0, t, T.p0 - 0.05);
      svgPop(pL1, t, T.p1 - 0.2);
      const pulse = t >= T.same ? 0.5 + 0.5 * Math.sin((t - T.same) * 7) : 0;
      pDots[3].setAttribute('r', 12 + 5 * pulse);
      rDots[3].setAttribute('r', 10 + 4 * pulse);
    };
  })();

  // 08 — a bigger budget reaches a wider, colder audience; quality down, quantity up
  UPD.s8 = (() => {
    const svg = $('#s8svg');
    const CX = 300, CY = 320, RAD = [88, 162, 236, 306];
    const FILL = ['rgba(101,61,199,0.20)', 'rgba(101,61,199,0.11)', 'rgba(101,61,199,0.06)', 'rgba(101,61,199,0.03)'];
    const rings = RAD.slice().reverse().map((r, j) => {
      const i = RAD.length - 1 - j;
      return { i, el: svgEl('circle', { cx: CX, cy: CY, r, fill: FILL[i], stroke: i === 0 ? '#653DC7' : '#B79BF0', 'stroke-width': i === 0 ? 4 : 3, 'stroke-dasharray': i === 0 ? '' : '10 10' }, svg) };
    }).sort((a, b) => a.i - b.i);
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const COUNT = [7, 13, 19, 25], CONV = [0.86, 0.46, 0.21, 0.08];
    const dots = [];
    RAD.forEach((r, i) => {
      const r0 = i ? RAD[i - 1] + 18 : 44, r1 = r - 16;
      for (let j = 0; j < COUNT[i]; j++) {
        const a = (j / COUNT[i]) * Math.PI * 2 + rnd() * 0.5 + i;
        const rr = r0 + (r1 - r0) * (0.2 + 0.6 * rnd());
        const x = CX + rr * Math.cos(a), y = CY + rr * Math.sin(a);
        const conv = rnd() < CONV[i];
        const g = svgEl('g', {}, svg);
        const c = svgEl('circle', { cx: x, cy: y, r: 12, fill: '#fff', stroke: ['#653DC7', '#7B55D9', '#9B6FEA', '#B79BF0'][i], 'stroke-width': 4 }, g);
        dots.push({ i, g, c, conv, delay: rnd() });
      }
    });
    svgIcon(svg, 'flame', CX, CY, 44, '#653DC7', 2.4);
    // leader lines from the chips to their ring
    const viz = $('#s8viz');
    const chips = ['#s8k0', '#s8k1', '#s8k2', '#s8k3'].map(q => $(q));
    const leaders = chips.map(() => {
      const g = svgEl('g', {}, svg);
      g.__p = svgEl('path', { fill: 'none', stroke: '#B79BF0', 'stroke-width': 3, 'stroke-dasharray': '2 8', 'stroke-linecap': 'round' }, g);
      g.__c = svgEl('circle', { r: 7, fill: '#653DC7' }, g);
      return g;
    });
    onLayout(() => chips.forEach((ch, i) => {
      const y = ch.offsetTop + ch.offsetHeight / 2, x = viz.clientWidth - ch.offsetWidth - 16;
      const dx = x - CX, dy = y - CY, L = Math.hypot(dx, dy);
      const px = CX + (dx / L) * RAD[i], py = CY + (dy / L) * RAD[i];
      leaders[i].__p.setAttribute('d', `M${x} ${y} L${px} ${py}`);
      leaders[i].__c.setAttribute('cx', px); leaders[i].__c.setAttribute('cy', py);
    }));
    const T = {
      core: 0.15, ring: [0.2, W(22, 2) - 0.1, W(22, 4), W(22, 6) - 0.1],
      k: [0.35, W(22, 7) - 0.1, W(22, 8) - 0.1, W(22, 10) - 0.1],
      meters: W(22, 10) + 0.2, q: W(23, 0) - 0.05, qc: W(23, 1) - 0.05, n: W(23, 3) - 0.1, nc: W(23, 4) - 0.05,
    };
    [1, 2, 3].forEach(i => cue(T.ring[i], 'pop', 0.5 + 0.1 * i));
    cue(T.k[1], 'pop', 0.6); cue(T.k[2], 'pop', 0.6); cue(T.k[3], 'pop', 0.7);
    cue(T.qc, 'drop', 0.6); cue(T.nc, 'rise', 0.8);
    return (t, s) => {
      const a0 = s.start;
      const ringT = i => (i === 0 ? a0 + T.ring[0] : T.ring[i]);
      rings.forEach(({ i, el }) => {
        const k = prog(t, ringT(i), 0.55);
        el.style.opacity = eOut(Math.min(1, k * 2));
        el.setAttribute('r', RAD[i] * lerp(i === 0 ? 0.5 : (RAD[i - 1] / RAD[i]), 1, eOut(k)));
      });
      dots.forEach(d => {
        const ta = ringT(d.i) + 0.2 + d.delay * 0.4;
        svgPop(d.g, t, ta, 0.3, 0.2);
        const kc = d.conv ? eOut(prog(t, ta + 0.5 + d.delay * 0.8, 0.3)) : 0;
        d.c.setAttribute('fill', kc > 0.5 ? ['#653DC7', '#7B55D9', '#9B6FEA', '#9B6FEA'][d.i] : '#fff');
      });
      chips.forEach((c, i) => popIn(c, t, i === 0 ? a0 + T.k[0] : T.k[i], 0.4, 0.6));
      leaders.forEach((g, i) => { g.style.opacity = eOut(prog(t, (i === 0 ? a0 + T.k[0] : T.k[i]) + 0.1, 0.3)); });
      fadeUp($('#s8h'), t, a0 + 0.1, 0.5, 26);
      fadeUp($('#s8meters'), t, T.meters, 0.5, 40);
      $('#s8qf').style.width = `${lerp(92, 46, eInOut(prog(t, T.q, 0.9)))}%`;
      $('#s8nf').style.width = `${lerp(26, 96, eInOut(prog(t, T.n, 0.9)))}%`;
      popIn($('#s8qc'), t, T.qc, 0.35, 0.6);
      popIn($('#s8nc'), t, T.nc, 0.35, 0.6);
    };
  })();

  // 09 — businesses stay small: they stop the campaign right before it takes off
  UPD.s9 = (() => {
    const svg = $('#s9svg');
    const B = 520;
    [130, 260, 390].forEach(y => svgEl('line', { x1: 30, y1: y, x2: 806, y2: y, stroke: 'rgba(101,61,199,0.07)', 'stroke-width': 2 }, svg));
    svgEl('line', { x1: 30, y1: B, x2: 806, y2: B, stroke: 'rgba(101,61,199,0.22)', 'stroke-width': 3 }, svg);
    const axis = svgEl('g', {}, svg);
    svgEl('path', { d: 'M560 566 H300 M318 552 L300 566 L318 580', fill: 'none', stroke: 'rgba(101,61,199,0.45)', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, axis);
    svgText(axis, 640, 576, 'الوقت', { 'font-size': 28, fill: '#666' });
    const P = [470, 392];
    const grow = svgEl('path', { d: `M790 478 C700 470 600 440 ${P[0]} ${P[1]}`, fill: 'none', stroke: '#653DC7', 'stroke-width': 9, 'stroke-linecap': 'round' }, svg);
    const ghostArea = svgEl('path', { d: `M${P[0]} ${P[1]} C360 360 230 250 70 60 L70 ${P[1]} Z`, fill: 'rgba(101,61,199,0.07)' }, svg);
    const ghost = svgEl('path', { d: `M${P[0]} ${P[1]} C360 360 230 250 70 60`, fill: 'none', stroke: '#9B6FEA', 'stroke-width': 7, 'stroke-dasharray': '14 12', 'stroke-linecap': 'round' }, svg);
    const ghostReveal = clipReveal(svg, ghost, 50, P[0] + 10);
    const flat = svgEl('path', { d: `M${P[0]} ${P[1]} H70`, fill: 'none', stroke: '#B0B0B8', 'stroke-width': 9, 'stroke-linecap': 'round' }, svg);
    const fear = svgPill(svg, 672, 322, 'نسبة العائد تنقص', { fill: 'rgba(224,134,0,0.14)', color: '#9A5D00', size: 28, icon: 'arrowDown', w: 300 });
    const stopG = svgEl('g', {}, svg);
    svgEl('circle', { cx: P[0], cy: P[1], r: 52, fill: 'rgba(209,0,95,0.12)' }, stopG);
    svgEl('circle', { cx: P[0], cy: P[1], r: 38, fill: '#D1005F' }, stopG);
    svgIcon(stopG, 'pause', P[0], P[1], 36, '#fff', 2.6);
    const stopL = svgPill(svg, 250, 450, 'حبست الحملة', { fill: '#ECECF0', color: '#555', size: 28, w: 230 });
    const missL = svgPill(svg, 250, 120, 'كانت راح تكبر', { fill: '#653DC7', color: '#fff', size: 30, icon: 'trending', w: 290 });
    const T = {
      icon: W(24, 0) - 0.15, m: W(24, 4) - 0.1, chip: W(24, 6) - 0.1, strike: WE(24, 9) - 0.05, card: W(24, 9) + 0.2,
      g0: W(25, 0), g1: WE(25, 7), fear: W(25, 5) - 0.1, stop: W(25, 8) - 0.05, flat0: W(25, 9), flat1: W(25, 11) + 0.2,
      ghost0: W(25, 12) - 0.1, ghost1: WE(25, 15) + 0.3, miss: W(25, 15) - 0.1,
    };
    cue(T.icon, 'pop', 0.6); cue(T.chip, 'pop', 0.6); cue(T.strike, 'scratch'); cue(T.fear, 'pop', 0.7);
    cue(T.stop, 'thud', 0.7); cue(T.ghost0 + 0.1, 'rise', 0.9); cue(T.miss, 'pop', 0.8);
    return t => {
      popIn($('#s9icon'), t, T.icon, 0.45, 0.6);
      fadeUp($('#s9m'), t, T.m, 0.35, 16);
      popIn($('#s9chip'), t, T.chip, 0.4, 0.6);
      $('#s9strike').style.transform = `scaleX(${eInOut(prog(t, T.strike, 0.35))})`;
      fadeUp($('#s9card'), t, T.card, 0.5, 40);
      draw(grow, eInOut(prog(t, T.g0, T.g1 - T.g0)));
      svgPop(fear, t, T.fear);
      fear.style.opacity = +fear.style.opacity * (1 - eOut(prog(t, T.stop + 0.3, 0.4)) * 0.6);
      svgPop(stopG, t, T.stop, 0.4, 0.3);
      draw(flat, eInOut(prog(t, T.flat0, T.flat1 - T.flat0)));
      flat.style.opacity = t >= T.flat0 ? 1 : 0;
      svgPop(stopL, t, T.flat0 + 0.3);
      const kg = eInOut(prog(t, T.ghost0, T.ghost1 - T.ghost0));
      ghostReveal(kg);
      ghostArea.style.opacity = eOut(prog(t, T.ghost1 - 0.3, 0.5));
      svgPop(missL, t, T.miss);
    };
  })();

  // 10 — the rule: don't only check the ratio; check the profit
  UPD.s10 = (() => {
    const svg = $('#s10svg');
    const H = [60, 82, 108, 132, 170, 214];
    const bars = H.map((h, i) => svgEl('rect', { x: 760 - i * 128, y: 240 - h, width: 92, height: h, rx: 14, fill: i === H.length - 1 ? '#FFB400' : `rgba(255,255,255,${0.10 + i * 0.03})` }, svg));
    const trend = svgEl('path', { d: 'M806 170 L620 140 L470 110 L340 70 L170 10', fill: 'none', stroke: '#FFB400', 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    const head = svgEl('path', { d: 'M196 0 L164 8 L180 36', fill: 'none', stroke: '#FFB400', 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    const T = { eb: 0.2, a: W(26, 0) - 0.25, strike: LE(26) - 0.05, b: W(27, 0) - 0.2, bars: W(27, 2) - 0.15, ding: W(27, 3) };
    cue(T.a + 0.1, 'pop', 0.6); cue(T.strike, 'scratch'); cue(T.b + 0.15, 'pop'); cue(T.ding, 'cash', 1.0);
    return (t, s) => {
      fadeUp($('#s10eb'), t, s.start + T.eb);
      fadeUp($('#s10a'), t, T.a, 0.5, 40);
      $('#s10strike').style.transform = `scaleX(${eInOut(prog(t, T.strike, 0.35))})`;
      dim($('#s10a'), t, T.b + 0.2, 0.5);
      fadeUp($('#s10b'), t, T.b, 0.5, 40);
      bars.forEach((r, i) => {
        const k = eOut(prog(t, T.bars + i * 0.09, 0.4));
        r.setAttribute('y', 240 - H[i] * k);
        r.setAttribute('height', H[i] * k);
      });
      draw(trend, eInOut(prog(t, T.bars + 0.3, 0.7)));
      head.style.opacity = eOut(prog(t, T.bars + 0.9, 0.2));
    };
  })();

  // 11 — your turn: did you ever stop a campaign because the ratio dropped?
  UPD.s11 = (() => {
    const dotsT = [...$('#s11typing').children];
    const T = { eb: 0.2, card: W(28, 0) - 0.2, y: LE(28) + 0.05, n: LE(28) + 0.2, cta: LE(28) + 0.55 };
    cue(T.y, 'pop', 0.6); cue(T.n, 'pop', 0.6); cue(T.cta, 'pop2');
    return (t, s) => {
      fadeUp($('#s11eb'), t, s.start + T.eb);
      fadeUp($('#s11card'), t, T.card, 0.5, 40);
      popIn($('#s11y'), t, T.y, 0.4, 0.7);
      popIn($('#s11n'), t, T.n, 0.4, 0.7);
      popIn($('#s11cta'), t, T.cta, 0.45, 0.7);
      fadeUp($('#s11typing'), t, T.cta + 0.3, 0.35, 10);
      dotsT.forEach((d, i) => { d.style.transform = `translateY(${-8 * Math.max(0, Math.sin((t - T.cta) * 6 - i * 0.9))}px)`; });
      const nudge = t > T.cta + 0.6 ? Math.sin((t - T.cta) * 4) * 0.015 : 0;
      $('#s11cta').style.transform += ` scale(${1 + nudge})`;
    };
  })();

  // 12 — end card
  UPD.s12 = (() => {
    return (t, s) => {
      const a = s.start;
      const k = eOut(prog(t, a + 0.15, 0.5));
      $('#s12logo').style.opacity = k;
      $('#s12logo').style.transform = `scale(${lerp(0.94, 1, k)})`;
      fadeUp($('#s12eb'), t, a + 0.4);
      fadeUp($('#s12h'), t, a + 0.6, 0.5, 40);
      popIn($('#s12cta'), t, a + 1.0, 0.45, 0.85);
      fadeUp($('#s12c'), t, a + 1.3);
    };
  })();
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
