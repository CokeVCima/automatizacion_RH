'use strict';
const url = atob('aHR0cHM6Ly9kb2NzLmdvb2dsZS5jb20vc3ByZWFkc2hlZXRzL2QvZS8yUEFDWC0xdlE3YmQ4MFpWSWI0ZC14VmdMQ0NNTzBEUVVpNlFUcktHUm5SelE0bEl6c2IxLTFtdUNnR0czSUFqLVhnQXdFTkdrUlJyWDk1Z1dxMERqQy9wdWI/b3V0cHV0PWNzdg==');
const STORAGE_KEY = 'plan90_url';
const SUBTASK_PREFIX = '↳'; //prefijo para identificar subtareas en el csv
const AVATAR_COLORS = ['#2563eb','#7c3aed','#db2777','#ea580c','#16a34a','#0891b2','#65a30d'];

let allEmployees = {};   // { name: EmployeeObj }
let selectedName  = null;
let activePeriodo = '';

const CSV_URL = url;
document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    loadData(CSV_URL);
});
//eventos
function bindEvents() {
    // Header
    id('btn-config').onclick  = openConfig;
    id('btn-refresh').onclick = () => loadData(CSV_URL);
    
    // Config panel
    id('btn-cancel-config').onclick  = closeConfig;
    id('btn-cancel-config2').onclick = closeConfig;
    id('config-overlay').onclick     = closeConfig;
    id('btn-save-config').onclick    = saveConfig;

    // Empty / error states
    id('btn-open-config').onclick = openConfig;
    id('btn-retry').onclick       = () => loadData(CSV_URL);
    id('btn-reconfig').onclick    = openConfig;

    function supervisor_filter(supervisor){

    }

    // Filters
    const syncFilterAccent = (selectId, groupId) => {
        const sel = id(selectId);
        const grp = id(groupId);
        const update = () => grp.classList.toggle('has-value', sel.value !== '');
        sel.addEventListener('change', update);
        update();
        return sel;
    };

    const empSel2 = syncFilterAccent('filter-employee', 'fg-employee');
    empSel2.addEventListener('change', (e) => { selectedName = e.target.value || null; renderView(); });
    syncFilterAccent('filter-supervisor', 'fg-supervisor').addEventListener('change', renderView);
    syncFilterAccent('filter-status',    'fg-status').addEventListener('change', renderView);

    id('btn-back').onclick = () => {
        selectedName = null;
        id('filter-employee').value = '';
        id('fg-employee').classList.remove('has-value');
        renderView();
    };

    id('btn-ss').onclick = () => {
        if(!selectedName || !allEmployees[selectedName]) return;
        window.descargarDossierPdf(selectedName, allEmployees, cleanedName);
    };


    id('period-tabs').addEventListener('click', (e) => {
        const btn = e.target.closest('.tab');
        if (!btn) return;
        id('period-tabs').querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activePeriodo = btn.dataset.periodo;
        if (selectedName) renderTaskTable(allEmployees[selectedName].tasks, activePeriodo);
    });
}
//====================================================================000
// FUNCIONES DESCONTINUADAS, secciones en hidden 
//no borrarar, si se borra no carga datos 
function openConfig() {
    id('sheets-url').value = localStorage.getItem(STORAGE_KEY) || '';
    id('config-panel').classList.remove('hidden');
    id('config-overlay').classList.remove('hidden');
    id('sheets-url').focus();
}
function closeConfig() {
    id('config-panel').classList.add('hidden');
    id('config-overlay').classList.add('hidden');
}
function saveConfig() {
    const url = id('sheets-url').value.trim();
    if (!url) { id('sheets-url').focus(); return; }
    localStorage.setItem(STORAGE_KEY, url);
    closeConfig();
    loadData(url);
}
//====================================================================000
// cargar datos del poderoso csv
async function loadData(url) {
    showState('loading');
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`);
        const csv = await res.text();
        const rows = parseCSV(csv);
        allEmployees = buildEmployees(rows);

        if (Object.keys(allEmployees).length === 0) {
            throw new Error('El sheet no contiene datos o no coincide el formato esperado.');
        }

        populateFilters();
        showState('content');

        const now = new Date().toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit' });
        id('last-updated').textContent = `Actualizado ${now}`;

        renderView();
    } catch (err) {
        id('error-msg').textContent = err.message;
        showState('error');
    }
}

//parsea el csv para asegurar consitencias 
function parseCSV(text) {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const records    = [];
    let row   = [];
    let field = '';
    let inQ   = false;
    let i     = 0;

    while (i < normalized.length) {
        const ch = normalized[i];
        if (inQ) {
            if (ch === '"' && normalized[i + 1] === '"') { field += '"'; i += 2; }
            else if (ch === '"')                          { inQ = false; i++; }
            else                                          { field += ch; i++; }
        } else {
            if      (ch === '"')  { inQ = true; i++; }
            else if (ch === ',')  { row.push(field.trim()); field = ''; i++; }
            else if (ch === '\n') {
                row.push(field.trim()); field = '';
                if (row.some(f => f !== '')) records.push(row);
                row = []; i++;
            } else { field += ch; i++; }
        }
    }
    if (field !== '' || row.length > 0) {
        row.push(field.trim());
        if (row.some(f => f !== '')) records.push(row);
    }

    if (records.length < 2) return [];

    const headers = records[0].map(h =>
        h.toLowerCase()
         .normalize('NFD').replace(/[̀-ͯ]/g, '')   // strip accents
         .replace(/\s+/g, '_')
         .replace(/[^a-z0-9_]/g, '')
    );

    return records.slice(1).map(r => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = (r[i] || '').trim(); });
        return obj;
    });
}

// procesamiento de datos por columna en sheets
function buildEmployees(rows) {
    const map = {};


    rows.forEach(row => {
        const puestoNuevo = "*PUESTO DE NUEVA CREACIÓN*"
        const name = row['empleado'] || '';
        const superv = row['supervisor'] || '';
        const supervisorParts = superv
            .toLowerCase()
            .replace(/\.|@/g, ' ')
            .split(/\s+/)
            .filter(Boolean)
            .map(n => n.charAt(0).toUpperCase() + n.slice(1));
        
        const departa = row['departamento'] || '';
        const deprtamentoParts = departa
            .toLowerCase()
            .charAt(0).toUpperCase() + departa.toLowerCase().slice(1);
        

        const puest = row['puesto'];
        let puestoParts = puest
        if(row['puesto'] == puestoNuevo.trim()){
            puestoParts = row["puesto_nuevo"];
            puestoParts = puestoParts
            .toLowerCase()
            .charAt(0).toUpperCase() + puestoParts.toLowerCase().slice(1)
        }else{
            puestoParts = puestoParts
            .toLowerCase()
            .charAt(0).toUpperCase() + puest.toLowerCase().slice(1);
        
        }
        const cleanedSupervisor = supervisorParts.slice(0, 2).join(' ');
        if (!name) return;

        if (!map[name]) {
            map[name] = {
                name,
                empId:      row['numero_empleado'] || row['noempleado'] || '',
                supervisor: cleanedSupervisor ? cleanedSupervisor : '', //row['supervisor'] ? row['supervisor'].toLowerCase() : '',
                fechaIngreso: parseDate(row['fecha_ingreso']) || row['sin_fecha_ingreso'],
                departamento: deprtamentoParts || '',
                puesto: puestoParts || '',
                jefe: row['nombre_jefe'] || '',
                tasks: [],
            };
        } else if (!map[name].empId) {
            map[name].empId = row['numero_empleado'] || row['noempleado'] || '';
            map[name].supervisor = cleanedSupervisor ? cleanedSupervisor : ''; //row['supervisor'] ? row['supervisor'].toLowerCase() : '';
            map[name].fechaIngreso = parseDate(row['fecha_ingreso']) || row['sin_fecha_ingreso'];
            map[name].departamento = deprtamentoParts || '';
            map[name].puesto = puestoParts || '';
            map[name].jefe = row['nombre_jefe'] || '';
        }

        let taskText = row['task'] || row['tarea'] || '';
        const isSubtask = taskText.startsWith(SUBTASK_PREFIX);

        if(taskText.length > 500){
         taskText = "Sin registro de tareas"
        }

        map[name].tasks.push({
            task:      taskText,
            isSubtask,
            cleanTask: isSubtask ? taskText.replace(SUBTASK_PREFIX, '').trim() : taskText,
            periodo:   normalizePeriodo(row['periodo'] || ''),
            tipo:      row['tipo'] || '',
            done:      isTruthy(row['completada']),
        });
    });

    return map;
}

function normalizePeriodo(s) {
    // Accept "1-30", "1–30", "Días 1-30", "30 días", etc.
    const clean = s.replace(/[–—]/g, '-').toLowerCase();
    if (clean.includes('30')) return '1-30';
    if (clean.includes('60')) return '31-60';
    if ( clean.includes('90')) return '61-90';
    if (clean.includes('180')) return '91-180';
    return s; // mantiene el original si no se reconoce, 
}
/*
en normalizar periodos se agregan condiciones para aceptar formatos, no mover 1-30, 31-60 etc.
esto se recibe en build employee, donde desde el html(data-period) asinga las tareas deacuerdo a su periodo
osea las filtra.
donde en renderPeriodCards() se agarran para mostrar el progrso en periodo
*/

//por si se les llega a ir otro formato de fecha
function parseDate(str) {
    if (!str) return null;
    let m;
    // YYYY-MM-DD
    m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    // DD/MM/YYYY
    m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    // MM/DD/YYYY (fallback)
    m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
        const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
        return new Date(y, +m[1] - 1, +m[2]);
    }
    return null;
}


// validacion de terminacion de tareas 
function isTruthy(val) {
    const v = (val || '').toString().trim().toUpperCase();
    return ['TRUE', 'SI', 'SÍ', 'YES', '1', 'COMPLETADA', 'COMPLETADO', 'X'].includes(v);
}

// metricas del empleado 
//logica PARA CALCULAR SI ESTA REZAGADO EN CURSO O COMPLETADO
function metrics(emp) {
    const today = startOfDay(new Date());
    const ingreso = emp.fechaIngreso ? startOfDay(emp.fechaIngreso) : null;
    const daysIn  = ingreso ? Math.floor((today - ingreso) / 864e5) : null;
    const daysLeft = daysIn !== null ? Math.max(0, 90 - daysIn) : null;
    const timePct  = daysIn !== null ? Math.min(100, Math.round((daysIn / 90) * 100)) : null;

    const all       = emp.tasks;
    const done      = all.filter(t => t.done).length;
    const taskPct   = all.length ? Math.round((done / all.length) * 100) : 0;
    const overdue30 = all.filter(task => !task.done && task.periodo === '1-30').length;
    const overdue60 = all.filter(task => !task.done && task.periodo === '31-60').length;
    const overdue90 = all.filter(task => !task.done && task.periodo === '61-90').length;
    const byPeriodo = {};
    ['1-30', '31-60', '61-90'].forEach(p => {
        const pts = all.filter(t => t.periodo === p);
        byPeriodo[p] = { total: pts.length, done: pts.filter(t => t.done).length };
    });


    let status = 'active';
    
    if (daysIn != null){
        if (daysIn > 90 && taskPct === 100) status = 'done';
        else if(daysIn > 90 && taskPct != 100) status = 'halfdone';
        else if (daysIn > 60 && overdue60 > 0) status = 'behind';
        else if (daysIn > 30 && overdue30 > 0) status = 'behind';
    }
    if (ingreso === null){
        status = 'no_date';
    }
    return { daysIn, daysLeft, timePct, taskPct, done, total: all.length, byPeriodo, status };
}

/*
    let status = 'active';
    if (daysIn != null && daysIn > 90 && taskPct < 100) status = 'halfdone';
        else if (daysIn !== null && daysIn > 90 && taskPct === 100) status = 'done';
            else if (overdue30 > 0 && daysIn !== null && daysIn > 30) status = 'behind';
                else if (overdue60 > 0 && daysIn !== null && daysIn > 60) status = 'behind';
                    else if (overdue90 > 0 && daysIn !== null && daysIn > 90) status = 'behind';
*/

//formatear fecha 
function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}


//filtros superiores 
function populateFilters() {
    const empSel = id('filter-employee');
    const supSel = id('filter-supervisor');

    const names = Object.keys(allEmployees).sort();
    const sups  = [...new Set(Object.values(allEmployees).map(e => e.supervisor).filter(Boolean))].sort();

    empSel.innerHTML = '<option value="">Todos los colaboradores</option>';
    names.forEach(n => {
        const o = document.createElement('option');
        o.value = o.textContent = n;
        empSel.appendChild(o);
    });

    supSel.innerHTML = '<option value="">Todos</option>';
    sups.forEach(s => {
        const o = document.createElement('option');
        o.value = o.textContent = s;
        supSel.appendChild(o);
    });
}

//manejo de estados de la data
function showState(state) {
    id('state-loading').classList.toggle('hidden', state !== 'loading');
    id('state-empty').classList.toggle('hidden',   state !== 'empty');
    id('state-error').classList.toggle('hidden',   state !== 'error');
    if (state !== 'content') {
        id('dashboard').classList.add('hidden');
        id('employees-grid').classList.add('hidden');
        id('overview-chart-wrap').classList.add('hidden');
        id('supervisor-rating-card').classList.add('hidden');
    }
}

// renderiza la vista principal
function renderView() {
    const supFilter    = id('filter-supervisor').value;
    const statusFilter = id('filter-status').value;

    let list = Object.values(allEmployees);
    if (supFilter) list = list.filter(e => e.supervisor === supFilter);
    if (statusFilter) list = list.filter(e => metrics(e).status === statusFilter);

    id('filter-stats').textContent = `${list.length} colaborador${list.length !== 1 ? 'es' : ''}`;

    if (selectedName && allEmployees[selectedName]) {
        id('dashboard').classList.remove('hidden');
        id('employees-grid').classList.add('hidden');
        id('overview-chart-wrap').classList.add('hidden');
        id('supervisor-rating-card').classList.add('hidden');
        renderDashboard(allEmployees[selectedName]);
    } else {
        id('dashboard').classList.add('hidden');
        id('overview-chart-wrap').classList.remove('hidden');
        id('employees-grid').classList.remove('hidden');
        renderSupervisorRating(supFilter, list);
        window.dashboardCharts?.destroyDashboardCharts();
        renderGrid(list);
    }
}

function renderSupervisorRating(supervisor, list) {
    const card = id('supervisor-rating-card');
    const supervisorReplace = supervisor.replace(/\.|@/g, " ");
    const supervisorClean = supervisorReplace.split(" ")
    const buildSupervisor = supervisorClean.map (n => ((n.charAt(0).toUpperCase() + n.slice(1)).split(" ")) );
    const cleanedSupervisor = `${buildSupervisor[0]} ${buildSupervisor[1]}`;
    if (!supervisor || !list.length) {
        card.classList.add('hidden');
        card.innerHTML = '';
        return;
    }

    const rating = supervisorRating(list);
    card.className = `supervisor-rating-card rating-${rating.level}`;
    card.innerHTML = `
        <div class="rating-main">
            <div>
                <div class="rating-eyebrow">Calificación del supervisor</div>
                <h2>${esc(cleanedSupervisor)}</h2>
            </div>
            <div class="rating-score">
                <span>${rating.score}</span>
                <small>${esc(rating.label)}</small>
            </div>
        </div>
        <div class="rating-metrics">
            <div><strong>${rating.avgPct}%</strong><span>Cumplimiento promedio</span></div>
            <div><strong>${rating.doneRate}%</strong><span>Planes completados</span></div>
            <div><strong>${rating.behindRate}%</strong><span>Colaboradores con tareas pendientes</span></div>
            <div><strong>${list.length}</strong><span>Colaboradores evaluados</span></div>
        </div>`;
}
//rating para el supervisor, se calcula con base en el avance de los colaboradores a su cargo, se asigna una calificacion y etiqueta segun el resultado
//cuidar tiempo de procesamiento

function supervisorRating(list) {
    const valid_no_date_employee = list.filter(emp => {
        const m = metrics(emp);
        return m.status !== 'no_date';
    });

    const valid_employees = valid_no_date_employee.length;
    const missing_counts = list.length - valid_employees;

    if (valid_employees === 0) {
        return { score: 0, label: 'invalorable', level: 'critical', avgPct: 0, doneRate: 0, behindRate: 0, missingDatesCount: missing_counts };
    }

    let totalTaskPct = 0;
    let behindCount = 0;
    let doneCount = 0;

    valid_no_date_employee.forEach(emp => {
        const m = metrics(emp);
        totalTaskPct += m.taskPct;
        if (m.status === 'behind' || m.status === 'halfdone') behindCount++;
        if (m.status === 'done') doneCount++;
    });

    const avgPct = Math.round(totalTaskPct / valid_employees);
    const behindRate = Math.round((behindCount / valid_employees) * 100);
    const doneRate = Math.round((doneCount / valid_employees) * 100);

    const pilarEficiencia = avgPct * 0.40;
    const pilarRiesgo     = Math.max(0, 40 - (behindRate * 0.40));
    const pilarOnboarding = doneRate * 0.20;
    const score = Math.round(pilarEficiencia + pilarRiesgo + pilarOnboarding);

    let label, level;
    if (score >= 85) { label = 'Excelente'; level = 'excellent'; }
    else if (score >= 70) { label = 'Bueno'; level = 'good'; }
    else if (score >= 50) { label = 'En riesgo'; level = 'risk'; }
    else { label = 'Crítico'; level = 'critical';  }

    return {
        score,
        avgPct,
        doneRate,
        behindRate,
        missingDatesCount: missing_counts,
        label,
        level,
    };
}

/*
    const count = list.length;
    const avgPct = Math.round(totals.taskPct / count);
    const doneRate = Math.round((totals.done / count) * 100);
    const behindRate = Math.round((totals.behind / count) * 100);
    const halfdoneRate = Math.round((totals.halfdone / count) * 100);
    const noDateRate = Math.round((totals.no_date / count) * 100);
    const score = clamp(Math.round(
        avgPct
        + (doneRate * 0.05)
        - (behindRate * 0.25)
        - (halfdoneRate * 0.15)
    ), 0, 100);

    if (score >= 90) return { score, avgPct, doneRate, behindRate, label: 'Excelente', level: 'excellent', note: 'Avance esperado y bajo rezago.' };
    if (score >= 75) return { score, avgPct, doneRate, behindRate, label: 'Bueno', level: 'good', note: 'El avance general sano.' };
    if (score >= 60) return { score, avgPct, doneRate, behindRate, label: 'En riesgo', level: 'risk', note: 'Hay señales de atraso.' };
    return { score, avgPct, doneRate, behindRate, label: 'Crítico', level: 'critical', note: 'Avance bajo.' };
}
*/
// renderiza las tarjetas de empleados en la vista principal
function renderGrid(list) {
    const grid = id('employees-grid');
    if (!list.length) {
        grid.innerHTML = '<p class="no-results">Sin resultados para los filtros aplicados.</p>';
        const overviewWrap = id('overview-chart-wrap');
        if (overviewWrap) overviewWrap.classList.add('hidden');
        return;
    }

    const statusCounts  = { done: 0, active: 0, behind: 0, halfdone: 0, no_date: 0 };
    const statusPctSum  = { done: 0, active: 0, behind: 0, halfdone: 0, no_date: 0 };
    list.forEach(emp => {
        const m = metrics(emp);
        if (m.status in statusCounts) {
            statusCounts[m.status]++;
            statusPctSum[m.status] += m.taskPct;
        }
    });
    window.dashboardCharts?.renderOverviewChart(statusCounts);
    window.dashboardCharts?.renderComplianceChart(statusCounts, statusPctSum);

    grid.innerHTML = list.map(emp => {
        const m          = metrics(emp);
        const cleanName  = cleanedName(emp.name);
        const initials   = avatarInitials(emp.name);
        const color      = avatarColor(emp.name);
        const badgeCls   = { done: 'badge-done', behind: 'badge-behind', active: 'badge-active', halfdone: 'badge-halfdone', no_date: 'badge-no-date' }[m.status];
        const badgeTxt   = { done: 'Completado', behind: 'Rezagado',    active: 'En curso', halfdone: 'Parcial', no_date: ''    }[m.status];
        const dayText    = m.daysIn !== null ? `Día ${m.daysIn} de 90` : 'Sin numero de empleado';
        const markerLeft = m.timePct !== null ? `style="left:${m.timePct}%"` : '';

        return `
        <div class="emp-card" onclick="selectEmployee('${emp.name}')">
            <div class="emp-card-top">
                <div class="emp-avatar" style="background:${color}">${initials}</div>
                <div class="emp-card-info">
                    <div class="emp-card-name">${esc(cleanedName(emp.name))}</div>
                    ${emp.empId      ? `<div class="emp-card-id">#${esc(emp.empId)}</div>` : ''}
                    ${emp.supervisor ? `<div class="emp-card-sup">${esc(emp.supervisor)}</div>` : ''}
                </div>
                <span class="badge ${badgeCls}">${badgeTxt}</span>
            </div>
            <div class="emp-card-progress">
                <div class="progress-mini-meta">
                    <span>${dayText}</span>
                    <span><strong>${m.taskPct}%</strong> tareas</span>
                </div>
                <div class="progress-mini-track">
                    <div class="progress-mini-fill" style="width:${m.taskPct}%"></div>
                    ${m.timePct !== null ? `<div class="progress-mini-marker" ${markerLeft}></div>` : ''}
                </div>
            </div>
            <div class="emp-card-stats">
                <span><strong>${m.done}</strong>/${m.total} completadas</span>
                ${m.daysLeft !== null ? `<span><strong>${m.daysLeft}</strong> días restantes</span>` : ''}
            </div>
        </div>`;
    }).join('');
}

function selectEmployee(name) {
    selectedName = name;
    id('filter-employee').value = name;
    activePeriodo = '';
    id('period-tabs').querySelectorAll('.tab').forEach((b, i) => b.classList.toggle('active', i === 0));
    renderView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// renderiza el dashboard de un empleado individual con metricas y tareas
function renderDashboard(emp) {
    const m      = metrics(emp);
    const color  = avatarColor(emp.name);
    const initials = avatarInitials(emp.name);
    //limpiar nombre del supervisor para mostar solo nombre y apelido a partir de el correo
    const supervisor = emp.supervisor ? emp.supervisor : '';
    const supervisorReplace = supervisor.replace(/\.|@/g, " ");
    const supervisorClean = supervisorReplace.split(" ")
    const buildSupervisor = supervisorClean.map (n => ((n.charAt(0).toUpperCase() + n.slice(1)).split(" ")) );
    const cleanedSupervisor = `${buildSupervisor[0]} ${buildSupervisor[1]}`;
    console.log(emp.departamento)
    console.log(emp.puesto)
    console.log(emp.jefe)
    /*
   console.log(supervisorReplace);
   console.log(supervisorClean);
   console.log(buildSupervisor);
   console.log(cleanedSupervisor);
   */
    // Header card
    id('emp-avatar-lg').textContent  = initials;
    id('emp-avatar-lg').style.background = color;
    id('emp-name').textContent       = emp.name;
    id('emp-departamento').innerHTML = emp.departamento ? `<b>Departamento:</b> ${emp.departamento}` : '<b>Departamento:</b> No registrado';
    id('emp-puesto').innerHTML = emp.puesto ? `<b>Puesto:</b> ${emp.puesto}` : '<b>Puesto:</b> No registrado';
    id('emp-jefe').innerHTML = emp.jefe ? `<b>Jefe:</b> ${emp.jefe}` : '<b>Jefe:</b> No registrado';
    id('emp-id').textContent         = emp.empId ? `ID #${emp.empId}` : '';
    id('emp-supervisor').textContent = emp.supervisor ? `Supervisor: ${cleanedSupervisor}` : '';
    id('emp-ingreso').textContent    = emp.fechaIngreso
        ? `Ingreso: ${emp.fechaIngreso.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}`
        : '';

    const badgeCls = { done: 'badge-done', behind: 'badge-behind', active: 'badge-active', halfdone: 'badge-halfdone', no_date: 'badge-no-date' }[m.status];
    const badgeTxt = { done: 'Plan completado', behind: 'Rezagado', active: 'En curso', halfdone: 'Parcial', no_date: '' }[m.status];
    id('emp-status-badge').innerHTML = `<span class="badge ${badgeCls}">${badgeTxt}</span>`;

    // Metric cards
    id('m-days-in').textContent    = m.daysIn    !== null ? m.daysIn    : '—';
    id('m-days-left').textContent  = m.daysLeft  !== null ? m.daysLeft  : '—';
    id('m-task-pct').textContent   = `${m.taskPct}%`;
    id('m-tasks-count').textContent = `${m.done}/${m.total}`;

    // Progress bars
    id('prog-task-fill').style.width = `${m.taskPct}%`;
    id('prog-time-fill').style.width = `${m.timePct ?? 0}%`;
    id('prog-task-pct').textContent  = `${m.taskPct}%`;
    id('prog-time-pct').textContent  = m.timePct !== null ? `${m.timePct}%` : '—';
    id('prog-summary').textContent   = m.daysIn !== null
        ? `Día ${m.daysIn} de 90 · ${m.done} de ${m.total} tareas`
        : `${m.done} de ${m.total} tareas`;

    renderPeriodCards(m.byPeriodo);

    window.dashboardCharts?.renderDashboardCharts(m.done, m.total, m.byPeriodo);

    renderTaskTable(emp.tasks, activePeriodo);
}

