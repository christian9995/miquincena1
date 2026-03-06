let START_DATE_SEEDS = localStorage.getItem('fecha_semilla_2026') || '2026-01-02';
let START_DATE_2026 = new Date(START_DATE_SEEDS + 'T00:00:00');
let currentPeriodIndex = 0;
let transactions = JSON.parse(localStorage.getItem('finanzas_v2026')) || [];
let budgets = JSON.parse(localStorage.getItem('presupuestos_v2026')) || {};
let pieChart, barChart;

function init() {
    const today = new Date(); today.setHours(0,0,0,0);
    const diffDays = Math.floor((today - START_DATE_2026) / (1000 * 60 * 60 * 24));
    currentPeriodIndex = Math.max(0, Math.min(25, Math.floor(diffDays / 14)));
    populatePeriodDropdown();
    resetForm();
    updateUI();
}

function getPeriodDates(index) {
    let start = new Date(START_DATE_2026);
    start.setDate(start.getDate() + (index * 14));
    let end = new Date(start);
    end.setDate(end.getDate() + 13);
    return { start, end };
}

function updateUI() {
    const { start, end } = getPeriodDates(currentPeriodIndex);
    document.getElementById('period-dropdown').value = currentPeriodIndex;
    document.getElementById('range-label').innerText = `Del ${start.toLocaleDateString()} al ${end.toLocaleDateString()}`;
    const searchText = document.getElementById('search-input').value.toLowerCase();
    const list = document.getElementById('list');
    list.innerHTML = '';

    let tIng = 0, tEgr = 0;
    let catTotals = { "GASOLINA": 0, "GASTOS PASIVOS RENTA": 0, "AHORRO": 0, "CONSUMO DIVERSION": 0, "OTROS": 0 };

    transactions.forEach((t, index) => {
        const tDate = new Date(t.date + 'T00:00:00');
        if (tDate >= start && tDate <= end && t.desc.toLowerCase().includes(searchText)) {
            const li = document.createElement('li');
            li.className = t.type;
            li.innerHTML = `
                <div><strong>${t.desc}</strong>${t.type==='egreso'?'<br><small>'+t.category+'</small>':''}</div>
                <div class="item-actions">
                    <span style="font-weight:bold">$${parseFloat(t.amount).toFixed(2)}</span>
                    <button class="btn-edit-item" title="Editar" onclick="editItem(${index})">✎</button>
                    <button class="btn-delete-item" title="Eliminar" onclick="deleteItem(${index})">🗑</button>
                </div>`;
            list.appendChild(li);
            t.type === 'ingreso' ? tIng += parseFloat(t.amount) : (tEgr += parseFloat(t.amount), catTotals[t.category] += parseFloat(t.amount));
        }
    });

    document.getElementById('sum-ingresos').innerText = `$${tIng.toFixed(2)}`;
    document.getElementById('sum-egresos').innerText = `$${tEgr.toFixed(2)}`;
    document.getElementById('sum-neto').innerText = `$${(tIng - tEgr).toFixed(2)}`;
    updateCharts(tIng, tEgr, catTotals);
    localStorage.setItem('finanzas_v2026', JSON.stringify(transactions));
}

// GESTIÓN DE EDICIÓN
function editItem(index) {
    const t = transactions[index];
    document.getElementById('edit-index').value = index;
    document.getElementById('desc').value = t.desc;
    document.getElementById('amount').value = t.amount;
    document.getElementById('date').value = t.date;
    document.getElementById('type').value = t.type;
    document.getElementById('category').value = t.category;
    toggleCategories();
    document.getElementById('submit-btn').innerText = "Actualizar Movimiento";
    document.getElementById('submit-btn').style.background = "#1a73e8";
    document.getElementById('cancel-edit-btn').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
    document.getElementById('finance-form').reset();
    document.getElementById('edit-index').value = "-1";
    document.getElementById('submit-btn').innerText = "Registrar Movimiento";
    document.getElementById('submit-btn').style.background = "#34a853";
    document.getElementById('cancel-edit-btn').classList.add('hidden');
    document.getElementById('date').valueAsDate = new Date();
    document.getElementById('category-container').classList.add('hidden');
}

document.getElementById('finance-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const index = parseInt(document.getElementById('edit-index').value);
    const itemData = {
        desc: document.getElementById('desc').value,
        amount: document.getElementById('amount').value,
        date: document.getElementById('date').value,
        type: document.getElementById('type').value,
        category: document.getElementById('type').value === 'egreso' ? document.getElementById('category').value : 'INGRESO'
    };
    if (index === -1) transactions.push(itemData);
    else transactions[index] = itemData;
    resetForm(); updateUI();
});

