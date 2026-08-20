import { resolve } from 'node:path';

import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: resolve(__dirname, '../../.env'), quiet: true });

process.env.DATABASE_URL ??=
  'postgresql://news_user:news_password@localhost:5432/news_tracker?schema=public';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
