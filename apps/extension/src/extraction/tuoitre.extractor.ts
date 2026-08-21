import { GenericArticleExtractor } from './generic-article.extractor';

export class TuoiTreExtractor extends GenericArticleExtractor {
  constructor() {
    super(
      ['h1.detail-title', 'h1.article-title'],
      ['.detail-content', '#main-detail-body'],
      ['.VCSortableInPreviewMode', '.related-news', '.ads-zone'],
    );
  }
}
