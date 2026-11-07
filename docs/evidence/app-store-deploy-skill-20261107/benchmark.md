# Skill Benchmark: app-store-deploy

**Model**: Inherited Codex session model; exact identifier unavailable
**Date**: 2026-11-07T21:06:28Z
**Evals**: 0, 1, 2, 3 (1 runs each per configuration)

## Summary

| Metric | With Skill | Old Skill | Delta |
|--------|------------|---------------|-------|
| Pass Rate | 100% ± 0% | 92% ± 11% | +0.0833 |
| Time | 96.3s ± 24.6s | 76.7s ± 16.1s | +19.6s |

## Notes

- Criterion totals: candidate 35/35; earlier skill 32/35. Aggregate pass-rate mean gives each scenario equal weight; criterion totals weight individual assertions.
- 32 assertions passed in both configurations; those checks do not distinguish the two skills in this small comparison.
- One run per scenario/configuration. Variation across scenarios is not repeated-trial reliability; timing is descriptive and excludes initial batch setup. No token measurements were exposed.
- Case 0 allows additional explicitly scoped CPP coverage: 33 required tuples are a minimum set, not a maximum. Baseline expansion was not penalized merely for extra rows.
- Candidate explicitly separates final encoded/decoded movie validation and persistent media-order readback. Baseline case 0 lacked these gates; baseline case 2 left 14-second preview acceptance unverified instead of identifying the documented minimum failure.
- First-publication and configured-policy transfer case was added after content audit generalized the manual-release preference; it uses a separate native SwiftUI product and two different locales.
- All executions used fictional fixtures and planning outputs only. No live Apple state, real captures, uploads, account changes, physical QA or submissions were performed or established.
- These offline workflow scores do not validate a live store release, independently recognize image language or replace the 27 deterministic media/CLI regression tests.
