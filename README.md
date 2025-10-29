# Bloor Street Dart League (bsdl)

A static website for the Bloor Street Dart League that highlights standings, player statistics, and upcoming matches for the 2025/2026 season. The project is built with plain HTML, CSS, and JavaScript so it can be hosted directly on GitHub Pages.

## Key Features
- Responsive layout that targets 375px, 768px, 1024px, and 1920px breakpoints.
- Dark- and light-mode support with a persistent theme toggle.
- Data-driven tables powered by local JSON feeds for standings and player statistics.
- Plotly-based charts that inherit the active theme colors.

## Local Development
No build step is required. Open `index.html` directly in a browser or serve the repository with any static file server (for example `python -m http.server`).

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000/index.html`.

## Testing Checklist
- Open the Chrome DevTools device toolbar and verify the layout on iPhone SE (375px), iPhone 12 Pro (390px), iPad (768px), and desktop widths (1024px and 1920px).
- Run the overflow diagnostic in the console to ensure the body does not exceed the viewport width:
  ```js
  console.log('Has overflow:', document.body.scrollWidth > window.innerWidth);
  ```
- Confirm the viewport meta tag prints the expected value:
  ```js
  console.log(document.querySelector('meta[name="viewport"]').content);
  ```
- Navigate the site in both light and dark modes to ensure contrast and touch targets meet accessibility expectations.

## Data Sources
The homepage consumes the JSON documents located in `data/standings.json` and `data/players.json`. Update these files to refresh statistics without editing any HTML.

## Folder Structure
```
.
├── data/               # JSON data consumed by matchDetails.js
├── img/                # Hero and announcement imagery
├── matchDetails.js     # Standings, players, charts, and schedule logic
├── styles.css          # Global styles and responsive layout rules
├── index.html          # Homepage
├── constitution.html   # League constitution page
└── contactUs.html      # Contact page
```

## Contributing
1. Create a new branch for your change.
2. Update HTML, CSS, or JSON files as needed. Keep the code modular and consistent with existing patterns.
3. Test across multiple viewport widths before opening a pull request.
4. Describe any visual or behavioral changes in the PR summary.

