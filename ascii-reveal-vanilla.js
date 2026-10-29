/*!
 * ascii-reveal-vanilla v1.0.0
 * Universal vanilla ASCII reveal + skeleton library.
 * No framework, no build step, no backend required.
 * MIT License. Concept inspired by quanhoangindex/ascii-reveal;
 * this is a clean, independent implementation — not a fork, not copied code.
 */
(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else {
    var lib = factory();
    root.AsciiReveal = lib.AsciiReveal;
    root.AsciiSkeleton = lib.AsciiSkeleton;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var root = typeof self !== 'undefined' ? self : this;
  var VERSION = '1.0.0-vanilla';

  /* ---------------- presets ---------------- */
  var PRESETS = {
    decode:    { scramble: '!<>-_\\/[]{}=+*^?#' },
    terminal:  { scramble: '01' },
    blueprint: { scramble: '─│┌┐└┘├┤┬┴┼·' },
    dither:    { scramble: ' ░▒▓█' },
    scan:      { scramble: '.·:;+*#%@' }
  };
  var DITHER_RAMP = ' ░▒▓█';
  var IMAGE_RAMP = ' .:-=+*#%@';

  function presetOf(name) {
    return PRESETS[name] || PRESETS.decode;
  }
  function randomChar(set) {
    return set.charAt(Math.floor(Math.random() * set.length));
  }
  function reducedMotion() {
    return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function fontsReady(timeout) {
    timeout = timeout || 1500;
    try {
      if (root.document && root.document.fonts && root.document.fonts.ready) {
        return Promise.race([
          root.document.fonts.ready.then(function () {}),
          new Promise(function (res) { setTimeout(res, timeout); })
        ]);
      }
    } catch (e) { /* fall through */ }
    return Promise.resolve();
  }
  function dispatch(el, active) {
    try {
      el.dispatchEvent(new CustomEvent('asciireveal', { detail: { active: active }, bubbles: true }));
    } catch (e) { /* old browsers: ignore */ }
  }

  /* ---------------- text ---------------- */
  function collectTextParts(el) {
    var spans = [];
    var fades = [];
    function walk(node) {
      if (node.nodeType === 3) {
        var text = node.nodeValue;
        if (!text || !text.trim()) return;
        var frag = root.document.createDocumentFragment();
        for (var i = 0; i < text.length; i++) {
          var ch = text[i];
          if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r') {
            frag.appendChild(root.document.createTextNode(ch));
          } else {
            var s = root.document.createElement('span');
            s.className = 'ascii-char';
            s.dataset.final = ch;
            s.textContent = ch;
            frag.appendChild(s);
            spans.push(s);
          }
        }
        node.parentNode.replaceChild(frag, node);
        return;
      }
      if (node.nodeType !== 1) return;
      var tag = node.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE') return;
      if (node.dataset && node.dataset.ascii === 'skip') return;
      if (node.dataset && node.dataset.ascii === 'fade') { fades.push(node); return; }
      var children = Array.prototype.slice.call(node.childNodes);
      for (var j = 0; j < children.length; j++) walk(children[j]);
    }
    var kids = Array.prototype.slice.call(el.childNodes);
    for (var k = 0; k < kids.length; k++) walk(kids[k]);
    return { spans: spans, fades: fades };
  }

  function revealText(container, spans, fades, opts) {
    return new Promise(function (resolve) {
      if (!spans.length) {
        fades.forEach(function (f) { f.style.opacity = '1'; });
        resolve();
        return;
      }
      var duration = opts.durationMs;
      var scrambleSet = presetOf(opts.preset).scramble;
      var rect = container.getBoundingClientRect();
      var origin = opts.origin || { x: rect.width / 2, y: rect.height / 2 };
      var items = spans.map(function (s) {
        var r = s.getBoundingClientRect();
        var cx = r.left - rect.left + r.width / 2;
        var cy = r.top - rect.top + r.height / 2;
        var dist = Math.sqrt(Math.pow(cx - origin.x, 2) + Math.pow(cy - origin.y, 2));
        return { el: s, dist: dist, done: false };
      });
      var maxDist = 0;
      items.forEach(function (it) { if (it.dist > maxDist) maxDist = it.dist; });
      items.forEach(function (it) {
        it.delay = maxDist ? (it.dist / maxDist) * duration * 0.55 : 0;
        it.span = duration * 0.45;
      });
      fades.forEach(function (f) { f.style.opacity = '0'; f.style.transition = 'opacity 300ms'; });
      var start = performance.now();
      var lastScramble = 0;
      var finished = false;
      function finish() {
        if (finished) return;
        finished = true;
        items.forEach(function (it) { it.el.textContent = it.el.dataset.final; });
        fades.forEach(function (f) { f.style.opacity = '1'; });
        resolve();
      }
      var watchdog = setTimeout(finish, duration * 2 + 1000);
      function frame(now) {
        if (finished) return;
        var elapsed = now - start;
        var scrambleTick = now - lastScramble > 70;
        if (scrambleTick) lastScramble = now;
        var allDone = true;
        items.forEach(function (it) {
          if (it.done) return;
          if (elapsed >= it.delay + it.span) {
            it.el.textContent = it.el.dataset.final;
            it.done = true;
          } else {
            allDone = false;
            if (scrambleTick) it.el.textContent = randomChar(scrambleSet);
          }
        });
        if (allDone) { clearTimeout(watchdog); finish(); return; }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }

  /* ---------------- images ---------------- */
  function parseGrid(raw) {
    try {
      var g = JSON.parse(raw);
      if (!g || !g.cols || !g.rows || !Array.isArray(g.cells)) return null;
      if (g.cells.length < g.cols * g.rows) return null;
      return g;
    } catch (e) { return null; }
  }
  function cellColor(cell) {
    if (Array.isArray(cell) && cell.length >= 3) return 'rgb(' + cell[0] + ',' + cell[1] + ',' + cell[2] + ')';
    if (typeof cell === 'string') return cell;
    if (cell && Array.isArray(cell.color)) return 'rgb(' + cell.color[0] + ',' + cell.color[1] + ',' + cell.color[2] + ')';
    if (cell && typeof cell.color === 'string') return cell.color;
    return '#888888';
  }
  function cellLum(cell) {
    if (Array.isArray(cell) && cell.length >= 3) return (0.2126 * cell[0] + 0.7152 * cell[1] + 0.0722 * cell[2]) / 255;
    return 0.5;
  }
  function glyphForLum(lum, preset) {
    if (preset === 'terminal') return lum > 0.5 ? '1' : '0';
    if (preset === 'blueprint') return '·┼─│'.charAt(Math.min(3, Math.floor(lum * 4)));
    var ramp = IMAGE_RAMP;
    return ramp.charAt(Math.min(ramp.length - 1, Math.floor(lum * ramp.length)));
  }
  function waitImg(img) {
    return new Promise(function (resolve) {
      if (img.complete && img.naturalWidth) { resolve(true); return; }
      var done = false;
      function ok(v) { if (!done) { done = true; resolve(v); } }
      img.addEventListener('load', function () { ok(true); }, { once: true });
      img.addEventListener('error', function () { ok(false); }, { once: true });
      setTimeout(function () { ok(!!(img.complete && img.naturalWidth)); }, 3000);
    });
  }
  function revealImage(img, opts) {
    return new Promise(function (resolve) {
      if (reducedMotion()) { img.style.opacity = '1'; resolve(); return; }
      waitImg(img).then(function (ok) {
        if (!ok || !img.clientWidth) { img.style.opacity = '1'; resolve(); return; }
        var parent = img.parentNode;
        var wrap;
        if (parent && parent.classList && parent.classList.contains('ascii-img-wrap')) {
          wrap = parent;
        } else {
          wrap = root.document.createElement('span');
          wrap.className = 'ascii-img-wrap';
          parent.insertBefore(wrap, img);
          wrap.appendChild(img);
        }
        var w = img.clientWidth, h = img.clientHeight;
        var cellW = 12, cellH = 18;
        var cols = Math.max(1, Math.round(w / cellW));
        var rows = Math.max(1, Math.round(h / cellH));
        var canvas = root.document.createElement('canvas');
        canvas.className = 'ascii-canvas';
        canvas.width = cols * cellW;
        canvas.height = rows * cellH;
        wrap.appendChild(canvas);
        var ctx = canvas.getContext('2d');
        ctx.font = cellH + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textBaseline = 'top';
        img.style.opacity = '0';
        var grid = img.dataset && img.dataset.asciiGrid ? parseGrid(img.dataset.asciiGrid) : null;
        var cells = [];
        var fallback = false;
        if (grid && grid.cols === cols && grid.rows === rows) {
          cells = grid.cells;
        } else if (grid) {
          // Grid supplied at a different resolution: use it as-is, rescale canvas grid.
          cols = grid.cols; rows = grid.rows;
          canvas.width = cols * cellW; canvas.height = rows * cellH;
          cells = grid.cells;
        } else {
          try {
            var off = root.document.createElement('canvas');
            off.width = cols; off.height = rows;
            var octx = off.getContext('2d');
            var nw = img.naturalWidth, nh = img.naturalHeight;
            var imgAspect = nw / nh, gridAspect = cols / rows;
            var sx = 0, sy = 0, sw = nw, sh = nh;
            if (imgAspect > gridAspect) { sw = nh * gridAspect; sx = (nw - sw) / 2; }
            else { sh = nw / gridAspect; sy = (nh - sh) / 2; }
            octx.drawImage(img, sx, sy, sw, sh, 0, 0, cols, rows);
            var data = octx.getImageData(0, 0, cols, rows).data;
            for (var i = 0; i < cols * rows; i++) {
              cells.push([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);
            }
          } catch (e) {
            fallback = true; // CORS-tainted canvas: cannot sample pixels.
            for (var y = 0; y < rows; y++) {
              for (var x = 0; x < cols; x++) {
                var hash = Math.abs((x * 73856093) ^ (y * 19349663)) % 100 / 100;
                cells.push({ lum: hash, fallback: true });
              }
            }
          }
        }
        function lumOf(cell) {
          if (cell && typeof cell.lum === 'number') return cell.lum;
          return cellLum(cell);
        }
        function drawGlyphs() {
          for (var y = 0; y < rows; y++) {
            for (var x = 0; x < cols; x++) {
              var cell = cells[y * cols + x];
              ctx.fillStyle = fallback ? '#777777' : cellColor(cell);
              ctx.fillText(glyphForLum(lumOf(cell), opts.preset), x * cellW, y * cellH);
            }
          }
        }
        drawGlyphs();
        if (fallback) {
          // No per-cell image reveal possible: glyph texture, then fade to the real image.
          setTimeout(function () {
            canvas.style.transition = 'opacity 400ms';
            canvas.style.opacity = '0';
            img.style.opacity = '1';
            setTimeout(function () { if (canvas.parentNode) canvas.parentNode.removeChild(canvas); resolve(); }, 420);
          }, Math.max(300, opts.durationMs * 0.6));
          return;
        }
        var duration = opts.durationMs;
        var order = [];
        for (var yy = 0; yy < rows; yy++) {
          for (var xx = 0; xx < cols; xx++) {
            var dx = xx - cols / 2, dy = yy - rows / 2;
            order.push({ x: xx, y: yy, dist: Math.sqrt(dx * dx + dy * dy) });
          }
        }
        var maxD = 0;
        order.forEach(function (o) { if (o.dist > maxD) maxD = o.dist; });
        order.sort(function (a, b) { return a.dist - b.dist; });
        var nw2 = img.naturalWidth, nh2 = img.naturalHeight;
        var imgAspect2 = nw2 / nh2, gridAspect2 = cols / rows;
        var sx2 = 0, sy2 = 0, sw2 = nw2, sh2 = nh2;
        if (imgAspect2 > gridAspect2) { sw2 = nh2 * gridAspect2; sx2 = (nw2 - sw2) / 2; }
        else { sh2 = nw2 / gridAspect2; sy2 = (nh2 - sh2) / 2; }
        var start = performance.now();
        var idx = 0;
        function frame(now) {
          var elapsed = now - start;
          var progress = Math.min(1, elapsed / duration);
          var target = Math.floor(progress * order.length);
          while (idx < target && idx < order.length) {
            var c = order[idx++];
            var px = sx2 + (c.x * sw2) / cols, py = sy2 + (c.y * sh2) / rows;
            ctx.clearRect(c.x * cellW, c.y * cellH, cellW, cellH);
            ctx.drawImage(img, px, py, sw2 / cols, sh2 / rows, c.x * cellW, c.y * cellH, cellW, cellH);
          }
          if (progress < 1) { requestAnimationFrame(frame); return; }
          img.style.opacity = '1';
          if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
          resolve();
        }
        requestAnimationFrame(frame);
      });
    });
  }

  /* ---------------- skeleton ---------------- */
  var SK_PATTERNS = { dither: '▓', scan: '·', braille: '⠿', terminal: '01' };
  function skeletonHTML(opts) {
    opts = opts || {};
    var variant = SK_PATTERNS[opts.variant] ? opts.variant : 'dither';
    var pat = SK_PATTERNS[variant];
    var animate = opts.animate !== false;
    var html = '';
    if (opts.circle || (opts.width && opts.height)) {
      var w = opts.width || 64, h = opts.height || 64;
      var style = 'width:' + w + 'px;height:' + h + 'px;' + (opts.circle ? 'border-radius:50%;' : '');
      html += '<div class="ascii-sk-block" style="' + style + '"><span class="ascii-sk-text">' + pat.repeat(80) + '</span></div>';
    }
    var lines = opts.lines == null ? 3 : opts.lines;
    var widths = opts.widths || null;
    for (var i = 0; i < lines; i++) {
      var lw = widths && widths[i] != null ? widths[i] : Math.max(45, 100 - i * 10);
      html += '<div class="ascii-sk-line" style="width:' + lw + '%"><span class="ascii-sk-text">' + pat.repeat(60) + '</span></div>';
    }
    if (animate) html += '<div class="ascii-sk-band"></div>';
    return html;
  }
  function AsciiSkeleton(el, opts) {
    if (!el) return;
    el.classList.add('ascii-skeleton');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = skeletonHTML(opts || {});
  }
  AsciiSkeleton.html = skeletonHTML;

  /* ---------------- reveal ---------------- */
  var instances = new WeakMap();
  function normOpts(el, opts) {
    opts = opts || {};
    var d = el.dataset || {};
    var dur = opts.duration || d.duration || 'fast';
    var durationMs = typeof dur === 'number' ? dur : (dur === 'cinematic' ? 1400 : 650);
    var origin = opts.origin;
    if (!origin && d.origin === 'top-left') origin = { x: 0, y: 0 };
    return {
      preset: opts.preset || d.preset || 'decode',
      durationMs: durationMs,
      origin: origin || null,
      lazy: opts.lazy != null ? opts.lazy : (d.lazy !== 'false')
    };
  }
  function AsciiReveal(el, opts) {
    this.el = el;
    this.opts = normOpts(el, opts);
    this.prepared = false;
    this.spans = [];
    this.fades = [];
    this.images = [];
    this.running = false;
  }
  AsciiReveal.prototype.prepare = function () {
    if (this.prepared) return;
    this.prepared = true;
    if (this.el.tagName === 'IMG') {
      this.images = [this.el];
    } else {
      var parts = collectTextParts(this.el);
      this.spans = parts.spans;
      this.fades = parts.fades;
      this.images = Array.prototype.slice.call(this.el.querySelectorAll('img'));
    }
  };
  AsciiReveal.prototype.finishInstant = function () {
    this.prepare();
    this.spans.forEach(function (s) { s.textContent = s.dataset.final; });
    this.fades.forEach(function (f) { f.style.opacity = '1'; });
    this.images.forEach(function (img) { img.style.opacity = '1'; });
  };
  AsciiReveal.prototype.reveal = function (opts) {
    var self = this;
    if (opts) this.opts = normOpts(this.el, opts);
    if (this.running) return this._current || Promise.resolve();
    this.running = true;
    dispatch(this.el, true);
    this._current = fontsReady().then(function () {
      self.prepare();
      if (reducedMotion()) { self.finishInstant(); return; }
      var jobs = [];
      if (self.spans.length || self.fades.length) jobs.push(revealText(self.el, self.spans, self.fades, self.opts));
      self.images.forEach(function (img) { jobs.push(revealImage(img, self.opts)); });
      return Promise.all(jobs);
    }).then(function () {
      self.running = false;
      dispatch(self.el, false);
    }).catch(function () {
      self.running = false;
      try { self.finishInstant(); } catch (e) {}
    });
    return this._current;
  };
  AsciiReveal.prototype.hide = function () {
    this.prepare();
    var set = presetOf(this.opts.preset).scramble;
    this.spans.forEach(function (s) { s.textContent = randomChar(set); });
    this.fades.forEach(function (f) { f.style.opacity = '0'; });
    this.images.forEach(function (img) { img.style.opacity = '0'; });
  };
  AsciiReveal.prototype.replay = function (opts) {
    var self = this;
    this.hide();
    return new Promise(function (res) { setTimeout(function () { self.reveal(opts).then(res); }, 60); });
  };
  AsciiReveal.get = function (el, opts) {
    var inst = instances.get(el);
    if (!inst) { inst = new AsciiReveal(el, opts); instances.set(el, inst); }
    else if (opts) { inst.opts = normOpts(el, opts); }
    return inst;
  };
  AsciiReveal.reveal = function (el, opts) { return AsciiReveal.get(el, opts).reveal(); };
  AsciiReveal.revealImage = function (img, opts) {
    var o = { preset: (opts && opts.preset) || 'dither', durationMs: (opts && opts.durationMs) || 900 };
    if (opts && typeof opts.duration === 'string') o.durationMs = opts.duration === 'cinematic' ? 1400 : 650;
    return fontsReady().then(function () { return revealImage(img, o); });
  };
  AsciiReveal.ready = fontsReady;
  AsciiReveal.PRESETS = PRESETS;
  AsciiReveal.version = VERSION;

  /* ---------------- auto-init ---------------- */
  function initSkeletons(root) {
    var nodes = root.querySelectorAll('[data-ascii-skeleton]');
    nodes.forEach(function (el) {
      if (el.dataset.asciiInit) return;
      el.dataset.asciiInit = 'true';
      var widths = el.dataset.widths ? el.dataset.widths.split(',').map(function (v) { return parseFloat(v); }) : null;
      new AsciiSkeleton(el, {
        lines: el.dataset.lines != null ? parseInt(el.dataset.lines, 10) : 3,
        variant: el.dataset.variant || 'dither',
        animate: el.dataset.animate !== 'false',
        widths: widths,
        width: el.dataset.width ? parseInt(el.dataset.width, 10) : null,
        height: el.dataset.height ? parseInt(el.dataset.height, 10) : null,
        circle: el.dataset.circle === 'true'
      });
    });
  }
  function initReveals(root) {
    var nodes = root.querySelectorAll('[data-ascii-reveal]');
    nodes.forEach(function (el) {
      if (el.dataset.asciiInit) return;
      el.dataset.asciiInit = 'true';
      var inst = AsciiReveal.get(el);
      if (el.dataset.auto === 'false') return;
      if (inst.opts.lazy && 'IntersectionObserver' in root) {
        var obs = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) { obs.disconnect(); inst.reveal(); }
          });
        }, { rootMargin: '80px' });
        obs.observe(el);
      } else {
        inst.reveal();
      }
    });
    var imgs = root.querySelectorAll('img[data-ascii-img]');
    imgs.forEach(function (img) {
      if (img.dataset.asciiInit) return;
      img.dataset.asciiInit = 'true';
      var run = function () {
        AsciiReveal.revealImage(img, { preset: img.dataset.preset || 'dither', durationMs: 900 });
      };
      if (img.dataset.lazy !== 'false' && 'IntersectionObserver' in root) {
        var obs2 = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) { if (en.isIntersecting) { obs2.disconnect(); run(); } });
        }, { rootMargin: '80px' });
        obs2.observe(img);
      } else { run(); }
    });
  }
  function init(root) {
    root = root || root.document;
    initSkeletons(root);
    initReveals(root);
  }
  AsciiReveal.init = init;

  /* ---------------- custom elements ---------------- */
  try {
    if (root.customElements && !root.customElements.get('ascii-reveal')) {
      root.customElements.define('ascii-reveal', class extends HTMLElement {
        connectedCallback() {
          if (this.dataset.asciiInit) return;
          this.dataset.asciiInit = 'true';
          var inst = AsciiReveal.get(this, { preset: this.getAttribute('preset') || undefined });
          if (this.getAttribute('auto') !== 'false') inst.reveal();
        }
      });
    }
    if (root.customElements && !root.customElements.get('ascii-skeleton')) {
      root.customElements.define('ascii-skeleton', class extends HTMLElement {
        connectedCallback() {
          if (this.dataset.asciiInit) return;
          this.dataset.asciiInit = 'true';
          new AsciiSkeleton(this, {
            lines: this.getAttribute('lines') != null ? parseInt(this.getAttribute('lines'), 10) : 3,
            variant: this.getAttribute('variant') || 'dither',
            animate: this.getAttribute('animate') !== 'false'
          });
        }
      });
    }
  } catch (e) { /* custom elements unavailable: data attributes still work */ }

  if (root.document) {
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', function () { init(root.document); });
    } else {
      init(root.document);
    }
  }

  return { AsciiReveal: AsciiReveal, AsciiSkeleton: AsciiSkeleton, version: VERSION };
});
