'use strict';

import { Chart, registerables } from 'https://cdn.jsdelivr.net/npm/chart.js@4.4.9/+esm';
Chart.register(...registerables);

const instances = {};

function destroy(key) {
    if (instances[key]) {
        instances[key].destroy();
        delete instances[key];
    }
}

function renderTaskDonut(done, total) {
    destroy('taskDonut');
    const ctx = document.getElementById('chart-task-donut');
    if (!ctx) return;
    instances['taskDonut'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Completadas', 'Pendientes'],
            datasets: [{
                data: [done, total - done],
                backgroundColor: ['#16a34a', '#e2e8f0'],
                borderWidth: 0,
                hoverOffset: 6,
            }]
        },
        options: {
            cutout: '70%',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { size: 12 }, padding: 16, usePointStyle: true }
                },
                tooltip: {
                    callbacks: {
                        label: (item) => ` ${item.raw} tarea${item.raw !== 1 ? 's' : ''}`
                    }
                }
            }
        }
    });
}

function renderPeriodBar(byPeriodo) {
    destroy('periodBar');
    const ctx = document.getElementById('chart-period-bar');
    if (!ctx) return;
    const periods = ['1-30', '31-60', '61-90'];
    const labels  = ['Días 1–30', 'Días 31–60', 'Días 61–90'];
    const done    = periods.map(p => (byPeriodo[p] || { done: 0 }).done);
    const pending = periods.map(p => {
        const d = byPeriodo[p] || { total: 0, done: 0 };
        return d.total - d.done;
    });

    instances['periodBar'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Completadas', data: done,    backgroundColor: '#16a34a', borderRadius: 4, borderSkipped: false },
                { label: 'Pendientes',  data: pending, backgroundColor: '#e2e8f0', borderRadius: 4, borderSkipped: false },
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, grid: { display: false }, ticks: { font: { size: 12 } } },
                y: { stacked: true, ticks: { stepSize: 1, font: { size: 12 } }, grid: { color: '#f1f5f9' } }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { size: 12 }, padding: 16, usePointStyle: true }
                }
            }
        }
    });
}

function renderStatusOverview(counts) {
    destroy('statusOverview');
    const ctx = document.getElementById('chart-status-overview');
    if (!ctx) return;

    const all = [
        { label: 'Completado', value: counts.done    || 0, color: '#16a34a' },
        { label: 'En curso',   value: counts.active  || 0, color: '#2563eb' },
        { label: 'Rezagado',   value: counts.behind  || 0, color: '#dc2626' },
        { label: 'Parcial',    value: counts.halfdone|| 0, color: '#ea580c' },
        { label: 'Sin fecha',  value: counts.no_date || 0, color: '#94a3b8' },
    ].filter(d => d.value > 0);

    instances['statusOverview'] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: all.map(d => d.label),
            datasets: [{
                data: all.map(d => d.value),
                backgroundColor: all.map(d => d.color),
                borderWidth: 2,
                borderColor: '#ffffff',
                hoverOffset: 6,
            }]
        },
        options: {
            cutout: '60%',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { font: { size: 12 }, padding: 14, usePointStyle: true }
                },
                tooltip: {
                    callbacks: {
                        label: (item) => ` ${item.raw} colaborador${item.raw !== 1 ? 'es' : ''}`
                    }
                }
            }
        }
    });
}

function renderComplianceByStatus(counts, pctSums) {
    destroy('complianceStatus');
    const ctx = document.getElementById('chart-compliance-status');
    if (!ctx) return;

    const statuses = [
        { key: 'done',     label: 'Completado', color: '#16a34a' },
        { key: 'active',   label: 'En curso',   color: '#2563eb' },
        { key: 'halfdone', label: 'Parcial',     color: '#ea580c' },
        { key: 'behind',   label: 'Rezagado',    color: '#dc2626' },
        { key: 'no_date',  label: 'Sin fecha',   color: '#94a3b8' },
    ].filter(s => (counts[s.key] || 0) > 0);

    const labels = statuses.map(s => s.label);
    const data   = statuses.map(s => counts[s.key] ? Math.round(pctSums[s.key] / counts[s.key]) : 0);
    const colors = statuses.map(s => s.color);

    instances['complianceStatus'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: '% cumplimiento promedio',
                data,
                backgroundColor: colors.map(c => c + 'cc'),
                borderColor: colors,
                borderWidth: 2,
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    min: 0, max: 100,
                    ticks: {
                        font: { size: 11 },
                        callback: v => v + '%',
                        stepSize: 25,
                    },
                    grid: { color: '#f1f5f9' },
                },
                y: {
                    grid: { display: false },
                    ticks: { font: { size: 12 } },
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: item => ` ${item.raw}% promedio (${counts[statuses[item.dataIndex].key]} colaborador${counts[statuses[item.dataIndex].key] !== 1 ? 'es' : ''})`
                    }
                },
                datalabels: { display: false },
            }
        }
    });
}

window.dashboardCharts = {
    Chart,
    renderDashboardCharts(done, total, byPeriodo) {
        renderTaskDonut(done, total);
        renderPeriodBar(byPeriodo);
    },
    renderOverviewChart(counts) {
        renderStatusOverview(counts);
    },
    renderComplianceChart(counts, pctSums) {
        renderComplianceByStatus(counts, pctSums);
    },
    destroyDashboardCharts() {
        destroy('taskDonut');
        destroy('periodBar');
    },
};
