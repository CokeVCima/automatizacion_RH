window.descargarDossierPdf = function(selectedName, allEmployees, cleanedNameFn) {
    const emp = allEmployees[selectedName];
    if (!emp) return;

    const m = metrics(emp);
    const color = avatarColor(emp.name);
    const initials = avatarInitials(emp.name);
    const displayName = cleanedNameFn(emp.name);
    const today = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

    const fechaStr = emp.fechaIngreso
        ? emp.fechaIngreso.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
        : 'Sin registro';

    const statusMap = {
        done:     { text: 'Plan completado', bg: '#dcfce7', fg: '#16a34a' },
        active:   { text: 'En curso',        bg: '#dbeafe', fg: '#2563eb' },
        behind:   { text: 'Rezagado',        bg: '#fee2e2', fg: '#dc2626' },
        halfdone: { text: 'Parcial',         bg: '#ffedd5', fg: '#ea580c' },
        no_date:  { text: '',                bg: 'transparent', fg: '#64748b' },
    };
    const st = statusMap[m.status] || statusMap.active;

    // Capturar gráficas del DOM actual
    const canvasDonut = document.querySelector('#chart-task-donut');
    const canvasBar   = document.querySelector('#chart-period-bar');
    const imgDonut = canvasDonut ? canvasDonut.toDataURL('image/png') : '';
    const imgBar   = canvasBar   ? canvasBar.toDataURL('image/png')   : '';

    // KPIs
    const kpis = [
        { val: m.daysIn  !== null ? m.daysIn  : '—', label: 'Días en la empresa',       accent: '#2563eb', bg: '#eff6ff' },
        { val: m.daysLeft !== null ? m.daysLeft : '—', label: 'Días restantes del plan', accent: '#7c3aed', bg: '#f5f3ff' },
        { val: `${m.taskPct}%`,                        label: 'Tareas completadas',       accent: '#16a34a', bg: '#f0fdf4' },
        { val: `${m.done}/${m.total}`,                 label: 'Total de tareas',          accent: '#0891b2', bg: '#ecfeff' },
    ];

    const kpiHtml = kpis.map(k => `
        <div style="display:table-cell;width:25%;padding:0 5px;vertical-align:top;">
            <div style="background:${k.bg};border:1px solid #e2e8f0;border-top:3px solid ${k.accent};border-radius:10px;padding:14px 12px;text-align:center;">
                <div style="font-size:28px;font-weight:800;color:${k.accent};line-height:1;">${k.val}</div>
                <div style="font-size:10.5px;color:#64748b;margin-top:5px;line-height:1.3;">${k.label}</div>
            </div>
        </div>`).join('');

    // Period cards
    const periods = [
        { key: '1-30',  label: 'Primeros 30 días' },
        { key: '31-60', label: 'Primeros 60 días' },
        { key: '61-90', label: 'Primeros 90 días' },
    ];
    const periodHtml = periods.map(p => {
        const d   = m.byPeriodo[p.key] || { total: 0, done: 0 };
        const pct = d.total ? Math.round((d.done / d.total) * 100) : 0;
        return `
        <div style="display:table-cell;padding:0 5px;vertical-align:top;">
            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px 14px;">
                <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#64748b;margin-bottom:8px;">${p.label}</div>
                <div style="font-size:26px;font-weight:800;margin-bottom:8px;line-height:1;">
                    ${d.done}<span style="font-size:15px;font-weight:500;color:#64748b;">/${d.total}</span>
                </div>
                <div style="height:6px;background:#f1f5f9;border-radius:99px;margin-bottom:6px;overflow:hidden;">
                    <div style="height:100%;width:${pct}%;background:#2563eb;border-radius:99px;"></div>
                </div>
                <div style="font-size:11px;color:#64748b;">${pct}% completado</div>
            </div>
        </div>`;
    }).join('');

    // Task rows
    const taskRows = [...emp.tasks]
        .sort((a, b) => a.periodo.localeCompare(b.periodo))
        .map(t => {
            const doneStyle    = 'background:#dcfce7;color:#16a34a;';
            const pendingStyle = 'background:#ffedd5;color:#ea580c;';
            const statusStyle  = t.done ? doneStyle : pendingStyle;
            const statusTxt    = t.done ? '✓ Completada' : '○ Pendiente';
            const taskIndent   = t.isSubtask
                ? 'padding-left:22px;color:#94a3b8;font-size:9.5px;'
                : 'font-size:10.5px;';
            return `
            <tr style="border-bottom:1px solid #f1f5f9;${t.isSubtask ? 'background:#fafafa;' : ''}">
                <td style="padding:8px 10px;vertical-align:middle;word-break:break-word;${taskIndent}">${esc(t.cleanTask || t.task)}</td>
                <td style="padding:8px 10px;vertical-align:middle;color:#64748b;font-size:10px;">${esc(t.periodo)}</td>
                <td style="padding:8px 10px;vertical-align:middle;color:#64748b;font-size:10px;">${esc(t.tipo)}</td>
                <td style="padding:8px 10px;vertical-align:middle;">
                    <span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:9px;font-weight:700;${statusStyle}">${statusTxt}</span>
                </td>
            </tr>`;
        }).join('');

    // ── Header compartido ──────────────────────────────
    const headerHtml = (subtitle) => `
        <div style="background:#01013C;padding:12px 22px;display:flex;align-items:center;gap:14px;">
            <img src="assets/Isotipo_CIMA_Blanco.png" alt="CIMA" style="height:42px;width:auto;flex-shrink:0;">
            <div>
                <div style="color:#94a3b8;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;">Reporte Individual · Plan de 90 Días</div>
                <div style="color:#ffffff;font-size:15px;font-weight:800;line-height:1.3;">${subtitle}</div>
            </div>
            <div style="margin-left:auto;color:#475569;font-size:10px;text-align:right;line-height:1.5;">
                <div style="color:#94a3b8;">Generado</div>
                <div style="color:#cbd5e1;font-weight:600;">${today}</div>
            </div>
        </div>`;

    // ── Construcción del documento completo ───────────
    const html = `
    <div style="width:190mm;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;background:#f8fafc;line-height:1.5;">

        <!-- ═══ PÁGINA 1 ═══ -->
        ${headerHtml(esc(displayName))}

        <!-- Perfil del colaborador -->
        <div style="background:#ffffff;border-bottom:3px solid #2563eb;padding:18px 22px;display:flex;align-items:center;gap:18px;margin-bottom:14px;">
            <div style="width:62px;height:62px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:22px;color:#fff;flex-shrink:0;letter-spacing:-1px;">
                ${esc(initials)}
            </div>
            <div style="flex:1;min-width:0;">
                <div style="font-size:19px;font-weight:800;margin-bottom:3px;">${esc(displayName)}</div>
                <div style="font-size:12px;color:#475569;margin-bottom:8px;">
                    ${[emp.puesto, emp.departamento].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ')}
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:14px;">
                    ${emp.empId     ? `<span style="font-size:11px;color:#64748b;"><strong style="color:#334155;">ID</strong> #${esc(emp.empId)}</span>` : ''}
                    ${emp.jefe      ? `<span style="font-size:11px;color:#64748b;"><strong style="color:#334155;">Jefe:</strong> ${esc(emp.jefe)}</span>` : ''}
                    ${emp.supervisor? `<span style="font-size:11px;color:#64748b;"><strong style="color:#334155;">Supervisor:</strong> ${esc(emp.supervisor)}</span>` : ''}
                    <span style="font-size:11px;color:#64748b;"><strong style="color:#334155;">Ingreso:</strong> ${fechaStr}</span>
                </div>
            </div>
            ${st.text ? `
            <div style="flex-shrink:0;text-align:center;">
                <span style="display:inline-block;padding:6px 16px;border-radius:20px;font-size:11px;font-weight:700;background:${st.bg};color:${st.fg};">${st.text}</span>
                ${m.daysIn !== null ? `<div style="font-size:10px;color:#94a3b8;margin-top:4px;">Día ${m.daysIn} de 90</div>` : ''}
            </div>` : ''}
        </div>

        <!-- KPIs -->
        <div style="display:table;width:100%;table-layout:fixed;padding:0 8px;margin-bottom:14px;">
            ${kpiHtml}
        </div>

        <!-- Avance del plan -->
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:18px 20px;margin:0 8px 14px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <div style="font-size:13px;font-weight:700;color:#0f172a;">Avance del Plan</div>
                <div style="font-size:11px;color:#64748b;">${m.daysIn !== null ? `Día ${m.daysIn} de 90` : ''} · ${m.done} de ${m.total} tareas</div>
            </div>

            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                <span style="font-size:11.5px;color:#64748b;width:88px;flex-shrink:0;">Completado</span>
                <div style="flex:1;height:10px;background:#f1f5f9;border-radius:99px;overflow:hidden;">
                    <div style="height:100%;width:${m.taskPct}%;background:#16a34a;border-radius:99px;"></div>
                </div>
                <span style="font-size:13px;font-weight:700;width:38px;text-align:right;color:#16a34a;">${m.taskPct}%</span>
            </div>

            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                <span style="font-size:11.5px;color:#64748b;width:88px;flex-shrink:0;">Tiempo</span>
                <div style="flex:1;height:10px;background:#f1f5f9;border-radius:99px;overflow:hidden;">
                    <div style="height:100%;width:${m.timePct ?? 0}%;background:#2563eb;border-radius:99px;"></div>
                </div>
                <span style="font-size:13px;font-weight:700;width:38px;text-align:right;color:#2563eb;">${m.timePct !== null ? m.timePct + '%' : '—'}</span>
            </div>

            <div style="display:flex;justify-content:space-between;font-size:9.5px;color:#94a3b8;padding-top:4px;padding-left:98px;padding-right:46px;">
                <span>Ingreso</span><span>Día 30</span><span>Día 60</span><span>Día 90</span>
            </div>
        </div>

        <!-- Tarjetas por período -->
        <div style="display:table;width:100%;table-layout:fixed;padding:0 8px;margin-bottom:8px;">
            ${periodHtml}
        </div>

        <!-- ═══ PÁGINA 2 ═══ -->
        <div style="break-before:page;page-break-before:always;">
            ${headerHtml(esc(displayName))}

            <!-- Gráficas -->
            ${(imgDonut || imgBar) ? `
            <div style="display:table;width:100%;table-layout:fixed;padding:0 8px;margin:14px 0;">
                ${imgDonut ? `
                <div style="display:table-cell;width:48%;padding-right:6px;vertical-align:top;">
                    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;">
                        <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:10px;">Completitud de tareas</div>
                        <img src="${imgDonut}" style="width:100%;height:auto;display:block;">
                    </div>
                </div>` : ''}
                ${imgBar ? `
                <div style="display:table-cell;width:52%;padding-left:6px;vertical-align:top;">
                    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;">
                        <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:10px;">Avance por período</div>
                        <img src="${imgBar}" style="width:100%;height:auto;display:block;">
                    </div>
                </div>` : ''}
            </div>` : ''}

            <!-- Tabla de tareas -->
            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin:0 8px;">
                <div style="padding:13px 18px;border-bottom:2px solid #e2e8f0;background:#f8fafc;display:flex;align-items:center;justify-content:space-between;">
                    <div style="font-size:13px;font-weight:700;color:#0f172a;">Tareas del Plan</div>
                    <div style="font-size:11px;color:#64748b;">${emp.tasks.length} registros · ${m.done} completadas · ${m.total - m.done} pendientes</div>
                </div>
                <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
                    <thead>
                        <tr style="border-bottom:1px solid #e2e8f0;background:#f8fafc;">
                            <th style="padding:8px 10px;text-align:left;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#64748b;width:55%;">Tarea</th>
                            <th style="padding:8px 10px;text-align:left;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#64748b;width:12%;">Período</th>
                            <th style="padding:8px 10px;text-align:left;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#64748b;width:18%;">Tipo</th>
                            <th style="padding:8px 10px;text-align:left;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#64748b;width:15%;">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${taskRows}
                    </tbody>
                </table>
            </div>
        </div>

    </div>`;

    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:0;';
    container.innerHTML = html;
    document.body.appendChild(container);

    html2pdf()
        .set({
            margin: [6, 6, 6, 6],
            filename: `${displayName} — Plan 90 Días.pdf`,
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: '#f8fafc' },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'] }
        })
        .from(container.firstElementChild)
        .save()
        .then(() => container.remove());
};
