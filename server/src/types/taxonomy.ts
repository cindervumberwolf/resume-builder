import { z } from "zod";

export const TaxonomySchema = z.object({
  signal_taxonomy: z.record(z.string(), z.array(z.string())),
});

export const RewriteConstraintsSchema = z.object({
  must_keep_facts: z.boolean().default(true),
  no_fabrication: z.boolean().default(true),
  max_words: z.number().int().positive().optional(),
  tone: z.string().default("student_professional"),
  quantify_when_supported: z.boolean().default(true),
});

export type Taxonomy = z.infer<typeof TaxonomySchema>;
export type RewriteConstraints = z.infer<typeof RewriteConstraintsSchema>;
