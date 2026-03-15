import { z } from 'zod';

const urlSchema = z
  .string()
  .trim()
  .url('Enter a valid URL.')
  .refine((value) => /^https?:\/\//i.test(value), 'URL must start with http:// or https://');

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(6, 'Password must contain at least 6 characters.'),
});

export const registerSchema = loginSchema.extend({
  displayName: z.string().trim().min(2, 'Display name must contain at least 2 characters.'),
});

export const createResearchSchema = z.object({
  homepageUrl: urlSchema,
  aboutUrl: urlSchema,
  sitemapUrl: urlSchema,
  brandName: z.string().trim().min(2, 'Brand name is required.'),
  language: z.enum(['English', 'Hebrew']),
  market: z.string().trim().min(2, 'Market is required.'),
  competitorUrls: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean),
    )
    .pipe(z.array(urlSchema).max(8, 'Add up to 8 competitor URLs.')),
  notes: z.string().trim().max(3000, 'Notes must be 3000 characters or fewer.').optional().default(''),
  mode: z.enum(['fresh', 'expand']).default('fresh'),
  targetRows: z.coerce.number().int().min(120).max(320).default(220),
});

export type CreateResearchInput = z.infer<typeof createResearchSchema>;

export const createResearchFormSchema = z.object({
  homepageUrl: urlSchema,
  aboutUrl: urlSchema,
  sitemapUrl: urlSchema,
  brandName: z.string().trim().min(2, 'Brand name is required.'),
  language: z.enum(['English', 'Hebrew']),
  market: z.string().trim().min(2, 'Market is required.'),
  competitorUrls: z.string(),
  notes: z.string().trim().max(3000, 'Notes must be 3000 characters or fewer.'),
  mode: z.enum(['fresh', 'expand']),
  targetRows: z.number().int().min(120).max(320),
});

export type CreateResearchFormInput = z.infer<typeof createResearchFormSchema>;
