# v0.4.0 verification — 2026-10-13

This release changes the first visit, authored example, and example-preview behavior. It does not change the model gateway or claim improved model output.

## Checked

- Local browser: desktop and a 390 × 844 phone viewport. The featured outcome and demo entry appear before the task form in English and Chinese. The three storyboard scenes switch correctly.
- The built-in tour displays the authored *Ratio* result. Automated execution of the actual tour functions verifies the result at 11.5 seconds, completion at 15 seconds, and zero model requests even with a configured model.
- Actual browser checks: an existing six-node saved route remains unchanged after a complete tour and after a product-example deep link. Returning home and resuming restores the original route. Returning home clears the recognized example fragment after reloading the final implementation.
- Actual browser: the example link can be copied; no browser console errors were observed. Unit coverage exercises the selectable fallback when clipboard access fails.
- Example previews do not write the stored workspace. Explicit saving, storage failure, switching examples, successful generation/import, and failure recovery are covered using the actual app functions. Allowlisted deep links contain no task, project content, or query parameters.
- `npm test`: 105 tests pass. `npm run check` and `git diff --check` pass.

## Boundaries

No model request or paid generation was made for this release. The new scenes are authored examples, not freshly generated results or a completed film. Browser viewport checks are not physical-device tests.

No external recruitment, launch post, or real-person test has been performed. The five-person comprehension test in `docs/launch.md` is ready to run; its thresholds are targets, not results. No star-growth or conversion improvement is claimed.
