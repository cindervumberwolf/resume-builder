import { z } from "zod";

export const StyleFeaturesSchema = z.object({
  opens_with_action_verb: z.boolean(),
  result_first: z.boolean(),
  quantified: z.boolean(),
  length_band: z.enum(["short", "medium", "long"]),
  tone: z.enum([
    "professional_compact",
    "professional_detailed",
    "academic",
    "leadership_heavy",
    "analytical",
  ]),
});

export const ExemplarSchema = z.object({
  exemplar_id: z.string(),
  source: z.string(),
  track: z.string(),
  seniority: z.enum(["student", "intern", "entry_level", "experienced"]),
  section: z.enum(["experience", "education", "projects", "leadership", "skills"]),
  bullet_text: z.string(),
  style_features: StyleFeaturesSchema,
  latent_tags: z.array(z.string()),
  anti_patterns: z.array(z.string()).default([]),
});

export type StyleFeatures = z.infer<typeof StyleFeaturesSchema>;
export type Exemplar = z.infer<typeof ExemplarSchema>;
