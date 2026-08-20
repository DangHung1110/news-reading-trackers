import { z } from 'zod';

const environmentSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgresql://news_user:news_password@localhost:5432/news_tracker?schema=public'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  WEB_URL: z.url().default('http://localhost:3001'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  return environmentSchema.parse(config);
}
