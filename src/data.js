import * as XLSX from '@e965/xlsx';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const REQUIRED_SHEETS = [
  'Kontrol_Budget',
  'Program CSR',
  'Budget_Tahunan',
  'Pengajuan',
  'Kasus Berjalan',
  'Follow Up Kecil',
  'Calendar_Event',
  'Awarding',
];

function text(value) {
  return String(value ?? '').trim();
}

function lower(value) {
  return text(value).toLocaleLowerCase('id-ID');
}

function number(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string' || !value.trim()) return 0;
  const normalized = value.includes(',')
    ? value.replace(/\./g, '').replace(',', '.')
    : value.replace(/\s/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateParts(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) return { year: parsed.y, month: parsed.m, day: parsed.d };
  }
  const raw = text(value);
  let match = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  match = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (match) return { year: Number(match[3]), month: Number(match[2]), day: Number(match[1]) };
  return null;
}

function inMonth(value, year, month) {
  const parsed = dateParts(value);
  return Boolean(parsed && parsed.year === year && parsed.month === month);
}

function rowsOf(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Sheet "${sheetName}" tidak ditemukan.`);
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: true,
    UTC: true,
  });
}

function addRecord(records, year, month, category, kpi, unit, target, actual, note) {
  if (target <= 0) return;
  records.push({
    rowNumber: records.length + 1,
    period: `${year}-${String(month).padStart(2, '0')}`,
    department: 'CSR',
    category,
    kpi,
    unit,
    target,
    actual,
    direction: 'Naik',
    weight: 1,
    achievement: Math.max(0, Math.min((actual / target) * 100, 100)),
    pic: 'Tim CSR',
    note,
  });
}

function calculateKpis(workbook) {
  const missingSheets = REQUIRED_SHEETS.filter((sheetName) => !workbook.Sheets[sheetName]);
  if (missingSheets.length) {
    throw new Error(`Workbook bukan format Monitoring Departemen CSR. Sheet yang tidak ditemukan: ${missingSheets.join(', ')}.`);
  }

  const controlRows = rowsOf(workbook, 'Kontrol_Budget');
  const monitoringYear = Math.trunc(number(controlRows[2]?.[1])) || new Date().getFullYear();
  const now = new Date();
  const monthLimit = monitoringYear < now.getFullYear()
    ? 12
    : monitoringYear === now.getFullYear() ? now.getMonth() + 1 : 0;

  const programRows = rowsOf(workbook, 'Program CSR');
  const budgetRows = rowsOf(workbook, 'Budget_Tahunan');
  const submissionRows = rowsOf(workbook, 'Pengajuan');
  const caseRows = rowsOf(workbook, 'Kasus Berjalan');
  const followUpRows = rowsOf(workbook, 'Follow Up Kecil');
  const eventRows = rowsOf(workbook, 'Calendar_Event');
  const awardingRows = rowsOf(workbook, 'Awarding');
  const records = [];

  for (let month = 1; month <= monthLimit; month += 1) {
    let programTarget = 0;
    let programActual = 0;
    for (let index = 4; index < Math.min(programRows.length, 202); index += 1) {
      const row = programRows[index] ?? [];
      const status = lower(row[14]);
      if (text(row[2]) && status !== 'dibatalkan' && inMonth(row[17], monitoringYear, month)) {
        programTarget += 1;
        if (status === 'selesai') programActual += 1;
      }
    }
    addRecord(records, monitoringYear, month, 'Program CSR', 'Penyelesaian program sesuai target bulan', 'program', programTarget, programActual, 'Target: program non-dibatalkan dengan Target Selesai pada bulan tersebut. Aktual: program berstatus Selesai.');

    let budgetTarget = 0;
    for (let index = 4; index < Math.min(budgetRows.length, 505); index += 1) {
      const row = budgetRows[index] ?? [];
      if (Math.trunc(number(row[0])) === monitoringYear) budgetTarget += number(row[month + 1]);
    }

    let budgetActual = 0;
    let submissionTarget = 0;
    let submissionActual = 0;
    for (let index = 5; index < Math.min(submissionRows.length, 1000); index += 1) {
      const row = submissionRows[index] ?? [];
      if (!text(row[1])) continue;
      const submissionStatus = lower(row[8]);
      const declarationStatus = lower(row[13]);
      if (
        Math.trunc(number(row[18])) === monitoringYear
        && lower(row[17]) === MONTH_NAMES[month - 1].toLocaleLowerCase('id-ID')
        && Boolean(row[11])
        && submissionStatus !== 'batal'
      ) {
        budgetActual += number(row[5]);
      }
      if (inMonth(row[9], monitoringYear, month) && submissionStatus !== 'batal') {
        submissionTarget += 1;
        if (declarationStatus === 'sudah deklarasi') submissionActual += 1;
      }
    }
    addRecord(records, monitoringYear, month, 'Budget', 'Realisasi budget bulanan', 'Rp', budgetTarget, budgetActual, 'Target: Budget_Tahunan pada bulan terkait. Aktual: Nominal Deklarasi berdasarkan Bulan/Tahun Budget.');
    addRecord(records, monitoringYear, month, 'Pengajuan', 'Penyelesaian deklarasi pengajuan', 'transaksi', submissionTarget, submissionActual, 'Target: transaksi non-batal berdasarkan Tanggal Pengajuan. Aktual: transaksi berstatus Sudah Deklarasi.');

    let caseTarget = 0;
    let caseActual = 0;
    for (let index = 4; index < Math.min(caseRows.length, 209); index += 1) {
      const row = caseRows[index] ?? [];
      if (text(row[2]) && inMonth(row[8], monitoringYear, month)) {
        caseTarget += 1;
        if (lower(row[7]) === 'closed') caseActual += 1;
      }
    }
    addRecord(records, monitoringYear, month, 'Kasus', 'Penyelesaian kasus berdasarkan bulan masuk', 'kasus', caseTarget, caseActual, 'Target: kasus yang masuk pada bulan terkait. Aktual: kasus berstatus Closed pada cohort yang sama.');

    let followTarget = 0;
    let followActual = 0;
    for (let index = 4; index < Math.min(followUpRows.length, 200); index += 1) {
      const row = followUpRows[index] ?? [];
      const status = lower(row[5]);
      if (text(row[2]) && status !== 'dibatalkan' && inMonth(row[7], monitoringYear, month)) {
        followTarget += 1;
        if (status === 'selesai') followActual += 1;
      }
    }
    addRecord(records, monitoringYear, month, 'Follow Up', 'Penyelesaian follow up sesuai deadline', 'follow up', followTarget, followActual, 'Target: follow up non-dibatalkan dengan deadline pada bulan terkait. Aktual: follow up berstatus Selesai.');

    let eventTarget = 0;
    let eventActual = 0;
    for (let index = 4; index < Math.min(eventRows.length, 303); index += 1) {
      const row = eventRows[index] ?? [];
      if (text(row[7]) && inMonth(row[3], monitoringYear, month)) {
        eventTarget += 1;
        if (lower(row[16]) === 'selesai') eventActual += 1;
      }
    }
    addRecord(records, monitoringYear, month, 'Event', 'Penyelesaian event/agenda', 'event', eventTarget, eventActual, 'Target: event pada bulan mulai terkait. Aktual: event berstatus Selesai.');

    let awardTarget = 0;
    let awardActual = 0;
    for (let index = 28; index < Math.min(awardingRows.length, 328); index += 1) {
      const row = awardingRows[index] ?? [];
      if (text(row[5]) && inMonth(row[4], monitoringYear, month)) {
        awardTarget += 1;
        if (number(row[14]) >= 1) awardActual += 1;
      }
    }
    addRecord(records, monitoringYear, month, 'Awarding', 'Kelengkapan dokumen awarding', 'awarding', awardTarget, awardActual, 'Target: awarding berdasarkan tanggal/deadline. Aktual: kelengkapan dokumen mencapai 100%.');
  }

  return records;
}

export async function loadPerformanceData(file) {
  if (!file) throw new Error('File Excel belum dipilih.');
  if (!/\.xlsm$/i.test(file.name)) throw new Error('Pilih file utama Monitoring Departemen CSR.xlsm.');

  let records;
  try {
    const workbook = XLSX.read(await file.arrayBuffer(), {
      type: 'array',
      cellDates: false,
      cellFormula: false,
    });
    records = calculateKpis(workbook);
  } catch (error) {
    throw new Error(`Workbook utama tidak dapat dibaca. ${error.message}`);
  }

  if (!records.length) throw new Error('Tidak ditemukan KPI aktif sampai bulan berjalan. Periksa tahun monitoring dan isi workbook.');
  return {
    records,
    metadata: {
      name: file.name,
      size: file.size,
      lastModifiedDateTime: new Date(file.lastModified).toISOString(),
    },
  };
}
