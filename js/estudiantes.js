/* ============================================================================
   estudiantes.js — Módulo 2: nómina de estudiantes por año y sección,
   edición en línea y carga masiva pegando desde Excel o Word.
   ========================================================================== */
(function (raiz) {
  'use strict';

  var VISTAS = raiz.VISTAS = raiz.VISTAS || {};
  var borradorMasiva = [];
  var seleccionados = {};

  function estado() { return App.estado; }
  function config() { return App.estado.config; }

  function contexto() {
    return { anio: UI.valor('nom-anio'), seccion: UI.valor('nom-seccion') };
  }

  /* ══════════════════════════════ PINTADO ══════════════════════════════ */

  function refrescarSelectores() {
    var anios = config().anios.map(function (n) { return { valor: n, texto: n + '° Año' }; });
    var secciones = config().secciones.map(function (s) { return { valor: s, texto: 'Sección «' + s + '»' }; });
    UI.llenarSelect('nom-anio', anios.length ? anios : [{ valor: '', texto: '(configure los años)' }]);
    UI.llenarSelect('nom-seccion', secciones.length ? secciones : [{ valor: '', texto: '(configure las secciones)' }]);
    UI.llenarSelect('masiva-anio', anios.length ? anios : [{ valor: '', texto: '(configure los años)' }]);
    UI.llenarSelect('masiva-seccion', secciones.length ? secciones : [{ valor: '', texto: '(configure las secciones)' }]);
    App.aplicarContexto({ anio: 'nom-anio', seccion: 'nom-seccion' });
    UI.seleccionar('masiva-anio', UI.valor('nom-anio'));
    UI.seleccionar('masiva-seccion', UI.valor('nom-seccion'));
  }

  function render() {
    refrescarSelectores();
    pintarNomina();
  }

  function pintarNomina() {
    var ctx = contexto();
    var cuerpo = UI.$('cuerpo-nomina');
    if (!cuerpo) return;
    var lista = ZZ.estudiantesDe(estado(), ctx.anio, ctx.seccion);
    var info = UI.$('nom-info');
    if (info) {
      var conCedula = lista.filter(function (e) { return !!e.cedula; }).length;
      info.innerHTML = '<span><b>Matrícula:</b> ' + lista.length + '</span>' +
        '<span><b>Con cédula:</b> ' + conCedula + '</span>' +
        '<span><b>Sin cédula:</b> ' + (lista.length - conCedula) + '</span>';
    }
    if (!lista.length) {
      cuerpo.innerHTML = '<tr><td colspan="8" class="sin-datos">No hay estudiantes en ' +
        (ctx.anio ? ctx.anio + '° Año, sección «' + ctx.seccion + '»' : 'este año/sección') +
        '. Agregue uno con el botón o pegue la lista completa en la carga masiva.</td></tr>';
    } else {
      cuerpo.innerHTML = lista.map(function (e, i) {
        return '<tr data-id="' + e.id + '">' +
          '<td class="col-check"><input type="checkbox" class="check-est" data-id="' + e.id + '"' + (seleccionados[e.id] ? ' checked' : '') + '></td>' +
          '<td class="celda-num">' + (i + 1) + '</td>' +
          '<td><input type="text" data-campo="cedula" data-id="' + e.id + '" value="' + UI.esc(e.cedula) + '" placeholder="V-00.000.000"></td>' +
          '<td><input type="text" data-campo="apellidos" data-id="' + e.id + '" value="' + UI.esc(e.apellidos) + '"></td>' +
          '<td><input type="text" data-campo="nombres" data-id="' + e.id + '" value="' + UI.esc(e.nombres) + '"></td>' +
          '<td class="celda-num">' + (e.anio || '') + '</td>' +
          '<td class="celda-num">' + UI.esc(e.seccion) + '</td>' +
          '<td class="col-acciones">' +
          '<button class="btn-icono" data-accion="subir" data-id="' + e.id + '" title="Subir">⬆️</button>' +
          '<button class="btn-icono" data-accion="bajar" data-id="' + e.id + '" title="Bajar">⬇️</button>' +
          '<button class="btn-icono" data-accion="borrar" data-id="' + e.id + '" title="Eliminar">🗑️</button>' +
          '</td></tr>';
      }).join('');
    }
    var pie = UI.$('pie-nomina');
    if (pie) {
      var totalGeneral = estado().estudiantes.length;
      pie.innerHTML = '<span>Matrícula de este curso: <b>' + lista.length + '</b></span>' +
        '<span>Total registrado en la aplicación: <b>' + totalGeneral + '</b></span>';
    }
    var checkTodos = UI.$('nom-check-todos');
    if (checkTodos) checkTodos.checked = false;
  }

  /* ══════════════════════════════ EVENTOS ══════════════════════════════ */

  function iniciar() {
    ['nom-anio', 'nom-seccion'].forEach(function (id) {
      var el = UI.$(id);
      if (el) el.addEventListener('change', function () {
        seleccionados = {};
        App.recordarContexto(contexto());
        pintarNomina();
      });
    });

    var cuerpo = UI.$('cuerpo-nomina');
    if (cuerpo) {
      cuerpo.addEventListener('input', function (ev) {
        var el = ev.target;
        var campo = el.getAttribute && el.getAttribute('data-campo');
        var id = el.getAttribute && el.getAttribute('data-id');
        if (!campo || !id) return;
        var est = estado().estudiantes.filter(function (e) { return e.id === id; })[0];
        if (!est) return;
        if (campo === 'cedula') est.cedula = ZZ.limpiar(el.value);
        else est[campo] = ZZ.limpiar(el.value).toUpperCase();
        App.cambio('nomina-edicion', { redibujar: false });
      });
      cuerpo.addEventListener('blur', function (ev) {
        var el = ev.target;
        if (el && el.getAttribute && el.getAttribute('data-campo') === 'cedula') {
          var n = ZZ.normalizarCedula(el.value);
          if (n.numero) el.value = (n.tipo ? n.tipo + '-' : '') + ZZ.agruparMiles(n.numero);
          var id = el.getAttribute('data-id');
          var est = estado().estudiantes.filter(function (e) { return e.id === id; })[0];
          if (est) { est.cedula = el.value; App.cambio('nomina-edicion', { redibujar: false }); }
        }
      }, true);
      cuerpo.addEventListener('change', function (ev) {
        var el = ev.target;
        if (el && el.className === 'check-est') {
          seleccionados[el.getAttribute('data-id')] = el.checked;
        }
      });
      cuerpo.addEventListener('click', function (ev) {
        var btn = ev.target.closest ? ev.target.closest('[data-accion]') : null;
        if (!btn) return;
        var id = btn.getAttribute('data-id');
        var accion = btn.getAttribute('data-accion');
        if (accion === 'borrar') {
          var est = estado().estudiantes.filter(function (e) { return e.id === id; })[0];
          UI.confirmar('Eliminar estudiante',
            '¿Eliminar a ' + UI.esc(ZZ.nombreCompleto(est)) + '? También se borrarán sus notas registradas.',
            function () { eliminarEstudiante(id); }, { aceptar: 'Sí, eliminar', peligro: true });
        } else {
          mover(id, accion === 'subir' ? -1 : 1);
        }
      });
    }

    var btnAgregar = UI.$('btn-agregar-estudiante');
    if (btnAgregar) btnAgregar.addEventListener('click', function () {
      var ctx = contexto();
      if (!ctx.anio || !ctx.seccion) {
        UI.avisoFlotante('Primero configure los años y las secciones en la pestaña 1.', 'error');
        return;
      }
      estado().estudiantes.push({
        id: ZZ.nuevoId('est'), cedula: '', apellidos: '', nombres: '', sexo: '',
        anio: Number(ctx.anio), seccion: ctx.seccion
      });
      App.cambio('nomina');
      pintarNomina();
      var filas = UI.$$('#cuerpo-nomina input[data-campo="apellidos"]');
      if (filas.length) filas[filas.length - 1].focus();
    });

    var btnBorrarSel = UI.$('btn-borrar-seleccion');
    if (btnBorrarSel) btnBorrarSel.addEventListener('click', function () {
      var ids = Object.keys(seleccionados).filter(function (k) { return seleccionados[k]; });
      if (!ids.length) { UI.avisoFlotante('No hay estudiantes marcados.', 'info'); return; }
      UI.confirmar('Eliminar seleccionados', '¿Eliminar ' + ids.length + ' estudiante(s) y sus notas?',
        function () {
          ids.forEach(eliminarEstudiante);
          seleccionados = {};
          App.cambio('nomina');
          pintarNomina();
          UI.avisoFlotante('Se eliminaron ' + ids.length + ' estudiantes.');
        }, { aceptar: 'Sí, eliminar', peligro: true });
    });

    var checkTodos = UI.$('nom-check-todos');
    if (checkTodos) checkTodos.addEventListener('change', function () {
      var ctx = contexto();
      ZZ.estudiantesDe(estado(), ctx.anio, ctx.seccion).forEach(function (e) {
        seleccionados[e.id] = checkTodos.checked;
      });
      UI.$$('#cuerpo-nomina .check-est').forEach(function (c) { c.checked = checkTodos.checked; });
    });

    var btnOrdenar = UI.$('btn-ordenar-nomina');
    if (btnOrdenar) btnOrdenar.addEventListener('click', function () {
      ordenarNomina();
      App.cambio('nomina');
      pintarNomina();
      UI.avisoFlotante('Nómina ordenada alfabéticamente.');
    });

    var btnImp = UI.$('btn-imprimir-nomina');
    if (btnImp) btnImp.addEventListener('click', function () {
      var ctx = contexto();
      if (!ctx.anio) { UI.avisoFlotante('Seleccione un año.', 'error'); return; }
      Export.imprimir(documentoNomina(ctx));
    });

    var btnXls = UI.$('btn-excel-nomina');
    if (btnXls) btnXls.addEventListener('click', function () {
      var ctx = contexto();
      Export.excel('Zazarabicoa-Nomina-' + ctx.anio + ctx.seccion + '-' + UI.selloArchivo() + '.xls', [hojaNomina(ctx)]);
    });

    /* ------------------------------------------------ carga masiva --------- */
    var btnAnalizar = UI.$('btn-analizar-masiva');
    if (btnAnalizar) btnAnalizar.addEventListener('click', analizarMasiva);

    var cuerpoMasiva = UI.$('cuerpo-masiva');
    if (cuerpoMasiva) {
      cuerpoMasiva.addEventListener('input', function (ev) {
        var el = ev.target;
        var idx = parseInt(el.getAttribute('data-idx'), 10);
        var campo = el.getAttribute('data-campo');
        if (isNaN(idx) || !campo || !borradorMasiva[idx]) return;
        if (campo === 'sexo') borradorMasiva[idx].sexo = el.value;
        else borradorMasiva[idx][campo] = ZZ.limpiar(el.value);
      });
      cuerpoMasiva.addEventListener('click', function (ev) {
        var btn = ev.target.closest ? ev.target.closest('[data-quitar-idx]') : null;
        if (!btn) return;
        borradorMasiva.splice(parseInt(btn.getAttribute('data-quitar-idx'), 10), 1);
        pintarBorradorMasiva();
      });
    }

    var btnConfirmar = UI.$('btn-confirmar-masiva');
    if (btnConfirmar) btnConfirmar.addEventListener('click', confirmarMasiva);

    var btnLimpiar = UI.$('btn-limpiar-masiva');
    if (btnLimpiar) btnLimpiar.addEventListener('click', function () {
      borradorMasiva = [];
      UI.ponerValor('masiva-texto', '');
      UI.listaAvisos('masiva-avisos', []);
      UI.mostrar('masiva-caja-preview', false);
      var b = UI.$('btn-confirmar-masiva');
      if (b) b.disabled = true;
    });

    App.alCambiar(function (motivo, op) {
      if (motivo === 'reemplazado' || motivo === 'restaurado' || motivo === 'nomina') {
        refrescarSelectores();
        pintarNomina();
      }
    });
  }

  function eliminarEstudiante(id) {
    var e = estado();
    e.estudiantes = e.estudiantes.filter(function (x) { return x.id !== id; });
    Object.keys(e.notas).forEach(function (k) {
      if (e.notas[k][id]) delete e.notas[k][id];
    });
    delete seleccionados[id];
  }

  function mover(id, delta) {
    var e = estado();
    var est = e.estudiantes.filter(function (x) { return x.id === id; })[0];
    if (!est) return;
    var mismo = e.estudiantes.filter(function (x) {
      return String(x.anio) === String(est.anio) && String(x.seccion) === String(est.seccion);
    });
    var idx = mismo.indexOf(est);
    var otro = mismo[idx + delta];
    if (!otro) return;
    var ia = e.estudiantes.indexOf(est), ib = e.estudiantes.indexOf(otro);
    e.estudiantes[ia] = otro;
    e.estudiantes[ib] = est;
    App.cambio('nomina');
    pintarNomina();
  }

  function ordenarNomina() {
    var e = estado();
    e.estudiantes.sort(function (a, b) {
      var k1 = String(a.anio) + String(a.seccion) + (a.apellidos || '') + (a.nombres || '');
      var k2 = String(b.anio) + String(b.seccion) + (b.apellidos || '') + (b.nombres || '');
      return k1.localeCompare(k2, 'es');
    });
  }

  /* ═════════════════════════════ CARGA MASIVA ══════════════════════════ */

  function analizarMasiva() {
    var texto = UI.$('masiva-texto') ? UI.$('masiva-texto').value : '';
    if (!texto.trim()) {
      UI.avisoFlotante('Pegue primero la lista de estudiantes.', 'error');
      return;
    }
    var r = ZZ.parsearNomina(texto);
    borradorMasiva = r.filas;
    var avisos = [];
    if (!r.filas.length) avisos.push({ texto: 'No se reconoció ningún estudiante. Revise el formato de la lista.', clase: 'error' });
    else avisos.push({ texto: 'Se reconocieron <b>' + r.filas.length + '</b> estudiante(s). Revise la vista previa y pulse «Cargar en la nómina».', clase: 'ok' });
    r.advertencias.slice(0, 12).forEach(function (a) { avisos.push({ texto: UI.esc(a), clase: '' }); });
    if (r.advertencias.length > 12) avisos.push({ texto: '…y ' + (r.advertencias.length - 12) + ' advertencia(s) más.', clase: '' });
    pintarAvisos(avisos);
    pintarBorradorMasiva();
    var btn = UI.$('btn-confirmar-masiva');
    if (btn) btn.disabled = !r.filas.length;
  }

  function pintarAvisos(lista) {
    var caja = UI.$('masiva-avisos');
    if (!caja) return;
    caja.innerHTML = '';
    lista.forEach(function (a) {
      var d = document.createElement('div');
      d.className = 'aviso-item' + (a.clase ? ' ' + a.clase : '');
      d.innerHTML = a.texto;
      caja.appendChild(d);
    });
  }

  function pintarBorradorMasiva() {
    var cuerpo = UI.$('cuerpo-masiva');
    var caja = UI.$('masiva-caja-preview');
    if (!cuerpo || !caja) return;
    if (!borradorMasiva.length) { caja.hidden = true; cuerpo.innerHTML = ''; return; }
    caja.hidden = false;
    cuerpo.innerHTML = borradorMasiva.map(function (f, i) {
      return '<tr>' +
        '<td class="celda-num">' + (i + 1) + '</td>' +
        '<td><input type="text" data-idx="' + i + '" data-campo="cedula" value="' + UI.esc(f.cedula) + '"></td>' +
        '<td><input type="text" data-idx="' + i + '" data-campo="apellidos" value="' + UI.esc(f.apellidos) + '"></td>' +
        '<td><input type="text" data-idx="' + i + '" data-campo="nombres" value="' + UI.esc(f.nombres) + '"></td>' +
        '<td class="col-acciones"><button class="btn-mini peligro" data-quitar-idx="' + i + '" type="button">Quitar</button></td>' +
        '</tr>';
    }).join('');
  }

  function confirmarMasiva() {
    var ctx = { anio: UI.valor('masiva-anio'), seccion: UI.valor('masiva-seccion') };
    if (!ctx.anio || !ctx.seccion) {
      UI.avisoFlotante('Seleccione el año y la sección de destino.', 'error');
      return;
    }
    var validas = borradorMasiva.filter(function (f) { return (f.apellidos || f.nombres); });
    if (!validas.length) { UI.avisoFlotante('No hay filas válidas para cargar.', 'error'); return; }

    UI.confirmar('Confirmar carga masiva',
      'Se agregarán ' + validas.length + ' estudiante(s) a ' + ctx.anio + '° Año, sección «' + ctx.seccion + '».\n' +
      'Los estudiantes repetidos (misma cédula en ese curso) se omitirán.',
      function () {
        var e = estado();
        var existentes = {};
        ZZ.estudiantesDe(e, ctx.anio, ctx.seccion).forEach(function (x) {
          if (x.cedula) existentes[normalizarTexto(x.cedula)] = true;
        });
        var agregados = 0, repetidos = 0;
        validas.forEach(function (f) {
          var clave = normalizarTexto(f.cedula);
          if (clave && existentes[clave]) { repetidos += 1; return; }
          var n = ZZ.normalizarCedula(f.cedula);
          e.estudiantes.push({
            id: ZZ.nuevoId('est'),
            cedula: n.numero ? ((n.tipo ? n.tipo + '-' : '') + ZZ.agruparMiles(n.numero)) : ZZ.limpiar(f.cedula),
            apellidos: ZZ.limpiar(f.apellidos).toUpperCase(),
            nombres: ZZ.limpiar(f.nombres).toUpperCase(),
            anio: Number(ctx.anio),
            seccion: ctx.seccion
          });
          if (clave) existentes[clave] = true;
          agregados += 1;
        });
        borradorMasiva = [];
        UI.ponerValor('masiva-texto', '');
        UI.mostrar('masiva-caja-preview', false);
        var b = UI.$('btn-confirmar-masiva');
        if (b) b.disabled = true;
        UI.seleccionar('nom-anio', ctx.anio);
        UI.seleccionar('nom-seccion', ctx.seccion);
        App.recordarContexto({ anio: ctx.anio, seccion: ctx.seccion });
        App.cambio('nomina');
        pintarNomina();
        UI.listaAvisos('masiva-avisos', [
          { texto: 'Se cargaron <b>' + agregados + '</b> estudiante(s) en ' + ctx.anio + '° Año, sección «' + ctx.seccion + '»' +
            (repetidos ? '. Se omitieron <b>' + repetidos + '</b> por estar repetidos.' : '.'), clase: 'ok' }
        ]);
        UI.avisoFlotante('Carga masiva completada: ' + agregados + ' estudiante(s).');
      }, { aceptar: 'Sí, cargar la lista' });
  }

  function normalizarTexto(t) {
    return String(t == null ? '' : t).toUpperCase().replace(/[^0-9A-Z]/g, '');
  }

  /* ══════════════════════ DOCUMENTO Y HOJA DE CÁLCULO ═══════════════════ */

  function documentoNomina(ctx) {
    var lista = ZZ.estudiantesDe(estado(), ctx.anio, ctx.seccion);
    var i = config().institucion;
    var filas = lista.map(function (e, n) {
      return '<tr><td class="c">' + (n + 1) + '</td><td class="c">' + UI.esc(e.cedula) + '</td>' +
        '<td>' + UI.esc(e.apellidos) + '</td><td>' + UI.esc(e.nombres) + '</td></tr>';
    }).join('');

    return '<div class="doc-oficial">' + Export.membrete() +
      '<h2 class="doc-titulo">Nómina de estudiantes</h2>' +
      '<p class="doc-subtitulo">' + UI.esc(i.anioEscolar || '') + ' &middot; ' + ctx.anio + '° Año de Educación Media General &middot; Sección «' + UI.esc(ctx.seccion) + '»</p>' +
      '<table class="tabla-doc"><thead><tr>' +
      '<th style="width:7%">N°</th><th style="width:20%">Cédula</th><th style="width:36%">Apellidos</th>' +
      '<th style="width:37%">Nombres</th></tr></thead><tbody>' +
      (filas || '<tr><td colspan="4" class="c">Sin estudiantes registrados</td></tr>') +
      '</tbody></table>' +
      '<table class="doc-estadisticas" style="margin-top:3mm"><tr>' +
      '<td><span class="rotulo">Matrícula total</span><span class="valor">' + lista.length + '</span></td>' +
      '<td><span class="rotulo">Con cédula</span><span class="valor">' + lista.filter(function (e) { return !!e.cedula; }).length + '</span></td>' +
      '<td><span class="rotulo">Nómina actualizada al</span><span class="valor" style="font-size:11px">' + UI.fechaLarga() + '</span></td>' +
      '<td><span class="rotulo">Docente</span><span class="valor" style="font-size:11px">' + UI.esc(ZZ.nombreDocente(config())) + '</span></td>' +
      '</tr></table>' +
      '<p class="doc-nota-pie">Certificación de la matrícula atendida por el docente en la asignatura o área correspondiente.</p>' +
      Export.firmas() + '</div>';
  }

  function hojaNomina(ctx) {
    var lista = ZZ.estudiantesDe(estado(), ctx.anio, ctx.seccion);
    var enc = Export.encabezadoExcel('NÓMINA DE ESTUDIANTES — ' + ctx.anio + '° AÑO, SECCIÓN «' + ctx.seccion + '»');
    var filas = lista.map(function (e, n) {
      return [n + 1, e.cedula || '', e.apellidos || '', e.nombres || '', ctx.anio + '°', ctx.seccion];
    });
    return {
      nombre: 'Nómina ' + ctx.anio + ctx.seccion,
      titulo: enc.titulo, subtitulos: enc.subtitulos,
      columnas: ['N°', 'Cédula', 'Apellidos', 'Nombres', 'Año', 'Sección'],
      anchos: [40, 110, 200, 220, 60, 70],
      filas: filas,
      pie: ['Matrícula total: ' + lista.length +
        '   |   Con cédula: ' + lista.filter(function (e) { return !!e.cedula; }).length]
    };
  }

  VISTAS.nomina = {
    render: render,
    iniciar: iniciar,
    refrescarSelectores: refrescarSelectores,
    documento: documentoNomina,
    hojaExcel: hojaNomina,
    ordenar: ordenarNomina,
    seleccion: contexto
  };
})(typeof window !== 'undefined' ? window : globalThis);
