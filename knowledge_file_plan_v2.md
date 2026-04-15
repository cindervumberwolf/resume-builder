# Knowledge File Plan v2 for Custom GPT Resume Builder

This version is aligned to the current `Custom GPT + Actions` build plan and the QS top-10 official undergraduate resume guidance synthesis.

## 1. Design principle

Use this simple split:
- **Instructions** = rules, workflow, tool-calling behavior, and output logic.
- **Knowledge** = reference material the GPT may consult while drafting, tailoring, and exporting.

Knowledge should not become a storage layer for dynamic user data.

## 2. Recommended first-version Knowledge shelf

### Required files
1. `resume_style_guide.md`
2. `action_verbs.md`
3. `anti_patterns.md`
4. `latex_template.tex`

### Not included for now
- exemplar bullets;
- raw crawl outputs;
- user module library;
- JD history;
- acquisition specs;
- Action or API instructions.

This matches the current direction: style in Knowledge, persistence and retrieval in Actions, and no exemplar-bullet dependency in the first usable version.

## 3. File-by-file purpose

### `resume_style_guide.md`
Purpose:
- establish the house writing standard;
- encode the cross-school consensus from the official top-10 guidance;
- define default structure, bullet logic, region-specific rules, and conditional inclusion rules.

Should include:
- what a resume is for;
- tailoring rules;
- bullet formula;
- region overrides;
- section logic;
- what to include conditionally;
- formatting and ATS norms;
- role-family emphasis.

Should not include:
- raw school-by-school extracts;
- user-specific facts;
- tool-calling instructions.

### `action_verbs.md`
Purpose:
- give the GPT a clean verb reference grouped by function.

Should include:
- research / analysis verbs;
- strategy verbs;
- build / execution verbs;
- technical verbs;
- communication verbs;
- leadership verbs;
- safer substitutes for weak verbs.

Should not include:
- bloated master lists with no grouping;
- exaggerated verbs presented as defaults.

### `anti_patterns.md`
Purpose:
- help the GPT recognize and avoid common resume failure modes.

Should include:
- task-log bullets;
- inflated ownership;
- fake quantification;
- buzzword stacking;
- overlong bullets;
- weak student filler;
- duplication;
- mis-tailoring;
- style drift.

### `latex_template.tex`
Purpose:
- provide the canonical export scaffold.

Important handling rule:
- preserve the user’s template structure as much as possible;
- use it as the default export scaffold unless the user explicitly requests a redesign.

## 4. What does not belong in Knowledge

Do not put these into Knowledge:
- stored user resume modules;
- stored JD records;
- long raw school guidance corpora;
- source acquisition specs;
- Action routing logic;
- matching results;
- transient session data.

The current build plan explicitly puts module storage, JD storage, matching, and LaTeX compilation into Actions rather than the Knowledge shelf. The top-30 acquisition spec is an upstream data-engineering document, not a runtime GPT reference file. fileciteturn1file0 fileciteturn1file1

## 5. Upload order recommendation

Recommended upload order in the GPT builder:
1. `resume_style_guide.md`
2. `action_verbs.md`
3. `anti_patterns.md`
4. `latex_template.tex`

## 6. Maintenance recommendation

When you improve the system over time:
- update `resume_style_guide.md` when your official top-school synthesis changes;
- update `action_verbs.md` only when you want better category coverage or safer verb choices;
- update `anti_patterns.md` when you discover repeat failure modes in real usage;
- update `latex_template.tex` only when the visual layout or structural mapping truly changes.

Avoid frequent unnecessary template edits, because stable export structure improves output consistency.
