const DB_NAME = 'dashboard-performance-local';
const STORE_NAME = 'settings';
const HANDLE_KEY = 'workbook-handle';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, operation) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = operation(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export function supportsPersistentFileAccess() {
  return window.isSecureContext && 'showOpenFilePicker' in window;
}

export async function saveFileHandle(handle) {
  try {
    await withStore('readwrite', (store) => store.put(handle, HANDLE_KEY));
  } catch (error) {
    console.warn('Handle file tidak dapat disimpan.', error);
  }
}

export async function getSavedFileHandle() {
  try {
    return await withStore('readonly', (store) => store.get(HANDLE_KEY));
  } catch {
    return null;
  }
}

export async function queryReadPermission(handle) {
  if (!handle?.queryPermission) return false;
  return (await handle.queryPermission({ mode: 'read' })) === 'granted';
}

export async function requestReadPermission(handle) {
  if (await queryReadPermission(handle)) return true;
  if (!handle?.requestPermission) return false;
  return (await handle.requestPermission({ mode: 'read' })) === 'granted';
}

export async function chooseWorkbook() {
  const [handle] = await window.showOpenFilePicker({
    id: 'dashboard-performance-workbook',
    multiple: false,
    types: [{
      description: 'Monitoring Departemen CSR',
      accept: {
        'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm'],
      },
    }],
  });
  await saveFileHandle(handle);
  return handle;
}
