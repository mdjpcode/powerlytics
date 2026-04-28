# Powerlytics Dashboard

A client-side training analysis dashboard built with Next.js App Router, React, Tailwind CSS, and Recharts.

## Features

- Credential entry for Intervals.icu Athlete ID + API key and Gemini API key.
- Optional localStorage persistence (`Save for next time`).
- Loads recent Intervals.icu activities.
- Supports swim, bike, and run data streams.
- Planned workout parser (`5x5 min @ 300W`, `10x100m at 1:30 pace`, etc.).
- Planned vs actual interval analysis + compliance percentage.
- Time-in-zone calculation and visualizations.
- Gemini-generated coaching feedback from analyzed workout data.

## Tech stack

- Next.js (App Router) with static export (`output: "export"`)
- React 19
- Tailwind CSS
- Recharts

## Local development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Deploying to GitHub Pages

This repository includes `.github/workflows/deploy.yml` that:

1. Installs dependencies
2. Builds the static export (`out/`)
3. Deploys to GitHub Pages

Ensure your repository settings are configured for GitHub Pages via **GitHub Actions**.

## Notes

- All Intervals.icu and Gemini API calls are performed client-side from the browser.
- API keys are never sent to a custom backend because this app is static-exported.
- For production usage, users should understand client-side API key exposure trade-offs.
