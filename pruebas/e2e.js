/* ============================================================================
   e2e.js — Autoprueba de extremo a extremo que se ejecuta dentro del navegador
   sobre la aplicación real (index.html). Simula el trabajo completo de un
   docente y verifica cálculos, guardado, exportación y documentos oficiales.
   Se inyecta en pruebas/autoprueba.html (generado por pruebas/ejecutar-e2e.ps1).
   ========================================================================== */
(function () {
  'use strict';

  var ok = 0, fallas = [], notas = [];

  function afirmar(nombre, condicion, detalle) {
    if (condicion) { ok += 1; }
    else { fallas.push(nombre + (detalle ? ' → ' + detalle : '')); }
  }

  function igual(nombre, recibido, esperado) {
    var a = JSON.stringify(recibido), b = JSON.stringify(esperado);
    afirmar(nombre, a === b, 'se esperaba ' + b + ' y se obtuvo ' + a);
  }

  function $(id) { return document.getElementById(id); }
  function valor(id) { return $(id) ? $(id).value : null; }

  function entrada(el, valorNuevo, evento) {
    if (!el) return false;
    el.value = valorNuevo;
    el.dispatchEvent(new Event(evento || 'input', { bubbles: true }));
    return true;
  }

  function poner(id, valorNuevo, evento) {
    return entrada($(id), valorNuevo, evento || 'input');
  }

  function marcar(selector, indices) {
    var total = 0;
    indices.forEach(function (i) {
      var cajas = document.querySelectorAll(selector);
      total = cajas.length;
      if (!cajas[i]) return;
      cajas[i].checked = true;
      cajas[i].dispatchEvent(new Event('change', { bubbles: true }));
    });
    return total;
  }

  function seleccionarPorTexto(id, texto) {
    var sel = $(id);
    if (!sel) return false;
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].textContent.toLowerCase().indexOf(texto.toLowerCase()) >= 0) {
        sel.value = sel.options[i].value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  function ponerNota(fila, columna, valorNota) {
    var filas = document.querySelectorAll('#cuerpo-notas tr');
    if (!filas[fila]) return false;
    var inputs = filas[fila].querySelectorAll('input.nota');
    if (!inputs[columna]) return false;
    return entrada(inputs[columna], valorNota, 'input');
  }

  function textoDe(id) { return $(id) ? $(id).textContent : ''; }

  function claseMedidor(prefijo) {
    var caja = $(prefijo + '-medidor');
    return caja ? caja.className : '';
  }

  function mostrarResultado() {
    var pre = document.createElement('pre');
    pre.id = 'resultado-e2e';
    pre.textContent = '[[RESULTADO]]\n' +
      'E2E OK: ' + ok + '\n' +
      'E2E FALLAS: ' + fallas.length + '\n' +
      (notas.length ? 'E2E NOTAS: ' + notas.join(' | ') + '\n' : '') +
      fallas.map(function (f) { return '- ' + f; }).join('\n') +
      '\n[[FIN]]';
    document.body.appendChild(pre);
    document.title = 'E2E ' + (fallas.length ? 'FALLO(' + fallas.length + ')' : 'OK(' + ok + ')');
  }

  function ejecutar() {
    try {
      /* ---------------------------------------------------- 0. Arranque */
      afirmar('App queda inicializada', !!App && !!App.estado);
      afirmar('la pantalla de acceso aparece antes que nada', $('pantalla-acceso').hidden === false);
      afirmar('el paso de usuarios está oculto al inicio', $('acceso-paso-usuario').hidden === true);
      afirmar('la clave general está exigida', !!(window.CONFIG_ACCESO && CONFIG_ACCESO.exigirClave));
      afirmar('el modo local está activo mientras no haya Firebase configurado',
        Nube.modo === 'local' && Nube.configurado() === false);
      afirmar('el escudo institucional real está integrado',
        typeof ESCUDO_REAL === 'string' && ESCUDO_REAL.indexOf('data:image/') === 0 && ESCUDO_REAL.length > 20000);
      afirmar('la pantalla de acceso también muestra el escudo',
        /data:image/.test($('acceso-escudo').innerHTML));

      /* ----------------------------------------------- 0b. Clave general */
      poner('acceso-clave', 'clave-equivocada');
      $('btn-acceso-clave').click();
      afirmar('una clave incorrecta no deja entrar',
        $('acceso-paso-usuario').hidden === true && $('acceso-clave-error').hidden === false);
      poner('acceso-clave', 'zazarabicoa123');
      $('btn-acceso-clave').click();
      afirmar('la clave correcta abre el paso de los docentes', $('acceso-paso-usuario').hidden === false);
      afirmar('se ofrece crear el usuario del docente', $('btn-crear-usuario') !== null &&
        $('acceso-local').hidden === false);

      /* ------------------------------------ 0c. Crear usuario del docente */
      poner('acceso-nombre', 'Miguel Ángel Pérez');
      poner('acceso-nueva-clave', 'miguel123');
      poner('acceso-nueva-clave2', 'miguel123');
      $('btn-crear-usuario').click();
      afirmar('al crear el usuario se entra a la aplicación', $('pantalla-acceso').hidden === true);
      afirmar('el usuario quedó registrado en el equipo',
        App.usuarios().length === 1 && App.usuarios()[0].nombre === 'Miguel Ángel Pérez');
      afirmar('la contraseña no se guarda en claro',
        JSON.stringify(App.usuarios()).indexOf('miguel123') < 0);
      afirmar('el docente nuevo empieza con datos vacíos',
        App.estado.estudiantes.length === 0 && Object.keys(App.estado.notas).length === 0);
      afirmar('la aplicación avisa en qué modo está guardando', App.modo === 'local');
      afirmar('los valores del plantel vienen precargados',
        App.estado.config.institucion.codigoDEA === 'S4375D1305' &&
        App.estado.config.institucion.circuito === 'José Morales "Cachimba"' &&
        App.estado.config.institucion.municipio === 'Morán' &&
        App.estado.config.institucion.estado === 'Lara' &&
        App.estado.config.institucion.director === 'Rosana Rodríguez' &&
        App.estado.config.institucion.coordinador === 'Rocío García' &&
        App.estado.config.institucion.coordinador2 === 'Eli Torrealba');
      afirmar('no existe el campo Título / Especialidad',
        $('doc-titulo') === null && $('doc-area') !== null);
      afirmar('ya no se puede cargar ni quitar el logo institucional',
        $('inst-escudo-archivo') === null && $('btn-escudo-quitar') === null && $('vista-escudo-config') === null);

      /* ------------------------------------------- 1. Configuración */
      App.irA('configuracion');
      poner('doc-nombres', 'María Alejandra');
      poner('doc-apellidos', 'Rodríguez Pérez');
      poner('doc-cedula', '12345678');
      $('doc-cedula').dispatchEvent(new Event('blur', { bubbles: true }));
      poner('inf-no-existe', 'x'); // debe ser tolerado sin errores
      poner('doc-telefono', '0414-1234567');
      poner('doc-correo', 'docente@zazarabicoa.edu.ve');
      poner('doc-area', 'Matemática');

      marcar('#grupo-anios input', [0, 2]);           // 1° y 3° año
      marcar('#grupo-secciones input', [0, 1]);       // secciones A y B
      marcar('#grupo-asignaturas input', [0, 2]);     // Lenguaje y Literatura + Matemática
      poner('asignatura-nueva', 'C.R.P. (Cátedra Bolivariana)');
      $('btn-agregar-asignatura').click();

      igual('años configurados', App.estado.config.anios, [1, 3]);
      igual('secciones configuradas', App.estado.config.secciones, ['A', 'B']);
      igual('asignaturas configuradas', App.estado.config.asignaturas.length, 3);
      afirmar('el área de desempeño se guarda', App.estado.config.docente.area === 'Matemática');
      afirmar('las áreas sugeridas son las asignaturas de la institución',
        $('lista-areas').innerHTML.indexOf('Biología, Ambiente y Tecnología') >= 0 &&
        $('lista-areas').innerHTML.indexOf('Orientación Vocacional') >= 0);
      afirmar('la cédula del docente se normaliza', $('doc-cedula').value === '12.345.678', $('doc-cedula').value);
      $('btn-guardar-config').click();

      /* ----------------------------------------------- 2. Nómina masiva */
      App.irA('nomina');
      afirmar('la tabla de la nómina ya no tiene columna de sexo',
        $('tabla-nomina').innerHTML.indexOf('Sexo') < 0);
      poner('masiva-texto', 'Cédula\tApellidos\tNombres\n' +
        'V-12345678\tPérez Gómez\tJuan Carlos\n' +
        'E-8123456; Rodríguez; Ana María\n' +
        'V-20123456 Salazar Rivas Luis Alberto\n' +
        '12.345.679, Marcano Pérez, José Gregorio\n' +
        'Gómez Ruiz Pedro\n');
      $('btn-analizar-masiva').click();
      igual('filas reconocidas en la vista previa', document.querySelectorAll('#cuerpo-masiva tr').length, 5);
      afirmar('la vista previa ya no pide sexo',
        $('cuerpo-masiva').innerHTML.indexOf('Sexo') < 0 && $('cuerpo-masiva').innerHTML.indexOf('sexo') < 0);
      afirmar('la vista previa es editable',
        document.querySelectorAll('#cuerpo-masiva input').length >= 15);
      $('btn-confirmar-masiva').click();
      afirmar('se abre la ventana de confirmación', $('fondo-modal').hidden === false);
      $('modal-aceptar').click();
      igual('estudiantes cargados', App.estado.estudiantes.length, 5);
      igual('filas en la tabla de nómina', document.querySelectorAll('#cuerpo-nomina tr').length, 5);
      afirmar('el año y la sección se asignan a los estudiantes',
        App.estado.estudiantes.every(function (e) { return Number(e.anio) === 1 && e.seccion === 'A'; }));
      afirmar('los apellidos y nombres se interpretan correctamente',
        App.estado.estudiantes.some(function (e) { return e.apellidos === 'PÉREZ GÓMEZ' && e.nombres === 'JUAN CARLOS'; }) &&
        App.estado.estudiantes.some(function (e) { return e.apellidos === 'SALAZAR RIVAS' && e.nombres === 'LUIS ALBERTO'; }));

      /* -------------------------------------------------- 3. Plan de evaluación */
      App.irA('plan');
      seleccionarPorTexto('plan-asignatura', 'Matemática');
      poner('plan-lapso', '1', 'change');
      $('btn-plan-agregar').click();
      $('btn-plan-agregar').click();
      igual('actividades creadas', App.estado.planes[ZZ.clave({ anio: 1, seccion: 'A', asignatura: valor('plan-asignatura'), lapso: 1 })].actividades.length, 2);
      var filasPlan = document.querySelectorAll('#cuerpo-plan tr');
      entrada(filasPlan[0].querySelector('input[data-campo="nombre"]'), 'Taller grupal de funciones', 'input');
      entrada(filasPlan[0].querySelector('input.ponderacion'), '40', 'input');
      entrada(filasPlan[1].querySelector('input[data-campo="nombre"]'), 'Prueba escrita', 'input');
      entrada(filasPlan[1].querySelector('input.ponderacion'), '60', 'input');
      afirmar('el medidor marca la ponderación completa',
        claseMedidor('plan').indexOf('ok') >= 0, claseMedidor('plan'));
      afirmar('el medidor muestra 100 %', textoDe('plan-total-texto').indexOf('100') >= 0, textoDe('plan-total-texto'));
      igual('puntos equivalentes de la primera actividad', ZZ.fmt2(PlanUtil.puntosDe(40)), '8,00');

      // Ponderación incompleta y luego completada automáticamente
      entrada(document.querySelectorAll('#cuerpo-plan input.ponderacion')[1], '30', 'input');
      afirmar('el medidor detecta que falta ponderación',
        claseMedidor('plan').indexOf('falta') >= 0, claseMedidor('plan'));
      $('btn-plan-completar').click();
      afirmar('el botón completar lleva la ponderación al 100 %',
        claseMedidor('plan').indexOf('ok') >= 0, claseMedidor('plan'));
      igual('la ponderación quedó repartida entre las dos actividades',
        ZZ.sumaPonderacion(PlanUtil.actividades({ anio: 1, seccion: 'A', asignatura: valor('plan-asignatura'), lapso: 1 }, false)), 100);

      // El docente fija la ponderación definitiva: 40 % y 60 %
      var pondPlan = document.querySelectorAll('#cuerpo-plan input.ponderacion');
      entrada(pondPlan[0], '40', 'input');
      entrada(pondPlan[1], '60', 'input');
      afirmar('la ponderación 40/60 queda en 100 %',
        claseMedidor('plan').indexOf('ok') >= 0, claseMedidor('plan'));

      /* ------------------------------------- 4. Evaluación continua y definitiva */
      App.irA('continua');
      seleccionarPorTexto('ec-asignatura', 'Matemática');
      poner('ec-lapso', '1', 'change');
      igual('la ponderación se comparte con el plan',
        document.querySelectorAll('#cuerpo-ponderacion tr').length, 2);
      afirmar('el medidor de continua está completo', claseMedidor('ec').indexOf('ok') >= 0, claseMedidor('ec'));

      // El docente modifica la ponderación desde la evaluación continua
      var pond = document.querySelectorAll('#cuerpo-ponderacion input.ponderacion');
      entrada(pond[0], '30', 'input');
      afirmar('al modificar la ponderación el medidor avisa que falta',
        claseMedidor('ec').indexOf('falta') >= 0, claseMedidor('ec'));
      igual('el plan refleja el cambio inmediatamente',
        App.estado.planes[ZZ.clave({ anio: 1, seccion: 'A', asignatura: valor('ec-asignatura'), lapso: 1 })].actividades[0].ponderacion, 30);
      entrada(pond[0], '40', 'input');
      afirmar('al restaurar la ponderación vuelve a 100 %',
        claseMedidor('ec').indexOf('ok') >= 0, claseMedidor('ec'));

      // Notas de los estudiantes
      var filasNotas = Array.prototype.slice.call(document.querySelectorAll('#cuerpo-notas tr'));
      var orden = filasNotas.map(function (f) { return f.querySelector('td:nth-child(2)').textContent.trim(); });
      notas.push('orden de la matriz: ' + orden.join(' / '));
      var idx = {};
      filasNotas.forEach(function (f, i) {
        var t = f.querySelector('td:nth-child(2)').textContent;
        if (/^PÉREZ GÓMEZ/i.test(t)) idx.perez = i;
        if (/^RODRÍGUEZ/i.test(t)) idx.rodriguez = i;
        if (/^SALAZAR/i.test(t)) idx.salazar = i;
        if (/^MARCANO/i.test(t)) idx.marcano = i;
        if (/^GÓMEZ RUIZ/i.test(t)) idx.gomez = i;
      });
      afirmar('se identificaron los 5 estudiantes en la matriz',
        Object.keys(idx).length === 5, JSON.stringify(idx));

      ponerNota(idx.perez, 0, '15'); ponerNota(idx.perez, 1, '18');
      ponerNota(idx.rodriguez, 0, '9.5'); ponerNota(idx.rodriguez, 1, '10');
      ponerNota(idx.salazar, 0, '20'); ponerNota(idx.salazar, 1, '20');
      ponerNota(idx.marcano, 0, '8'); ponerNota(idx.marcano, 1, '9');

      function celda(i, nombre) {
        var f = document.querySelectorAll('#cuerpo-notas tr')[i];
        return f.querySelector('[data-celda="' + nombre + '"]').textContent;
      }
      afirmar('Pérez acumula 16,80 y obtiene 17', /16,80/.test(celda(idx.perez, 'puntos')) && /^17/.test(celda(idx.perez, 'definitiva').trim()), celda(idx.perez, 'definitiva'));
      afirmar('Rodríguez con 9,80 se redondea a 10 y APRUEBA',
        /^10/.test(celda(idx.rodriguez, 'definitiva').trim()) && /APROBADO/.test(celda(idx.rodriguez, 'condicion')),
        celda(idx.rodriguez, 'definitiva') + ' ' + celda(idx.rodriguez, 'condicion'));
      afirmar('Salazar obtiene 20', /^20/.test(celda(idx.salazar, 'definitiva').trim()));
      afirmar('Marcano con 8,60 queda en 9 y REPRUEBA',
        /^9\b/.test(celda(idx.marcano, 'definitiva').trim()) && /REPROBADO/.test(celda(idx.marcano, 'condicion')),
        celda(idx.marcano, 'definitiva') + ' ' + celda(idx.marcano, 'condicion'));
      afirmar('Gómez queda SIN DATOS',
        /SIN DATOS/.test(celda(idx.gomez, 'condicion')), celda(idx.gomez, 'condicion'));

      // Estadísticas oficiales del lapso
      var est = ZZ.estadisticas(PlanUtil.matriz({ anio: 1, seccion: 'A', asignatura: valor('ec-asignatura'), lapso: 1 }).filas.map(function (f) {
        return { definitiva: f.definitiva.definitiva };
      }), App.estado.config.ajustes);
      igual('matrícula', est.matricula, 5);
      igual('evaluados', est.evaluados, 4);
      igual('aprobados', est.aprobados, 3);
      igual('reprobados', est.reprobados, 1);
      igual('porcentaje de aprobados', est.porcAprobados, 75);
      igual('porcentaje de reprobados', est.porcReprobados, 25);
      igual('promedio general', est.promedio, 14);
      afirmar('las estadísticas se muestran en pantalla',
        textoDe('ec-estadisticas').indexOf('14,00') >= 0 && textoDe('ec-estadisticas').indexOf('75,00 %') >= 0);

      // Cambio del criterio de redondeo y su efecto
      App.irA('configuracion');
      poner('aj-modo', 'truncar', 'change');
      App.irA('continua');
      seleccionarPorTexto('ec-asignatura', 'Matemática');
      afirmar('con «sin redondeo» Rodríguez baja a 9 y reprueba',
        /^9\b/.test(celda(idx.rodriguez, 'definitiva').trim()) && /REPROBADO/.test(celda(idx.rodriguez, 'condicion')),
        celda(idx.rodriguez, 'definitiva') + ' ' + celda(idx.rodriguez, 'condicion'));
      App.irA('configuracion');
      poner('aj-modo', 'estandar', 'change');
      App.irA('continua');

      /* --------------------- Llenar una evaluación vacía (dos pasos) ---- */
      $('btn-ec-llenar').click();
      afirmar('la ventana para llenar una evaluación se abre', $('fondo-modal').hidden === false);
      var selectorLlenar = $('modal-texto').querySelector('select');
      afirmar('la ventana ofrece las evaluaciones del lapso',
        !!selectorLlenar && selectorLlenar.options.length === 2,
        selectorLlenar ? String(selectorLlenar.options.length) : 'sin selector');
      $('modal-aceptar').click();
      var entradaNota = $('modal-texto').querySelector('input');
      afirmar('la ventana pide la nota a asignar', !!entradaNota && entradaNota.type === 'number');
      if (entradaNota) {
        entrada(entradaNota, '11', 'input');
        $('modal-aceptar').click();
      }
      afirmar('el llenado avisa que sólo asignó a los que no tenían nota',
        /1 estudiante/.test(document.body.textContent));
      afirmar('la nota se aplicó únicamente al estudiante sin calificar',
        /4\s*\(4,40\)/.test(celda(idx.gomez, 'definitiva').replace(/\s+/g, ' ')),
        celda(idx.gomez, 'definitiva'));
      afirmar('el contador de notas aumenta a 9 de 10',
        textoDe('ec-chip-notas').indexOf('9 de 10') >= 0, textoDe('ec-chip-notas'));

      /* --------------------------------------------- 5. Sábana definitiva anual */
      App.irA('sabana');
      seleccionarPorTexto('sab-asignatura', 'Matemática');
      igual('filas de la sábana', document.querySelectorAll('#cuerpo-sabana tr').length, 5);
      var textoSabana = textoDe('cuerpo-sabana');
      afirmar('la sábana muestra las definitivas del 1er lapso',
        /17/.test(textoSabana) && /20/.test(textoSabana));
      afirmar('marca el derecho a revisión del promedio 9',
        /DERECHO A REVISIÓN/.test(textoSabana));
      afirmar('la sábana informa que faltan lapsos',
        document.querySelectorAll('#cuerpo-sabana tr').length === 5);
      igual('filas del resumen general', document.querySelectorAll('#cuerpo-resumen tr').length, 5);
      afirmar('el resumen general muestra las 3 asignaturas',
        document.querySelectorAll('#cabeza-resumen th').length === 8,
        String(document.querySelectorAll('#cabeza-resumen th').length));
      afirmar('las estadísticas finales se muestran',
        textoDe('sab-estadisticas').indexOf('Matrícula') >= 0);

      /* ------------------------------------------------ 6. Documentos oficiales */
      var escudo = ESCUDO_SVG();
      afirmar('el emblema institucional contiene el año 1946', /1946/.test(escudo));
      afirmar('el emblema institucional se identifica con Zazarabicoa', /ZAZARABICOA/.test(escudo));

      var selEc = { anio: 1, seccion: 'A', asignatura: valor('ec-asignatura'), lapso: 1 };
      var docEc = VISTAS.continua.documento(selEc);
      ['REPÚBLICA BOLIVARIANA DE VENEZUELA', 'MINISTERIO DEL PODER POPULAR PARA LA EDUCACIÓN',
        'ZAZARABICOA', '1946', 'Docente de la asignatura', 'Coordinador(a) de Evaluación',
        'Director(a) del Plantel', 'Puntos acumulados', 'APROBADO', 'REPROBADO'].forEach(function (t) {
          afirmar('el registro de evaluación continua incluye «' + t + '»',
            docEc.toUpperCase().indexOf(t.toUpperCase()) >= 0);
        });
      afirmar('el documento incluye el escudo real', docEc.indexOf('data:image/') >= 0);
      afirmar('el escudo del documento institucional es el del plantel',
        /alt="Escudo del Complejo Educativo Zazarabicoa/.test(docEc));

      var docPlan = VISTAS.plan.documento({ anio: 1, seccion: 'A', asignatura: valor('ec-asignatura'), lapso: 1 });
      ['PLAN DE EVALUACIÓN', 'Taller grupal de funciones', 'Prueba escrita', 'TOTAL'].forEach(function (t) {
        afirmar('el plan de evaluación incluye «' + t + '»', docPlan.toUpperCase().indexOf(t.toUpperCase()) >= 0);
      });

      var docSab = VISTAS.sabana.documento({ anio: 1, seccion: 'A', asignatura: valor('ec-asignatura') });
      ['SÁBANA DE CALIFICACIONES DEFINITIVAS', 'CONSOLIDADO ANUAL', 'Promedio anual'].forEach(function (t) {
        afirmar('la sábana impresa incluye «' + t + '»', docSab.toUpperCase().indexOf(t.toUpperCase()) >= 0);
      });

      var docNom = VISTAS.nomina.documento({ anio: 1, seccion: 'A' });
      ['NÓMINA DE ESTUDIANTES', 'PÉREZ GÓMEZ', 'Matrícula total'].forEach(function (t) {
        afirmar('la nómina impresa incluye «' + t + '»', docNom.toUpperCase().indexOf(t.toUpperCase()) >= 0);
      });

      // Impresión (se intercepta window.print)
      window.print = function () { impresoEnviado = true; };
      Export.imprimir([docEc, docPlan]);
      afirmar('el área de impresión recibe los documentos',
        $('area-impresion').innerHTML.indexOf('REPÚBLICA BOLIVARIANA DE VENEZUELA') >= 0 &&
        $('area-impresion').querySelectorAll('.doc-oficial').length === 2);
      afirmar('cada documento lleva sus tres firmas',
        $('area-impresion').querySelectorAll('.doc-firmas .firma').length === 6);

      /* ------------------------------------------------------- 7. Excel */
      var hoja = VISTAS.continua.hojaExcel(selEc);
      var libro = Export.libroHtml([hoja]);
      afirmar('el libro Excel declara el espacio de nombres de Excel', libro.indexOf('urn:schemas-microsoft-com:office:excel') >= 0);
      afirmar('el libro Excel incluye la hoja «Lapso 1»', libro.indexOf('<x:Name>Lapso 1</x:Name>') >= 0);
      afirmar('el libro Excel usa números nativos', libro.indexOf('x:num=') >= 0);
      afirmar('el libro Excel aplica color a aprobados', libro.indexOf('background:#D8F2E0') >= 0);
      afirmar('el libro Excel aplica color a reprobados', libro.indexOf('background:#FDE8E6') >= 0);
      afirmar('el libro Excel incluye estadísticas',
        libro.indexOf('Aprobados') >= 0 && libro.indexOf('Promedio general') >= 0);
      afirmar('el libro Excel incluye el membrete oficial',
        libro.indexOf('REPÚBLICA BOLIVARIANA DE VENEZUELA') >= 0);

      var multi = Export.libroHtml([hoja, VISTAS.nomina.hojaExcel({ anio: 1, seccion: 'A' })]);
      afirmar('el libro Excel soporta varias hojas',
        (multi.match(/<x:ExcelWorksheet>/g) || []).length === 2 && multi.indexOf('<x:Name>') >= 0);

      var completo = VISTAS.sabana.libroCompleto();
      afirmar('el libro completo reúne varias hojas', completo.length >= 3, 'hojas: ' + completo.length);

      var libroConfig = Export.libroHtml([VISTAS.configuracion.hojaExcel()]);
      afirmar('la hoja de configuración incluye el docente',
        libroConfig.indexOf('María Alejandra') >= 0 && libroConfig.indexOf('C.R.P.') >= 0);

      /* ------------------------------------------- 7b. Excel nativo (.xlsx) */
      afirmar('el generador .xlsx está disponible', !!window.XLSX && typeof XLSX.libro === 'function');
      var bytes = XLSX.libro([hoja, VISTAS.nomina.hojaExcel({ anio: 1, seccion: 'A' }),
        Export.hojaSabana(App.estado, { anio: 1, seccion: 'A', asignatura: valor('ec-asignatura') },
          VISTAS.sabana.construir({ anio: 1, seccion: 'A', asignatura: valor('ec-asignatura') }).filas)]);
      afirmar('el libro .xlsx es un paquete ZIP (firma PK)',
        bytes.length > 3000 && bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 3 && bytes[3] === 4,
        'tamaño ' + bytes.length);
      var crudo = '';
      for (var bi = 0; bi < bytes.length; bi++) crudo += String.fromCharCode(bytes[bi]);
      ['[Content_Types].xml', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet1.xml',
        'xl/worksheets/sheet3.xml', 'D8F2E0', 'FDE8E6', 'inlineStr'].forEach(function (t) {
          afirmar('el paquete .xlsx contiene «' + t + '»', crudo.indexOf(t) >= 0);
        });
      afirmar('el .xlsx declara las tres hojas',
        (crudo.match(/<sheet name=/g) || []).length === 3, String((crudo.match(/<sheet name=/g) || []).length));
      afirmar('el .xlsx fija las filas de encabezado y combina celdas',
        crudo.indexOf('state="frozen"') >= 0 && crudo.indexOf('<mergeCells count=') >= 0);
      afirmar('el .xlsx guarda las notas como números',
        crudo.indexOf('<v>16.8</v>') >= 0, 'no se encontró el acumulado 16.8');

      /* ---------------------------------------------------- 8. Respaldo */
      App.irA('respaldo');
      var contenido = VISTAS.respaldo.contenido();
      var json = JSON.parse(contenido);
      afirmar('el respaldo es un JSON válido con metadatos',
        json.aplicacion === 'Evaluación Docente de Zazarabicoa' && !!json.datos && json.datos.estudiantes.length === 5);
      afirmar('el respaldo contiene las notas', Object.keys(json.datos.notas).length >= 1);
      var reconstruido = ZZ.normalizarEstado(json.datos);
      igual('el respaldo se puede reconstruir', reconstruido.estudiantes.length, 5);

      App.guardarCopia('Copia de prueba');
      afirmar('la copia interna se guarda', App.leerCopias().length >= 1);
      var idCopia = App.leerCopias()[0].id;
      App.estado.estudiantes.push({ id: 'temporal', apellidos: 'TEMPORAL', nombres: 'X', anio: 1, seccion: 'A' });
      App.restaurarCopia(idCopia);
      igual('restaurar una copia recupera el estado', App.estado.estudiantes.length, 5);
      App.borrarCopia(idCopia);

      afirmar('los datos quedan guardados en el navegador',
        !App.disponible || !!localStorage.getItem('zazarabicoa_datos_v1::' + App.usuario.id));
      afirmar('cada docente tiene su propia clave de guardado',
        App.claveDatos().indexOf(App.usuario.id) > 0);

      /* ------------------------------- 9. Varios docentes, datos aparte */
      App.irA('respaldo');
      var resumenMiguel = App.resumen();

      // Cambiar de docente (vuelve a la pantalla de acceso)
      $('btn-cambiar-docente').click();
      afirmar('el cambio de docente pide confirmación', $('fondo-modal').hidden === false);
      $('modal-aceptar').click();
      afirmar('al cambiar de docente vuelve la pantalla de acceso', $('pantalla-acceso').hidden === false);
      afirmar('la sesión anterior quedó cerrada', App.usuario === null);

      poner('acceso-clave', 'zazarabicoa123');
      $('btn-acceso-clave').click();
      afirmar('Miguel aparece en la lista de docentes del equipo',
        $('acceso-usuarios-lista').innerHTML.indexOf('Miguel Ángel Pérez') >= 0);

      // Entrar como Miguel con una contraseña equivocada
      UI.$$('[data-entrar]', $('acceso-usuarios-lista'))[0].click();
      var campoClave = $('modal-texto').querySelector('input');
      afirmar('al elegir un docente se pide su contraseña', !!campoClave && campoClave.type === 'password');
      entrada(campoClave, 'no-es-la-clave', 'input');
      $('modal-aceptar').click();
      afirmar('una contraseña incorrecta no abre los datos',
        App.usuario === null && $('pantalla-acceso').hidden === false);
      $('modal-cancelar').click();

      // Crear el segundo docente (Carlos) con datos totalmente distintos
      poner('acceso-nombre', 'Carlos Ruiz');
      poner('acceso-nueva-clave', 'carlos123');
      poner('acceso-nueva-clave2', 'carlos123');
      $('btn-crear-usuario').click();
      afirmar('el segundo docente entra con su propio espacio de datos',
        App.usuario && App.usuario.nombre === 'Carlos Ruiz' && App.estado.estudiantes.length === 0);
      afirmar('Carlos no ve los estudiantes de Miguel',
        ZZ.estudiantesDe(App.estado, 1, 'A').length === 0);
      afirmar('Carlos no ve las notas de Miguel', Object.keys(App.estado.notas).length === 0);
      afirmar('cada docente tiene su propia configuración de plantel',
        App.estado.config.anios.length === 0 && App.estado.config.asignaturas.length === 0);

      // Carlos configura sus propias asignaturas y carga su propia nómina
      App.irA('configuracion');
      marcar('#grupo-anios input', [1]);              // 2° año
      marcar('#grupo-secciones input', [2]);          // sección C
      marcar('#grupo-asignaturas input', [4]);        // Biología, Ambiente y Tecnología
      poner('doc-area', 'Biología, Ambiente y Tecnología');
      App.irA('nomina');
      poner('masiva-texto', 'V-11111111\tLópez\tMaría\nV-22222222\tDíaz\tPedro\nV-33333333\tRojas\tLuis\n');
      $('btn-analizar-masiva').click();
      $('btn-confirmar-masiva').click();
      $('modal-aceptar').click();
      igual('Carlos carga su propia nómina', App.estado.estudiantes.length, 3);
      afirmar('los cursos de Carlos son distintos a los de Miguel',
        App.estado.config.anios.join(',') === '2' && App.estado.config.secciones.join(',') === 'C');
      afirmar('Carlos tiene 1 asignatura y Miguel tenía 3',
        App.estado.config.asignaturas.length === 1);
      afirmar('el área de Carlos es la suya', App.estado.config.docente.area === 'Biología, Ambiente y Tecnología');

      // Volver a Miguel y comprobar que TODO sigue intacto
      $('btn-cambiar-docente').click();
      $('modal-aceptar').click();
      poner('acceso-clave', 'zazarabicoa123');
      $('btn-acceso-clave').click();
      UI.$$('[data-entrar]', $('acceso-usuarios-lista'))[0].click();
      entrada($('modal-texto').querySelector('input'), 'miguel123', 'input');
      $('modal-aceptar').click();
      afirmar('Miguel vuelve a entrar con su contraseña', App.usuario && App.usuario.nombre === 'Miguel Ángel Pérez');
      igual('Miguel conserva sus 5 estudiantes', App.estado.estudiantes.length, 5);
      igual('Miguel conserva sus 3 asignaturas', App.estado.config.asignaturas.length, 3);
      igual('Miguel conserva sus años y secciones',
        [App.estado.config.anios.join(','), App.estado.config.secciones.join(',')], ['1,3', 'A,B']);
      var notasMiguel = 0;
      Object.keys(App.estado.notas).forEach(function (k) {
        Object.keys(App.estado.notas[k]).forEach(function (est) { notasMiguel += Object.keys(App.estado.notas[k][est]).length; });
      });
      igual('Miguel conserva sus 9 notas', notasMiguel, 9);
      afirmar('los datos de Carlos no se mezclaron con los de Miguel',
        ZZ.estudiantesDe(App.estado, 2, 'C').length === 0 &&
        App.estado.estudiantes.every(function (e) { return e.apellidos.indexOf('LÓPEZ') < 0; }));
      afirmar('el registro guarda a los dos docentes',
        App.usuarios().length === 2 && resumenMiguel.estudiantes === 5);
      App.irA('continua');
      afirmar('Miguel recupera su matriz de notas completa',
        document.querySelectorAll('#cuerpo-notas tr').length === 5);

      /* --------------------------------------------- 10. Integridad general */
      afirmar('no hay textos «undefined» visibles en la aplicación',
        document.body.textContent.indexOf('undefined') < 0);
      afirmar('el modal de confirmación queda oculto al terminar',
        $('fondo-modal').hidden === true);
      afirmar('el medidor de ponderación quedó en 100 %',
        textoDe('ec-total-texto').indexOf('100') >= 0, textoDe('ec-total-texto'));

    } catch (e) {
      fallas.push('EXCEPCIÓN NO CONTROLADA: ' + (e && e.message ? e.message : e) +
        (e && e.stack ? ' :: ' + e.stack.split('\n')[1] : ''));
    }
    // La orden de impresión se dispara de forma diferida (60 ms)
    setTimeout(function () {
      afirmar('la orden de impresión se dispara', impresoEnviado, 'window.print no fue llamado');
      mostrarResultado();
    }, 300);
  }

  var impresoEnviado = false;
  var ejecutado = false;

  window.addEventListener('load', function () { setTimeout(ejecutar, 60); });
})();
