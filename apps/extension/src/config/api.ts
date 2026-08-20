export const DEFAULT_API_URL = __EXTENSION_API_URL__;
export const API_URL_STORAGE_KEY = 'apiUrl';

export async function getApiUrl(): Promise<string> {
  const stored = await chrome.storage.sync.get(API_URL_STORAGE_KEY);
  const value = stored[API_URL_STORAGE_KEY];

  return typeof value === 'string' && value.length > 0 ? value : DEFAULT_API_URL;
}
