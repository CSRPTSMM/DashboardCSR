import Chart from 'chart.js/auto';

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const charts = {};
let store = { programs: [], events: [], cases: [], followups: [], submissions: [], budgets: [] };
const el = (id) => document.getElementById(id);
const filters = { year: el('yearFilter'), month: el('monthFilter'), pic: el('picFilter') };
const today = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const daysBetween = (a, b) => Math.floor((a - b) / 86400000);
const closed = (s) => /selesai|closed|batal/i.test(String(s || ''));
const undeclared = (s) => !/sudah deklarasi|batal/i.test(String(s || ''));
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const money = (v) => new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', maximumFractionDigits:0 }).format(v || 0);
const compactMoney = (v) => `Rp${new Intl.NumberFormat('id-ID', { notation:'compact', maximumFractionDigits:1 }).format(v || 0)}`;
const pct = (v) => `${new Intl.NumberFormat('id-ID', { maximumFractionDigits:1 }).format(v || 0)}%`;
const date = (v) => v ? new Intl.DateTimeFormat('id-ID', { day:'2-digit', month:'short', year:'numeric' }).format(v) : '–';
const sum = (rows, key) => rows.reduce((a, r) => a + (Number(r[key]) || 0), 0);
const badge = (text, kind) => `<span class="badge ${kind}">${esc(text || '–')}</span>`;
const empty = (cols, text) => `<tr><td colspan="${cols}" class="empty">${text}</td></tr>`;
const selectedYear = () => Number(filters.year.value) || new Date().getFullYear();
const selectedMonth = () => filters.month.value === 'ALL' ? null : Number(filters.month.value);
const selectedPic = () => filters.pic.value;
const picMatch = (r) => selectedPic() === 'ALL' || r.pic === selectedPic();
const yearOf = (d) => d?.getFullYear();
const monthOf = (d) => d?.getMonth();
const periodMatch = (d, yearFallback) => {
  const y = yearOf(d) || yearFallback;
  return y === selectedYear() && (selectedMonth() === null || monthOf(d) === selectedMonth());
};

function draw(id, config) {
  charts[id]?.destroy();
  charts[id] = new Chart(el(id), config);
}

function populateFilters() {
  const years = new Set([
    ...store.programs.map(r => r.year), ...store.budgets.map(r => r.year),
    ...store.submissions.map(r => r.budgetYear), ...store.events.map(r => yearOf(r.start)),
  ].filter(Boolean));
  filters.year.innerHTML = [...years].sort((a,b)=>b-a).map(y => `<option>${y}</option>`).join('');
  filters.year.value = years.has(new Date().getFullYear()) ? String(new Date().getFullYear()) : String([...years][0] || new Date().getFullYear());
  filters.month.innerHTML = `<option value="ALL">Semua bulan</option>${MONTHS.map((m,i)=>`<option value="${i}">${m}</option>`).join('')}`;
  const pics = [...new Set([
    ...store.programs.map(r=>r.pic), ...store.events.map(r=>r.pic), ...store.cases.map(r=>r.pic),
    ...store.followups.map(r=>r.pic), ...store.submissions.map(r=>r.pic),
  ].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'id'));
  filters.pic.innerHTML = `<option value="ALL">Semua PIC</option>${pics.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('')}`;
}

function filtered() {
  const year = selectedYear();
  return {
    programs: store.programs.filter(r => r.year === year && picMatch(r)),
    events: store.events.filter(r => periodMatch(r.start) && picMatch(r)),
    cases: store.cases.filter(r => (yearOf(r.entered) === year || !r.entered) && picMatch(r)),
    followups: store.followups.filter(r => periodMatch(r.created || r.deadline) && picMatch(r)),
    submissions: store.submissions.filter(r => (r.budgetYear || yearOf(r.submissionDate)) === year && (selectedMonth() === null || monthOf(r.submissionDate || r.disbursementDate) === selectedMonth()) && picMatch(r)),
    budgets: store.budgets.filter(r => r.year === year),
  };
}

