import './style.css';
import { APP_CONFIG, validateConfig } from './config.js';
import { loadPerformanceData } from './data.js';
import { setDashboardData } from './dashboard.js';
import {
  chooseWorkbook,
  getSavedFileHandle,
  queryReadPermission,
  requestReadPermission,
  supportsPersistentFileAccess,
} from './file-access.js';

const byId = (id) => document.getElementById(id);
const ui = {
  fileButton: byId('fileBtn'),
  fallbackInput: byId('fallbackFileInput'),
  refresh: byId('refreshBtn'),
  fileStatus: byId('fileStatus'),
  welcome: byId('welcomePanel'),
  browserNote: byId('browserNote'),
  dashboard: byId('dashboard'),
  loading: byId('loading'),
  message: byId('message'),
};

let activeHandle = null;
let pendingSavedHandle = null;
let fallbackFile = null;
let lastFileSignature = null;
let refreshTimer = null;

function showMessage(text, type = 'error') {
  ui.message.textContent = text;
  ui.message.className = `message ${type}`;
  ui.message.hidden = !text;
}

function fileSignature(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function setConnected(file, persistent) {
  ui.welcome.hidden = true;
  ui.dashboard.hidden = false;
  ui.refresh.hidden = false;
  ui.fileStatus.textContent = `${file.name}${persistent ? ' • tersambung' : ' • pilihan sementara'}`;
  ui.fileButton.textContent = 'Ganti file utama';
}

async function displayFile(file, { persistent = false } = {}) {
  ui.loading.hidden = false;
  ui.refresh.disabled = true;
  showMessage('');
  try {
    const { records, metadata } = await loadPerformanceData(file);
    setConnected(file, persistent);
    setDashboardData(records, metadata);
    lastFileSignature = fileSignature(file);
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  } catch (error) {
    console.error(error);
    if (!ui.dashboard.hidden) showMessage(`${error.message} Pastikan file yang dipilih adalah workbook utama CSR.`);
    else alert(`${error.message}\n\nPastikan file yang dipilih adalah Monitoring Departemen CSR.xlsm.`);
    error.alreadyShown = true;
    throw error;
  } finally {
    ui.loading.hidden = true;
    ui.refresh.disabled = false;
  }
}

async function refreshFromActiveFile({ force = true, silent = false } = {}) {
  try {
    if (activeHandle) {
      if (!(await queryReadPermission(activeHandle))) {
        if (!silent) showMessage('Izin membaca file telah berakhir. Klik “Ganti file utama” untuk menghubungkannya kembali.');
        return;
      }
      const file = await activeHandle.getFile();
      if (force || fileSignature(file) !== lastFileSignature) {
        await displayFile(file, { persistent: true });
      }
      return;
    }

    if (fallbackFile) {
      if (force) await displayFile(fallbackFile, { persistent: false });
      return;
    }

    showMessage('File Excel belum dipilih.');
  } catch (error) {
    if (!silent) showMessage(error.message);
  }
}

async function connectFileFromButton() {
  try {
    if (pendingSavedHandle) {
      if (await requestReadPermission(pendingSavedHandle)) {
        activeHandle = pendingSavedHandle;
        pendingSavedHandle = null;
        fallbackFile = null;
        await displayFile(await activeHandle.getFile(), { persistent: true });
        startAutoRefresh();
        return;
      }
      pendingSavedHandle = null;
    }

    if (supportsPersistentFileAccess()) {
      activeHandle = await chooseWorkbook();
      fallbackFile = null;
      await displayFile(await activeHandle.getFile(), { persistent: true });
      startAutoRefresh();
    } else {
      ui.fallbackInput.click();
    }
  } catch (error) {
    if (error.name !== 'AbortError' && !error.alreadyShown) {
      console.error(error);
      alert(`File tidak dapat dihubungkan: ${error.message}`);
    }
  }
}

function startAutoRefresh() {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (!document.hidden && activeHandle) refreshFromActiveFile({ force: false, silent: true });
  }, Math.max(15, APP_CONFIG.checkIntervalSeconds) * 1000);
}

ui.fileButton.addEventListener('click', connectFileFromButton);
ui.refresh.addEventListener('click', () => refreshFromActiveFile({ force: true }));
ui.fallbackInput.addEventListener('change', async () => {
  const [file] = ui.fallbackInput.files;
  if (!file) return;
  try {
    activeHandle = null;
    pendingSavedHandle = null;
    fallbackFile = file;
    await displayFile(file, { persistent: false });
    clearInterval(refreshTimer);
    showMessage('Browser ini memakai pilihan file sementara. Pilih ulang file setelah data OneDrive berubah.', 'info');
  } catch { /* pesan kesalahan sudah ditampilkan */ }
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && activeHandle) refreshFromActiveFile({ force: false, silent: true });
});

async function boot() {
  const configErrors = validateConfig();
  if (configErrors.length) {
    ui.welcome.innerHTML = `<p class="eyebrow">KONFIGURASI BELUM SELESAI</p><h2>Lengkapi src/config.js</h2><p>${configErrors.join(' ')}</p>`;
    ui.fileButton.disabled = true;
    return;
  }

  if (supportsPersistentFileAccess()) {
    ui.browserNote.textContent = 'Edge/Chrome terdeteksi. Browser dapat mengingat file dan memeriksa perubahan secara otomatis.';
    pendingSavedHandle = await getSavedFileHandle();
    if (pendingSavedHandle) {
      if (await queryReadPermission(pendingSavedHandle)) {
        activeHandle = pendingSavedHandle;
        pendingSavedHandle = null;
        await displayFile(await activeHandle.getFile(), { persistent: true });
        startAutoRefresh();
      } else {
        ui.fileButton.textContent = 'Hubungkan kembali file terakhir';
        ui.browserNote.textContent = 'File sebelumnya ditemukan. Klik tombol untuk memberikan kembali izin baca.';
      }
    }
  } else {
    ui.browserNote.textContent = 'Browser ini memakai mode kompatibilitas: file harus dipilih ulang setelah data berubah. Untuk pembaruan otomatis gunakan Microsoft Edge atau Google Chrome desktop.';
  }
}

boot().catch((error) => {
  console.error(error);
  ui.welcome.innerHTML = `<h2>Aplikasi gagal dimulai</h2><p>${error.message}</p>`;
});
