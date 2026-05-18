import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: 'src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    icon: z.string().optional(),
    tech: z.array(z.string()),
    featured: z.boolean().default(false),
    order: z.number().default(99),
    liveUrl: z.string().url().optional(),
    repoUrl: z.string().url().optional(),
    status: z.enum(['live', 'wip', 'archived']).default('live'),
  }),
});

export const collections = { projects };