function renderOverview(d) {
  const annualBudget = d.budgets.reduce((a,r)=>a+r.months.reduce((x,y)=>x+y,0),0);
  const declared = d.submissions.filter(r=>r.declarationDate || !undeclared(r.declarationStatus));
  const declaredTotal = sum(declared, 'declaredAmount');
  const attentionEvents = d.events.filter(r => !closed(r.status) && ((r.documentDeadline && daysBetween(today(),r.documentDeadline)>0) || (r.start && daysBetween(r.start,today())<=14)));
  const activeCases = d.cases.filter(r=>!closed(r.status));
  el('programCount').textContent = d.programs.length;
  el('budgetTotal').textContent = compactMoney(annualBudget);
  el('realizationTotal').textContent = compactMoney(declaredTotal);
  el('absorptionRate').textContent = `Serapan ${pct(annualBudget ? declaredTotal/annualBudget*100 : 0)}`;
  el('eventAttention').textContent = attentionEvents.length;
  el('activeCaseCount').textContent = activeCases.length;

  const budgetMonthly = Array(12).fill(0);
  d.budgets.forEach(r=>r.months.forEach((v,i)=>budgetMonthly[i]+=v));
  const declarationMonthly = Array(12).fill(0);
  d.submissions.forEach(r=>{ if(r.declarationDate) declarationMonthly[r.declarationDate.getMonth()] += r.declaredAmount; });
  draw('monthlyBudgetChart',{type:'bar',data:{labels:MONTHS,datasets:[
    {label:'Budget',data:budgetMonthly,backgroundColor:'#2c6ed5',borderRadius:5},
    {label:'Deklarasi',data:declarationMonthly,backgroundColor:'#19a06f',borderRadius:5},
  ]},options:{maintainAspectRatio:false,scales:{y:{beginAtZero:true,ticks:{callback:compactMoney}}}}});

  const statusMap = new Map();
  d.programs.forEach(r=>statusMap.set(r.status,(statusMap.get(r.status)||0)+1));
  draw('programStatusChart',{type:'doughnut',data:{labels:[...statusMap.keys()],datasets:[{data:[...statusMap.values()],backgroundColor:['#2c6ed5','#19a06f','#f0ac2c','#df5261','#8b66d9'],borderWidth:0}]},options:{maintainAspectRatio:false,cutout:'64%',plugins:{legend:{position:'bottom'}}}});

  const buckets = [0,0,0,0];
  d.submissions.filter(r=>undeclared(r.declarationStatus) && r.disbursementDate).forEach(r=>{
    const age=daysBetween(today(),r.disbursementDate); buckets[age<=14?0:age<=30?1:age<=60?2:3]++;
  });
  draw('agingChart',{type:'bar',data:{labels:['0–14 hari','15–30 hari','31–60 hari','> 60 hari'],datasets:[{label:'Pengajuan',data:buckets,backgroundColor:['#55a8df','#f0ac2c','#e78139','#cf4052'],borderRadius:7}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0}}}}});
}

function renderPrograms(d) {
  const budgetTotal = sum(d.programs, 'budget');
  const realizationTotal = sum(d.programs, 'realization');
  const attention = d.programs.filter(r => /overdue|mendesak/i.test(r.timeStatus) || (!closed(r.status) && r.budget > 0 && r.absorption < 25)).sort((a,b)=>a.absorption-b.absorption);
  el('programModuleCount').textContent = d.programs.length;
  el('programBudgetTotal').textContent = compactMoney(budgetTotal);
  el('programRealizationTotal').textContent = compactMoney(realizationTotal);
  el('programAbsorptionRate').textContent = `Serapan ${pct(budgetTotal ? realizationTotal / budgetTotal * 100 : 0)}`;
  el('programAttentionTotal').textContent = attention.length;
  el('programAttentionCount').textContent = `${attention.length} program`;
  el('programAttentionBody').innerHTML = attention.map(r=>`<tr><td>${esc(r.id)}</td><td class="wrap"><strong>${esc(r.name)}</strong></td><td>${esc(r.pillar)}</td><td>${esc(r.pic)}</td><td>${money(r.budget)}</td><td>${money(r.realization)}</td><td>${pct(r.absorption)}</td><td>${badge(r.timeStatus,/overdue/i.test(r.timeStatus)?'bad':'warning')}</td></tr>`).join('') || empty(8,'Tidak ada program yang memerlukan perhatian.');

  const pillars = new Map();
  d.programs.forEach(r => {
    const key = r.pillar || 'Belum dikategorikan';
    const item = pillars.get(key) || { budget: 0, realization: 0 };
    item.budget += r.budget || 0;
    item.realization += r.realization || 0;
    pillars.set(key, item);
  });
  draw('pillarBudgetChart', {
    type: 'bar',
    data: {
      labels: [...pillars.keys()],
      datasets: [
        { label: 'Budget', data: [...pillars.values()].map(v => v.budget), backgroundColor: '#2c6ed5', borderRadius: 6 },
        { label: 'Realisasi', data: [...pillars.values()].map(v => v.realization), backgroundColor: '#19a06f', borderRadius: 6 },
      ],
    },
    options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { callback: compactMoney } } } },
  });
}