// REPORTE ANUAL CON RECUADRO DINÁMICO
function generateAnnualReport() {
    const body = document.getElementById('report-body');
    const balanceBox = document.getElementById('annual-balance-box');
    const netResultEl = document.getElementById('annual-net-result');
    body.innerHTML = '';
    let totals = { ing: 0, egr: 0 };

    for (let i = 0; i < 26; i++) {
        const { start, end } = getPeriodDates(i);
        const b = budgets[i] || { income: 0, expense: 0 };
        let qI = 0, qE = 0;
        transactions.forEach(t => {
            const d = new Date(t.date + 'T00:00:00');
            if (d >= start && d <= end) t.type === 'ingreso' ? qI += parseFloat(t.amount) : qE += parseFloat(t.amount);
        });
        const dI = qI - b.income; const dE = b.expense - qE;
        totals.ing += qI; totals.egr += qE;
        body.innerHTML += `<tr><td>${start.toLocaleDateString('es-ES',{day:'2-digit',month:'short'})}</td><td>$${qI.toFixed(0)}</td><td>$${qE.toFixed(0)}</td><td>$${b.income.toFixed(0)}</td><td>$${b.expense.toFixed(0)}</td><td style="color:${dI>=0?'green':'red'}">$${dI.toFixed(0)}</td><td style="color:${dE>=0?'green':'red'}">$${dE.toFixed(0)}</td></tr>`;
    }
    const finalNet = totals.ing - totals.egr;
    netResultEl.innerText = `$${finalNet.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;
    balanceBox.className = 'final-balance-card ' + (finalNet >= 0 ? 'balance-positive' : 'balance-negative');
    document.getElementById('report-modal').classList.remove('hidden');
}

// GRÁFICOS Y OTROS
function updateCharts(ing, egr, catData) {
    if (pieChart) pieChart.destroy(); if (barChart) barChart.destroy();
    const b = budgets[currentPeriodIndex] || { income: 0, expense: 0 };
    barChart = new Chart(document.getElementById('barChart'), { type: 'bar', data: { labels: ['Ingresos', 'Egresos'], datasets: [{ label: 'Real', data: [ing, egr], backgroundColor: ['#34a853', '#ea4335'] }, { label: 'Meta', data: [b.income, b.expense], backgroundColor: ['#a8dab5', '#f5b7b1'] }] } });
    const activeCats = Object.keys(catData).filter(k => catData[k] > 0);
    pieChart = new Chart(document.getElementById('pieChart'), { type: 'doughnut', data: { labels: activeCats, datasets: [{ data: activeCats.map(k => catData[k]), backgroundColor: ['#fbbc05','#4285f4','#34a853','#9c27b0','#ff5722'] }] } });
}

function populatePeriodDropdown() {
    const d = document.getElementById('period-dropdown'); d.innerHTML = '';
    for (let i = 0; i < 26; i++) {
        const { start } = getPeriodDates(i);
        const opt = document.createElement('option'); opt.value = i;
        opt.innerText = `Q${i + 1}: ${start.toLocaleDateString('es-ES', {day:'2-digit', month:'short'})}`;
        d.appendChild(opt);
    }
}

function updateBaseStartDate() {
    const val = document.getElementById('base-start-date').value;
    if(val && confirm("¿Recalcular todas las quincenas?")) {
        START_DATE_SEEDS = val;
        START_DATE_2026 = new Date(val + 'T00:00:00');
        localStorage.setItem('fecha_semilla_2026', val);
        currentPeriodIndex = 0; populatePeriodDropdown(); updateUI(); closeConfigModal();
    }
}

function toggleCategories() { document.getElementById('category-container').className = document.getElementById('type').value === 'egreso' ? '' : 'hidden'; }
function openBudgetModal() { const b = budgets[currentPeriodIndex] || { income: 0, expense: 0 }; document.getElementById('budget-income').value = b.income; document.getElementById('budget-expense').value = b.expense; document.getElementById('budget-modal').classList.remove('hidden'); }
function closeBudgetModal() { document.getElementById('budget-modal').classList.add('hidden'); }
function openConfigModal() { document.getElementById('base-start-date').value = START_DATE_SEEDS; document.getElementById('config-modal').classList.remove('hidden'); }
function closeConfigModal() { document.getElementById('config-modal').classList.add('hidden'); }
function closeReportModal() { document.getElementById('report-modal').classList.add('hidden'); }
function saveBudget() { budgets[currentPeriodIndex] = { income: parseFloat(document.getElementById('budget-income').value) || 0, expense: parseFloat(document.getElementById('budget-expense').value) || 0 }; localStorage.setItem('presupuestos_v2026', JSON.stringify(budgets)); closeBudgetModal(); updateUI(); }
function deleteItem(i) { if(confirm("¿Eliminar?")) { transactions.splice(i, 1); updateUI(); } }
function changePeriod(n) { const next = currentPeriodIndex + n; if (next >= 0 && next <= 25) { currentPeriodIndex = next; updateUI(); } }
function jumpToPeriod(idx) { currentPeriodIndex = parseInt(idx); updateUI(); }
function clearAllData() { if(confirm("¿Borrar todo?")) { localStorage.clear(); location.reload(); } }

init();
