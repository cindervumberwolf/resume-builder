# Resume Builder Starter Benchmark v1

This package is a **synthetic but realistic** evaluation set for your private GPT-based resume builder.

It is designed for the workflow you defined:
- store and modularize resume information
- parse and store JD
- match modules to JD
- rewrite bullets under style constraints
- optionally generate LaTeX / PDF

The benchmark is aligned with the style rules distilled from QS Top 10 official guidance:
- resume/CV is a marketing document, not a full life archive
- tailoring is the first principle
- bullets should follow action -> context -> result/reason
- evidence selection matters as much as wording
- region rules differ across USA / UK / Europe / APAC

## Package contents
- `profiles.jsonl`: 6 synthetic candidate profiles with structured modules, skills, and hard constraints
- `baseline_resumes/`: 6 generic non-tailored baseline resumes
- `jd_library.jsonl`: 12 synthetic job descriptions across consulting, strategy, product, analytics, finance, research, and ML
- `jd_texts/`: human-readable Markdown versions of the 12 JDs
- `tasks.jsonl`: 24 evaluation tasks mapping profile × JD, with expected focus and failure modes
- `task_manifest.csv`: quick spreadsheet view of the 24 tasks
- `blind_scoring_sheet.csv`: blank scoring form, pre-expanded to 5 benchmark arms
- `process_audit_sheet.csv`: sheet for checking module selection, rule compliance, and overclaim
- `rubric.md`: short scoring reference

## Recommended benchmark arms
- A: Original / generic baseline
- B: Vanilla ChatGPT direct rewrite
- C: Private GPT full system
- D: Private GPT without one key module (optional ablation)
- E: Second ablation or human-edited comparator (optional)

## How to run
1. Pick one task from `tasks.jsonl`.
2. Load the relevant candidate from `profiles.jsonl` or use the matching file from `baseline_resumes/`.
3. Feed the matching JD from `jd_library.jsonl` or `jd_texts/`.
4. Generate outputs for each benchmark arm.
5. Blind the outputs before human scoring.
6. Score with `blind_scoring_sheet.csv`.
7. Audit module choice and factuality with `process_audit_sheet.csv`.

## Suggested first wave
Run the following 8 tasks first:
- T01, T02, T05, T06, T09, T13, T17, T23

This subset covers:
- consulting / product / analytics / finance / ML / generalist
- USA / UK / Europe / APAC rules
- strong-fit and medium-fit cases

## Important note
This benchmark is intentionally synthetic so that you can start testing immediately, even before you collect enough real user resumes and real annotated job applications.

Once your system stabilizes, you should replace or augment it with:
- real user master profiles (with consent)
- real target JDs
- gold factuality annotations
- real blind reviewers
