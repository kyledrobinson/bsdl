# Quick Fix Checklist

Use this list before committing responsive updates to the Bloor Street Dart League site.

## Critical
- [ ] Confirm the viewport meta tag in every HTML document reads `width=device-width, initial-scale=1.0, maximum-scale=5.0`.
- [ ] Verify `body`, `main`, and `.main-content` use fluid widths (`width: 100%`) with side padding no greater than 16px on narrow screens.
- [ ] Ensure the hero image element has the `responsive-img` class and renders with `width: 100%` and `height: auto`.
- [ ] Wrap each `<table>` inside a `.matches-table-wrapper` within a `.table-container` to enable horizontal scrolling without affecting the body width.
- [ ] Load standings and player statistics from the JSON files inside `/data` (never from PHP endpoints on GitHub Pages).

## High Priority
- [ ] Run the overflow diagnostic in Chrome DevTools (`document.body.scrollWidth > window.innerWidth`) at 375px, 768px, 1024px, and 1920px.
- [ ] Test navigation tap targets on mobile to ensure every item is at least 44px tall.
- [ ] Confirm that `matchDetails.js` shows a loading state and friendly error message if any fetch fails.

## Nice to Have
- [ ] Capture before/after screenshots for the hero, navigation, and standings table in Chrome mobile.
- [ ] Re-run the Plotly charts after toggling the theme to ensure colors update.
- [ ] Update this checklist with any new regression tests when issues are discovered.

