/* ============================================================================
   sabana.js — Módulo 5: sábana definitiva anual (consolidado de los 3 lapsos),
   resumen general por asignatura, estadísticas finales y libro Excel completo.
   ========================================================================== */
(function (raiz) {
  'use strict';

  var VISTAS = raiz.VISTAS = raiz.VISTAS || {};
  var IDS = { anio: 'sab-anio', seccion: 'sab-seccion', asignatura: 'sab-asignatura' };
  var TODAS = 'TODAS';

  function estado() { return App.estado; }
  function config() { return App.estado.config; }
  function seleccion() {
    return { anio: UI.valor(IDS.anio), seccion: UI.valor(IDS.seccion), asignatura: UI.valor(IDS.asignatura) };
  }

  function refrescarSelectores() {
    var anios = config().anios.map(function (n) { return { valor: n, texto: n + '° Año' }; });
    var secciones = config().secciones.map(function (s) { return { valor: s, texto: 'Sección «' + s + '»' }; });
    var asignaturas = config().asignaturas.map(function (a) { return { valor: a.id, texto: a.nombre }; });
    UI.llenarSelect(IDS.anio, anios.length ? anios : [{ valor: '', texto: '(sin años)' }]);
    UI.llenarSelect(IDS.seccion, secciones.length ? secciones : [{ valor: '', texto: '(sin secciones)' }]);
    UI.llenarSelect(IDS.asignatura, [{ valor: TODAS, texto: '★ TODAS LAS ASIGNATURAS (promedio)' }].concat(
      asignaturas.length ? asignaturas : [{ valor: '', texto: '(sin asignaturas)' }]
    ));
    App.aplicarContexto(IDS);
  }

  /* ══════════════════════════════ CÁLCULO ══════════════════════════════ */

  /** Definitiva por estudiante de una asignatura y lapso. */
  function mapaDefinitivas(anio, seccion, idAsignatura, lapso) {
    var sel = { anio: anio, seccion: seccion, asignatura: idAsignatura, lapso: lapso };
    var acts = PlanUtil.actividades(sel, false);
    var notas = ZZ.notasDe(estado(), sel);
    var salida = {};
    ZZ.estudiantesDe(estado(), anio, seccion).forEach(function (e) {
      var calc = ZZ.puntosDe(acts, notas[e.id] || {});
      salida[e.id] = calc ? ZZ.calcularDefinitiva(calc.puntos, config().ajustes).definitiva : null;
    });
    return salida;
  }

  function promedio(valores) {
    var v = valores.filter(function (x) { return x !== null && x !== undefined; });
    if (!v.length) return null;
    var s = 0;
    v.forEach(function (x) { s += x; });
    return ZZ.redondear(s / v.length, 2);
  }

  function construir(sel) {
    var estudiantes = ZZ.estudiantesDe(estado(), sel.anio, sel.seccion);
    var asignaturas = config().asignaturas;
    var todas = sel.asignatura === TODAS;

    // definitivas[estId][lapso] = número | null
    var mapa = {};
    estudiantes.forEach(function (e) { mapa[e.id] = {}; });

    if (todas) {
      ZZ.LAPSOS.forEach(function (l) {
        var parciales = {};
        estudiantes.forEach(function (e) { parciales[e.id] = []; });
        asignaturas.forEach(function (a) {
          var m = mapaDefinitivas(sel.anio, sel.seccion, a.id, l.n);
          estudiantes.forEach(function (e) {
            if (m[e.id] !== null && m[e.id] !== undefined) parciales[e.id].push(m[e.id]);
          });
        });
        estudiantes.forEach(function (e) { mapa[e.id][l.n] = promedio(parciales[e.id]); });
      });
    } else {
      ZZ.LAPSOS.forEach(function (l) {
        var m = mapaDefinitivas(sel.anio, sel.seccion, sel.asignatura, l.n);
        estudiantes.forEach(function (e) { mapa[e.id][l.n] = (m[e.id] === undefined ? null : m[e.id]); });
      });
    }

    var filas = estudiantes.map(function (e) {
      var porLapso = { 1: mapa[e.id][1], 2: mapa[e.id][2], 3: mapa[e.id][3] };
      return { estudiante: e, consolidado: ZZ.consolidarAnual(porLapso, config().ajustes) };
    });

    return {
      seleccion: sel,
      todas: todas,
      filas: filas,
      estadisticas: ZZ.estadisticas(filas.map(function (f) { return { definitiva: f.consolidado.definitiva }; }), config().ajustes)
    };
  }

  /** Resumen general: promedio anual de cada estudiante en cada asignatura. */
  function construirResumen(sel) {
    var estudiantes = ZZ.estudiantesDe(estado(), sel.anio, sel.seccion);
    var asignaturas = config().asignaturas;
    var filas = estudiantes.map(function (e) {
      var porAsignatura = {}, celdas = [];
      asignaturas.forEach(function (a) {
        var porLapso = {};
        ZZ.LAPSOS.forEach(function (l) {
          var m = mapaDefinitivas(sel.anio, sel.seccion, a.id, l.n);
          porLapso[l.n] = (m[e.id] === undefined ? null : m[e.id]);
        });
        var c = ZZ.consolidarAnual(porLapso, config().ajustes);
        porAsignatura[a.id] = c;
        celdas.push({ asignatura: a, consolidado: c });
      });
      return { estudiante: e, celdas: celdas, general: ZZ.consolidarGeneral(porAsignatura, config().ajustes) };
    });
    var conDatos = filas.filter(function (f) { return f.general.definitiva !== null; });
    return {
      asignaturas: asignaturas,
      filas: filas,
      estadisticas: ZZ.estadisticas(conDatos.map(function (f) { return { definitiva: f.general.definitiva }; }), config().ajustes)
    };
  }

  /* ══════════════════════════════ PINTADO ══════════════════════════════ */

  function render() {
    refrescarSelectores();
    pintarSabana();
    pintarResumen();
  }

  function pintarSabana() {
    var sel = seleccion();
    var cabeza = UI.$('cabeza-sabana');
    var cuerpo = UI.$('cuerpo-sabana');
    var pie = UI.$('pie-sabana');
    if (!cabeza || !cuerpo) return;

    if (!sel.anio || !sel.seccion || !sel.asignatura) {
      cabeza.innerHTML = '';
      cuerpo.innerHTML = '<tr><td class="sin-datos">Complete la configuración inicial (años, secciones y asignaturas) en la pestaña 1.</td></tr>';
      if (pie) pie.innerHTML = '';
      pintarEstadisticas('sab-estadisticas', null, sel);
      return;
    }

    var datos = construir(sel);
    cabeza.innerHTML = '<tr>' +
      '<th class="col-num">N°</th>' +
      '<th style="min-width:100px">Cédula</th>' +
      '<th class="celda-fija" style="min-width:240px">Apellidos y nombres</th>' +
      '<th class="celda-num">1er Lapso</th><th class="celda-num">2do Lapso</th><th class="celda-num">3er Lapso</th>' +
      '<th class="celda-num" style="min-width:110px">Promedio anual</th>' +
      '<th class="celda-num" style="min-width:120px">Calificación definitiva final</th>' +
      '<th class="celda-num" style="min-width:170px">Condición final</th></tr>';

    if (!datos.filas.length) {
      cuerpo.innerHTML = '<tr><td colspan="9" class="sin-datos">No hay estudiantes registrados en ' +
        sel.anio + '° Año, sección «' + UI.esc(sel.seccion) + '».</td></tr>';
    } else {
      cuerpo.innerHTML = datos.filas.map(function (f, i) {
        var c = f.consolidado;
        var clase = c.condicion === 'APROBADO' ? 'aprobado' : (c.revision ? 'revision' : (c.definitiva === null ? '' : 'reprobado'));
        var textoCond = c.definitiva === null ? 'SIN DATOS' : c.condicion + (c.parcial ? ' (parcial: falta ' + c.faltantes.map(function (n) { return ZZ.tituloLapso(n); }).join(', ') + ')' : '');
        return '<tr>' +
          '<td class="celda-num">' + (i + 1) + '</td>' +
          '<td>' + UI.esc(f.estudiante.cedula || '') + '</td>' +
          '<td class="celda-fija"><b>' + UI.esc(f.estudiante.apellidos) + '</b> ' + UI.esc(f.estudiante.nombres) + '</td>' +
          celdaNota(c.l1) + celdaNota(c.l2) + celdaNota(c.l3) +
          '<td class="celda-num"><b>' + (c.promedio === null ? '—' : ZZ.fmt2(c.promedio)) + '</b></td>' +
          '<td class="celda-num ' + clase + '">' + (c.definitiva === null ? '—' : ZZ.fmtNota(c.definitiva)) + '</td>' +
          '<td class="' + clase + '">' + UI.esc(textoCond) + '</td></tr>';
      }).join('');
    }

    if (pie) {
      var e = datos.estadisticas;
      pie.innerHTML = '<tr><td colspan="6" style="text-align:right">PROMEDIO DEL CURSO POR LAPSO / GENERAL</td>' +
        '<td class="celda-num">' + ZZ.fmt2(e.promedio) + '</td>' +
        '<td class="celda-num">' + e.aprobados + ' aprob. / ' + e.reprobados + ' reprob.</td>' +
        '<td>' + ZZ.fmtPct(e.porcAprobados) + ' aprobados</td></tr>';
    }
    pintarEstadisticas('sab-estadisticas', datos.estadisticas, sel);
  }

  function celdaNota(v) {
    if (v === null || v === undefined) return '<td class="celda-num sin-datos">—</td>';
    return '<td class="celda-num">' + ZZ.fmtNota(v) + '</td>';
  }

  function pintarResumen() {
    var sel = seleccion();
    var cabeza = UI.$('cabeza-resumen');
    var cuerpo = UI.$('cuerpo-resumen');
    if (!cabeza || !cuerpo) return;

    if (!sel.anio || !sel.seccion || !config().asignaturas.length) {
      cabeza.innerHTML = '';
      cuerpo.innerHTML = '<tr><td class="sin-datos">Configure años, secciones y asignaturas para ver el resumen general.</td></tr>';
      return;
    }

    var datos = construirResumen(sel);
    cabeza.innerHTML = '<tr><th class="col-num">N°</th>' +
      '<th class="celda-fija" style="min-width:240px">Apellidos y nombres</th>' +
      datos.asignaturas.map(function (a) {
        return '<th class="celda-num" title="' + UI.esc(a.nombre) + '">' + UI.esc(recortar(a.nombre, 14)) + '</th>';
      }).join('') +
      '<th class="celda-num" style="min-width:110px">Promedio general</th>' +
      '<th class="celda-num">Definitiva</th>' +
      '<th class="celda-num" style="min-width:130px">Condición</th></tr>';

    if (!datos.filas.length) {
      cuerpo.innerHTML = '<tr><td colspan="' + (datos.asignaturas.length + 5) + '" class="sin-datos">Sin estudiantes en este curso.</td></tr>';
      return;
    }
    cuerpo.innerHTML = datos.filas.map(function (f, i) {
      var g = f.general;
      var clase = g.condicion === 'APROBADO' ? 'aprobado' : (g.definitiva === null ? '' : 'reprobado');
      return '<tr>' +
        '<td class="celda-num">' + (i + 1) + '</td>' +
        '<td class="celda-fija"><b>' + UI.esc(f.estudiante.apellidos) + '</b> ' + UI.esc(f.estudiante.nombres) + '</td>' +
        f.celdas.map(function (c) {
          if (c.consolidado.definitiva === null) return '<td class="celda-num sin-datos">—</td>';
          return '<td class="celda-num ' + (c.consolidado.condicion === 'APROBADO' ? 'aprobado' : (c.consolidado.revision ? 'revision' : 'reprobado')) +
            '" title="' + UI.esc(c.asignatura.nombre + ' — promedio ' + ZZ.fmt2(c.consolidado.promedio)) + '">' +
            ZZ.fmtNota(c.consolidado.definitiva) + '</td>';
        }).join('') +
        '<td class="celda-num"><b>' + (g.promedio === null ? '—' : ZZ.fmt2(g.promedio)) + '</b></td>' +
        '<td class="celda-num ' + clase + '">' + (g.definitiva === null ? '—' : ZZ.fmtNota(g.definitiva)) + '</td>' +
        '<td class="' + clase + '">' + (g.definitiva === null ? 'SIN DATOS' : g.condicion) + '</td></tr>';
    }).join('');
  }

  function recortar(t, n) {
    var s = String(t || '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  function pintarEstadisticas(idCaja, est, sel) {
    var caja = UI.$(idCaja);
    if (!caja) return;
    if (!est) { caja.innerHTML = '<p class="ayuda">Sin datos para mostrar.</p>'; return; }
    var tarjetas = [
      { r: 'Matrícula total', v: est.matricula, c: '' },
      { r: 'Con calificación definitiva', v: est.evaluados, c: '' },
      { r: 'Aprobados', v: est.aprobados, c: 'verde', extra: ZZ.fmtPct(est.porcAprobados) + ' de los evaluados' },
      { r: 'Reprobados', v: est.reprobados, c: 'roja', extra: ZZ.fmtPct(est.porcReprobados) + ' de los evaluados' },
      { r: 'Promedio general del curso', v: ZZ.fmt2(est.promedio), c: 'ambar', extra: 'sobre ' + ZZ.fmtNota(config().ajustes.escalaMax) + ' puntos' },
      { r: 'Sin calificación', v: Math.max(0, est.matricula - est.evaluados), c: '' }
    ];
    caja.innerHTML = tarjetas.map(function (t) {
      return '<div class="estadistica ' + t.c + '"><div class="valor">' + t.v + '</div>' +
        '<div class="rotulo">' + t.r + '</div>' +
        (t.extra ? '<div class="ayuda" style="margin:2px 0 0">' + t.extra + '</div>' : '') + '</div>';
    }).join('');
  }

  /* ══════════════════════════════ EVENTOS ══════════════════════════════ */

  function iniciar() {
    [IDS.anio, IDS.seccion, IDS.asignatura].forEach(function (id) {
      var el = UI.$(id);
      if (el) el.addEventListener('change', function () {
        App.recordarContexto(seleccion());
        pintarSabana();
        pintarResumen();
      });
    });

    var txt = UI.$('sab-revision-texto');
    if (txt) txt.textContent = ZZ.fmt2(config().ajustes.revisionDesde);

    var btnOrdenar = UI.$('btn-sab-ordenar');
    if (btnOrdenar) btnOrdenar.addEventListener('click', function () {
      if (VISTAS.nomina && VISTAS.nomina.ordenar) VISTAS.nomina.ordenar();
      App.cambio('sabana');
      pintarSabana(); pintarResumen();
      UI.avisoFlotante('Estudiantes ordenados por apellidos.');
    });

    var btnOrdenarNota = UI.$('btn-sab-ordenar-nota');
    if (btnOrdenarNota) btnOrdenarNota.addEventListener('click', function () {
      var sel = seleccion();
      var datos = construir(sel);
      var orden = datos.filas.slice().sort(function (a, b) {
        var va = a.consolidado.definitiva === null ? -1 : a.consolidado.definitiva;
        var vb = b.consolidado.definitiva === null ? -1 : b.consolidado.definitiva;
        return vb - va;
      });
      var e = estado(), ids = orden.map(function (f) { return f.estudiante.id; });
      var porId = {}; e.estudiantes.forEach(function (x) { porId[x.id] = x; });
      e.estudiantes = e.estudiantes.filter(function (x) { return ids.indexOf(x.id) < 0; })
        .concat(ids.map(function (id) { return porId[id]; }));
      App.cambio('sabana');
      pintarSabana(); pintarResumen();
      UI.avisoFlotante('Sábana ordenada de mayor a menor calificación.');
    });

    var btnImp = UI.$('btn-sab-imprimir');
    if (btnImp) btnImp.addEventListener('click', function () {
      var sel = seleccion();
      if (!sel.anio || !sel.seccion) { UI.avisoFlotante('Seleccione año y sección.', 'error'); return; }
      Export.imprimir(documentoSabana(sel));
    });

    var btnXls = UI.$('btn-sab-excel');
    if (btnXls) btnXls.addEventListener('click', function () {
      var sel = seleccion();
      if (!sel.anio || !sel.seccion) { UI.avisoFlotante('Seleccione año y sección.', 'error'); return; }
      Export.excel('Zazarabicoa-Sabana-' + sel.anio + sel.seccion + '-' + UI.selloArchivo() + '.xls', [
        Export.hojaSabana(estado(), sel, construir(sel).filas),
        hojaResumenGeneral(sel)
      ]);
    });

    var btnTodo = UI.$('btn-sab-todo-excel');
    if (btnTodo) btnTodo.addEventListener('click', function () {
      var hojas = libroCompleto();
      if (hojas.length < 2) { UI.avisoFlotante('Todavía no hay datos suficientes para exportar el libro completo.', 'error'); return; }
      Export.excel('Zazarabicoa-Libro-Completo-' + UI.selloArchivo() + '.xls', hojas);
      UI.avisoFlotante('Libro completo exportado con ' + hojas.length + ' hojas.');
    });

    App.alCambiar(function (motivo) {
      if (motivo === 'reemplazado' || motivo === 'restaurado') { refrescarSelectores(); pintarSabana(); pintarResumen(); }
      var txt2 = UI.$('sab-revision-texto');
      if (txt2) txt2.textContent = ZZ.fmt2(config().ajustes.revisionDesde);
    });
  }

  /* ══════════════════════ DOCUMENTO Y HOJAS DE CÁLCULO ══════════════════ */

  function tituloAsignatura(sel) {
    return sel.asignatura === TODAS ? 'TODAS LAS ASIGNATURAS (promedio general)' : ZZ.nombreAsignatura(estado(), sel.asignatura);
  }

  function documentoSabana(sel) {
    var datos = construir(sel);
    var est = datos.estadisticas;
    var i = config().institucion;

    var filas = datos.filas.map(function (f, n) {
      var c = f.consolidado;
      var clase = c.condicion === 'APROBADO' ? 'aprobado' : (c.definitiva === null ? '' : 'reprobado');
      return '<tr class="' + clase + '"><td class="c">' + (n + 1) + '</td>' +
        '<td class="c chico">' + UI.esc(f.estudiante.cedula || '') + '</td>' +
        '<td class="chico">' + UI.esc(f.estudiante.apellidos + ' ' + f.estudiante.nombres) + '</td>' +
        '<td class="c">' + (c.l1 === null ? '' : ZZ.fmtNota(c.l1)) + '</td>' +
        '<td class="c">' + (c.l2 === null ? '' : ZZ.fmtNota(c.l2)) + '</td>' +
        '<td class="c">' + (c.l3 === null ? '' : ZZ.fmtNota(c.l3)) + '</td>' +
        '<td class="c">' + (c.promedio === null ? '' : ZZ.fmt2(c.promedio)) + '</td>' +
        '<td class="c"><b>' + (c.definitiva === null ? '' : ZZ.fmtNota(c.definitiva)) + '</b></td>' +
        '<td class="c chico">' + (c.definitiva === null ? 'SIN DATOS' : c.condicion) + '</td></tr>';
    }).join('');

    return '<div class="doc-oficial doc-horizontal">' + Export.membrete() +
      '<h2 class="doc-titulo">Sábana de calificaciones definitivas — consolidado anual</h2>' +
      '<p class="doc-subtitulo">' + UI.esc(i.anioEscolar || '') + ' &middot; ' + sel.anio +
      '° Año de Educación Media General, sección «' + UI.esc(sel.seccion) + '»</p>' +
      Export.ficha([
        ['Asignatura', tituloAsignatura(sel)],
        ['Docente', ZZ.nombreDocente(config())],
        ['Cédula del docente', (config().docente.cedulaTipo || 'V') + '-' + (config().docente.cedula || '')],
        ['Lapsos', '1er, 2do y 3er Lapso']
      ]) +
      '<table class="tabla-doc"><thead><tr>' +
      '<th style="width:4%">N°</th><th style="width:9%">Cédula</th><th style="width:22%">Apellidos y nombres</th>' +
      '<th style="width:7%">1er Lapso</th><th style="width:7%">2do Lapso</th><th style="width:7%">3er Lapso</th>' +
      '<th style="width:9%">Promedio anual</th><th style="width:9%">Calif. definitiva</th>' +
      '<th style="width:16%">Condición final</th></tr></thead><tbody>' +
      (filas || '<tr><td colspan="9" class="c">Sin estudiantes registrados</td></tr>') +
      '</tbody></table>' +
      '<table class="doc-estadisticas"><tr>' +
      '<td><span class="rotulo">Matrícula</span><span class="valor">' + est.matricula + '</span></td>' +
      '<td><span class="rotulo">Evaluados</span><span class="valor">' + est.evaluados + '</span></td>' +
      '<td><span class="rotulo">Aprobados</span><span class="valor">' + est.aprobados + '</span><span class="rotulo">' + ZZ.fmtPct(est.porcAprobados) + '</span></td>' +
      '<td><span class="rotulo">Reprobados</span><span class="valor">' + est.reprobados + '</span><span class="rotulo">' + ZZ.fmtPct(est.porcReprobados) + '</span></td>' +
      '<td><span class="rotulo">Promedio general</span><span class="valor">' + ZZ.fmt2(est.promedio) + '</span></td>' +
      '</tr></table>' +
      '<p class="doc-leyenda">Promedio anual = media de las calificaciones definitivas de los 3 lapsos. ' +
      'Calificación definitiva final según el criterio de redondeo configurado. ' +
      'La condición <b>REPROBADO / DERECHO A REVISIÓN</b> se asigna cuando el promedio anual es igual o superior a ' +
      ZZ.fmt2(config().ajustes.revisionDesde) + ' y menor que la nota mínima aprobatoria (' + ZZ.fmtNota(config().ajustes.minima) + ' puntos).</p>' +
      '<p class="doc-nota-pie">Los porcentajes se calculan sobre los estudiantes con calificación definitiva. Generado el ' +
      UI.fechaLarga() + '.</p>' +
      Export.firmas() + '</div>';
  }

  function hojaResumenGeneral(sel) {
    var datos = construirResumen(sel);
    var enc = Export.encabezadoExcel('RESUMEN GENERAL ANUAL POR ASIGNATURA');
    var columnas = ['N°', 'Cédula', 'Apellidos y nombres'].concat(
      datos.asignaturas.map(function (a) { return recortar(a.nombre, 20); })
    ).concat(['Promedio general', 'Calificación definitiva', 'Condición']);
    var filas = datos.filas.map(function (f, n) {
      var fila = [n + 1, f.estudiante.cedula || '', ZZ.nombreCompleto(f.estudiante)];
      f.celdas.forEach(function (c) {
        fila.push(c.consolidado.definitiva === null ? { v: '', c: 'sin' } :
          { v: c.consolidado.definitiva, c: c.consolidado.condicion === 'APROBADO' ? 'aprobado' : (c.consolidado.revision ? 'revision' : 'reprobado') });
      });
      fila.push(f.general.promedio === null ? '' : f.general.promedio);
      fila.push({
        v: f.general.definitiva === null ? '' : f.general.definitiva,
        c: f.general.condicion === 'APROBADO' ? 'aprobado' : (f.general.definitiva === null ? '' : 'reprobado')
      });
      fila.push({
        v: f.general.definitiva === null ? 'SIN DATOS' : f.general.condicion,
        c: f.general.condicion === 'APROBADO' ? 'aprobado' : (f.general.definitiva === null ? '' : 'reprobado')
      });
      return fila;
    });
    var est = datos.estadisticas;
    return {
      nombre: 'Resumen general ' + sel.anio + sel.seccion,
      titulo: enc.titulo,
      subtitulos: enc.subtitulos.concat([
        'Año: ' + sel.anio + '°  |  Sección: «' + sel.seccion + '»  |  Promedios anuales por asignatura'
      ]),
      columnas: columnas,
      anchos: [40, 105, 240].concat(datos.asignaturas.map(function () { return 90; })).concat([100, 100, 130]),
      filas: filas,
      pie: ['Matrícula: ' + est.matricula + '   |   Con calificación: ' + est.evaluados +
        '   |   Aprobados: ' + est.aprobados + ' (' + ZZ.fmtPct(est.porcAprobados) + ')' +
        '   |   Reprobados: ' + est.reprobados + ' (' + ZZ.fmtPct(est.porcReprobados) + ')' +
        '   |   Promedio general: ' + ZZ.fmt2(est.promedio)],
      nota: 'El promedio general del estudiante es la media de los promedios anuales de todas las asignaturas con datos.'
    };
  }

  /** Libro Excel con toda la información registrada. */
  function libroCompleto() {
    var e = estado();
    var hojas = [];
    if (VISTAS.configuracion) hojas.push(VISTAS.configuracion.hojaExcel());
    var anios = config().anios.length ? config().anios : [];
    var secciones = config().secciones.length ? config().secciones : [];

    anios.forEach(function (anio) {
      secciones.forEach(function (seccion) {
        var hayAlumnos = ZZ.estudiantesDe(e, anio, seccion).length > 0;
        if (hayAlumnos && VISTAS.nomina) hojas.push(VISTAS.nomina.hojaExcel({ anio: anio, seccion: seccion }));
      });
    });

    anios.forEach(function (anio) {
      secciones.forEach(function (seccion) {
        config().asignaturas.forEach(function (a) {
          ZZ.LAPSOS.forEach(function (l) {
            var sel = { anio: anio, seccion: seccion, asignatura: a.id, lapso: l.n };
            var acts = PlanUtil.actividades(sel, false);
            var notas = ZZ.notasDe(e, sel);
            var hayNotas = Object.keys(notas).some(function (k) { return Object.keys(notas[k]).length; });
            if (acts.length || hayNotas) hojas.push(VISTAS.continua.hojaExcel(sel));
          });
        });
      });
    });

    anios.forEach(function (anio) {
      secciones.forEach(function (seccion) {
        config().asignaturas.forEach(function (a) {
          var sel = { anio: anio, seccion: seccion, asignatura: a.id };
          var datos = construir(sel);
          var conDatos = datos.filas.some(function (f) { return f.consolidado.definitiva !== null; });
          if (conDatos) hojas.push(Export.hojaSabana(e, sel, datos.filas));
        });
        var h = hojaResumenGeneral({ anio: anio, seccion: seccion });
        if (h && h.filas.length) hojas.push(h);
      });
    });

    return hojas;
  }

  VISTAS.sabana = {
    render: render,
    iniciar: iniciar,
    refrescarSelectores: refrescarSelectores,
    documento: documentoSabana,
    hojaExcel: function (sel) { return Export.hojaSabana(estado(), sel, construir(sel).filas); },
    resumen: construirResumen,
    hojaResumen: hojaResumenGeneral,
    libroCompleto: libroCompleto,
    construir: construir,
    TODAS: TODAS
  };
})(typeof window !== 'undefined' ? window : globalThis);