// renderiza el progreso individual por colaborador
function renderPeriodCards(byP) {
    const labels = { '1-30': 'Primeros 30 días', '31-60': 'Primeros 60 días', '61-90': 'Primeros 90 días' };
    id('period-cards').innerHTML = ['1-30', '31-60', '61-90'].map(p => {
        const d   = byP[p] || { total: 0, done: 0 };
        const pct = d.total ? Math.round((d.done / d.total) * 100) : 0;
        return `
        <div class="period-card">
            <div class="period-card-label">${labels[p]}</div>
            <div class="period-fraction">${d.done}<span>/${d.total}</span></div>
            <div class="period-bar-track"><div class="period-bar-fill" style="width:${pct}%"></div></div>
            <div class="period-pct">${pct}% completado</div>
        </div>`;
    }).join('');
}

// renderiza la tabla de tareas en el dashboard del empleado, junto con los filtros por mes
function renderTaskTable(tasks, periodoFilter) {
    const body = id('tasks-body');
    const list = periodoFilter ? tasks.filter(t => t.periodo === periodoFilter) : tasks;
    list.sort((a, b) => a.periodo.localeCompare(b.periodo));
    if (!list.length) {
        body.innerHTML = '<tr><td colspan="4" class="no-tasks">No hay tareas para este período.</td></tr>';
        return;
    }

    body.innerHTML = list.map(t => {
        const statusCls = t.done ? 'done' : 'pending';
        const statusTxt = t.done ? '✓ Completada' : '○ Pendiente';
        const rowCls    = t.isSubtask ? 'subtask-row' : '';

        const taskCell = t.isSubtask
            ? `<td class="task-cell"><span class="subtask-arrow">${SUBTASK_PREFIX}</span><span class="task-name">${esc(t.cleanTask)}</span></td>`
            : `<td class="task-cell"><span class="task-name">${esc(t.task)}</span></td>`;

        return `
        <tr class="${rowCls}">
            ${taskCell}
            <td>${esc(t.periodo)}</td>
            <td>${esc(t.tipo)}</td>
            <td class="col-status"><span class="task-status ${statusCls}">${statusTxt}</span></td>
        </tr>`;
    }).join('');
}

// auxiliares 
function id(s) { return document.getElementById(s); }

function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
}

function esc(str) {
    return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function avatarInitials(name) {
    let cleanedName = name.replace(/^Plan de 90 Días\s*(-)?\s*/i, "");
    cleanedName = cleanedName.trim();
    cleanedName = cleanedName.split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
    return cleanedName
}

function avatarColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function cleanedName(name){
    let cleanedName = name.replace(/^Plan de 90 Días\s*(-)?\s*/i, "");
      return cleanedName.trim();  
}
