import * as XLSX from '@e965/xlsx';

const REQUIRED_HEADERS = [
  'ID Program', 'Pilar CSR', 'Nama Program', 'Lokasi/Desa', 'PIC',
  'Tahun', 'Budget', 'Realisasi', 'Status', 'Last Update', 'Status Waktu',
];

function clean(value) {
  return String(value ?? '').trim();
}

function numeric(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = clean(value).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function excelDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y) return new Date(parsed.y, parsed.m - 1, parsed.d);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function findHeaderRow(rows) {
  return rows.findIndex((row) => REQUIRED_HEADERS.every((header) => row.includes(header)));
}

function programRecords(workbook) {
  const sheet = workbook.Sheets['Program CSR'];
  if (!sheet) throw new Error('Sheet "Program CSR" tidak ditemukan.');

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  const headerIndex = findHeaderRow(rows);
  if (headerIndex < 0) throw new Error('Header sheet "Program CSR" tidak sesuai format.');

  const headers = rows[headerIndex].map(clean);
  const column = Object.fromEntries(headers.map((header, index) => [header, index]));

  return rows.slice(headerIndex + 1)
    .filter((row) => clean(row[column['ID Program']]) && clean(row[column['Nama Program']]))
    .map((row) => {
      const budget = numeric(row[column.Budget]);
      const realization = numeric(row[column.Realisasi]);
      const lastUpdate = excelDate(row[column['Last Update']]);
      return {
        id: clean(row[column['ID Program']]),
        pillar: clean(row[column['Pilar CSR']]) || 'Belum ditentukan',
        name: clean(row[column['Nama Program']]),
        location: clean(row[column['Lokasi/Desa']]) || 'Belum ditentukan',
        pic: clean(row[column.PIC]) || 'Belum ditentukan',
        year: Math.trunc(numeric(row[column.Tahun])) || null,
        budget,
        realization,
        absorption: budget > 0 ? (realization / budget) * 100 : 0,
        status: clean(row[column.Status]) || 'Belum ditentukan',
        timeStatus: clean(row[column['Status Waktu']]) || 'Belum ditentukan',
        lastUpdate,
      };
    });
}

export async function loadPerformanceData(file) {
  if (!file) throw new Error('File Excel belum dipilih.');
  if (!/\.(xlsm|xlsx)$/i.test(file.name)) {
    throw new Error('Pilih file Monitoring Departemen CSR berformat .xlsm atau .xlsx.');
  }

  let records;
  try {
    const workbook = XLSX.read(await file.arrayBuffer(), {
      type: 'array',
      cellDates: false,
      cellFormula: false,
    });
    records = programRecords(workbook);
  } catch (error) {
    throw new Error(`Workbook tidak dapat dibaca. ${error.message}`);
  }

  if (!records.length) throw new Error('Tidak ada data program pada sheet "Program CSR".');
  const latestDataUpdate = records
    .map((record) => record.lastUpdate)
    .filter(Boolean)
    .sort((a, b) => b - a)[0];

  return {
    records,
    metadata: {
      name: file.name,
      lastModifiedDateTime: new Date(file.lastModified).toISOString(),
      latestDataUpdate,
    },
  };
}
