# Implementation Guide

This guide describes how the responsive updates are organized throughout the project.

## 1. HTML Structure
- The `<head>` of each page defines `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">`.
- Critical layout sections share semantic wrappers:
  - `<header class="site-header">` for the navigation bar.
  - `<main class="main-content">` containing a single `.content-wrapper` that centers content.
  - `.table-container > .matches-table-wrapper > table` for scrollable tables.
- Hero and announcement imagery use the `responsive-img` helper class so CSS can enforce fluid scaling.
- Data tables emit `data-label` attributes on `<td>` elements (via `matchDetails.js`) to support stacked layouts on narrow screens.

## 2. CSS Layout Principles
- Global rules in `styles.css` reset margins/padding on the `html` and `body` elements and lock the horizontal overflow.
- Fluid widths:
  ```css
  body,
  main,
  .main-content,
  .content-wrapper {
    width: 100%;
  }
  ```
- `.main-content` caps at 1200px with modest padding for small screens (`24px 16px`) and expands to `32px 48px` on viewports ≥ 1024px.
- The hero banner is a flex column card with a white background, border, and subtle shadow. The `responsive-img` class guarantees the hero art never exceeds the viewport width.
- Navigation links and the theme toggle enforce a minimum touch height of 44px.
- Tables have a `min-width` of 540px (players table: 960px) so they scroll horizontally on very small devices while keeping columns legible.

## 3. JavaScript Data Flow
- `matchDetails.js` fetches JSON from `data/standings.json` and `data/players.json` using `cache: 'no-store'` to avoid stale Chrome caches.
- Loading states populate table bodies with temporary rows until the data resolves.
- Errors surface through `.table-error` banners for both standings and player stats.
- Pagination, search, and sorting update the DOM without reloading the page.

## 4. Adding New Content
- To add a new section, wrap it in the `.content-wrapper` context so it inherits site padding.
- For new tables, reuse the `.table-container` and `.matches-table` classes; apply `data-label` attributes if rows are built manually.
- Add new imagery to the `img/` directory and apply the `responsive-img` class for consistent scaling.

## 5. Deployment Notes
- GitHub Pages hosts only static assets. Ensure all runtime data is available as JSON.
- Cache busting is handled by appending a version query string to `styles.css` and `matchDetails.js` in `index.html`.
- After pushing to GitHub, force refresh Chrome (or use an incognito window) to bypass old assets when validating fixes.

