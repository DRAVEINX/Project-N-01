# Project N-01

An independent, accessibility-first daily-life companion for Android phones, Android tablets, and Windows. This is a temporary project codename; the public product name will be selected after trademark, app-store, and domain checks.

## Principles
- Calm, predictable interfaces with adjustable density and text size.
- Dutch and English from the start.
- Core daily-planning and self-support features intended to remain free.
- Privacy by default: personal notes and feelings are not shared automatically.
- Accessibility: keyboard support, semantic controls, reduced-motion support, and screen-reader-friendly labels.
- No medical claims; the app supports daily routines and communication and is not a replacement for professional care.

## Current stage
Phase 1 is a responsive web prototype and project foundation, with a web app manifest and service-worker caching for offline use after the first successful visit when served over HTTPS or localhost. It is not yet a native Android or Windows release. Do not treat the prototype as production-ready.

## Run locally
Requires Node.js 20 or newer.

```bash
npm test
npm run serve
```

Then open http://localhost:4173. The serve script uses Node's built-in modules and has no runtime dependencies.

## Planned milestones
1. Accessible prototype and automated smoke tests.
2. Validate flows with users and accessibility checks.
3. Add native Android phone/tablet application shell and platform-specific layouts.
4. Add secure local persistence, export/recovery, and privacy controls.
5. Build and verify Windows packaging and platform release workflows.
6. Choose final product name only after availability research.

## Project boundaries
This repository is separate from MoodPress, KlaarKompas, and CreatorNexus. Do not copy over or modify those projects as part of this work.
