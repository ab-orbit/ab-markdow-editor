# Offline evaluations

These fixtures are fictional release states. They do not authorize account, device, upload, submission or public-release actions.

Run the deterministic media/CLI regression suite from the skill directory:

```sh
uv run --script evals/test_audit_media.py
```

The optional real-movie case needs local ffmpeg/ffprobe and a supported encoder. The suite reports a skip if unavailable; do not describe parser-only fixtures as a real encoding test.

`evals.json` supplies four workflow prompts, their input files, expected outputs and evidence-based assertions:

1. Localized screenshots, Duo coverage, CPPs, media processing and a locked release.
2. Account-to-team upload failure, exact build selection, TestFlight eligibility and secondary-locale metadata errors.
3. Physical review evidence, encoded duration, privacy/trader facts and an explicit owner hold.
4. A native SwiftUI product with English/Japanese, three screenshots, no movies/CPPs/site and an existing automatic release policy.

Evaluate with the `skill-creator` workflow: use fresh offline executor contexts for candidate and baseline, then an independent grader. Keep outputs outside the canonical skill directory. For cases 0–2, the initial comparison used one executor per configuration running the three cases sequentially because of the concurrency limit; case 3 used a fresh paired context. One run per case/configuration is a smoke comparison, not a reliability or speed claim.

Snapshot the baseline before edits. The original project export is preserved in Git history under `docs/app-store/deploy-skill/app-store-deploy`; commit `ba9a536` moved that unchanged content into the canonical location before the 1.0.0 expansion. Do not let baseline executors read candidate instructions, assertions or other outputs.

Write `grading.json` with `expectations` entries containing `text`, `passed` and specific `evidence`. Validate structured output and CSV coverage programmatically where applicable. Additional explicitly scoped CPP coverage is allowed; case 0 checks all 33 required tuples, not an absolute maximum.

Use the supplied skill-creator aggregator and review viewer. Preserve actual wall-time measurements; omit unavailable token metrics rather than substituting output characters. Record evaluator limitations and assertions passing in both configurations. Recheck real Apple state only during a separately authorized publication task.
