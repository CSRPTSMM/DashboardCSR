# CSR Control Center v4 — Dashboard GitHub Terpadu

Tampilan final dipisahkan menjadi lima modul: **Overview**, **Program & Budget**, **Calendar of Event**, **Kasus & Follow Up**, dan **Monitoring Pengajuan**.

Versi ini membaca `Monitoring Departemen CSR.xlsm` secara langsung dari folder OneDrive lokal. Tidak ada file bantu, PowerShell, VBA tambahan, Microsoft Graph, atau Microsoft Entra App Registration.

## 1. Alur kerja

```text
Monitoring Departemen CSR.xlsm
        ↓ disimpan di Excel
OneDrive menyinkronkan file lokal
        ↓ dibaca dengan izin browser
Dashboard GitHub Pages menghitung KPI
```

GitHub hanya menyimpan kode website. Workbook dan data CSR tidak dimasukkan ke repository dan tidak dikirim ke server dashboard.

## 2. Persyaratan

- Windows 10/11;
- Excel desktop;
- aplikasi OneDrive kantor;
- Microsoft Edge atau Google Chrome desktop;
- akun GitHub dan izin menggunakan GitHub Pages.

PowerShell dan akses Microsoft Entra tidak diperlukan.

## 3. Siapkan workbook OneDrive

1. Pastikan `Monitoring Departemen CSR.xlsm` berada di folder OneDrive kantor.
2. Klik kanan file lalu pilih **Always keep on this device** jika tersedia.
3. Tunggu ikon OneDrive menjadi centang hijau.
4. Jangan mengunggah workbook tersebut ke GitHub.

Dashboard membaca enam sumber utama berikut:

- `Program CSR`;
- `Budget_Tahunan`;
- `Pengajuan`;
- `Kasus Berjalan`;
- `Follow Up Kecil`;
- `Calendar_Event`.

Jika nama atau struktur kolom utama diubah, kode pemetaan perlu disesuaikan.

## 4. Modul dashboard

| Modul | Informasi utama |
|---|---|---|
| Ringkasan | Program, budget tahunan, deklarasi, serapan bulanan, agenda kritis, kasus aktif |
| Calendar of Event | Agenda, status, prioritas, progress, deadline dokumen, overdue, dan H-14 |
| Kasus & Follow Up | Kasus aktif, usia kasus, due follow up, quick task, dan keterlambatan |
| Pengajuan | Nominal pengajuan, belum cair, belum deklarasi, aging >14 hari, serta tren bulanan |

Aging dihitung ulang oleh browser berdasarkan tanggal saat dashboard dibuka. Tanggal **Data File** menggunakan waktu terakhir workbook disimpan.

## 5. Buat repository GitHub

1. Login ke GitHub.
2. Pilih **New repository**.
3. Beri nama, misalnya `dashboard-csr`.
4. Jangan membuat README atau `.gitignore` baru karena sudah tersedia dalam paket.
5. Ekstrak paket dashboard ini.
6. Upload seluruh isi hasil ekstraksi ke repository, termasuk folder `.github` dan `src`.

Alternatif menggunakan Git:

```powershell
git init
git add .
git commit -m "Dashboard CSR langsung dari OneDrive lokal"
git branch -M main
git remote add origin https://github.com/USERNAME/dashboard-csr.git
git push -u origin main
```

Ganti `USERNAME` dengan nama akun GitHub Anda.

## 6. Aktifkan GitHub Pages

1. Buka repository di GitHub.
2. Masuk ke **Settings > Pages**.
3. Pada **Build and deployment**, pilih **Source: GitHub Actions**.
4. Buka tab **Actions**.
5. Tunggu workflow `Deploy dashboard to GitHub Pages` berstatus hijau.
6. Buka alamat yang ditampilkan GitHub, biasanya:

```text
https://USERNAME.github.io/dashboard-csr/
```

`vite.config.js` mendeteksi nama repository secara otomatis.

## 7. Hubungkan workbook utama

1. Buka dashboard melalui Edge atau Chrome desktop.
2. Klik **Pilih file utama**.
3. Pilih `Monitoring Departemen CSR.xlsm` dari folder OneDrive lokal.
4. Setujui izin baca file.
5. Tunggu hingga kartu, grafik, filter, dan tabel muncul.

Edge/Chrome dapat menyimpan izin file pada browser. Dashboard memeriksa perubahan nama, ukuran, dan waktu modifikasi setiap 60 detik.

Jika browser meminta izin kembali, klik **Hubungkan kembali file terakhir**. Pada browser yang tidak mendukung akses file persisten, pilih ulang workbook setelah data berubah.

## 8. Proses pembaruan harian

1. Buka dan perbarui `Monitoring Departemen CSR.xlsm`.
2. Simpan workbook utama.
3. Tunggu OneDrive selesai menyinkronkan file.
4. Kembali ke dashboard.
5. Tunggu maksimal 60 detik atau klik **Perbarui data**.

Tidak diperlukan file bantu, `Ctrl+Alt+F9`, PowerShell, commit, atau push GitHub setiap kali data berubah.

## 9. Keamanan

- `.gitignore` memblokir `.xlsx`, `.xlsm`, `.xls`, dan `.csv` dari proses `git add`.
- Jangan upload workbook melalui menu GitHub web.
- Data dibaca dan dihitung di browser pengguna.
- Website tidak mempunyai alamat OneDrive, password, token, atau akses ke akun Microsoft.
- Halaman GitHub Pages dapat diakses melalui internet, tetapi tidak menampilkan data sebelum pengguna memberikan izin atas file lokal.
- Repository private tidak otomatis membuat halaman Pages menjadi internal; ikuti kebijakan keamanan perusahaan.

## 10. Troubleshooting

| Gejala | Penyebab | Solusi |
|---|---|---|
| Workbook tidak dapat dibaca | File yang dipilih bukan file utama | Pilih `Monitoring Departemen CSR.xlsm` |
| Sheet tidak ditemukan | Struktur workbook berubah | Pulihkan nama sheet atau sesuaikan `src/data.js` |
| Dashboard menampilkan data lama | Workbook belum disimpan atau OneDrive belum selesai | Simpan file, tunggu centang hijau, klik Perbarui data |
| Izin file berakhir | Browser menghapus izin sesi | Klik Hubungkan kembali file terakhir |
| File harus dipilih ulang | Browser tidak mendukung file handle persisten | Gunakan Edge/Chrome desktop |
| Workflow GitHub gagal | `package-lock.json` tidak ikut diunggah | Upload ulang seluruh paket |
| Halaman 404 | GitHub Pages belum aktif | Pilih Source GitHub Actions dan periksa tab Actions |

## 11. Pengujian lokal opsional

Jika Node.js tersedia:

```powershell
npm ci
npm run dev
```

Build produksi:

```powershell
npm run build
```

## 12. Referensi resmi

- [GitHub Pages dengan custom workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Konfigurasi publishing source GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [MDN File System API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API)
- [Microsoft Learn — OneDrive](https://learn.microsoft.com/en-us/sharepoint/onedrive-overview)
