const supportedDomains = new Set(['vnexpress.net', 'dantri.com.vn', 'tuoitre.vn']);
const normalizedDomain = window.location.hostname.replace(/^www\./, '');

if (supportedDomains.has(normalizedDomain)) {
  document.documentElement.dataset.newsReadingTracker = 'ready';
  console.info('[News Reading Tracker] Supported page detected.');
}

export {};
