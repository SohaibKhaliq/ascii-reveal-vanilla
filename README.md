# ascii-reveal-vanilla

Universal vanilla ASCII reveal + skeleton library. **No framework, no build step, no backend required.**

Public open source, MIT license. Concept inspired by [ascii-reveal](https://github.com/quanhoangindex/ascii-reveal) — this is a clean, independent implementation, not a fork and not copied code.

## Install

```bash
npm install ascii-reveal-vanilla
```

Or use it straight from a CDN, no install needed:

## Use it anywhere

```html
<link rel="stylesheet" href="ascii-reveal-vanilla.css">
<script src="ascii-reveal-vanilla.js"></script>

<div data-ascii-reveal data-preset="decode">Hello world</div>
<div data-ascii-skeleton data-lines="3" data-variant="dither"></div>
<img data-ascii-img data-preset="dither" src="photo.jpg" alt="">
```

Works in plain HTML, WordPress, Shopify, Webflow, Astro, Next.js (client), Vue, Svelte, and static hosting. Just add the two files.

With a bundler / CommonJS:

```js
const { AsciiReveal, AsciiSkeleton } = require('./ascii-reveal-vanilla.js');
AsciiReveal.init();
```

## Features

- **Text decode reveal** — characters scramble, then lock in a wave across the element.
- **Skeleton** — plain HTML/CSS, paints on the first frame, no JavaScript needed to paint.
- **Image dither reveal** — canvas sampling, grid precomputed once per cell size.
- **Presets** — `decode`, `terminal`, `blueprint`, `dither`, `scan`.
- **Durations** — `fast` (~650 ms), `cinematic` (~1400 ms).
- **Fonts** — reveals wait for `document.fonts.ready` (with a ~1.5 s timeout) so late fonts never misalign the grid.
- **Reduced motion** — `prefers-reduced-motion` turns every reveal into a short fade.
- **Lazy** — below-fold sections reveal when scrolled into view (IntersectionObserver).
- **No layout shift** — real content stays in the DOM; only an overlay/scramble layer animates.
- **Accessible** — screen readers read the real text throughout.

## API

### Data attributes

| Attribute | Values |
|---|---|
| `data-ascii-reveal` | (present = reveal this subtree) |
| `data-preset` | `decode` (default), `terminal`, `blueprint`, `dither`, `scan` |
| `data-duration` | `fast` (default), `cinematic` |
| `data-origin` | `center` (default), `top-left` |
| `data-lazy` | `true` (default), `false` |
| `data-auto` | `false` = do not auto-reveal, drive it from JS |
| `data-ascii-skeleton` | (present = render a skeleton here) |
| `data-lines`, `data-variant`, `data-animate`, `data-widths` | skeleton shape; variants `dither`, `scan`, `braille`, `terminal` |
| `data-ascii="skip"` | leave a subtree alone |
| `data-ascii="fade"` | fade in with the wave, do not scramble |

### JS API

```js
AsciiReveal.init();                              // init all data-attribute elements
AsciiReveal.reveal(el, { preset: 'terminal', duration: 'cinematic' });
AsciiReveal.revealImage(img, { preset: 'dither', duration: 'fast' });
AsciiReveal.ready();                             // Promise: fonts ready (with timeout)
AsciiReveal.PRESETS; AsciiReveal.version;

const sk = new AsciiSkeleton(el, { lines: 3, variant: 'dither', animate: true });
AsciiSkeleton.html({ lines: 3, variant: 'braille', animate: false }); // HTML string
```

### Custom elements

```html
<ascii-reveal preset="terminal"><p>Hello</p></ascii-reveal>
<ascii-skeleton lines="3" variant="dither"></ascii-skeleton>
```

### Events

Every reveal dispatches an `asciireveal` CustomEvent on its wrapper with `detail: { active: true | false }`.

### Loading pattern (skeleton → reveal)

```html
<div id="sk" data-ascii-skeleton data-lines="3"></div>
<div id="content" data-ascii-reveal style="display:none">…real content…</div>
<script>
  fetchData().then(function () {
    document.getElementById('sk').style.display = 'none';
    var c = document.getElementById('content');
    c.style.display = 'block';
    AsciiReveal.reveal(c);
  });
</script>
```

## Images: CORS, honestly

Canvas pixel sampling is blocked by the browser for cross-origin images without CORS headers — that is browser security, not a bug, and no client code can bypass it.

- **Same-origin images** work directly.
- **CORS-enabled images** (with `crossorigin="anonymous"` + server `Access-Control-Allow-Origin`) work directly.
- **CORS-blocked images** fall back to a neutral glyph texture, then fade to the real image. No crash, no broken canvas.
- **Any backend can precompute a grid** and pass it as JSON, sidestepping sampling entirely:

```html
<img data-ascii-img src="photo.jpg"
     data-ascii-grid='{"cols":40,"rows":24,"cells":[[255,0,0],[0,255,0]]}'>
```

Cells may be `[r, g, b]` arrays, `"#rrggbb"` strings, or `{ "color": [r, g, b] }` objects. Any backend (Node, Python, PHP, Go) or edge function (Cloudflare Worker, Netlify, Vercel) can produce this JSON. No Laravel-specific code anywhere in this library.

## Theming

```css
.my-app {
  --ascii-accent: #5b8cff;
  --ascii-skeleton: #888;
  --ascii-glyph: #888;
  --ascii-font: "Geist Mono", ui-monospace, monospace;
}
```

## Files

- `ascii-reveal-vanilla.js` — the library (UMD: script tag or CommonJS)
- `ascii-reveal-vanilla.css` — skeleton, canvas, and theming styles
- `demo.html` — zero-backend demo; open the file directly, no server needed

## License

MIT. See `LICENSE`. Keep the license notice in the files when you redistribute them.
