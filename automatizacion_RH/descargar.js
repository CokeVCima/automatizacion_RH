window.descargarDossierPdf = function(selectedName, allEmployees, cleanedName) {
    const dashboard = document.getElementById('dashboard');
    const copia = dashboard.cloneNode(true);


//aplicar filtro a period-cards para mostrar la tercera tarjeta centrada
    const periodCards = copia.querySelector('#period-cards');


if (periodCards) {
    periodCards.style.display = 'grid';
    periodCards.style.gridTemplateColumns = '1fr 1fr';
    periodCards.style.gap = '16px';
}

const terceraTarjeta = copia.querySelector('#period-cards .period-card:nth-child(3)');

if (terceraTarjeta) {
    terceraTarjeta.style.gridColumn = '1 / -1';
    terceraTarjeta.style.justifySelf = 'center';
    terceraTarjeta.style.width = 'calc(50% - 8px)';
    terceraTarjeta.style.marginBottom = '16px';
}
    copia.querySelector('#btn-ss')?.remove();
    copia.querySelector('#btn-back')?.remove();
    copia.querySelector('.tasks-card-header')?.remove();
// ==============================================================

//clonar las graficaas para hacerlas meterlas en imagen y poder usarlas

/*
como uso clone del documento real, se clona el documento, la estructura y layout pero no funciona el contendio de las graficas, entonces
hay que convertir cada grfica a imagen para asi insertarla en el documento final a descargar
*/
const originalCanvas = document.querySelector('#chart-period-bar');
const cloneBars = copia.querySelector('#chart-period-bar');
const img = document.createElement('img');
img.src = originalCanvas.toDataURL('image/png');
img.style.cssText = 'width:100%; height:auto; display:block;';

const originalCanvas2 = document.querySelector('#chart-task-donut');
const cloneDonut2 = copia.querySelector('#chart-task-donut');
const img2 = document.createElement('img');
img2.src = originalCanvas2.toDataURL('image/png');
img2.style.cssText = 'width:100%; height:auto; display:block;';

const barsContainer = cloneBars.parentElement;
const donutContainer = cloneDonut2.parentElement;

cloneBars.replaceWith(img);
cloneDonut2.replaceWith(img2);

const chartsWrapper = barsContainer?.parentElement;
if (chartsWrapper) {
    chartsWrapper.style.cssText = 'display:flex; flex-direction:row; gap:16px; width:100%;';
    if (barsContainer)  barsContainer.style.cssText  = 'flex:1; min-width:0;';
    if (donutContainer) donutContainer.style.cssText = 'flex:1; min-width:0;';
}
//=====================================================================


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
            image: { type: 'jpeg', quality: 2 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        })
        .from(pdf)
        .save()
        .then(() => pdf.remove());
}
//window.descargarDossierPdf = descargarDossierPdf;
