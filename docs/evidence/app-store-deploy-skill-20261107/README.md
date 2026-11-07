# App Store deployment skill — 1.0.0 validation

The repository-versioned [app-store-deploy skill](../../../.agents/skills/app-store-deploy/SKILL.md) consolidates the Scriba publication rounds. Its generic workflow is separated from [dated application findings](../../../.agents/skills/app-store-deploy/references/scriba.md) and [dated official sources](../../../.agents/skills/app-store-deploy/references/apple-sources.md).

No application UI changed. No real Apple account, upload, submission, release, tester access or physical-device QA was performed during skill creation or evaluation.

## Deterministic validation

- Skill-creator frontmatter validation passed.
- The media/CLI regression suite passed **27 tests, 0 failures, 0 skips**, including an actual 15-second ProRes 422 HQ movie decoded by ffprobe.
- JSON and relative skill-document links validated; sensitive-pattern scan found no credentials, real tester/contact identities, verification codes or legal documents in the new skill files.
- [Validation record](validation.json) and [skill file fingerprints](skill-manifest.json).

Run the media tests from the skill directory with `uv run --script evals/test_audit_media.py`. Apple accepts formats beyond the helper's PNG support; the helper does not perform OCR, full PNG pixel decoding or live App Store readback. Its visual/store fields are supplied attestations. Success is not release authorization or proof of App Review readiness.

## Paired offline workflow evaluation

| Scenario | New skill | Earlier skill |
| --- | --- | --- |
| Localized media, CPPs, Duo and a locked release | 9 / 9 | 7 / 9 |
| Xcode upload, selected build, TestFlight and locale errors | 9 / 9 | 9 / 9 |
| Physical review evidence, privacy/trader and owner hold | 9 / 9 | 8 / 9 |
| Native SwiftUI first release, English/Japanese and automatic policy | 8 / 8 | 8 / 8 |
| **Total criteria** | **35 / 35** | **32 / 35** |

[Interactive comparison and feedback](review.html) · [Benchmark with evidence per criterion](benchmark.json) · [Readable benchmark](benchmark.md) · [CSV and fact checks](programmatic-checks.json) · [Versioned prompts and fixtures](../../../.agents/skills/app-store-deploy/evals/README.md).

The report was generated with the supplied skill-creator aggregator and `eval-viewer/generate_review.py`. Its Outputs view contains the actual fictional plans, decisions and coverage CSVs, alongside grading evidence; Benchmark shows the comparison. Submit All Reviews exports feedback for a later iteration. No user approval of this skill is inferred from an empty review.

The earlier skill lacked final encoded-movie/decoded-duration validation and persistent media-order verification in the media case. In the review-evidence case it calculated 14 seconds but left acceptance unverified, without identifying the dated 15-second minimum failure. These three observed gaps distinguish the runs. **32 criteria passed in both configurations** and do not demonstrate an improvement by themselves.

## Limits and reproducibility

There was **one run per scenario/configuration**. Cases 0–2 used one executor per configuration, sequential within the two parallel batches because of the concurrency limit; case 3 used fresh paired contexts. Separate graders inspected outputs and evidence. The first three cases were run before a content-review clarification generalized release-mode preservation and first-publication guidance; those cases explicitly requested manual release, so the changed generalization was separately checked in case 3. This small comparison does not establish repeatability or production release success.

The baseline was snapshotted before editing. Commit `ba9a536` preserves the unchanged skill migration, including its original name, before the expansion. Case 0's 33 required page/locale/device tuples are a minimum; the baseline's explicit expansion to 60 tuples was not penalized for extra coverage. No media was actually captured for these workflow scenarios.

Timing values are executor-recorded case wall time, including reasoning and file I/O, excluding initial batch setup. They are descriptive, not a speed benchmark. Token counts and tool metrics were unavailable and are omitted. The provided aggregator's default three-runs metadata, alphabetical comparison order and character-to-token fallback were corrected in the saved result to match the actual experiment; no missing metrics were invented.

Apple dimensions, deadlines and state names remain time-sensitive. The dated source audit does not independently verify live store eligibility or authenticated state. A future release must inspect current Apple documentation and its actual account, selected binary and processing states.
