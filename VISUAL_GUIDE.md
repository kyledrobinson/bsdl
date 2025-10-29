# Visual Guide

The following notes describe the expected appearance of the responsive layout across common breakpoints.

## Hero Section
- **Mobile (≤ 480px):** Hero banner displays as a white card with rounded corners. The image fills the top of the card and scales to the viewport width. Headline and subtitle appear beneath the image with left-aligned text.
- **Tablet (768px):** Additional padding appears around the hero content. Text remains left-aligned and the image retains its 16px corner radius.
- **Desktop (≥ 1024px):** The hero card widens up to 1200px and receives 32px of internal padding. There is no horizontal scroll at any size.

## Navigation
- **Mobile:** Navigation items stack vertically, stretch to full width, and include 44px touch targets.
- **Tablet/Desktop:** Navigation collapses to a single row aligned to the right of the header. Hover states lighten the link color while preserving contrast in dark and light themes.

## Tables
- Tables sit inside bordered wrappers with subtle shadows.
- On viewports narrower than 600px, the table retains a minimum width of 540px and scrolls horizontally inside the wrapper. Data labels (`data-label`) provide context when rows are stacked by CSS.
- The players table uses a wider minimum width (960px) to ensure numeric statistics do not overlap.

## Quick Links & Cards
- Cards feature rounded corners, gentle shadows, and hover lift effects in light mode.
- Grid layout automatically collapses to a single column on narrow devices and expands to multiple columns when space allows.

## Dark Mode
- Dark mode relies on CSS custom properties toggled via the `data-theme` attribute on `<body>`.
- Plotly charts read the same tokens so axes, grid lines, and text respect the active theme.

