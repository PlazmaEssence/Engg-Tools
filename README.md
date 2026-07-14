# Egg Tools

Small browser-based engineering tools for piping design work (ASME B31.3 / B31.4). Static site, no backend, no build step — hosted free on GitHub Pages.

Live site: `https://<your-username>.github.io/Engg-Tools/` (enable in repo Settings → Pages → Deploy from branch → `main` / `/root`).

## Structure

```
index.html                     home page — tool launcher grid
assets/
  css/theme.css                shared design system (colors, type, components)
  js/tools-registry.js         list of every tool (single source of truth)
  js/site.js                   renders header/nav/footer + home page grid from the registry
tools/
  unit-converter/
    index.html
    converter.js
```

Every page loads `tools-registry.js` then `site.js`, and sets two globals first:

```html
<script src="../../assets/js/tools-registry.js"></script>
<script>
  window.EGG_BASE = '../../';       // relative path back to the site root
  window.EGG_CURRENT_TOOL = 'unit-converter'; // id of this tool, for nav highlighting
</script>
<script src="../../assets/js/site.js"></script>
```

`site.js` uses `EGG_BASE` to build correct links regardless of how deep the page is nested, and fills in `#site-header` / `#site-footer` placeholder elements. The home page additionally has a `#tool-grid` element that gets populated with a card per registry entry.

## Adding a new tool

1. Create `tools/<id>/index.html` (copy `tools/unit-converter/index.html` as a starting point — same `<head>`, header/footer placeholders, and script includes, with `EGG_BASE` set to `'../../'` and `EGG_CURRENT_TOOL` set to `'<id>'`).
2. Write the tool's own logic in `tools/<id>/<id>.js`.
3. Add one entry to `assets/js/tools-registry.js`:
   ```js
   {
     id: 'wall-thickness',
     name: 'Pipe Wall Thickness',
     icon: '⭕',
     desc: 'B31.3 / B31.4 pressure design thickness calculator.',
     tags: ['B31.3', 'B31.4'],
     url: 'tools/wall-thickness/',
     status: 'live' // or 'coming-soon' to list it grayed-out before it's finished
   }
   ```

That's it — the home page grid and every page's "Tools" nav dropdown pick it up automatically.

## Cache-busting (making pushes show up)

GitHub Pages rebuilds automatically on every push to `main`, but browsers and the CDN cache JS/CSS by URL, so a returning visitor can keep running old assets until they clear their cache. To avoid that, every asset include carries a `?v=<n>` version query:

```html
<link rel="stylesheet" href="../../assets/css/theme.css?v=1">
<script src="../../assets/js/tools-registry.js?v=1"></script>
<script src="../../assets/js/site.js?v=1"></script>
<script src="converter.js?v=2"></script>
```

Changing the URL makes every cache layer treat it as a new file and refetch. **When you edit a shared file (`theme.css`, `tools-registry.js`, `site.js`), bump its `?v=` number in every page that includes it.** For a tool's own script, bump the `?v=` on just that page. Adding a new tool means editing `tools-registry.js`, so bump its version too — otherwise the new tool card/nav entry stays hidden behind a cached registry.

## Local preview

No build step needed. From the repo root:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.
