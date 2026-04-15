# GPT Setup Package README v2

This package is the updated setup bundle for the `Custom GPT + Actions` resume builder.

It reflects two inputs:
1. the current GPT+Actions build plan;
2. the QS top-10 official undergraduate resume guidance synthesis.

It also now includes a preserved LaTeX template based directly on the user-provided scaffold.

## Files in this package

- `custom_gpt_instructions_v2.md`
- `resume_style_guide_v2.md`
- `knowledge_file_plan_v2.md`
- `latex_template_preserved.tex`

Existing supporting drafts that still remain usable:
- `action_verbs_draft.md`
- `anti_patterns_draft.md`

## Recommended use

### Paste into GPT Instructions
Use:
- `custom_gpt_instructions_v2.md`

### Upload into GPT Knowledge
Upload in this order:
1. `resume_style_guide_v2.md`
2. `action_verbs_draft.md`
3. `anti_patterns_draft.md`
4. `latex_template_preserved.tex`

### Keep outside GPT runtime
Do not upload as runtime Knowledge:
- raw acquisition specs;
- user module database exports;
- JD history;
- source crawling notes.

## Note on the LaTeX template

The template file in this package was intentionally preserved as closely as possible to the user-provided source. The goal was not to redesign it, but to keep the existing class, packages, macro structure, section sequence, and visual logic stable for export.
