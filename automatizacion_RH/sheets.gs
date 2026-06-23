const getproperties = PropertiesService.getScriptProperties();
const ASANATOKEN = getproperties.getProperty('asanaToken');
const PROYECTOID = getproperties.getProperty('ProyectoGid');

function exportarAsanaASheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Hoja 1");

  const headers = { 'Authorization': `Bearer ${ASANATOKEN}` };
  const options = { method: 'GET', headers: headers };

  // 1. Petición de tareas normales
  const url = `https://app.asana.com/api/1.0/projects/${PROYECTOID}/tasks?opt_fields=name,completed,memberships.project.name,memberships.project.gid,custom_fields.name,custom_fields.display_value`;
  const response = UrlFetchApp.fetch(url, options);
  const tareas = JSON.parse(response.getContentText()).data;

  // extraemos de rh con un map
  const ssRH = SpreadsheetApp.openById('1Uq-I9m_kryxLUuapLkg55f0LqtCWgomd8cfzVkrh2Vg');
  const sheetRH = ssRH.getSheetByName("Hoja 1");
  const dataRH = sheetRH.getDataRange().getValues();
  
  const sheetsMap = {};
  for (let i = 1; i < dataRH.length; i++) {
    const row = dataRH[i];
    const idEmpleado = String(row[0]).trim();
    if (idEmpleado) {
      sheetsMap[idEmpleado] = {
        correoSupervisor: row[3],
        fechaIngreso: row[28], // Columna AC
        departamento: row[21], // Columna V -> DEPARTAMENTO AL QUE INGRESA
        puesto: row[22],       // Columna W -> PUESTO AL QUE INGRESA
        nuevoPuesto: row[23],  // Columna X -> INGRESA EL NOMBRE DEL PUESTO DE NUEVA CREACIÓN
        nombreJefe: row[30]    // Columna AE -> NOMBRE DEL JEFE
      };
    }
  }

  // preparamos el array para peticiones de subtareas mapeado al orden original
  const requests = tareas.map(tarea => ({
    url: `https://app.asana.com/api/1.0/tasks/${tarea.gid}/subtasks?opt_fields=name,completed`,
    method: 'GET',
    headers: headers,
    muteHttpExceptions: true
  }));
  
  const respuestasSubtareas = [];
  const chunkSize = 100; 

  for (let i = 0; i < requests.length; i += chunkSize) {
    const chunk = requests.slice(i, i + chunkSize);
    const chunkResponses = UrlFetchApp.fetchAll(chunk);
    respuestasSubtareas.push(...chunkResponses);
    
    if (i + chunkSize < requests.length) {
      Logger.log(`Descargando subtareas: ${i + chunkSize} de ${requests.length}`);
      Utilities.sleep(2000); 
    }
  }
  //mapear y agrupar por colaborador
  const infoColaboradores = {};

  tareas.forEach((tarea, index) => {
    let proyectoColaborador = "";
    let numeroEmpleadoTarea = "";
    let periodo = "";
    let tipoTarea = "";

    // Multi-homing check
    const gidsVistos = new Set();
    let perteneceAlConglomerado = false;

    if (tarea.memberships) {
      tarea.memberships.forEach(m => {
        if (m.project && m.project.gid && !gidsVistos.has(m.project.gid)) {
          gidsVistos.add(m.project.gid);
          if (m.project.gid === PROYECTOID) perteneceAlConglomerado = true;
          if (m.project.name && m.project.name.trim().startsWith("Plan de 90 Días") && m.project.name.trim() !== "Sin proyecto") {
            proyectoColaborador = m.project.name.trim();
          }
        }
      });
    }

    // aseguramos que pertenece a 2 proyectos, si no pertenece es una tarea suelta 
    if (!perteneceAlConglomerado || !proyectoColaborador) return;

    // Extraer campos de la tarea actual
    if (tarea.custom_fields) {
      tarea.custom_fields.forEach(field => {
        if (field.name === "Periodo de Entrega") periodo = field.display_value;
        if (field.name === "Tipo de Tarea.") tipoTarea = field.display_value;
        if (field.name === "Numero de empleado" && field.display_value) {
          numeroEmpleadoTarea = String(field.display_value).trim();
        }
      });
    }

    if (!infoColaboradores[proyectoColaborador]) {
      infoColaboradores[proyectoColaborador] = {
        idEncontrado: "",
        tareas: []
      };
    }

    if (numeroEmpleadoTarea && numeroEmpleadoTarea !== "null" && infoColaboradores[proyectoColaborador].idEncontrado === "") {
      infoColaboradores[proyectoColaborador].idEncontrado = numeroEmpleadoTarea;
    }

    infoColaboradores[proyectoColaborador].tareas.push({
      nombre: tarea.name,
      periodo: periodo,
      tipo: tipoTarea,
      completada: tarea.completed ? "Sí" : "No",
      indexOriginal: index,
      idPropio: numeroEmpleadoTarea
    });
  });
  //armar filas finales
  const filas = [];

  for (const colaborador in infoColaboradores) {
    const datos = infoColaboradores[colaborador];
    const idFinal = datos.idEncontrado;

    // valores por defecto en caso de que no tengan ID o no estén en RH
    let correoSupervisor = "";
    let fechaIngreso = "";
    let departamento = "";
    let puesto = "";
    let nuevoPuesto = "";
    let nombreJefe = "";
    //mapeamos sheets

    if (idFinal && sheetsMap[idFinal]) {
      const infoRH = sheetsMap[idFinal];
      correoSupervisor = infoRH.correoSupervisor;
      fechaIngreso = infoRH.fechaIngreso;
      departamento = infoRH.departamento;
      puesto = infoRH.puesto;
      nuevoPuesto = infoRH.nuevoPuesto;
      nombreJefe = infoRH.nombreJefe;
    } else {
      Logger.log(`No existe en lista de RH o no tiene ID: ${colaborador}`);
    }

    // Procesamos todas las tareas guardadas de este colaborador
    datos.tareas.forEach(t => {
      const idParaEscribir = t.idPropio || idFinal || "";

      // Inyectamos la tarea principal
      filas.push([
        colaborador,
        idParaEscribir,
        t.nombre,
        t.periodo,
        t.tipo,
        t.completada,
        correoSupervisor,
        fechaIngreso,
        departamento,
        puesto,
        nuevoPuesto,
        nombreJefe
      ]);

      // Recuperamos sus subtareas usando el indexOriginal
      const respuestaSub = respuestasSubtareas[t.indexOriginal];
      if (respuestaSub && respuestaSub.getResponseCode() === 200) {
        const subtasksData = JSON.parse(respuestaSub.getContentText()).data;
        if (subtasksData && subtasksData.length > 0) {
          subtasksData.forEach(subtarea => {
            filas.push([
              colaborador,          
              idParaEscribir,     
              "   ↳ " + subtarea.name, 
              t.periodo,            
              "Subtarea",         
              subtarea.completed ? "Sí" : "No", 
              correoSupervisor,
              fechaIngreso,
              departamento,
              puesto,
              nuevoPuesto,
              nombreJefe
            ]);
          });
        }
      }
    });
  }

  // 4. ESCRITURA EN SHEET
  sheet.clearContents();
  
  const headersEncabezado = [
    "Empleado", "Número Empleado", "Task", "Periodo", 
    "Tipo", "Completada", "supervisor", "fecha_ingreso",
    "Departamento", "Puesto", "Puesto nuevo", "Nombre Jefe"
  ];
  
  sheet.appendRow(headersEncabezado);

  if (filas.length > 0) {
    sheet.getRange(2, 1, filas.length, headersEncabezado.length).setValues(filas);
  }
  
  Logger.log("Terminado");
}