function renderEvents(d) {
  const now=today();
  const overdue=d.events.filter(r=>!closed(r.status)&&r.documentDeadline&&r.documentDeadline<now);
  const upcoming=d.events.filter(r=>!closed(r.status)&&r.start&&daysBetween(r.start,now)>=0&&daysBetween(r.start,now)<=14);
  el('eventCount').textContent=d.events.length; el('eventOverdue').textContent=overdue.length;
  el('eventUpcoming').textContent=upcoming.length; el('eventDone').textContent=d.events.filter(r=>closed(r.status)).length;
  el('eventRowCount').textContent=`${d.events.length} agenda`;
  el('eventBody').innerHTML=d.events.sort((a,b)=>(a.start||Infinity)-(b.start||Infinity)).map(r=>{
    const late=!closed(r.status)&&r.documentDeadline&&r.documentDeadline<now;
    const urgent=!closed(r.status)&&r.start&&daysBetween(r.start,now)>=0&&daysBetween(r.start,now)<=14;
    return `<tr><td>${date(r.start)}<small>s.d. ${date(r.end)}</small></td><td class="wrap"><strong>${esc(r.name)}</strong><small>${esc(r.source)}</small></td><td>${esc(r.category)}</td><td>${esc(r.pic)}</td><td>${badge(r.priority,/tinggi/i.test(r.priority)?'bad':'warning')}</td><td>${badge(r.status,closed(r.status)?'good':'warning')}</td><td>${pct(r.progress)}</td><td>${date(r.documentDeadline)}</td><td>${badge(late?'Overdue':urgent?'H-14':'Normal',late?'bad':urgent?'warning':'good')}</td></tr>`;
  }).join('')||empty(9,'Tidak ada agenda sesuai filter.');
}

function renderCases(d) {
  const now=today(), active=d.cases.filter(r=>!closed(r.status)), activeFu=d.followups.filter(r=>!closed(r.status));
  const caseLate=active.filter(r=>r.followupDue&&r.followupDue<now), fuLate=activeFu.filter(r=>r.deadline&&r.deadline<now);
  el('caseCount').textContent=active.length; el('caseOverdue').textContent=caseLate.length;
  el('followupCount').textContent=activeFu.length; el('followupOverdue').textContent=fuLate.length;
  el('caseBody').innerHTML=active.map(r=>`<tr><td class="wrap"><strong>${esc(r.title)}</strong><small>${esc(r.category)}</small></td><td>${esc(r.location)}</td><td>${esc(r.pic)}</td><td>${badge(r.risk,/tinggi/i.test(r.risk)?'bad':'warning')}</td><td>${badge(r.status,'warning')}</td><td>${r.entered?daysBetween(now,r.entered):'–'} hari</td><td class="wrap">${esc(r.nextFollowup)||'–'}</td><td>${r.followupDue&&r.followupDue<now?badge(date(r.followupDue),'bad'):date(r.followupDue)}</td></tr>`).join('')||empty(8,'Tidak ada kasus aktif.');
  el('followupBody').innerHTML=activeFu.map(r=>{const left=r.deadline?daysBetween(r.deadline,now):null;return `<tr><td class="wrap"><strong>${esc(r.detail)}</strong><small>${esc(r.source)}</small></td><td>${esc(r.pic)}</td><td>${badge(r.priority,/tinggi/i.test(r.priority)?'bad':'warning')}</td><td>${badge(r.status,'warning')}</td><td>${date(r.deadline)}</td><td>${left===null?'–':left<0?badge(`${Math.abs(left)} hari lewat`,'bad'):`${left} hari`}</td></tr>`}).join('')||empty(6,'Tidak ada quick task aktif.');
}

