/* Shohraty motion piece — deterministic renderer.
   Every frame is a pure function of time: window.render(t) sets all styles,
   so tools/render.mjs can step through frames one by one. Timings come from
   timeline.js (built from the voice-over), so words appear as they are spoken. */
(() => {
  const TL = window.TL;
  const W = 1080;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const eOut = k => 1 - Math.pow(1 - k, 3);
  const eInOut = k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const prog = (t, a, d) => clamp((t - a) / d);
  const $ = s => document.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';
  const SEG = n => TL.segs.find(s => s.seg === n);
  const P = (n, k = 0) => SEG(n).phrases[k];
  const SC = id => TL.scenes.find(s => s.id === id);

  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /* ---------- icons (Lucide-style, 24px grid, rounded 2px strokes) ---------- */
  const ICONS = {
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    network: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/>',
    shuffle: '<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    trending: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    message: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    restart: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    unlink: '<path d="m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71"/><path d="m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71"/><path d="M8 2v3M2 8h3M16 22v-3M22 16h-3"/>',
    arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
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

  /* ---------- animation helpers ---------- */
  function fadeUp(el, t, a, d = 0.45, dy = 34) {
    const k = eOut(prog(t, a, d));
    el.style.opacity = k;
    el.style.transform = `translateY(${(1 - k) * dy}px)`;
    return k;
  }
  function popIn(el, t, a, d = 0.4, s0 = 0.86, base = '') {
    const k = eOut(prog(t, a, d));
    el.style.opacity = k;
    el.style.transform = `${base} scale(${lerp(s0, 1, k)})`;
    return k;
  }
  function draw(el, k) {
    const L = el.__len || (el.__len = el.getTotalLength());
    el.style.strokeDasharray = `${L} ${L}`;
    el.style.strokeDashoffset = L * (1 - k);
  }
  function svgPop(el, t, a, d = 0.35) {           // scale an SVG group about its own centre
    const k = eOut(prog(t, a, d));
    el.style.opacity = k;
    el.style.transformBox = 'fill-box';
    el.style.transformOrigin = 'center';
    el.style.transform = `scale(${lerp(0.6, 1, k)})`;
    return k;
  }

  /* ---------- word-by-word captions, timed to the voice ---------- */
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
  const WORDS = [];
  document.querySelectorAll('.say[data-p]').forEach(el => {
    const [n, k] = el.dataset.p.split('.').map(Number);
    const ph = P(n, k);
    const words = splitWords(el);
    const lens = words.map(w => w.textContent.replace(/[ً-ْ]/g, '').length + 1.5);
    const total = lens.reduce((a, b) => a + b, 0);
    const span = Math.max(0.3, ph.end - ph.start) * 0.88;
    let acc = 0;
    words.forEach((w, i) => {
      WORDS.push({ el: w, t0: ph.start - 0.1 + (span * acc) / total });
      acc += lens[i];
    });
  });
  function updateWords(t) {
    for (const w of WORDS) {
      const k = eOut(prog(t, w.t0, 0.42));
      w.el.style.opacity = k;
      w.el.style.transform = k >= 1 ? 'none' : `translateY(${(1 - k) * 0.32}em)`;
      w.el.style.filter = k >= 1 ? 'none' : `blur(${(1 - k) * 7}px)`;
    }
  }

  /* ---------- decorative C-arc motif (from the logo) per scene ---------- */
  const ARCS = {
    s1: [990, 1720, 260], s2: [980, 1640, 300], s3: [80, 1700, 260], s4: [540, 640, 430], s5: [990, 1730, 240],
    s6: [980, 1720, 280], s7: [950, 1690, 300], s8: [90, 1650, 270], s9: [990, 1700, 250], s10: [960, 1700, 330], s11: [880, 260, 320],
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
    const rot = -60 + (t - s.start) * 4;
    c.setAttribute('transform', `rotate(${rot} ${cx} ${cy})`);
    if (dot) dot.setAttribute('transform', `rotate(${(t - s.start) * 4} ${cx} ${cy})`);
  }

  /* =====================================================================
     Scene choreography
     ===================================================================== */
  const UPD = {};

  // 01 — a system (connected nodes) falls apart into random actions
  UPD.s1 = (() => {
    const lines = $('#s1lines'), dotsG = $('#s1dots');
    const C = [450, 380], R = 300, N = 8;
    const ring = [...Array(N)].map((_, i) => {
      const a = ((-90 + i * 45) * Math.PI) / 180;
      return [C[0] + R * Math.cos(a), C[1] + R * Math.sin(a)];
    });
    const scat = [[120, 110], [790, 60], [320, 700], [860, 470], [40, 540], [610, 230], [700, 730], [210, 330]];
    const hubScat = [500, 540];
    const ringLines = ring.map((p, i) => svgEl('line', { x1: p[0], y1: p[1], x2: ring[(i + 1) % N][0], y2: ring[(i + 1) % N][1],
      stroke: '#FFB400', 'stroke-width': 5, 'stroke-linecap': 'round' }, lines));
    const spokes = ring.map(p => svgEl('line', { x1: C[0], y1: C[1], x2: p[0], y2: p[1], stroke: 'rgba(255,255,255,0.35)',
      'stroke-width': 3, 'stroke-linecap': 'round' }, lines));
    const halos = ring.map(() => svgEl('circle', { r: 36, fill: 'rgba(255,255,255,0.08)' }, dotsG));
    const dots = ring.map(() => svgEl('circle', { r: 18, fill: '#fff' }, dotsG));
    const hubHalo = svgEl('circle', { r: 64, fill: 'rgba(255,180,0,0.16)' }, dotsG);
    const hub = svgEl('circle', { r: 30, fill: '#FFB400' }, dotsG);
    return (t, s) => {
      const p0 = P(1, 0), p1 = P(1, 1);
      const scatter = eInOut(prog(t, p1.start - 0.05, 0.75));
      const lineFade = 1 - eOut(prog(t, p1.start - 0.1, 0.3));
      lines.style.opacity = lineFade;
      ringLines.forEach((l, i) => draw(l, eInOut(prog(t, p0.start - 0.1 + i * 0.11, 0.3))));
      spokes.forEach((l, i) => draw(l, eInOut(prog(t, p0.start + 0.35 + i * 0.06, 0.3))));
      ring.forEach((p, i) => {
        const k = eOut(prog(t, s.start + 0.05 + i * 0.05, 0.35));
        const dx = Math.sin(t * 0.9 + i * 1.7) * 16 * scatter, dy = Math.cos(t * 0.75 + i * 1.3) * 16 * scatter;
        const x = lerp(p[0], scat[i][0], scatter) + dx, y = lerp(p[1], scat[i][1], scatter) + dy;
        dots[i].setAttribute('cx', x); dots[i].setAttribute('cy', y); dots[i].setAttribute('r', 18 * k);
        halos[i].setAttribute('cx', x); halos[i].setAttribute('cy', y); halos[i].setAttribute('r', 36 * k * (1 - scatter * 0.6));
      });
      const hk = eOut(prog(t, p0.start + 0.2, 0.4));
      const hx = lerp(C[0], hubScat[0], scatter) + Math.sin(t * 0.8) * 14 * scatter;
      const hy = lerp(C[1], hubScat[1], scatter) + Math.cos(t * 0.6) * 14 * scatter;
      hub.setAttribute('cx', hx); hub.setAttribute('cy', hy); hub.setAttribute('r', hk * lerp(30, 18, scatter));
      const g = Math.round(lerp(180, 255, scatter)), b = Math.round(lerp(0, 255, scatter));
      hub.setAttribute('fill', `rgb(255,${g},${b})`);
      hubHalo.setAttribute('cx', hx); hubHalo.setAttribute('cy', hy); hubHalo.setAttribute('r', 64 * hk * (1 - scatter));
    };
  })();

  // 02 — the question card + two options
  UPD.s2 = (t, s) => {
    popIn($('#s2icon'), t, s.start + 0.1);
    fadeUp($('#s2card'), t, P(2, 0).end - 0.15, 0.5, 50);
    fadeUp($('#s2a'), t, P(3, 0).end - 0.2);
    fadeUp($('#s2b'), t, P(3, 1).end - 0.2);
  };

  // 03 — 12-month timeline: months, actions, connections
  UPD.s3 = (() => {
    const svg = $('#s3svg');
    const B = 236, X0 = 780, X1 = 40, step = (X0 - X1) / 11;
    const mx = m => X0 - (m - 1) * step;
    const base = svgEl('line', { x1: X0, y1: B, x2: X1, y2: B, stroke: 'rgba(101,61,199,0.25)', 'stroke-width': 4, 'stroke-linecap': 'round' }, svg);
    const ticks = [], labels = [];
    for (let m = 1; m <= 12; m++) {
      ticks.push(svgEl('line', { x1: mx(m), y1: B - 10, x2: mx(m), y2: B + 10, stroke: '#B79BF0', 'stroke-width': 4, 'stroke-linecap': 'round' }, svg));
      const tx = svgEl('text', { x: mx(m), y: B + 52, 'text-anchor': 'middle', 'font-family': 'Roboto', 'font-size': 26, 'font-weight': 700, fill: '#737373', direction: 'ltr' }, svg);
      tx.textContent = m;
      labels.push(tx);
    }
    const ACT = [[1, 1], [2, 1], [2, 2], [4, 1], [5, 1], [7, 1], [8, 1], [8, 2], [10, 1], [12, 1]];
    const pos = ACT.map(([m, l]) => [mx(m), B - 50 - (l - 1) * 62]);
    const LINKS = [[0, 1], [1, 3], [3, 4], [2, 1]];
    const linkEls = LINKS.map(([a, b]) => {
      const [x1, y1] = pos[a], [x2, y2] = pos[b];
      const d = x1 === x2 ? `M${x1} ${y1} L${x2} ${y2}` : `M${x1} ${y1} Q${(x1 + x2) / 2} ${Math.min(y1, y2) - 70} ${x2} ${y2}`;
      return svgEl('path', { d, fill: 'none', stroke: '#653DC7', 'stroke-width': 5, 'stroke-linecap': 'round' }, svg);
    });
    const ISO = [5, 6, 7, 8, 9];
    const rings = ISO.map(i => svgEl('circle', { cx: pos[i][0], cy: pos[i][1], r: 30, fill: 'none', stroke: '#D1005F', 'stroke-width': 3.5, 'stroke-dasharray': '6 7' }, svg));
    const dots = pos.map(([x, y]) => {
      const g = svgEl('g', {}, svg);
      svgEl('circle', { cx: x, cy: y, r: 19, fill: '#653DC7', stroke: '#fff', 'stroke-width': 5 }, g);
      return g;
    });
    const rows = ['#st1', '#st2', '#st3'].map(q => $(q));
    return (t, s) => {
      const p1 = P(5, 0), p2 = P(6, 0), p3a = P(7, 0), p3b = P(7, 1);
      fadeUp($('#s3card'), t, P(4, 0).end - 0.25, 0.5, 50);
      // step 1 — the 12 months
      draw(base, eInOut(prog(t, p1.start, (p1.end - p1.start) * 0.9)));
      ticks.forEach((tk, i) => {
        const k = eOut(prog(t, p1.start + i * ((p1.end - p1.start) * 0.85) / 12, 0.3));
        tk.style.opacity = k; labels[i].style.opacity = k;
      });
      popIn($('#s3range'), t, p1.start + 0.4);
      // step 2 — count the actions
      popIn($('#s3count'), t, p2.start - 0.1);
      let count = 0;
      dots.forEach((g, i) => {
        const a = p2.start + 0.15 + (i * (p2.end - p2.start) * 0.85) / dots.length;
        svgPop(g, t, a);
        if (t >= a + 0.05) count++;
      });
      $('#s3n').textContent = count;
      // step 3 — linked or alone?
      linkEls.forEach((l, i) => draw(l, eInOut(prog(t, p3a.start + 0.2 + i * 0.45, 0.5))));
      rings.forEach((r, i) => {
        const k = eOut(prog(t, p3b.start + i * 0.12, 0.35));
        r.style.opacity = k;
        r.setAttribute('r', lerp(18, 31, k));
      });
      // step rows: active / done
      const starts = [p1.start, p2.start, p3a.start];
      rows.forEach((row, i) => {
        fadeUp(row, t, starts[i] - 0.25, 0.45, 30);
        const done = i < 2 ? eOut(prog(t, starts[i + 1] - 0.2, 0.4)) : 0;
        const n = row.querySelector('.n');
        n.style.background = `rgba(${Math.round(lerp(101, 205, done))},${Math.round(lerp(61, 186, done))},${Math.round(lerp(199, 245, done))},1)`;
        n.style.color = done > 0.5 ? '#653DC7' : '#fff';
        row.querySelector('p').style.color = done > 0.5 ? '#666666' : '#1A1A2E';
      });
    };
  })();

  // 04 — "two kinds"
  UPD.s4 = (t, s) => {
    const k = eOut(prog(t, s.start + 0.05, 0.6));
    const n = $('#s4num');
    n.style.opacity = k;
    n.style.transform = `scale(${lerp(0.92, 1, k)})`;
    popIn($('#s4a'), t, P(8, 0).end - 0.15);
    popIn($('#s4b'), t, P(8, 0).end + 0.15);
  };

  // 05 — reactive marketing: spikes when needed, drops in between
  UPD.s5 = (() => {
    const svg = $('#s5svg');
    const B = 320;
    const pts = [[790, B], [700, B], [670, 372, 'dip'], [636, 168, 'spike'], [602, 300], [528, B], [462, B], [432, 372, 'dip'],
      [398, 168, 'spike'], [364, 300], [292, B], [228, B], [198, 372, 'dip'], [164, 168, 'spike'], [130, 300], [30, B]];
    svgEl('line', { x1: 790, y1: B, x2: 30, y2: B, stroke: 'rgba(101,61,199,0.18)', 'stroke-width': 3, 'stroke-dasharray': '10 12' }, svg);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
    const line = svgEl('path', { d, fill: 'none', stroke: '#653DC7', 'stroke-width': 7, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    let acc = 0;
    const lens = [0];
    for (let i = 1; i < pts.length; i++) { acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); lens.push(acc); }
    const spikes = [], dips = [];
    pts.forEach((p, i) => {
      if (p[2] === 'spike') {
        const g = svgEl('g', {}, svg);
        svgEl('line', { x1: p[0], y1: p[1] - 14, x2: p[0], y2: 118, stroke: 'rgba(101,61,199,0.35)', 'stroke-width': 3, 'stroke-dasharray': '4 6' }, g);
        svgEl('circle', { cx: p[0], cy: 86, r: 34, fill: '#653DC7' }, g);
        svgIcon(g, 'megaphone', p[0], 86, 34, '#fff');
        const tx = svgEl('text', { x: p[0], y: 30, 'text-anchor': 'middle', 'font-size': 30, 'font-weight': 800, fill: '#653DC7' }, g);
        tx.textContent = 'حملة';
        spikes.push({ g, f: lens[i] / acc });
      }
      if (p[2] === 'dip') {
        const g = svgEl('g', {}, svg);
        svgEl('rect', { x: p[0] - 82, y: 394, width: 164, height: 50, rx: 25, fill: 'rgba(255,77,158,0.12)' }, g);
        const tx = svgEl('text', { x: p[0] + 16, y: 429, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 800, fill: '#D1005F' }, g);
        tx.textContent = 'الزبائن';
        svgIcon(g, 'down', p[0] - 52, 419, 26, '#D1005F', 2.8);
        dips.push(g);
      }
    });
    return (t, s) => {
      const k0 = eOut(prog(t, s.start + 0.05, 0.6));
      $('#s5num').style.opacity = k0;
      $('#s5num').style.transform = `translateY(${(1 - k0) * 30}px)`;
      fadeUp($('#s5card'), t, P(9, 1).end - 0.3, 0.5, 50);
      const p = P(9, 2);
      const a = p.start - 0.1, d = (p.end - p.start) * 0.95;
      draw(line, prog(t, a, d));
      spikes.forEach(sp => svgPop(sp.g, t, a + sp.f * d - 0.05));
      const q = P(9, 3);
      dips.forEach((g, i) => svgPop(g, t, q.start + i * 0.3));
    };
  })();

  // 06 — system marketing: every part linked, flowing into growth
  UPD.s6 = (() => {
    const svg = $('#s6svg');
    const cx = 444, cy = 310, rx = 334, ry = 240;
    const at = th => [cx + rx * Math.cos(th), cy + ry * Math.sin(th)];
    const arcs = [];
    for (let i = 0; i < 4; i++) {
      const a0 = (-Math.PI / 2) + i * Math.PI / 2, a1 = a0 + Math.PI / 2;
      const [x0, y0] = at(a0), [x1, y1] = at(a1);
      const p = svgEl('path', { d: `M${x0} ${y0} A${rx} ${ry} 0 0 1 ${x1} ${y1}`, fill: 'none', stroke: '#653DC7', 'stroke-width': 6, 'stroke-linecap': 'round' }, svg);
      const am = (a0 + a1) / 2, [mx, my] = at(am);
      const ang = (Math.atan2(ry * Math.cos(am), -rx * Math.sin(am)) * 180) / Math.PI;
      const chev = svgEl('path', { d: 'M-12 -14 L6 0 L-12 14', fill: 'none', stroke: '#653DC7', 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        transform: `translate(${mx} ${my}) rotate(${ang})` }, svg);
      arcs.push({ p, chev });
    }
    const parts = [...Array(10)].map(() => svgEl('circle', { r: 8, fill: '#9B6FEA' }, svg));
    const nodes = ['#n1', '#n2', '#n3', '#n4'].map(q => $(q));
    return (t, s) => {
      const k0 = eOut(prog(t, s.start + 0.05, 0.6));
      $('#s6num').style.opacity = k0;
      $('#s6num').style.transform = `translateY(${(1 - k0) * 30}px)`;
      const pn = P(10, 1);
      nodes.forEach((n, i) => popIn(n, t, pn.start + i * 0.18, 0.4, 0.8, 'translate(50%,-50%)'));
      const pl = P(10, 2);
      arcs.forEach((a, i) => {
        const k = eInOut(prog(t, pl.start + i * 0.42, 0.55));
        draw(a.p, k);
        a.chev.style.opacity = eOut(prog(t, pl.start + i * 0.42 + 0.35, 0.25));
      });
      const pg = P(10, 3);
      popIn($('#s6hub'), t, pg.start + 0.1, 0.45, 0.7);
      const pk = eOut(prog(t, pg.start, 0.5));
      parts.forEach((c, i) => {
        const th = -Math.PI / 2 + (i * 2 * Math.PI) / parts.length + (t - pg.start) * 0.8;
        const [x, y] = at(th);
        c.setAttribute('cx', x); c.setAttribute('cy', y);
        c.style.opacity = pk * 0.9;
      });
    };
  })();

  // 07 — lasting vs temporary results
  UPD.s7 = (() => {
    const svg = $('#s7svg');
    const B = 400;
    svgEl('line', { x1: 790, y1: B, x2: 30, y2: B, stroke: 'rgba(255,255,255,0.18)', 'stroke-width': 3 }, svg);
    [100, 200, 300].forEach(y => svgEl('line', { x1: 790, y1: y, x2: 30, y2: y, stroke: 'rgba(255,255,255,0.06)', 'stroke-width': 2 }, svg));
    const defs = svgEl('defs', {}, svg);
    const clip = svgEl('clipPath', { id: 's7clip' }, defs);
    const clipR = svgEl('rect', { x: 820, y: -40, width: 0, height: 520 }, clip);
    const temp = svgEl('path', { d: 'M780 388 L690 386 L640 150 L590 372 L470 384 L40 388', fill: 'none', stroke: 'rgba(255,255,255,0.55)',
      'stroke-width': 6, 'stroke-dasharray': '16 14', 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'clip-path': 'url(#s7clip)' }, svg);
    const glow = svgEl('path', { d: 'M780 388 C600 384 430 330 310 250 S100 92 40 52', fill: 'none', stroke: 'rgba(255,180,0,0.25)', 'stroke-width': 22, 'stroke-linecap': 'round' }, svg);
    const last = svgEl('path', { d: 'M780 388 C600 384 430 330 310 250 S100 92 40 52', fill: 'none', stroke: '#FFB400', 'stroke-width': 8, 'stroke-linecap': 'round' }, svg);
    const end = svgEl('circle', { cx: 40, cy: 52, r: 16, fill: '#FFB400', stroke: '#2D1B69', 'stroke-width': 6 }, svg);
    const axis = svgEl('g', {}, svg);
    svgEl('path', { d: 'M150 432 H40 M58 418 L40 432 L58 446', fill: 'none', stroke: 'rgba(255,255,255,0.45)', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, axis);
    const ax = svgEl('text', { x: 166, y: 442, 'text-anchor': 'start', 'font-size': 26, 'font-weight': 700, fill: 'rgba(255,255,255,0.55)', direction: 'rtl' }, axis);
    ax.textContent = 'الوقت';
    const tag = svgEl('g', {}, svg);
    svgEl('rect', { x: 470, y: 112, width: 190, height: 52, rx: 26, fill: 'rgba(255,255,255,0.10)' }, tag);
    const tx = svgEl('text', { x: 565, y: 147, 'text-anchor': 'middle', 'font-size': 28, 'font-weight': 700, fill: 'rgba(255,255,255,0.7)' }, tag);
    tx.textContent = 'وقتية';
    return (t, s) => {
      const p0 = P(11, 0), p1 = P(11, 1);
      fadeUp($('#s7card'), t, p0.start + 0.6, 0.5, 50);
      const k = eInOut(prog(t, p0.start + 1.1, Math.max(1.2, p0.end - p0.start - 0.9)));
      draw(last, k); draw(glow, k);
      svgPop(end, t, p0.start + 1.1 + Math.max(1.2, p0.end - p0.start - 0.9) - 0.1);
      fadeUp($('#s7l1'), t, p0.start + 1.1, 0.4, 16);
      const k2 = eInOut(prog(t, p1.start, (p1.end - p1.start) * 0.9));
      clipR.setAttribute('x', 820 - 820 * k2); clipR.setAttribute('width', 820 * k2);
      fadeUp($('#s7l2'), t, p1.start, 0.4, 16);
      svgPop(tag, t, p1.start + 0.6);
    };
  })();

  // 08 — lots of effort, unstable results
  UPD.s8 = (() => {
    const svg = $('#s8svg');
    svgEl('line', { x1: 790, y1: 85, x2: 10, y2: 85, stroke: 'rgba(101,61,199,0.15)', 'stroke-width': 3, 'stroke-dasharray': '10 12' }, svg);
    const zz = svgEl('path', { d: 'M790 90 L735 40 L680 128 L620 30 L566 140 L506 58 L452 150 L392 46 L338 118 L280 26 L226 142 L168 66 L112 132 L60 50 L10 100',
      fill: 'none', stroke: '#9B6FEA', 'stroke-width': 6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    return (t, s) => {
      popIn($('#s8icon'), t, s.start + 0.1);
      const p0 = P(12, 0), p1 = P(12, 1);
      fadeUp($('#s8card'), t, p0.start + 0.5, 0.5, 50);
      $('#s8fill').style.width = `${92 * eOut(prog(t, p0.start + 0.9, Math.max(1, p0.end - p0.start - 0.6)))}%`;
      draw(zz, eInOut(prog(t, p1.start - 0.1, (p1.end - p1.start) * 0.95)));
      popIn($('#s8chip'), t, p1.end - 0.7);
    };
  })();

  // 09 — every campaign starts from zero, no link to the previous one
  UPD.s9 = (() => {
    const cards = ['#c1', '#c2', '#c3'].map(q => $(q));
    const fills = cards.map(c => c.querySelector('.fill'));
    const zeros = cards.map(c => c.querySelector('.zero'));
    const target = [74, 66, 71];
    return (t, s) => {
      const p1 = P(13, 1), p2 = P(13, 2);
      const gap = Math.max(0.55, (p1.end - p1.start) / 3);
      cards.forEach((c, i) => {
        const a = p1.start - 0.2 + i * gap;
        popIn(c, t, a, 0.4, 0.9);
        popIn(zeros[i], t, a + 0.15, 0.3, 0.7);
        fills[i].style.width = `${target[i] * eOut(prog(t, a + 0.3, 0.8))}%`;
      });
      popIn($('#u1'), t, p2.start + 0.05, 0.35, 0.6);
      popIn($('#u2'), t, p2.start + 0.4, 0.35, 0.6);
    };
  })();

  // 10 — your last 12 months: linked, or each one alone?
  UPD.s10 = (() => {
    const A = $('#s10svgA'), Bv = $('#s10svgB');
    const na = [[40, 40], [200, 30], [190, 120], [50, 115]];
    const la = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]].map(([i, j]) => svgEl('line', { x1: na[i][0], y1: na[i][1], x2: na[j][0], y2: na[j][1],
      stroke: '#FFB400', 'stroke-width': 4, 'stroke-linecap': 'round' }, A));
    na.forEach(([x, y]) => svgEl('circle', { cx: x, cy: y, r: 14, fill: '#fff' }, A));
    const nb = [[30, 30], [170, 20], [120, 90], [215, 128], [50, 125]];
    const db = nb.map(([x, y]) => svgEl('circle', { cx: x, cy: y, r: 14, fill: 'rgba(255,255,255,0.55)' }, Bv));
    return (t, s) => {
      const p2 = P(14, 2), p3 = P(14, 3);
      fadeUp($('#s10a'), t, p2.start + 0.5, 0.5, 40);
      la.forEach((l, i) => draw(l, eInOut(prog(t, p2.start + 0.8 + i * 0.15, 0.35))));
      fadeUp($('#s10b'), t, p3.start + 0.1, 0.5, 40);
      db.forEach((c, i) => {
        c.setAttribute('cx', nb[i][0] + Math.sin(t * 0.9 + i * 2.1) * 8);
        c.setAttribute('cy', nb[i][1] + Math.cos(t * 0.8 + i * 1.4) * 8);
      });
    };
  })();

  // 11 — end card
  UPD.s11 = (t, s) => {
    const a = s.start;
    const k = eOut(prog(t, a + 0.1, 0.5));
    $('#s11logo').style.opacity = k;
    $('#s11logo').style.transform = `scale(${lerp(0.94, 1, k)})`;
    fadeUp($('#s11eb'), t, a + 0.35);
    fadeUp($('#s11h'), t, a + 0.55, 0.5, 40);
    popIn($('#s11cta'), t, a + 0.95, 0.45, 0.9);
    fadeUp($('#s11c'), t, a + 1.25);
  };

  /* ---------- scene visibility & transitions ---------- */
  const SCENES = TL.scenes.map((s, i) => ({ ...s, el: document.getElementById(s.id), fg: document.querySelector(`#${s.id} > .fg`), next: TL.scenes[i + 1] }));
  function sceneState(s, t) {
    let a = s.trans === 'fade' ? eInOut(prog(t, s.start - 0.25, 0.5)) : (t >= s.start ? 1 : 0);
    let exit = 0;
    if (s.next) {
      if (s.next.trans === 'fade') {
        if (t >= s.end + 0.3) a = 0;
        exit = eInOut(prog(t, s.end - 0.38, 0.4));
      } else if (t >= s.end) a = 0;
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
        const L = lerp(1330, -2650, eInOut(prog(t, a, 1)));
        p.style.transform = `translateX(${L}px) skewX(-12deg)`;
        p.style.left = '0px';
        shown = true;
      }
      p.style.display = shown ? 'block' : 'none';
    });
  }

  const bug = $('#bug'), bugW = $('#bugW'), bugP = $('#bugP');
  function updateBug(t, states) {
    let dark = 0, endA = 0;
    states.forEach(({ s, a }) => {
      dark = dark * (1 - a) + (s.kind === 'dark' ? a : 0);
      if (s.id === 's11') endA = a;
    });
    bugW.style.opacity = dark;
    bugP.style.opacity = 1 - dark;
    bug.style.opacity = eOut(prog(t, 0.2, 0.5)) * (1 - endA);
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
    updateWords(t);
    updateWipe(t);
    updateBug(t, states);
  };

  window.renderReady = Promise.all([
    document.fonts.ready,
    ...[...document.images].map(img => (img.complete ? Promise.resolve() : new Promise(r => { img.onload = img.onerror = r; }))),
  ]).then(() => { window.render(0); return true; });
})();
