# Remaining Design QA automation implementation plan

Goal: implement automatic draft notes with screenshot evidence, batch comparisons, repeat checks and downloadable visual reports, entirely locally without AI.
Architecture: retain existing manual comparison; add shared cancellable worker runner, independent batch comparison panel, reusable image evidence/report utilities and revision-aware repeat checks. Preserve current JSON note export.

- [x] Shared typed analysis runner: reusable by interactive and batch comparisons, terminates on cancellation/errors.
- [x] Automatic note drafts: deterministic region descriptions, cropped site/reference evidence, duplicate avoidance, 500-note bound; additional-height notes allowed on union canvas.
- [x] Repeat check: explicit new site version keeps reference, exclusions and notes, compares old open notes against current filtered regions and records remaining/cleared (provisional, no semantic claims); retain summary history and discard stale results.
- [x] Batch comparison: match filenames without extensions, explicit missing/ambiguous pairs, sequential resource-bounded analysis, progress/cancel, individual failures, results and open-pair callback. Use current thresholds/filter, exclude current pair's coordinate-specific exclusions from unrelated batch pairs.
- [x] HTML visual report: safely escaped text, annotated screenshot, side-by-side region crops, notes, settings, exclusions, history and statistics; self-contained local download. Batch report supports all successful pairs.
- [x] Validate meaningful unit behavior plus browser workflows, cancellation/replacement, existing regressions, mobile layout; update README.

Rulings: existing user request authorizes the four previously described capabilities; implement together without another confirmation. Keep current working directory because it contains all authorized preceding changes. Reports and batches live in memory until downloaded; no new service or storage dependency.

Validation: 54 unit tests, 26 browser tests, production build/typecheck, lint and git diff whitespace checks pass. Desktop/mobile screenshots inspected. Read-only review found stale-settings and historical export issues; both fixed and covered by regression scenarios.
