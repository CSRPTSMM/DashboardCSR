import * as XLSX from '@e965/xlsx';

const clean = (value) => String(value ?? '').trim();
const numeric = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(clean(value).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};
const dateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number') {
    const p = XLSX.SSF.parse_date_code(value);
    if (p?.y) return new Date(p.y, p.m - 1, p.d);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

function rowsFrom(workbook, sheetName, anchorHeaders) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Sheet "${sheetName}" tidak ditemukan.`);
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  const headerIndex = rows.findIndex((row) => anchorHeaders.every((header) => row.map(clean).includes(header)));
  if (headerIndex < 0) throw new Error(`Header sheet "${sheetName}" tidak sesuai format.`);
  const headers = rows[headerIndex].map(clean);
  const idx = Object.fromEntries(headers.map((header, index) => [header, index]));
  return { rows: rows.slice(headerIndex + 1), idx };
}

const val = (row, idx, name) => row[idx[name]];

function programs(workbook) {
  const { rows, idx } = rowsFrom(workbook, 'Program CSR', ['ID Program', 'Nama Program', 'Budget', 'Realisasi']);
  return rows.filter((r) => clean(val(r, idx, 'Nama Program'))).map((r) => {
    const budget = numeric(val(r, idx, 'Budget'));
    const realization = numeric(val(r, idx, 'Realisasi'));
    return {
      id: clean(val(r, idx, 'ID Program')), pillar: clean(val(r, idx, 'Pilar CSR')) || 'Belum ditentukan',
      name: clean(val(r, idx, 'Nama Program')), location: clean(val(r, idx, 'Lokasi/Desa')) || 'Belum ditentukan',
      pic: clean(val(r, idx, 'PIC')) || 'Belum ditentukan', year: Math.trunc(numeric(val(r, idx, 'Tahun'))) || null,
      budget, realization, absorption: budget > 0 ? realization / budget * 100 : 0,
      status: clean(val(r, idx, 'Status')) || 'Belum ditentukan',
      timeStatus: clean(val(r, idx, 'Status Waktu')) || 'Belum ditentukan',
      start: dateValue(val(r, idx, 'Tanggal Mulai')), end: dateValue(val(r, idx, 'Tanggal Selesai')),
      lastUpdate: dateValue(val(r, idx, 'Last Update')),
    };
  });
}

function events(workbook) {
  const { rows, idx } = rowsFrom(workbook, 'Calendar_Event', ['Tanggal Mulai', 'Nama Event/Audit/Awarding/Meeting', 'PIC Utama']);
  return rows.filter((r) => clean(val(r, idx, 'Nama Event/Audit/Awarding/Meeting'))).map((r) => ({
    name: clean(val(r, idx, 'Nama Event/Audit/Awarding/Meeting')), category: clean(val(r, idx, 'Kategori')),
    source: clean(val(r, idx, 'Sumber Event')), pic: clean(val(r, idx, 'PIC Utama')) || 'Belum ditentukan',
    start: dateValue(val(r, idx, 'Tanggal Mulai')), end: dateValue(val(r, idx, 'Tanggal Selesai')),
    documentDeadline: dateValue(val(r, idx, 'Deadline Dokumen')), priority: clean(val(r, idx, 'Prioritas')),
    status: clean(val(r, idx, 'Status')) || 'Belum ditentukan', progress: numeric(val(r, idx, 'Progress (%)')),
    risk: clean(val(r, idx, 'Risk Level')), notes: clean(val(r, idx, 'Catatan')),
  }));
}

function cases(workbook) {
  const { rows, idx } = rowsFrom(workbook, 'Kasus Berjalan', ['Judul Kasus', 'Status Kasus', 'Tanggal Masuk']);
  return rows.filter((r) => clean(val(r, idx, 'Judul Kasus'))).map((r) => ({
    id: clean(val(r, idx, 'ID Kasus')), title: clean(val(r, idx, 'Judul Kasus')),
    category: clean(val(r, idx, 'Kategori Kasus')), location: clean(val(r, idx, 'Lokasi')),
    pic: clean(val(r, idx, 'PIC')) || 'Belum ditentukan', risk: clean(val(r, idx, 'Risiko')),
    status: clean(val(r, idx, 'Status Kasus')), entered: dateValue(val(r, idx, 'Tanggal Masuk')),
    target: dateValue(val(r, idx, 'Target Selesai')), lastUpdate: dateValue(val(r, idx, 'Last Update')),
    nextFollowup: clean(val(r, idx, 'Follow Up Berikutnya')), followupDue: dateValue(val(r, idx, 'Due Follow Up')),
  }));
}

function followups(workbook) {
  const { rows, idx } = rowsFrom(workbook, 'Follow Up Kecil', ['Detail Follow Up', 'PIC', 'Deadline']);
  return rows.filter((r) => clean(val(r, idx, 'Detail Follow Up'))).map((r) => ({
    id: clean(val(r, idx, 'ID FU')), detail: clean(val(r, idx, 'Detail Follow Up')),
    source: clean(val(r, idx, 'Sumber')), pic: clean(val(r, idx, 'PIC')) || 'Belum ditentukan',
    priority: clean(val(r, idx, 'Prioritas')), status: clean(val(r, idx, 'Status')),
    created: dateValue(val(r, idx, 'Tanggal Dibuat')), deadline: dateValue(val(r, idx, 'Deadline')),
    related: clean(val(r, idx, 'Program/Kasus Terkait')),
  }));
}

function submissions(workbook) {
  const { rows, idx } = rowsFrom(workbook, 'Pengajuan', ['No SAP Pengajuan', 'Deskripsi Pengajuan', 'Status Deklarasi']);
  return rows.filter((r) => clean(val(r, idx, 'No SAP Pengajuan'))).map((r) => ({
    sap: clean(val(r, idx, 'No SAP Pengajuan')), declarationSap: clean(val(r, idx, 'No SAP Deklarasi')),
    description: clean(val(r, idx, 'Deskripsi Pengajuan')), program: clean(val(r, idx, 'Deskripsi Program')),
    amount: numeric(val(r, idx, 'Nominal Pengajuan')), declaredAmount: numeric(val(r, idx, 'Nominal Deklarasi')),
    coa: clean(val(r, idx, 'COA Text')), submissionStatus: clean(val(r, idx, 'Status Pengajuan')),
    submissionDate: dateValue(val(r, idx, 'Tanggal Pengajuan')), disbursementDate: dateValue(val(r, idx, 'Tanggal Pencairan')),
    declarationDate: dateValue(val(r, idx, 'Tanggal Deklarasi')), transferDate: dateValue(val(r, idx, 'Tanggal Transfer')),
    declarationStatus: clean(val(r, idx, 'Status Deklarasi')), pic: clean(val(r, idx, 'PIC')) || 'Belum ditentukan',
    budgetCategory: clean(val(r, idx, 'Kategori Budget')), budgetMonth: clean(val(r, idx, 'Bulan Budget')),
    budgetYear: Math.trunc(numeric(val(r, idx, 'Tahun Budget'))) || null,
  }));
}

function budgets(workbook) {
  const { rows, idx } = rowsFrom(workbook, 'Budget_Tahunan', ['Tahun Budget', 'COA Text', 'Januari', 'Desember']);
  const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return rows.filter((r) => numeric(val(r, idx, 'Tahun Budget')) && clean(val(r, idx, 'COA Text'))).map((r) => ({
    year: Math.trunc(numeric(val(r, idx, 'Tahun Budget'))), coa: clean(val(r, idx, 'COA Text')),
    months: months.map((m) => numeric(val(r, idx, m))),
  }));
}

export async function loadPerformanceData(file) {
  if (!file || !/\.(xlsm|xlsx)$/i.test(file.name)) throw new Error('Pilih workbook berformat .xlsm atau .xlsx.');
  try {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false, cellFormula: false });
    const data = {
      programs: programs(workbook), events: events(workbook), cases: cases(workbook),
      followups: followups(workbook), submissions: submissions(workbook), budgets: budgets(workbook),
    };
    return { data, metadata: { name: file.name, lastModifiedDateTime: new Date(file.lastModified).toISOString() } };
  } catch (error) {
    throw new Error(`Workbook tidak dapat dibaca. ${error.message}`);
  }
}
