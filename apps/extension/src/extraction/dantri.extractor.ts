import { GenericArticleExtractor } from './generic-article.extractor';

export class DanTriExtractor extends GenericArticleExtractor {
  constructor() {
    super(
      ['h1.title-page', 'h1.article-title'],
      ['.singular-content', '.e-magazine__body'],
      ['.related-news', '.ads-wrapper', '.article-actions'],
    );
  }
}
