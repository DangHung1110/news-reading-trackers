import type { EventSyncStatus, SyncStatusResponse } from '../messages';

const supportedDomains = new Set(['vnexpress.net', 'dantri.com.vn', 'tuoitre.vn']);
const statusElement = document.querySelector<HTMLParagraphElement>('#page-status');
const pendingElement = document.querySelector<HTMLElement>('#pending-count');
const lastSyncElement = document.querySelector<HTMLElement>('#last-sync');
const syncErrorElement = document.querySelector<HTMLParagraphElement>('#sync-error');
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

async function showSyncStatus(): Promise<void> {
  const response: unknown = await chrome.runtime.sendMessage({ type: 'GET_SYNC_STATUS' });
  if (!isSyncStatusResponse(response)) return;

  pendingElement?.replaceChildren(
    document.createTextNode(
      response.data.rejectedCount > 0
        ? `${response.data.pendingCount} (${response.data.rejectedCount} rejected)`
        : String(response.data.pendingCount),
    ),
  );
  if (lastSyncElement !== null) {
    lastSyncElement.textContent =
      response.data.lastSuccessAt === null
        ? 'Not synced yet'
        : new Date(response.data.lastSuccessAt).toLocaleString();
  }
  if (syncErrorElement !== null) {
    syncErrorElement.hidden = response.data.lastError === null;
    syncErrorElement.textContent = response.data.lastError ?? '';
  }
}

function isSyncStatusResponse(value: unknown): value is Required<SyncStatusResponse> {
  if (typeof value !== 'object' || value === null) return false;
  if (!('ok' in value) || value.ok !== true || !('data' in value)) return false;
  return isEventSyncStatus(value.data);
}

function isEventSyncStatus(value: unknown): value is EventSyncStatus {
  return (
    typeof value === 'object' &&
    value !== null &&
    'pendingCount' in value &&
    typeof value.pendingCount === 'number' &&
    'rejectedCount' in value &&
    typeof value.rejectedCount === 'number' &&
    'lastAttemptAt' in value &&
    (value.lastAttemptAt === null || typeof value.lastAttemptAt === 'string') &&
    'lastSuccessAt' in value &&
    (value.lastSuccessAt === null || typeof value.lastSuccessAt === 'string') &&
    'lastError' in value &&
    (value.lastError === null || typeof value.lastError === 'string')
  );
}

optionsButton?.addEventListener('click', () => {
  void chrome.runtime.openOptionsPage();
});

void showCurrentTabStatus();
void showSyncStatus();

export {};
