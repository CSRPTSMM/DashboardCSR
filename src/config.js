export const APP_CONFIG = {
  // Dashboard hanya membaca ulang workbook ketika waktu/ukuran file berubah.
  checkIntervalSeconds: 60,
  scoreCap: 120,
  thresholds: { achieved: 100, warning: 90 },
};

export function validateConfig() {
  return [];
}