/*
const getproperties = PropertiesService.getScriptProperties();
const ASANATOKEN = getproperties.getProperty('asanaToken');
const PROYECTOID = getproperties.getProperty('ProyectoGid');

function exportarAsanaASheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Hoja 1");

  const headers = { 'Authorization': `Bearer ${ASANATOKEN}` };
  const options = { method: 'GET', headers: headers };

  // 1. Petición de tareas normales
  const url = `https://app.asana.com/api/1.0/projects/${PROYECTOID}/tasks?opt_fields=name,completed,memberships.project.name,memberships.project.gid,custom_fields.name,custom_fields.display_value`;
  const response = UrlFetchApp.fetch(url, options);
  const tareas = JSON.parse(response.getContentText()).data;

  // extraemos de rh con un map
  const ssRH = SpreadsheetApp.openById('1Uq-I9m_kryxLUuapLkg55f0LqtCWgomd8cfzVkrh2Vg');
  const sheetRH = ssRH.getSheetByName("Hoja 1");
  const dataRH = sheetRH.getDataRange().getValues();
  
  const sheetsMap = {};
  for (let i = 1; i < dataRH.length; i++) {
    const row = dataRH[i];
    const idEmpleado = String(row[0]).trim();
    if (idEmpleado) {
      sheetsMap[idEmpleado] = {
        correoSupervisor: row[3],
        fechaIngreso: row[28], // Columna AC
        departamento: row[21], // Columna V -> DEPARTAMENTO AL QUE INGRESA
        puesto: row[22],       // Columna W -> PUESTO AL QUE INGRESA
        nombreJefe: row[30]    // Columna AE -> NOMBRE DEL JEFE
      };
    }
  }

  // preparamos el array para peticiones de subtareas mapeado al orden original
  const requests = tareas.map(tarea => ({
    url: `https://app.asana.com/api/1.0/tasks/${tarea.gid}/subtasks?opt_fields=name,completed`,
    method: 'GET',
    headers: headers,
    muteHttpExceptions: true
  }));
  
  const respuestasSubtareas = [];
  const chunkSize = 100; 

  for (let i = 0; i < requests.length; i += chunkSize) {
    const chunk = requests.slice(i, i + chunkSize);
    const chunkResponses = UrlFetchApp.fetchAll(chunk);
    respuestasSubtareas.push(...chunkResponses);
    
    if (i + chunkSize < requests.length) {
      Logger.log(`Descargando subtareas: ${i + chunkSize} de ${requests.length}`);
      Utilities.sleep(2000); 
    }
  }
  //mapear y agrupar por colaborador
  const infoColaboradores = {};

  tareas.forEach((tarea, index) => {
    let proyectoColaborador = "";
    let numeroEmpleadoTarea = "";
    let periodo = "";
    let tipoTarea = "";

    // Multi-homing check
    const gidsVistos = new Set();
    let perteneceAlConglomerado = false;

    if (tarea.memberships) {
      tarea.memberships.forEach(m => {
        if (m.project && m.project.gid && !gidsVistos.has(m.project.gid)) {
          gidsVistos.add(m.project.gid);
          if (m.project.gid === PROYECTOID) perteneceAlConglomerado = true;
          if (m.project.name && m.project.name.trim().startsWith("Plan de 90 Días") && m.project.name.trim() !== "Sin proyecto") {
            proyectoColaborador = m.project.name.trim();
          }
        }
      });
    }

    // aseguramos que pertenece a 2 proyectos, si no pertenece es una tarea suelta 
    if (!perteneceAlConglomerado || !proyectoColaborador) return;

    // Extraer campos de la tarea actual
    if (tarea.custom_fields) {
      tarea.custom_fields.forEach(field => {
        if (field.name === "Periodo de Entrega") periodo = field.display_value;
        if (field.name === "Tipo de Tarea.") tipoTarea = field.display_value;
        if (field.name === "Numero de empleado" && field.display_value) {
          numeroEmpleadoTarea = String(field.display_value).trim();
        }
      });
    }

    if (!infoColaboradores[proyectoColaborador]) {
      infoColaboradores[proyectoColaborador] = {
        idEncontrado: "",
        tareas: []
      };
    }

    if (numeroEmpleadoTarea && numeroEmpleadoTarea !== "null" && infoColaboradores[proyectoColaborador].idEncontrado === "") {
      infoColaboradores[proyectoColaborador].idEncontrado = numeroEmpleadoTarea;
    }

    infoColaboradores[proyectoColaborador].tareas.push({
      nombre: tarea.name,
      periodo: periodo,
      tipo: tipoTarea,
      completada: tarea.completed ? "Sí" : "No",
      indexOriginal: index,
      idPropio: numeroEmpleadoTarea
    });
  });
  //armar filas finales
  const filas = [];

  for (const colaborador in infoColaboradores) {
    const datos = infoColaboradores[colaborador];
    const idFinal = datos.idEncontrado;

    // valores por defecto en caso de que no tengan ID o no estén en RH
    let correoSupervisor = "";
    let fechaIngreso = "";
    let departamento = "";
    let puesto = "";
    let nombreJefe = "";
    //mapeamos sheets

    if (idFinal && sheetsMap[idFinal]) {
      const infoRH = sheetsMap[idFinal];
      correoSupervisor = infoRH.correoSupervisor;
      fechaIngreso = infoRH.fechaIngreso;
      departamento = infoRH.departamento;
      puesto = infoRH.puesto;
      nombreJefe = infoRH.nombreJefe;
    } else {
      Logger.log(`No existe en lista de RH o no tiene ID: ${colaborador}`);
    }

    // Procesamos todas las tareas guardadas de este colaborador
    datos.tareas.forEach(t => {
      const idParaEscribir = t.idPropio || idFinal || "";

      // Inyectamos la tarea principal
      filas.push([
        colaborador,
        idParaEscribir,
        t.nombre,
        t.periodo,
        t.tipo,
        t.completada,
        correoSupervisor,
        fechaIngreso,
        departamento,
        puesto,
        nombreJefe
      ]);

      // Recuperamos sus subtareas usando el indexOriginal
      const respuestaSub = respuestasSubtareas[t.indexOriginal];
      if (respuestaSub && respuestaSub.getResponseCode() === 200) {
        const subtasksData = JSON.parse(respuestaSub.getContentText()).data;
        if (subtasksData && subtasksData.length > 0) {
          subtasksData.forEach(subtarea => {
            filas.push([
              colaborador,          
              idParaEscribir,     
              "   ↳ " + subtarea.name, 
              t.periodo,            
              "Subtarea",         
              subtarea.completed ? "Sí" : "No", 
              correoSupervisor,
              fechaIngreso,
              departamento,
              puesto,
              nombreJefe
            ]);
          });
        }
      }
    });
  }

  // 4. ESCRITURA EN SHEET
  sheet.clearContents();
  
  const headersEncabezado = [
    "Empleado", "Número Empleado", "Task", "Periodo", 
    "Tipo", "Completada", "supervisor", "fecha_ingreso",
    "Departamento", "Puesto", "Nombre Jefe", "Nuevo puesto"
  ];
  
  sheet.appendRow(headersEncabezado);

  if (filas.length > 0) {
    sheet.getRange(2, 1, filas.length, headersEncabezado.length).setValues(filas);
  }
  
  Logger.log("Terminado");
}
*/

