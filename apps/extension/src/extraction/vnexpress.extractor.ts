import { GenericArticleExtractor } from './generic-article.extractor';

export class VnExpressExtractor extends GenericArticleExtractor {
  constructor() {
    super(
      ['h1.title-detail'],
      ['article.fck_detail', '.fck_detail'],
      ['.social_pin', '.box-tinlienquan', '.banner-ads', '.ads'],
    );
  }
}
