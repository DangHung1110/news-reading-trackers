const supportedDomains = new Set(['vnexpress.net', 'dantri.com.vn', 'tuoitre.vn']);
const statusElement = document.querySelector<HTMLParagraphElement>('#page-status');
const optionsButton = document.querySelector<HTMLButtonElement>('#open-options');

async function showCurrentTabStatus(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (statusElement === null) {
    return;
  }

  if (tab?.url === undefined) {
    statusElement.textContent = 'No readable tab is active.';
    return;
  }

  const domain = new URL(tab.url).hostname.replace(/^www\./, '');
  statusElement.textContent = supportedDomains.has(domain)
    ? `${domain} is supported.`
    : `${domain || 'This page'} is not supported yet.`;
}

optionsButton?.addEventListener('click', () => {
  void chrome.runtime.openOptionsPage();
});

void showCurrentTabStatus();

export {};
