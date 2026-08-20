import { API_URL_STORAGE_KEY, getApiUrl } from '../config/api';

const form = document.querySelector<HTMLFormElement>('#settings-form');
const apiUrlInput = document.querySelector<HTMLInputElement>('#api-url');
const statusOutput = document.querySelector<HTMLOutputElement>('#save-status');

async function restoreSettings(): Promise<void> {
  if (apiUrlInput !== null) {
    apiUrlInput.value = await getApiUrl();
  }
}

form?.addEventListener('submit', (event) => {
  event.preventDefault();

  if (apiUrlInput === null) {
    return;
  }

  void chrome.storage.sync.set({ [API_URL_STORAGE_KEY]: apiUrlInput.value }).then(() => {
    if (statusOutput !== null) {
      statusOutput.textContent = 'Saved.';
    }
  });
});

void restoreSettings();
