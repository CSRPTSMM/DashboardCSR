import Chart from 'chart.js/auto';

const charts = {};
let allRecords = [];
const el = (id) => document.getElementById(id);
const filters = {
  year: el('yearFilter'),
  pillar: el('pillarFilter'),
  location: el('locationFilter'),
  pic: el('picFilter'),
  status: el('statusFilter'),
  search: el('searchFilter'),
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
})[character]);
const unique = (values) => [...new Set(values.filter((value) => value !== null && value !== ''))];
const option = (value, label = value) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
const rupiah = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(value || 0);
const percent = (value) => `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value || 0)}%`;
const isOverdue = (record) => /overdue|terlambat/i.test(record.timeStatus);

function populate(select, values, allLabel) {
  select.innerHTML = option('ALL', allLabel)
    + unique(values).sort((a, b) => String(a).localeCompare(String(b), 'id')).map((value) => option(value)).join('');
}

function populateFilters(records) {
  populate(filters.year, records.map((r) => r.year), 'Semua tahun');
  populate(filters.pillar, records.map((r) => r.pillar), 'Semua pilar');
  populate(filters.location, records.map((r) => r.location), 'Semua lokasi');
  populate(filters.pic, records.map((r) => r.pic), 'Semua PIC');
  populate(filters.status, records.map((r) => r.status), 'Semua status');
  const years = unique(records.map((r) => r.year)).sort((a, b) => b - a);
  if (years.length) filters.year.value = String(years[0]);
}

function filteredRecords() {
  const search = filters.search.value.trim().toLocaleLowerCase('id');
  return allRecords.filter((record) =>
    (filters.year.value === 'ALL' || String(record.year) === filters.year.value)
    && (filters.pillar.value === 'ALL' || record.pillar === filters.pillar.value)
    && (filters.location.value === 'ALL' || record.location === filters.location.value)
    && (filters.pic.value === 'ALL' || record.pic === filters.pic.value)
    && (filters.status.value === 'ALL' || record.status === filters.status.value)
    && (!search || `${record.id} ${record.name} ${record.location} ${record.pic}`.toLocaleLowerCase('id').includes(search))
  );
}

function group(records, key) {
  const result = new Map();
  records.forEach((record) => {
    if (!result.has(record[key])) result.set(record[key], []);
    result.get(record[key]).push(record);
  });
  return result;
}

function drawChart(id, config) {
  charts[id]?.destroy();
  charts[id] = new Chart(el(id), config);
}

function renderCards(records) {
  const budget = records.reduce((sum, r) => sum + r.budget, 0);
  const realization = records.reduce((sum, r) => sum + r.realization, 0);
  el('programCount').textContent = records.length;
  el('budgetTotal').textContent = rupiah(budget);
  el('realizationTotal').textContent = rupiah(realization);
  el('absorptionRate').textContent = `Serapan ${percent(budget > 0 ? realization / budget * 100 : 0)}`;
  el('overdueCount').textContent = records.filter(isOverdue).length;
}

function renderCharts(records) {
  const byPillar = [...group(records, 'pillar')];
  drawChart('budgetChart', {
    type: 'bar',
    data: {
      labels: byPillar.map(([label]) => label),
      datasets: [
        { label: 'Budget', data: byPillar.map(([, rows]) => rows.reduce((s, r) => s + r.budget, 0)), backgroundColor: '#2f6fdd', borderRadius: 6 },
        { label: 'Realisasi', data: byPillar.map(([, rows]) => rows.reduce((s, r) => s + r.realization, 0)), backgroundColor: '#20a06b', borderRadius: 6 },
      ],
    },
    options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { callback: (v) => `Rp${Intl.NumberFormat('id-ID', { notation: 'compact' }).format(v)}` } } } },
  });

  const statuses = [...group(records, 'status')];
  drawChart('statusChart', {
    type: 'doughnut',
    data: {
      labels: statuses.map(([label]) => label),
      datasets: [{ data: statuses.map(([, rows]) => rows.length), backgroundColor: ['#2f6fdd', '#20a06b', '#f2ae2e', '#df5261', '#8b66d9', '#5aa9b7'], borderWidth: 0 }],
    },
    options: { maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom' } } },
  });

  const locations = [...group(records, 'location')]
    .map(([label, rows]) => ({ label, count: rows.length }))
    .sort((a, b) => b.count - a.count).slice(0, 10);
  drawChart('locationChart', {
    type: 'bar',
    data: { labels: locations.map((x) => x.label), datasets: [{ label: 'Jumlah Program', data: locations.map((x) => x.count), backgroundColor: '#4c86df', borderRadius: 7 }] },
    options: { indexAxis: 'y', maintainAspectRatio: false, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { display: false } } },
  });
}

function statusClass(record) {
  if (isOverdue(record)) return 'bad';
  if (/selesai/i.test(record.status)) return 'good';
  return 'warning';
}

function renderTable(records) {
  el('rowCount').textContent = `${records.length} program`;
  el('detailBody').innerHTML = records.map((record) => `<tr>
    <td>${escapeHtml(record.id)}</td>
    <td><strong>${escapeHtml(record.name)}</strong></td>
    <td>${escapeHtml(record.pillar)}</td>
    <td>${escapeHtml(record.location)}</td>
    <td>${escapeHtml(record.pic)}</td>
    <td>${escapeHtml(rupiah(record.budget))}</td>
    <td>${escapeHtml(rupiah(record.realization))}</td>
    <td>${escapeHtml(percent(record.absorption))}</td>
    <td><span class="badge ${statusClass(record)}">${escapeHtml(record.status)}</span></td>
    <td><span class="badge ${isOverdue(record) ? 'bad' : 'good'}">${escapeHtml(record.timeStatus)}</span></td>
  </tr>`).join('') || '<tr><td colspan="10" class="empty">Tidak ada program sesuai filter.</td></tr>';
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
  const update = metadata.latestDataUpdate || metadata.lastModifiedDateTime;
  el('lastUpdate').textContent = update
    ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(update))
    : '–';
  el('fileName').textContent = metadata.name || 'Sumber OneDrive';
  render();
}

Object.values(filters).forEach((filter) => {
  filter.addEventListener(filter.type === 'search' ? 'input' : 'change', render);
});
