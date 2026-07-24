import Chart from 'chart.js/auto';
import { APP_CONFIG } from './config.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const charts = {};
let allRecords = [];

const element = (id) => document.getElementById(id);
const filters = {
  year: element('yearFilter'),
  month: element('monthFilter'),
  department: element('departmentFilter'),
  category: element('categoryFilter'),
  search: element('searchFilter'),
};

function unique(values) { return [...new Set(values.filter(Boolean))]; }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  })[character]);
}
function option(value, label = value) { return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`; }

function weightedScore(records) {
  const valid = records.filter((r) => Number.isFinite(r.achievement));
  const weight = valid.reduce((sum, r) => sum + (r.weight > 0 ? r.weight : 1), 0);
  if (!weight) return null;
  return valid.reduce((sum, r) => sum + r.achievement * (r.weight > 0 ? r.weight : 1), 0) / weight;
}

function scoreStatus(score) {
  if (score >= APP_CONFIG.thresholds.achieved) return { label: 'Tercapai', className: 'good' };
  if (score >= APP_CONFIG.thresholds.warning) return { label: 'Perlu Perhatian', className: 'warning' };
  return { label: 'Belum Tercapai', className: 'bad' };
}

function populateFilters(records) {
  const periods = unique(records.map((r) => r.period)).sort();
  const latest = periods.at(-1);
  const years = unique(periods.map((p) => p.slice(0, 4))).sort().reverse();
  filters.year.innerHTML = option('ALL', 'Semua tahun') + years.map((y) => option(y)).join('');
  filters.month.innerHTML = option('ALL', 'Semua bulan') + MONTHS.map((m, i) => option(String(i + 1).padStart(2, '0'), m)).join('');
  filters.department.innerHTML = option('ALL', 'Semua departemen') + unique(records.map((r) => r.department)).sort().map((v) => option(v)).join('');
  filters.category.innerHTML = option('ALL', 'Semua kategori') + unique(records.map((r) => r.category)).sort().map((v) => option(v)).join('');
  if (latest) {
    filters.year.value = latest.slice(0, 4);
    filters.month.value = latest.slice(5, 7);
  }
}

function filteredRecords() {
  const search = filters.search.value.trim().toLowerCase();
  return allRecords.filter((record) =>
    (filters.year.value === 'ALL' || record.period.startsWith(filters.year.value)) &&
    (filters.month.value === 'ALL' || record.period.endsWith(`-${filters.month.value}`)) &&
    (filters.department.value === 'ALL' || record.department === filters.department.value) &&
    (filters.category.value === 'ALL' || record.category === filters.category.value) &&
    (!search || `${record.kpi} ${record.pic} ${record.note}`.toLowerCase().includes(search))
  );
}

function groupScores(records, key) {
  const groups = new Map();
  records.forEach((record) => {
    const value = record[key];
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(record);
  });
  return [...groups.entries()].map(([label, values]) => ({ label, score: weightedScore(values) ?? 0 })).sort((a, b) => a.label.localeCompare(b.label));
}

function drawChart(id, config) {
  charts[id]?.destroy();
  charts[id] = new Chart(element(id), config);
}

function formatNumber(value) {
  return Number.isFinite(value) ? new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value) : '–';
}

function formatValue(value, unit) {
  if (!Number.isFinite(value)) return '–';
  if (/^(rp|idr)$/i.test(unit)) return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
  return `${formatNumber(value)}${unit === '%' ? '%' : unit ? ` ${unit}` : ''}`;
}

function renderCards(records) {
  const score = weightedScore(records);
  element('overallScore').textContent = score === null ? '–' : `${formatNumber(score)}%`;
  element('achievedCount').textContent = records.filter((r) => r.achievement >= APP_CONFIG.thresholds.achieved).length;
  element('actionCount').textContent = records.filter((r) => r.achievement < APP_CONFIG.thresholds.warning).length;
}

function renderCharts(records) {
  const trend = groupScores(records, 'period');
  drawChart('trendChart', {
    type: 'line',
    data: { labels: trend.map((x) => x.label), datasets: [{ label: 'Skor', data: trend.map((x) => x.score), borderColor: '#2367d1', backgroundColor: 'rgba(35,103,209,.12)', fill: true, tension: .32 }] },
    options: { maintainAspectRatio: false, scales: { y: { suggestedMin: 0, suggestedMax: 120, ticks: { callback: (v) => `${v}%` } } }, plugins: { legend: { display: false } } },
  });

  const statuses = ['Tercapai', 'Perlu Perhatian', 'Belum Tercapai'];
  const counts = statuses.map((status) => records.filter((r) => scoreStatus(r.achievement).label === status).length);
  drawChart('statusChart', {
    type: 'doughnut',
    data: { labels: statuses, datasets: [{ data: counts, backgroundColor: ['#1d9b65', '#efad25', '#d94b5b'], borderWidth: 0 }] },
    options: { maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom' } } },
  });

  const categories = groupScores(records, 'category').sort((a, b) => b.score - a.score);
  drawChart('departmentChart', {
    type: 'bar',
    data: { labels: categories.map((x) => x.label), datasets: [{ data: categories.map((x) => x.score), backgroundColor: '#4b85df', borderRadius: 8 }] },
    options: { indexAxis: 'y', maintainAspectRatio: false, scales: { x: { beginAtZero: true, suggestedMax: 120, ticks: { callback: (v) => `${v}%` } } }, plugins: { legend: { display: false } } },
  });
}

function renderTable(records) {
  element('rowCount').textContent = `${records.length} data`;
  element('detailBody').innerHTML = records.slice(0, 500).map((record) => {
    const status = scoreStatus(record.achievement);
    return `<tr>
      <td>${escapeHtml(record.period)}</td><td>${escapeHtml(record.department)}</td><td><strong>${escapeHtml(record.kpi)}</strong><small>${escapeHtml(record.category)}</small></td>
      <td>${escapeHtml(formatValue(record.target, record.unit))}</td><td>${escapeHtml(formatValue(record.actual, record.unit))}</td>
      <td>${Number.isFinite(record.achievement) ? `${formatNumber(record.achievement)}%` : '–'}</td><td><span class="badge ${status.className}">${status.label}</span></td><td>${escapeHtml(record.pic || '–')}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="8" class="empty">Tidak ada data sesuai filter.</td></tr>';
}

export function render() {
  const records = filteredRecords();
  renderCards(records);
  renderCharts(records);
  renderTable(records);
}

export function setDashboardData(records, metadata) {
  allRecords = records;
  populateFilters(records);
  element('lastUpdate').textContent = metadata.lastModifiedDateTime
    ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(metadata.lastModifiedDateTime))
    : '–';
  element('fileName').textContent = metadata.name ?? 'Sumber OneDrive';
  render();
}

Object.values(filters).forEach((filter) => filter.addEventListener(filter.type === 'search' ? 'input' : 'change', render));
