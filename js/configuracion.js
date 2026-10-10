/* ============================================================================
   configuracion.js — Módulo 1: datos del docente, del plantel, años que
   atiende, secciones, asignaturas y criterios de evaluación.
   ========================================================================== */
(function (raiz) {
  'use strict';

  var VISTAS = raiz.VISTAS = raiz.VISTAS || {};

  var CAMPOS_DOCENTE = [
    ['doc-nombres', 'nombres'], ['doc-apellidos', 'apellidos'],
    ['doc-cedula', 'cedula'], ['doc-telefono', 'telefono'],
    ['doc-correo', 'correo'], ['doc-area', 'area']
  ];

  var CAMPOS_INSTITUCION = [
    ['inst-nombre', 'nombre'], ['inst-fundado', 'fundado'], ['inst-dea', 'codigoDEA'],
    ['inst-circuito', 'circuito'], ['inst-municipio', 'municipio'], ['inst-estado', 'estado'],
    ['inst-anio', 'anioEscolar'], ['inst-director', 'director'],
    ['inst-coordinador', 'coordinador'], ['inst-coordinador2', 'coordinador2']
  ];

  var CAMPOS_AJUSTES = [
    ['aj-minima', 'minima', 'numero'], ['aj-umbral', 'umbral', 'numero'],
    ['aj-revision', 'revisionDesde', 'numero'], ['aj-escala', 'escalaMax', 'numero']
  ];

  var SECCIONES_SUGERIDAS = ['A', 'B', 'C', 'D', 'E', 'F'];

  function estado() { return App.estado; }
  function config() { return App.estado.config; }

  /* ══════════════════════════════ PINTADO ══════════════════════════════ */

  function pintarCampos() {
    var d = config().docente, i = config().institucion;
    CAMPOS_DOCENTE.forEach(function (p) { UI.ponerValor(p[0], d[p[1]]); });
    CAMPOS_INSTITUCION.forEach(function (p) { UI.ponerValor(p[0], i[p[1]]); });
    UI.seleccionar('doc-cedula-tipo', d.cedulaTipo || 'V');
    CAMPOS_AJUSTES.forEach(function (p) { UI.ponerValor(p[0], config().ajustes[p[1]]); });
    UI.llenarSelect('aj-modo', ZZ.MODOS_REDONDEO.map(function (m) {
      return { valor: m.id, texto: m.titulo };
    }), config().ajustes.modoRedondeo);
    pintarAyudaRedondeo();
    pintarAreas();
  }

  /** Sugerencias del área de desempeño: las 10 asignaturas de la institución
      más las adicionales que el docente haya agregado. */
  function pintarAreas() {
    var lista = UI.$('lista-areas');
    if (!lista) return;
    lista.innerHTML = ZZ.areasDisponibles(config()).map(function (a) {
      return '<option value="' + UI.esc(a) + '"></option>';
    }).join('');
  }

  function pintarAyudaRedondeo() {
    var m = ZZ.MODOS_REDONDEO.filter(function (x) { return x.id === config().ajustes.modoRedondeo; })[0];
    var caja = UI.$('ayuda-redondeo');
    if (!caja || !m) return;
    caja.innerHTML = '<b>' + UI.esc(m.detalle) + '</b><br>' +
      'Nota mínima aprobatoria: ' + ZZ.fmtNota(config().ajustes.minima) + ' pts · ' +
      'Umbral de redondeo: ' + ZZ.fmtNota(config().ajustes.umbral) + ' · ' +
      'Escala vigesimal 01–' + ZZ.fmtNota(config().ajustes.escalaMax) + ' puntos. ' +
      'El cálculo de los puntos acumulados siempre se hace con decimales exactos ' +
      '(Σ nota × % ÷ 100) y el redondeo se aplica únicamente a la calificación definitiva.';
  }

  function pintarAños() {
    var cont = UI.$('grupo-anios');
    if (!cont) return;
    cont.innerHTML = '';
    [1, 2, 3, 4, 5].forEach(function (n) {
      var marcada = config().anios.indexOf(n) >= 0;
      var lbl = document.createElement('label');
      lbl.className = 'opcion' + (marcada ? ' marcada' : '');
      lbl.innerHTML = '<input type="checkbox" ' + (marcada ? 'checked' : '') + '> ' + n + '° Año';
      lbl.querySelector('input').addEventListener('change', function (ev) {
        var lista = config().anios.slice();
        if (ev.target.checked) { if (lista.indexOf(n) < 0) lista.push(n); }
        else lista = lista.filter(function (x) { return x !== n; });
        config().anios = lista.sort(function (a, b) { return a - b; });
        App.cambio('config-anios');
        App.refrescarSelectores();
        pintarAños();
      });
      cont.appendChild(lbl);
    });
  }

  function pintarSecciones() {
    var cont = UI.$('grupo-secciones');
    if (!cont) return;
    cont.innerHTML = '';
    var candidatas = ZZ.limpiar(SECCIONES_SUGERIDAS.concat(config().secciones).join(' ')).split(' ')
      .filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; });
    candidatas.forEach(function (s) {
      var marcada = config().secciones.indexOf(s) >= 0;
      var lbl = document.createElement('label');
      lbl.className = 'opcion' + (marcada ? ' marcada' : '');
      lbl.innerHTML = '<input type="checkbox" ' + (marcada ? 'checked' : '') + '> Sección «' + UI.esc(s) + '»';
      lbl.querySelector('input').addEventListener('change', function (ev) {
        if (ev.target.checked) {
          if (config().secciones.indexOf(s) < 0) config().secciones.push(s);
          config().secciones.sort();
          App.cambio('config-secciones');
          App.refrescarSelectores();
          pintarSecciones();
        } else {
          var afectados = estado().estudiantes.filter(function (e) { return String(e.seccion) === String(s); });
          var quitar = function () {
            config().secciones = config().secciones.filter(function (x) { return x !== s; });
            App.cambio('config-secciones');
            App.refrescarSelectores();
            pintarSecciones();
          };
          if (afectados.length) {
            UI.confirmar('Quitar la sección «' + s + '»',
              'Hay ' + afectados.length + ' estudiante(s) registrado(s) en esta sección. ' +
              'La sección saldrá de la lista, pero los estudiantes conservarán el dato. ¿Continuar?',
              quitar, { aceptar: 'Sí, quitar', peligro: true });
            ev.target.checked = true;
          } else quitar();
        }
      });
      cont.appendChild(lbl);
    });
  }

  function pintarAsignaturas() {
    var cont = UI.$('grupo-asignaturas');
    if (!cont) return;
    cont.innerHTML = '';
    var elegidas = config().asignaturas;
    pintarAreas();

    function fila(nombre, id, oficial) {
      var marcada = elegidas.some(function (a) { return a.id === id; });
      var lbl = document.createElement('label');
      lbl.className = 'opcion' + (marcada ? ' marcada' : '');
      lbl.innerHTML = '<input type="checkbox" ' + (marcada ? 'checked' : '') + '> ' +
        (oficial ? '' : '⭐ ') + UI.esc(nombre);
      lbl.querySelector('input').addEventListener('change', function (ev) {
        if (ev.target.checked) {
          if (!elegidas.some(function (a) { return a.id === id; })) {
            elegidas.push({ id: id, nombre: nombre, oficial: !!oficial });
          }
        } else {
          config().asignaturas = elegidas.filter(function (a) { return a.id !== id; });
          limpiaPlanesDe(id);
        }
        App.cambio('config-asignaturas');
        App.refrescarSelectores();
        pintarAsignaturas();
      });
      cont.appendChild(lbl);
    }

    ZZ.ASIGNATURAS_OFICIALES.forEach(function (nombre, i) { fila(nombre, 'of' + (i + 1), true); });
    elegidas.filter(function (a) { return !a.oficial; }).forEach(function (a) { fila(a.nombre, a.id, false); });

    var etiquetas = UI.$('lista-asignaturas-elegidas');
    if (etiquetas) {
      etiquetas.innerHTML = elegidas.length
        ? elegidas.map(function (a) {
          return '<span class="etiqueta ' + (a.oficial ? 'oficial' : 'propia') + '">' + UI.esc(a.nombre) +
            (a.oficial ? '' : ' <span class="quitar" data-quitar-asig="' + a.id + '" title="Eliminar asignatura">✕</span>') + '</span>';
        }).join('')
        : '<span class="ayuda">Todavía no ha seleccionado asignaturas.</span>';
      UI.$$('[data-quitar-asig]', etiquetas).forEach(function (x) {
        x.addEventListener('click', function () {
          var id = x.getAttribute('data-quitar-asig');
          config().asignaturas = config().asignaturas.filter(function (a) { return a.id !== id; });
          limpiaPlanesDe(id);
          App.cambio('config-asignaturas');
          App.refrescarSelectores();
          pintarAsignaturas();
        });
      });
    }
  }

  /** Al quitar una asignatura se descartan sus planes y notas. */
  function limpiaPlanesDe(idAsignatura) {
    var e = estado();
    Object.keys(e.planes).forEach(function (k) {
      if (ZZ.partesClave(k).asignatura === idAsignatura) delete e.planes[k];
    });
    Object.keys(e.notas).forEach(function (k) {
      if (ZZ.partesClave(k).asignatura === idAsignatura) delete e.notas[k];
    });
  }

  function render() {
    pintarCampos();
    pintarAños();
    pintarSecciones();
    pintarAsignaturas();
  }

  /* ══════════════════════════════ EVENTOS ══════════════════════════════ */

  function iniciar() {
    CAMPOS_DOCENTE.forEach(function (p) {
      var el = UI.$(p[0]);
      if (!el) return;
      el.addEventListener('input', function () {
        config().docente[p[1]] = ZZ.limpiar(el.value);
        App.cambio('config-docente', { redibujar: false });
      });
      el.addEventListener('blur', function () { App.guardar(true); });
    });

    var tipo = UI.$('doc-cedula-tipo');
    if (tipo) tipo.addEventListener('change', function () {
      config().docente.cedulaTipo = tipo.value;
      App.cambio('config-docente', { redibujar: false });
    });

    var ced = UI.$('doc-cedula');
    if (ced) ced.addEventListener('blur', function () {
      var n = ZZ.normalizarCedula(ced.value);
      if (n.numero) {
        ced.value = (n.tipo ? n.tipo + '-' : '') + ZZ.agruparMiles(n.numero);
        config().docente.cedula = ZZ.agruparMiles(n.numero);
        if (n.tipo) { config().docente.cedulaTipo = n.tipo; UI.seleccionar('doc-cedula-tipo', n.tipo); }
      }
      App.cambio('config-docente', { redibujar: false });
    });

    CAMPOS_INSTITUCION.forEach(function (p) {
      var el = UI.$(p[0]);
      if (!el) return;
      el.addEventListener('input', function () {
        config().institucion[p[1]] = ZZ.limpiar(el.value);
        App.cambio('config-inst', { redibujar: false });
      });
      el.addEventListener('blur', function () { App.guardar(true); });
    });

    CAMPOS_AJUSTES.forEach(function (p) {
      var el = UI.$(p[0]);
      if (!el) return;
      el.addEventListener('change', function () {
        var v = ZZ.numero(el.value);
        if (v === null) { el.value = config().ajustes[p[1]]; return; }
        config().ajustes[p[1]] = v;
        pintarAyudaRedondeo();
        App.cambio('config-ajustes');
      });
    });

    var modo = UI.$('aj-modo');
    if (modo) modo.addEventListener('change', function () {
      config().ajustes.modoRedondeo = modo.value;
      pintarAyudaRedondeo();
      App.cambio('config-ajustes');
    });

    var btnSec = UI.$('btn-agregar-seccion');
    if (btnSec) btnSec.addEventListener('click', function () {
      var el = UI.$('seccion-nueva');
      var v = ZZ.limpiar(el.value).toUpperCase().replace(/\|/g, '');
      if (!v) { UI.avisoFlotante('Escriba el nombre de la sección.', 'error'); return; }
      if (config().secciones.indexOf(v) >= 0) { UI.avisoFlotante('Esa sección ya está en la lista.', 'info'); return; }
      config().secciones.push(v);
      config().secciones.sort();
      el.value = '';
      App.cambio('config-secciones');
      App.refrescarSelectores();
      pintarSecciones();
      UI.avisoFlotante('Sección «' + v + '» agregada.');
    });

    var btnAsig = UI.$('btn-agregar-asignatura');
    if (btnAsig) btnAsig.addEventListener('click', function () {
      var el = UI.$('asignatura-nueva');
      var v = ZZ.limpiar(el.value);
      if (!v) { UI.avisoFlotante('Escriba el nombre de la asignatura.', 'error'); return; }
      if (config().asignaturas.some(function (a) { return a.nombre.toLowerCase() === v.toLowerCase(); })) {
        UI.avisoFlotante('Esa asignatura ya está en la lista.', 'info'); return;
      }
      config().asignaturas.push({ id: ZZ.nuevoId('as'), nombre: v, oficial: false });
      el.value = '';
      App.cambio('config-asignaturas');
      App.refrescarSelectores();
      pintarAsignaturas();
      UI.avisoFlotante('Asignatura «' + v + '» agregada.');
    });

    var btnOficiales = UI.$('btn-marcar-oficiales');
    if (btnOficiales) btnOficiales.addEventListener('click', function () {
      var faltan = ZZ.asignaturasOficiales().filter(function (o) {
        return !config().asignaturas.some(function (a) { return a.id === o.id; });
      });
      if (!faltan.length) { UI.avisoFlotante('Ya están marcadas todas las asignaturas oficiales.', 'info'); return; }
      config().asignaturas = config().asignaturas.concat(faltan);
      App.cambio('config-asignaturas');
      App.refrescarSelectores();
      pintarAsignaturas();
      UI.avisoFlotante('Se marcaron ' + faltan.length + ' asignaturas oficiales.');
    });

    var btnGuardar = UI.$('btn-guardar-config');
    if (btnGuardar) btnGuardar.addEventListener('click', function () {
      App.guardar(true);
      var msg = UI.$('msg-config');
      if (msg) {
        msg.textContent = '✔ Datos guardados ' + UI.fechaHora();
        setTimeout(function () { msg.textContent = ''; }, 4000);
      }
      UI.avisoFlotante('Configuración guardada correctamente.');
      App.actualizarCabecera();
    });

    var btnImp = UI.$('btn-imprimir-config');
    if (btnImp) btnImp.addEventListener('click', function () { Export.imprimir(documentoConfiguracion()); });

    var btnXls = UI.$('btn-excel-config');
    if (btnXls) btnXls.addEventListener('click', function () {
      Export.excel('Zazarabicoa-Configuracion-' + UI.selloArchivo() + '.xls', [hojaConfiguracion()]);
    });

    /* Los cambios de configuración siempre refrescan el contexto de cabecera. */
    App.alCambiar(function (motivo, op) {
      if (motivo && motivo.indexOf('config') === 0) App.actualizarCabecera();
      if (motivo === 'reemplazado' || motivo === 'restaurado') render();
    });
  }

  /* ══════════════════════════ DOCUMENTOS Y HOJAS ═══════════════════════ */

  function documentoConfiguracion() {
    var c = config(), d = c.docente, i = c.institucion;
    var asignaturas = c.asignaturas.length
      ? '<table class="tabla-doc"><thead><tr><th style="width:8%">N°</th><th>Asignatura que imparte</th><th style="width:22%">Tipo</th></tr></thead><tbody>' +
      c.asignaturas.map(function (a, n) {
        return '<tr><td class="c">' + (n + 1) + '</td><td>' + UI.esc(a.nombre) + '</td><td class="c">' +
          (a.oficial ? 'Asignatura oficial' : 'Asignatura adicional') + '</td></tr>';
      }).join('') + '</tbody></table>'
      : '<p>Sin asignaturas registradas.</p>';

    return '<div class="doc-oficial">' + Export.membrete() +
      '<h2 class="doc-titulo">Constancia de datos del docente y del plantel</h2>' +
      '<p class="doc-subtitulo">Año escolar ' + UI.esc(i.anioEscolar || '') + '</p>' +
      Export.ficha([
        ['Nombres y apellidos', d.nombres + ' ' + d.apellidos],
        ['Cédula de identidad', (d.cedulaTipo || 'V') + '-' + (d.cedula || '')],
        ['Teléfono', d.telefono], ['Correo', d.correo],
        ['Área donde se desempeña', d.area],
        ['Plantel', i.nombre], ['Fundado en', i.fundado],
        ['Código DEA', i.codigoDEA], ['Circuito escolar', i.circuito],
        ['Municipio', i.municipio], ['Estado', i.estado],
        ['Director(a) del plantel', i.director],
        ['Coordinador(a) de evaluación 1', i.coordinador],
        ['Coordinador(a) de evaluación 2', i.coordinador2],
        ['Años que atiende', c.anios.map(function (n) { return n + '° Año'; }).join(', ')],
        ['Secciones', c.secciones.join(', ')],
        ['Nota mínima aprobatoria', ZZ.fmtNota(c.ajustes.minima) + ' puntos'],
        ['Criterio de redondeo', (ZZ.MODOS_REDONDEO.filter(function (m) { return m.id === c.ajustes.modoRedondeo; })[0] || {}).titulo || ''],
        ['Escala', 'Vigesimal 01 – ' + ZZ.fmtNota(c.ajustes.escalaMax)]
      ]) +
      '<div class="doc-bloque"><p style="font-weight:bold;margin:3mm 0 1mm;">Asignaturas que imparte</p>' +
      asignaturas + '</div>' +
      '<p class="doc-nota-pie">Documento generado por la aplicación «Evaluación Docente de Zazarabicoa» el ' +
      UI.fechaLarga() + '.</p>' +
      Export.firmas() + '</div>';
  }

  function hojaConfiguracion() {
    var c = config(), d = c.docente, i = c.institucion;
    var enc = Export.encabezadoExcel('CONFIGURACIÓN DE DATOS DEL DOCENTE Y DEL PLANTEL');
    var filas = [
      [{ v: 'DATOS DEL DOCENTE EVALUADOR', c: 'encabezado', colspan: 2 }],
      [{ v: 'Nombres', c: 'etiqueta' }, d.nombres],
      [{ v: 'Apellidos', c: 'etiqueta' }, d.apellidos],
      [{ v: 'Cédula de identidad', c: 'etiqueta' }, (d.cedulaTipo || 'V') + '-' + d.cedula],
      [{ v: 'Teléfono', c: 'etiqueta' }, d.telefono],
      [{ v: 'Correo electrónico', c: 'etiqueta' }, d.correo],
      [{ v: 'Área donde se desempeña', c: 'etiqueta' }, d.area],
      [{ v: 'DATOS DE LA INSTITUCIÓN', c: 'encabezado', colspan: 2 }],
      [{ v: 'Plantel', c: 'etiqueta' }, i.nombre],
      [{ v: 'Año de fundación', c: 'etiqueta' }, i.fundado],
      [{ v: 'Código DEA', c: 'etiqueta' }, i.codigoDEA],
      [{ v: 'Circuito escolar', c: 'etiqueta' }, i.circuito],
      [{ v: 'Municipio', c: 'etiqueta' }, i.municipio],
      [{ v: 'Estado', c: 'etiqueta' }, i.estado],
      [{ v: 'Año escolar', c: 'etiqueta' }, i.anioEscolar],
      [{ v: 'Director(a) del plantel', c: 'etiqueta' }, i.director],
      [{ v: 'Coordinador(a) de evaluación 1', c: 'etiqueta' }, i.coordinador],
      [{ v: 'Coordinador(a) de evaluación 2', c: 'etiqueta' }, i.coordinador2],
      [{ v: 'AÑOS Y SECCIONES', c: 'encabezado', colspan: 2 }],
      [{ v: 'Años que atiende', c: 'etiqueta' }, c.anios.map(function (n) { return n + '° Año'; }).join(', ')],
      [{ v: 'Secciones', c: 'etiqueta' }, c.secciones.join(', ')],
      [{ v: 'CRITERIOS DE EVALUACIÓN', c: 'encabezado', colspan: 2 }],
      [{ v: 'Nota mínima aprobatoria', c: 'etiqueta' }, c.ajustes.minima],
      [{ v: 'Umbral de redondeo', c: 'etiqueta' }, c.ajustes.umbral],
      [{ v: 'Criterio de redondeo', c: 'etiqueta' },
        (ZZ.MODOS_REDONDEO.filter(function (m) { return m.id === c.ajustes.modoRedondeo; })[0] || {}).titulo || ''],
      [{ v: 'Derecho a revisión desde', c: 'etiqueta' }, c.ajustes.revisionDesde],
      [{ v: 'Escala máxima', c: 'etiqueta' }, c.ajustes.escalaMax],
      [{ v: 'ASIGNATURAS QUE IMPARTE', c: 'encabezado', colspan: 2 }]
    ];
    c.asignaturas.forEach(function (a, n) {
      filas.push([{ v: 'Asignatura ' + (n + 1), c: 'etiqueta' }, a.nombre + (a.oficial ? '' : ' (adicional)')]);
    });
    return {
      nombre: 'Configuración',
      titulo: enc.titulo, subtitulos: enc.subtitulos,
      columnas: ['Concepto', 'Dato'],
      anchos: [230, 420],
      filas: filas,
      nota: 'Generado el ' + UI.fechaHora() + ' por la aplicación Evaluación Docente de Zazarabicoa.'
    };
  }

  function refrescarSelectores() { /* Configuración no tiene selectores de contexto */ }

  VISTAS.configuracion = {
    render: render,
    iniciar: iniciar,
    refrescarSelectores: refrescarSelectores,
    documento: documentoConfiguracion,
    hojaExcel: hojaConfiguracion
  };
})(typeof window !== 'undefined' ? window : globalThis);