/*
const getproperties = PropertiesService.getScriptProperties();
const ASANATOKEN = getproperties.getProperty('asanaToken');
const PROYECTOID = getproperties.getProperty('ProyectoGid');

function exportarAsanaASheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Hoja 1");

  const headers = { 'Authorization': `Bearer ${ASANATOKEN}` };
  const options = { method: 'GET', headers: headers };

  // 1. Petición de tareas normales
  const url = `https://app.asana.com/api/1.0/projects/${PROYECTOID}/tasks?opt_fields=name,completed,memberships.project.name,memberships.project.gid,custom_fields.name,custom_fields.display_value`;
  const response = UrlFetchApp.fetch(url, options);
  const tareas = JSON.parse(response.getContentText()).data;

  // extraemos de rh con un map
  const ssRH = SpreadsheetApp.openById('1Uq-I9m_kryxLUuapLkg55f0LqtCWgomd8cfzVkrh2Vg');
  const sheetRH = ssRH.getSheetByName("Hoja 1");
  const dataRH = sheetRH.getDataRange().getValues();
  
  const sheetsMap = {};
  for (let i = 1; i < dataRH.length; i++) {
    const row = dataRH[i];
    const idEmpleado = String(row[0]).trim();
    if (idEmpleado) {
      sheetsMap[idEmpleado] = {
        correoSupervisor: row[3],
        fechaIngreso: row[28] // Columna AC
      };
    }
  }

  // preparamos el array para peticiones de subtareas mapeado al orden original
  const requests = tareas.map(tarea => ({
    url: `https://app.asana.com/api/1.0/tasks/${tarea.gid}/subtasks?opt_fields=name,completed`,
    method: 'GET',
    headers: headers,
    muteHttpExceptions: true
  }));
  
  const respuestasSubtareas = [];
  const chunkSize = 100; 

  for (let i = 0; i < requests.length; i += chunkSize) {
    const chunk = requests.slice(i, i + chunkSize);
    const chunkResponses = UrlFetchApp.fetchAll(chunk);
    respuestasSubtareas.push(...chunkResponses);
    
    if (i + chunkSize < requests.length) {
      Logger.log(`Descargando subtareas: ${i + chunkSize} de ${requests.length}`);
      Utilities.sleep(2000); 
    }
  }
  //mapear y agrupar por colaborador
  const infoColaboradores = {};

  tareas.forEach((tarea, index) => {
    let proyectoColaborador = "";
    let numeroEmpleadoTarea = "";
    let periodo = "";
    let tipoTarea = "";

    // Multi-homing check
    const gidsVistos = new Set();
    let perteneceAlConglomerado = false;

    if (tarea.memberships) {
      tarea.memberships.forEach(m => {
        if (m.project && m.project.gid && !gidsVistos.has(m.project.gid)) {
          gidsVistos.add(m.project.gid);
          if (m.project.gid === PROYECTOID) perteneceAlConglomerado = true;
          if (m.project.name && m.project.name.trim().startsWith("Plan de 90 Días") && m.project.name.trim() !== "Sin proyecto") {
            proyectoColaborador = m.project.name.trim();
          }
        }
      });
    }

    // aseguramos que pertenece a 2 proyectos, si no pertenece es una tarea suelta 
    if (!perteneceAlConglomerado || !proyectoColaborador) return;

    // Extraer campos de la tarea actual
    if (tarea.custom_fields) {
      tarea.custom_fields.forEach(field => {
        if (field.name === "Periodo de Entrega") periodo = field.display_value;
        if (field.name === "Tipo de Tarea.") tipoTarea = field.display_value;
        if (field.name === "Numero de empleado" && field.display_value) {
          numeroEmpleadoTarea = String(field.display_value).trim();
        }
      });
    }

    if (!infoColaboradores[proyectoColaborador]) {
      infoColaboradores[proyectoColaborador] = {
        idEncontrado: "",
        tareas: []
      };
    }

    if (numeroEmpleadoTarea && numeroEmpleadoTarea !== "null" && infoColaboradores[proyectoColaborador].idEncontrado === "") {
      infoColaboradores[proyectoColaborador].idEncontrado = numeroEmpleadoTarea;
    }

    infoColaboradores[proyectoColaborador].tareas.push({
      nombre: tarea.name,
      periodo: periodo,
      tipo: tipoTarea,
      completada: tarea.completed ? "Sí" : "No",
      indexOriginal: index,
      idPropio: numeroEmpleadoTarea
    });
  });
  //armar filas finales
  const filas = [];

  for (const colaborador in infoColaboradores) {
    const datos = infoColaboradores[colaborador];
    const idFinal = datos.idEncontrado;

    // valores por defecto en caso de que no tengan ID o no estén en RH
    let correoSupervisor = "";
    let fechaIngreso = "";
    //mapeamos sheets

    if (idFinal && sheetsMap[idFinal]) {
      const infoRH = sheetsMap[idFinal];
      correoSupervisor = infoRH.correoSupervisor;
      fechaIngreso = infoRH.fechaIngreso;
    } else {
      Logger.log(`No existe en lista de RH o no tiene ID: ${colaborador}`);
    }

    // Procesamos todas las tareas guardadas de este colaborador
    datos.tareas.forEach(t => {
      const idParaEscribir = t.idPropio || idFinal || "";

      // Inyectamos la tarea principal
      filas.push([
        colaborador,
        idParaEscribir,
        t.nombre,
        t.periodo,
        t.tipo,
        t.completada,
        correoSupervisor,
        fechaIngreso
      ]);

      // Recuperamos sus subtareas usando el indexOriginal
      const respuestaSub = respuestasSubtareas[t.indexOriginal];
      if (respuestaSub && respuestaSub.getResponseCode() === 200) {
        const subtasksData = JSON.parse(respuestaSub.getContentText()).data;
        if (subtasksData && subtasksData.length > 0) {
          subtasksData.forEach(subtarea => {
            filas.push([
              colaborador,           
              idParaEscribir,     
              "   ↳ " + subtarea.name, 
              t.periodo,            
              "Subtarea",         
              subtarea.completed ? "Sí" : "No", 
              correoSupervisor,
              fechaIngreso
            ]);
          });
        }
      }
    });
  }

  // 4. ESCRITURA EN SHEET
  sheet.clearContents();
  
  const headersEncabezado = [
    "Empleado", "Número Empleado", "Task", "Periodo", 
    "Tipo", "Completada", "supervisor", "fecha_ingreso"
  ];
  
  sheet.appendRow(headersEncabezado);

  if (filas.length > 0) {
    sheet.getRange(2, 1, filas.length, headersEncabezado.length).setValues(filas);
  }
  
  Logger.log("Terminado");
}
*/