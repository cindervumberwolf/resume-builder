import { z } from "zod";

export const StrengthScoreSchema = z.object({
  clarity: z.number().min(0).max(1),
  quantification: z.number().min(0).max(1),
  brand_signal: z.number().min(0).max(1),
  transferability: z.number().min(0).max(1),
});

export const NormalizedFactSchema = z.object({
  action: z.string(),
  object: z.string(),
  method: z.array(z.string()).optional(),
  output: z.string().optional(),
  metric: z.string().nullable().optional(),
});

export const BulletModuleSchema = z.object({
  bullet_id: z.string(),
  parent_module_id: z.string(),
  raw_fact: z.string(),
  normalized_fact: NormalizedFactSchema,
  evidence_tags: z.array(z.string()),
  skill_tags: z.array(z.string()),
  role_fit_tags: z.array(z.string()),
  strength_score: StrengthScoreSchema,
  rewrite_candidates: z.array(z.string()).default([]),
});

export const ExperienceModuleSchema = z.object({
  module_id: z.string(),
  type: z.enum(["experience", "project", "education", "leadership", "award", "certification"]),
  section: z.enum(["experience", "education", "projects", "leadership", "skills", "awards"]),
  organization: z.string(),
  title: z.string(),
  date_range: z.string(),
  context_tags: z.array(z.string()),
  base_priority: z.number().min(0).max(1),
  source_type: z.enum(["master_resume", "manual_input", "parsed"]).default("master_resume"),
});

export type StrengthScore = z.infer<typeof StrengthScoreSchema>;
export type NormalizedFact = z.infer<typeof NormalizedFactSchema>;
export type BulletModule = z.infer<typeof BulletModuleSchema>;
export type ExperienceModule = z.infer<typeof ExperienceModuleSchema>;
