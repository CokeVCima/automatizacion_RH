'use strict';
window.descargarDossierPdf = function(selectedName, allEmployees, cleanedName) {
    const dashboard = document.getElementById('dashboard');
    const copia = dashboard.cloneNode(true);

    copia.querySelector('#btn-ss')?.remove();
    copia.querySelector('#btn-back')?.remove();
    copia.querySelector('.tasks-card-header')?.remove();

    const pdf = document.createElement('div');
    pdf.className = 'pdf-export';

    pdf.innerHTML = `
    <div class="header-content">
            <div class="header-brand">
                <div>
                    <img src="assets/Isotipo_CIMA_Blanco.png" alt="CIMA Logo" width="90" height="70">
                </div>
                <div>
                    <h1>Seguimiento - plan de 90 Días</h1>
                </div>
            </div>
    `;

    pdf.appendChild(copia);
    document.body.appendChild(pdf);

     html2pdf()

        .set({
            margin: 5,
            filename: `${selectedName}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        })
        .from(pdf)
        .save()
        .then(() => pdf.remove());
}
//window.descargarDossierPdf = descargarDossierPdf;
