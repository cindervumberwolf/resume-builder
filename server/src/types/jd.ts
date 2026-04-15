import { z } from "zod";

export const EvidenceTargetSchema = z.object({
  signal: z.string(),
  examples: z.array(z.string()),
  priority: z.number().min(0).max(1),
});

export const StyleConstraintsSchema = z.object({
  resume_language: z.enum(["en", "zh"]).default("en"),
  bullet_style: z.enum(["result_first", "action_first"]).default("action_first"),
  quant_preference: z.enum(["high", "medium", "low"]).default("high"),
  tone: z.enum(["professional_student", "professional_experienced", "academic"]).default("professional_student"),
});

export const JdMetaSchema = z.object({
  company: z.string(),
  team: z.string().optional(),
  location: z.string().optional(),
  role_title: z.string(),
  language: z.enum(["en", "zh"]).default("en"),
  seniority: z.enum(["student_intern", "entry_level", "experienced"]).default("student_intern"),
});

export const JdSchema = z.object({
  job_id: z.string(),
  raw_text: z.string(),
  meta: JdMetaSchema,
  hard_requirements: z.array(z.string()),
  soft_requirements: z.array(z.string()),
  preferred_signals: z.array(z.string()),
  domain_tags: z.array(z.string()),
  evidence_targets: z.array(EvidenceTargetSchema),
  style_constraints: StyleConstraintsSchema,
});

export type EvidenceTarget = z.infer<typeof EvidenceTargetSchema>;
export type StyleConstraints = z.infer<typeof StyleConstraintsSchema>;
export type JdMeta = z.infer<typeof JdMetaSchema>;
export type Jd = z.infer<typeof JdSchema>;
