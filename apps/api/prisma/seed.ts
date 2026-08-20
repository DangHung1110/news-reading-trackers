import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const siteConfigs = [
  {
    domain: 'vnexpress.net',
    articleUrlPatterns: ['^https://vnexpress\\.net/.+-\\d+\\.html$'],
    titleSelectors: ['h1.title-detail'],
    contentSelectors: ['article.fck_detail'],
    removeSelectors: ['.Image', '.social_pin', '.box-tinlienquan'],
  },
  {
    domain: 'dantri.com.vn',
    articleUrlPatterns: ['^https://dantri\\.com\\.vn/.+\\d{17}\\.htm$'],
    titleSelectors: ['h1.title-page', 'h1.article-title'],
    contentSelectors: ['.singular-content', '.e-magazine__body'],
    removeSelectors: ['.figure', '.related-news', '.ads-wrapper'],
  },
  {
    domain: 'tuoitre.vn',
    articleUrlPatterns: ['^https://tuoitre\\.vn/.+-\\d+\\.htm$'],
    titleSelectors: ['h1.detail-title', 'h1.article-title'],
    contentSelectors: ['.detail-content', '#main-detail-body'],
    removeSelectors: ['.VCSortableInPreviewMode', '.related-news', '.ads-zone'],
  },
] as const;

async function main(): Promise<void> {
  for (const config of siteConfigs) {
    await prisma.siteConfig.upsert({
      where: { domain: config.domain },
      create: {
        ...config,
        articleUrlPatterns: [...config.articleUrlPatterns],
        titleSelectors: [...config.titleSelectors],
        contentSelectors: [...config.contentSelectors],
        removeSelectors: [...config.removeSelectors],
      },
      update: {
        enabled: true,
        articleUrlPatterns: [...config.articleUrlPatterns],
        titleSelectors: [...config.titleSelectors],
        contentSelectors: [...config.contentSelectors],
        removeSelectors: [...config.removeSelectors],
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