function renderSubmissions(d) {
  const notDeclared=d.submissions.filter(r=>undeclared(r.declarationStatus));
  const aging14=notDeclared.filter(r=>r.disbursementDate&&daysBetween(today(),r.disbursementDate)>14);
  const unpaid=d.submissions.filter(r=>!r.disbursementDate&&!/batal/i.test(r.submissionStatus));
  const declared=d.submissions.filter(r=>!undeclared(r.declarationStatus));
  el('submissionCount').textContent=d.submissions.length; el('submissionAmount').textContent=compactMoney(sum(d.submissions,'amount'));
  el('undeclaredCount').textContent=notDeclared.length; el('undeclaredAmount').textContent=compactMoney(sum(notDeclared,'amount'));
  el('aging14Count').textContent=aging14.length; el('unpaidCount').textContent=unpaid.length; el('declaredCount').textContent=declared.length;
  const subM=Array(12).fill(0),decM=Array(12).fill(0);
  d.submissions.forEach(r=>{if(r.submissionDate)subM[r.submissionDate.getMonth()]+=r.amount;if(r.declarationDate)decM[r.declarationDate.getMonth()]+=r.declaredAmount;});
  draw('submissionChart',{type:'line',data:{labels:MONTHS,datasets:[
    {label:'Pengajuan',data:subM,borderColor:'#2c6ed5',backgroundColor:'rgba(44,110,213,.12)',fill:true,tension:.3},
    {label:'Deklarasi',data:decM,borderColor:'#19a06f',backgroundColor:'rgba(25,160,111,.08)',fill:true,tension:.3},
  ]},options:{maintainAspectRatio:false,scales:{y:{beginAtZero:true,ticks:{callback:compactMoney}}}}});
  const priority=d.submissions.filter(r=>undeclared(r.declarationStatus)||!r.disbursementDate).sort((a,b)=>{
    const aa=a.disbursementDate?daysBetween(today(),a.disbursementDate):0,bb=b.disbursementDate?daysBetween(today(),b.disbursementDate):0;return bb-aa;
  });
  el('submissionRowCount').textContent=`${priority.length} pengajuan`;
  el('submissionBody').innerHTML=priority.map(r=>{const age=r.disbursementDate&&!r.declarationDate?daysBetween(today(),r.disbursementDate):0;return `<tr><td>${esc(r.sap)}</td><td class="wrap"><strong>${esc(r.description)}</strong><small>${esc(r.program)}</small></td><td>${esc(r.pic)}</td><td>${money(r.amount)}</td><td>${date(r.disbursementDate)}</td><td>${badge(r.submissionStatus,r.disbursementDate?'good':'warning')}</td><td>${badge(r.declarationStatus,undeclared(r.declarationStatus)?'bad':'good')}</td><td>${age>0?badge(`${age} hari`,age>14?'bad':'warning'):'–'}</td><td>${esc(r.budgetCategory)}</td></tr>`}).join('')||empty(9,'Tidak ada pengajuan prioritas.');
}

export function render() {
  const d=filtered(); renderOverview(d); renderPrograms(d); renderEvents(d); renderCases(d); renderSubmissions(d);
}

export function setDashboardData(data, metadata) {
  store=data; populateFilters();
  const update=metadata.lastModifiedDateTime;
  el('lastUpdate').textContent=update?new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short'}).format(new Date(update)):'–';
  el('fileName').textContent=metadata.name||'Sumber OneDrive';
  render();
}

Object.values(filters).forEach(f=>f.addEventListener('change',render));
document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===tab));
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===`${tab.dataset.view}View`));
  requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
}));
