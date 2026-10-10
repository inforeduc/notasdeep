/* ============================================================================
   plan.js — Módulo 3: plan de evaluación por lapso (actividades, contenido
   programático, técnica, instrumento y control de ponderación al 100 %).
   Además expone PlanUtil, utilidades compartidas con la evaluación continua.
   ========================================================================== */
(function (raiz) {
  'use strict';

  var VISTAS = raiz.VISTAS = raiz.VISTAS || {};

  function estado() { return App.estado; }
  function config() { return App.estado.config; }

  /* ═══════════════════════════ UTILIDADES COMPARTIDAS ═════════════════════ */

  var PlanUtil = raiz.PlanUtil = {

    seleccion: function (ids) {
      return {
        anio: UI.valor(ids.anio),
        seccion: UI.valor(ids.seccion),
        asignatura: UI.valor(ids.asignatura),
        lapso: UI.valor(ids.lapso)
      };
    },

    valida: function (sel) {
      return !!(sel.anio && sel.seccion && sel.asignatura && sel.lapso);
    },

    /** Lista mutable de actividades del contexto (la crea si no existe). */
    actividades: function (sel, crear) {
      if (!sel.anio || !sel.seccion || !sel.asignatura || !sel.lapso) return [];
      var plan = crear === false ? ZZ.planDe(estado(), sel) : ZZ.asegurarPlan(estado(), sel);
      return plan.actividades;
    },

    agregar: function (sel, datos) {
      var acts = PlanUtil.actividades(sel);
      var d = datos || {};
      var restante = ZZ.redondear(100 - ZZ.sumaPonderacion(acts), 2);
      acts.push({
        id: ZZ.nuevoId('act'),
        nombre: d.nombre || 'Nueva actividad evaluativa',
        tipo: d.tipo || 'Taller grupal',
        contenido: d.contenido || '',
        tecnica: d.tecnica || 'Observación directa',
        instrumento: d.instrumento || 'Escala de estimación',
        ponderacion: d.ponderacion != null ? d.ponderacion : (restante > 0 ? restante : 0)
      });
      return acts[acts.length - 1];
    },

    repartir: function (acts) {
      if (!acts.length) return;
      var base = Math.floor((100 / acts.length) * 100) / 100;
      var acumulado = 0;
      acts.forEach(function (a, i) {
        if (i === acts.length - 1) a.ponderacion = ZZ.redondear(100 - acumulado, 2);
        else { a.ponderacion = base; acumulado += base; }
      });
    },

    completar: function (acts) {
      var total = ZZ.sumaPonderacion(acts);
      var falta = ZZ.redondear(100 - total, 2);
      if (falta <= 0) return false;
      if (!acts.length) {
        acts.push({
          id: ZZ.nuevoId('act'), nombre: 'Evaluación integral del lapso', tipo: 'Proyecto',
          contenido: '', tecnica: 'Análisis de producción', instrumento: 'Rúbrica', ponderacion: 100
        });
        return true;
      }
      var viejas = acts.filter(function (a) { return ZZ.numero(a.ponderacion) > 0; });
      var sobrante = ZZ.redondear(falta / (viejas.length || 1), 2);
      var acumulado = 0;
      viejas.forEach(function (a, i) {
        var extra = (i === viejas.length - 1) ? ZZ.redondear(falta - acumulado, 2) : sobrante;
        a.ponderacion = ZZ.redondear(ZZ.numero(a.ponderacion) + extra, 2);
        acumulado += extra;
      });
      return true;
    },

    mover: function (acts, id, delta) {
      var i = -1;
      acts.forEach(function (a, n) { if (a.id === id) i = n; });
      if (i < 0) return false;
      var j = i + delta;
      if (j < 0 || j >= acts.length) return false;
      var tmp = acts[i]; acts[i] = acts[j]; acts[j] = tmp;
      return true;
    },

    duplicar: function (acts, id) {
      var i = -1;
      acts.forEach(function (a, n) { if (a.id === id) i = n; });
      if (i < 0) return null;
      var copia = JSON.parse(JSON.stringify(acts[i]));
      copia.id = ZZ.nuevoId('act');
      copia.nombre = copia.nombre + ' (copia)';
      acts.splice(i + 1, 0, copia);
      return copia;
    },

    eliminar: function (acts, id) {
      var i = -1;
      acts.forEach(function (a, n) { if (a.id === id) i = n; });
      if (i < 0) return false;
      acts.splice(i, 1);
      // Se descartan las notas de esa actividad en el contexto correspondiente.
      return true;
    },

    quitarNotasActividad: function (sel, idActividad) {
      var m = estado().notas[ZZ.clave(sel)];
      if (!m) return;
      Object.keys(m).forEach(function (est) { delete m[est][idActividad]; });
    },

    puntosDe: function (porcentaje) {
      return ZZ.redondear((ZZ.numero(porcentaje) || 0) * (ZZ.numero(config().ajustes.escalaMax) || 20) / 100, 2);
    },

    /** Actualiza el medidor visual de ponderación (prefijo: 'plan' o 'ec'). */
    medidor: function (prefijo, acts) {
      var total = ZZ.sumaPonderacion(acts);
      var caja = UI.$(prefijo + '-medidor');
      var texto = UI.$(prefijo + '-total-texto');
      var detalle = UI.$(prefijo + '-total-detalle');
      var barra = UI.$(prefijo + '-total-barra');
      var mensaje = UI.$(prefijo + '-total-mensaje');
      if (!caja) return total;
      caja.classList.remove('ok', 'excedido', 'falta');
      if (texto) texto.textContent = ZZ.fmt2(total) + ' %';
      var sinPeso = acts.filter(function (a) { return !(ZZ.numero(a.ponderacion) > 0); }).length;
      if (detalle) {
        detalle.textContent = acts.length + ' actividad(es) · equivale a ' +
          ZZ.fmt2(PlanUtil.puntosDe(total)) + ' de ' + ZZ.fmtNota(config().ajustes.escalaMax) + ' puntos' +
          (sinPeso ? ' · ' + sinPeso + ' actividad(es) sin ponderación' : '');
      }
      if (barra) barra.style.width = Math.max(0, Math.min(100, total)) + '%';
      var diferencia = ZZ.redondear(100 - total, 2);
      if (diferencia === 0) {
        caja.classList.add('ok');
        if (mensaje) mensaje.innerHTML = '✔ Ponderación completa: la suma alcanza exactamente el 100 %, equivalente a ' +
          ZZ.fmtNota(config().ajustes.escalaMax) + ' puntos.';
      } else if (diferencia < 0) {
        caja.classList.add('excedido');
        if (mensaje) mensaje.innerHTML = '⚠ La ponderación excede el 100 % en <b>' + ZZ.fmt2(Math.abs(diferencia)) +
          ' punto(s) porcentual(es)</b>. Ajuste las actividades para que la suma sea exactamente 100 %.';
      } else {
        caja.classList.add('falta');
        if (mensaje) mensaje.innerHTML = 'Falta <b>' + ZZ.fmt2(diferencia) + ' %</b> para completar el 100 %' +
          (acts.length ? '. Puede ajustar las ponderaciones o usar «Completar hasta 100 %».' : '. Agregue las actividades evaluativas del lapso.');
      }
      return total;
    },

    /** Datos de la matriz de notas: actividades + notas por estudiante. */
    matriz: function (sel) {
      var acts = PlanUtil.actividades(sel, false);
      var notas = ZZ.notasDe(estado(), sel);
      var estudiantes = ZZ.estudiantesDe(estado(), sel.anio, sel.seccion);
      var filas = estudiantes.map(function (e) {
        var m = notas[e.id] || {};
        var calculo = ZZ.puntosDe(acts, m);
        var def = ZZ.calcularDefinitiva(calculo ? calculo.puntos : null, config().ajustes);
        return { estudiante: e, notas: m, calculo: calculo, definitiva: def };
      });
      var estadisticas = ZZ.estadisticas(filas.map(function (f) { return { definitiva: f.definitiva.definitiva }; }), config().ajustes);
      return { actividades: acts, filas: filas, estadisticas: estadisticas, seleccion: sel };
    },

    ponderacionCompleta: function (acts) { return ZZ.sumaPonderacion(acts) === 100; }
  };

  /* ══════════════════════════════ MÓDULO 3 ═════════════════════════════ */

  var IDS = { anio: 'plan-anio', seccion: 'plan-seccion', asignatura: 'plan-asignatura', lapso: 'plan-lapso' };

  function refrescarSelectores() {
    var anios = config().anios.map(function (n) { return { valor: n, texto: n + '° Año' }; });
    var secciones = config().secciones.map(function (s) { return { valor: s, texto: 'Sección «' + s + '»' }; });
    var asignaturas = config().asignaturas.map(function (a) { return { valor: a.id, texto: a.nombre }; });
    var lapsos = ZZ.LAPSOS.map(function (l) { return { valor: l.n, texto: l.titulo }; });
    UI.llenarSelect(IDS.anio, anios.length ? anios : [{ valor: '', texto: '(sin años)' }]);
    UI.llenarSelect(IDS.seccion, secciones.length ? secciones : [{ valor: '', texto: '(sin secciones)' }]);
    UI.llenarSelect(IDS.asignatura, asignaturas.length ? asignaturas : [{ valor: '', texto: '(sin asignaturas)' }]);
    UI.llenarSelect(IDS.lapso, lapsos);
    App.aplicarContexto(IDS);
  }

  function seleccion() { return PlanUtil.seleccion(IDS); }

  function render() {
    refrescarSelectores();
    pintarPlan();
  }

  function pintarPlan() {
    var sel = seleccion();
    var acts = PlanUtil.actividades(sel);
    var cuerpo = UI.$('cuerpo-plan');
    if (!cuerpo) return;

    if (!PlanUtil.valida(sel)) {
      cuerpo.innerHTML = '<tr><td colspan="9" class="sin-datos">Complete la configuración (años, secciones y asignaturas) en la pestaña 1 para comenzar a planificar.</td></tr>';
      PlanUtil.medidor('plan', []);
      return;
    }

    if (!acts.length) {
      cuerpo.innerHTML = '<tr><td colspan="9" class="sin-datos">Aún no hay actividades evaluativas en este lapso. Use «Agregar actividad evaluativa» para comenzar.</td></tr>';
    } else {
      cuerpo.innerHTML = acts.map(function (a, i) {
        return '<tr data-id="' + a.id + '">' +
          '<td class="celda-num">' + (i + 1) + '</td>' +
          '<td><input type="text" data-campo="nombre" data-id="' + a.id + '" value="' + UI.esc(a.nombre) + '"></td>' +
          '<td>' + selectSimple('tipo', a.id, a.tipo, ZZ.TIPOS_ACTIVIDAD) + '</td>' +
          '<td><input type="text" data-campo="contenido" data-id="' + a.id + '" value="' + UI.esc(a.contenido) + '" placeholder="Contenido / referente teórico-práctico"></td>' +
          '<td>' + selectSimple('tecnica', a.id, a.tecnica, ZZ.TECNICAS) + '</td>' +
          '<td>' + selectSimple('instrumento', a.id, a.instrumento, ZZ.INSTRUMENTOS) + '</td>' +
          '<td class="celda-num"><input type="number" class="ponderacion" min="0" max="100" step="0.5" data-campo="ponderacion" data-id="' + a.id + '" value="' + ZZ.fmtNota(a.ponderacion) + '"></td>' +
          '<td class="celda-num" data-puntos-id="' + a.id + '">' + ZZ.fmt2(PlanUtil.puntosDe(a.ponderacion)) + '</td>' +
          '<td class="col-acciones">' +
          '<button class="btn-icono" data-accion="subir" data-id="' + a.id + '" title="Subir">⬆️</button>' +
          '<button class="btn-icono" data-accion="bajar" data-id="' + a.id + '" title="Bajar">⬇️</button>' +
          '<button class="btn-icono" data-accion="duplicar" data-id="' + a.id + '" title="Duplicar">⧉</button>' +
          '<button class="btn-icono" data-accion="borrar" data-id="' + a.id + '" title="Eliminar">🗑️</button>' +
          '</td></tr>';
      }).join('');
    }
    PlanUtil.medidor('plan', acts);

    var pie = UI.$('pie-plan');
    if (pie) {
      pie.innerHTML = '<span>' + UI.esc(ZZ.nombreAsignatura(estado(), sel.asignatura)) + ' · ' + sel.anio +
        '° Año, sección «' + UI.esc(sel.seccion) + '» · ' + ZZ.tituloLapso(sel.lapso) + '</span>' +
        '<span>Estudiantes en el curso: <b>' + ZZ.estudiantesDe(estado(), sel.anio, sel.seccion).length + '</b></span>' +
        '<span>Actividades: <b>' + acts.length + '</b></span>';
    }
  }

  function selectSimple(campo, id, valor, opciones) {
    var lista = opciones.slice();
    if (valor && lista.indexOf(valor) < 0) lista.unshift(valor);
    return '<select data-campo="' + campo + '" data-id="' + id + '">' +
      lista.map(function (o) {
        return '<option value="' + UI.esc(o) + '"' + (o === valor ? ' selected' : '') + '>' + UI.esc(o) + '</option>';
      }).join('') + '</select>';
  }

  function iniciar() {
    ['plan-anio', 'plan-seccion', 'plan-asignatura', 'plan-lapso'].forEach(function (id) {
      var el = UI.$(id);
      if (el) el.addEventListener('change', function () {
        App.recordarContexto(seleccion());
        pintarPlan();
      });
    });

    var cuerpo = UI.$('cuerpo-plan');
    if (cuerpo) {
      cuerpo.addEventListener('input', function (ev) {
        var el = ev.target;
        var campo = el.getAttribute('data-campo');
        var id = el.getAttribute('data-id');
        if (!campo || !id) return;
        var sel = seleccion();
        var acts = PlanUtil.actividades(sel);
        var act = acts.filter(function (a) { return a.id === id; })[0];
        if (!act) return;
        if (campo === 'ponderacion') {
          var v = ZZ.numero(el.value);
          act.ponderacion = v === null ? 0 : Math.max(0, Math.min(100, v));
          var celda = UI.$$('[data-puntos-id="' + id + '"]', cuerpo)[0];
          if (celda) celda.textContent = ZZ.fmt2(PlanUtil.puntosDe(act.ponderacion));
          PlanUtil.medidor('plan', acts);
          App.cambio('plan-ponderacion', { redibujar: false });
        } else {
          act[campo] = campo === 'nombre' || campo === 'contenido' ? el.value : ZZ.limpiar(el.value);
          App.cambio('plan-edicion', { redibujar: false });
        }
      });
      cuerpo.addEventListener('blur', function (ev) {
        if (ev.target && ev.target.getAttribute && ev.target.getAttribute('data-campo') === 'ponderacion') {
          var v = ZZ.numero(ev.target.value);
          ev.target.value = ZZ.fmtNota(v === null ? 0 : v);
        }
      }, true);
      cuerpo.addEventListener('change', function (ev) {
        var el = ev.target;
        var campo = el.getAttribute('data-campo');
        var id = el.getAttribute('data-id');
        if (!campo || !id || campo === 'ponderacion') return;
        var acts = PlanUtil.actividades(seleccion());
        var act = acts.filter(function (a) { return a.id === id; })[0];
        if (!act) return;
        act[campo] = el.value;
        App.cambio('plan-edicion', { redibujar: false });
      });
      cuerpo.addEventListener('click', function (ev) {
        var btn = ev.target.closest ? ev.target.closest('[data-accion]') : null;
        if (!btn) return;
        var id = btn.getAttribute('data-id');
        var accion = btn.getAttribute('data-accion');
        var sel = seleccion();
        var acts = PlanUtil.actividades(sel);
        if (accion === 'subir' || accion === 'bajar') {
          PlanUtil.mover(acts, id, accion === 'subir' ? -1 : 1);
          App.cambio('plan');
          pintarPlan();
        } else if (accion === 'duplicar') {
          PlanUtil.duplicar(acts, id);
          App.cambio('plan');
          pintarPlan();
        } else if (accion === 'borrar') {
          var act = acts.filter(function (a) { return a.id === id; })[0];
          UI.confirmar('Eliminar actividad',
            '¿Eliminar «' + UI.esc(act ? act.nombre : '') + '»? Se borrarán también las notas registradas para esa actividad.',
            function () {
              PlanUtil.quitarNotasActividad(sel, id);
              PlanUtil.eliminar(acts, id);
              App.cambio('plan');
              pintarPlan();
            }, { aceptar: 'Sí, eliminar', peligro: true });
        }
      });
    }

    var btnAgregar = UI.$('btn-plan-agregar');
    if (btnAgregar) btnAgregar.addEventListener('click', function () {
      var sel = seleccion();
      if (!PlanUtil.valida(sel)) { UI.avisoFlotante('Complete año, sección, asignatura y lapso.', 'error'); return; }
      PlanUtil.agregar(sel, {});
      App.cambio('plan');
      pintarPlan();
      var nombres = UI.$$('#cuerpo-plan input[data-campo="nombre"]');
      if (nombres.length) { nombres[nombres.length - 1].focus(); nombres[nombres.length - 1].select(); }
      UI.avisoFlotante('Actividad agregada. Ajuste su ponderación.');
    });

    var btnRepartir = UI.$('btn-plan-repartir');
    if (btnRepartir) btnRepartir.addEventListener('click', function () {
      var acts = PlanUtil.actividades(seleccion());
      if (!acts.length) { UI.avisoFlotante('No hay actividades que repartir.', 'info'); return; }
      PlanUtil.repartir(acts);
      App.cambio('plan');
      pintarPlan();
      UI.avisoFlotante('Ponderación repartida en partes iguales (100 %).');
    });

    var btnCompletar = UI.$('btn-plan-completar');
    if (btnCompletar) btnCompletar.addEventListener('click', function () {
      var acts = PlanUtil.actividades(seleccion());
      if (!PlanUtil.completar(acts)) { UI.avisoFlotante('La ponderación ya alcanza el 100 %.', 'info'); return; }
      App.cambio('plan');
      pintarPlan();
      UI.avisoFlotante('Ponderación completada al 100 %.');
    });

    var btnCopiar = UI.$('btn-plan-copiar');
    if (btnCopiar) btnCopiar.addEventListener('click', function () {
      var sel = seleccion();
      if (!PlanUtil.valida(sel)) { UI.avisoFlotante('Seleccione año, sección, asignatura y lapso.', 'error'); return; }
      var opciones = ZZ.LAPSOS.filter(function (l) { return String(l.n) !== String(sel.lapso); })
        .map(function (l) { return { valor: l.n, texto: 'Copiar desde el ' + l.titulo }; });
      if (!opciones.length) return;
      UI.modal({
        titulo: 'Copiar plan de otro lapso',
        texto: 'Se reemplazarán las actividades del ' + ZZ.tituloLapso(sel.lapso) +
          ' por las del lapso elegido (misma asignatura, año y sección). Las notas ya registradas no se modifican.',
        campo: 'select', etiqueta: 'Lapso de origen', opciones: opciones,
        aceptar: 'Copiar plan', peligro: true,
        onAceptar: function (v) {
          var origen = { anio: sel.anio, seccion: sel.seccion, asignatura: sel.asignatura, lapso: v };
          var actsOrigen = PlanUtil.actividades(origen, false);
          if (!actsOrigen.length) { UI.avisoFlotante('El lapso de origen no tiene actividades.', 'error'); return; }
          var actual = PlanUtil.actividades(sel);
          actual.length = 0;
          actsOrigen.forEach(function (a) {
            var copia = JSON.parse(JSON.stringify(a));
            copia.id = ZZ.nuevoId('act');
            actual.push(copia);
          });
          App.cambio('plan');
          pintarPlan();
          UI.avisoFlotante('Plan copiado desde el ' + ZZ.tituloLapso(v) + '.');
        }
      });
    });

    var btnLimpiar = UI.$('btn-plan-limpiar');
    if (btnLimpiar) btnLimpiar.addEventListener('click', function () {
      var sel = seleccion();
      var acts = PlanUtil.actividades(sel);
      if (!acts.length) return;
      UI.confirmar('Vaciar plan del lapso',
        'Se eliminarán las ' + acts.length + ' actividades del ' + ZZ.tituloLapso(sel.lapso) +
        ' y las notas asociadas. ¿Continuar?',
        function () {
          var m = estado().notas[ZZ.clave(sel)];
          if (m) delete estado().notas[ZZ.clave(sel)];
          acts.length = 0;
          App.cambio('plan');
          pintarPlan();
          UI.avisoFlotante('Plan vaciado.');
        }, { aceptar: 'Sí, vaciar', peligro: true });
    });

    var btnImp = UI.$('btn-imprimir-plan');
    if (btnImp) btnImp.addEventListener('click', function () {
      var sel = seleccion();
      if (!PlanUtil.valida(sel)) { UI.avisoFlotante('Seleccione año, sección, asignatura y lapso.', 'error'); return; }
      var docs = ZZ.LAPSOS.map(function (l) {
        return documentoPlan({ anio: sel.anio, seccion: sel.seccion, asignatura: sel.asignatura, lapso: l.n });
      }).filter(function (d, i) {
        var acts = PlanUtil.actividades({ anio: sel.anio, seccion: sel.seccion, asignatura: sel.asignatura, lapso: ZZ.LAPSOS[i].n }, false);
        return acts.length > 0;
      });
      if (!docs.length) { UI.avisoFlotante('No hay actividades planificadas para imprimir.', 'info'); return; }
      Export.imprimir(docs);
    });

    var btnXls = UI.$('btn-excel-plan');
    if (btnXls) btnXls.addEventListener('click', function () {
      var sel = seleccion();
      if (!PlanUtil.valida(sel)) { UI.avisoFlotante('Seleccione año, sección, asignatura y lapso.', 'error'); return; }
      var hojas = ZZ.LAPSOS.map(function (l) {
        return hojaPlan({ anio: sel.anio, seccion: sel.seccion, asignatura: sel.asignatura, lapso: l.n });
      });
      Export.excel('Zazarabicoa-Plan-' + sel.anio + sel.seccion + '-' + UI.selloArchivo() + '.xls', hojas);
    });

    App.alCambiar(function (motivo, op) {
      if (motivo === 'reemplazado' || motivo === 'restaurado') { refrescarSelectores(); pintarPlan(); }
    });
  }

  /* ══════════════════════ DOCUMENTO Y HOJA DE CÁLCULO ═══════════════════ */

  function documentoPlan(sel) {
    var acts = PlanUtil.actividades(sel, false);
    var i = config().institucion;
    var total = ZZ.sumaPonderacion(acts);
    var filas = acts.map(function (a, n) {
      return '<tr><td class="c">' + (n + 1) + '</td><td>' + UI.esc(a.nombre) + '</td>' +
        '<td class="chico">' + UI.esc(a.tipo) + '</td>' +
        '<td class="chico">' + UI.esc(a.contenido) + '</td>' +
        '<td class="chico">' + UI.esc(a.tecnica) + '</td>' +
        '<td class="chico">' + UI.esc(a.instrumento) + '</td>' +
        '<td class="c">' + ZZ.fmtNota(a.ponderacion) + ' %</td>' +
        '<td class="c">' + ZZ.fmt2(PlanUtil.puntosDe(a.ponderacion)) + '</td></tr>';
    }).join('');

    return '<div class="doc-oficial doc-horizontal">' + Export.membrete() +
      '<h2 class="doc-titulo">Plan de evaluación</h2>' +
      '<p class="doc-subtitulo">' + UI.esc(i.anioEscolar || '') + ' &middot; ' + ZZ.tituloLapso(sel.lapso).toUpperCase() +
      ' &middot; ' + sel.anio + '° Año, sección «' + UI.esc(sel.seccion) + '»</p>' +
      Export.ficha([
        ['Asignatura', ZZ.nombreAsignatura(estado(), sel.asignatura)],
        ['Docente', ZZ.nombreDocente(config()) + '  (C.I. ' + (config().docente.cedulaTipo || 'V') + '-' + (config().docente.cedula || '') + ')'],
        ['Matrícula', String(ZZ.estudiantesDe(estado(), sel.anio, sel.seccion).length) + ' estudiantes'],
        ['Momento / lapso', ZZ.tituloLapso(sel.lapso)]
      ]) +
      '<table class="tabla-doc"><thead><tr>' +
      '<th style="width:4%">N°</th><th style="width:19%">Actividad evaluativa</th>' +
      '<th style="width:11%">Tipo</th><th style="width:26%">Contenido programático / referente teórico-práctico</th>' +
      '<th style="width:13%">Técnica / estrategia</th><th style="width:13%">Instrumento</th>' +
      '<th style="width:7%">Ponderación</th><th style="width:7%">Puntos</th></tr></thead><tbody>' +
      (filas || '<tr><td colspan="8" class="c">Sin actividades planificadas</td></tr>') +
      '<tr><td colspan="6" style="text-align:right"><b>TOTAL</b></td>' +
      '<td class="c"><b>' + ZZ.fmt2(total) + ' %</b></td>' +
      '<td class="c"><b>' + ZZ.fmt2(PlanUtil.puntosDe(total)) + '</b></td></tr>' +
      '</tbody></table>' +
      '<p class="doc-leyenda"><b>Observaciones:</b> la ponderación total equivale a ' + ZZ.fmtNota(config().ajustes.escalaMax) +
      ' puntos de la escala vigesimal. ' +
      (total === 100 ? 'La ponderación alcanza el 100 %.' : 'Atención: la ponderación suma ' + ZZ.fmt2(total) + ' %.') + '</p>' +
      '<p class="doc-nota-pie">Plan elaborado conforme a los criterios de evaluación del ' +
      UI.esc(i.nombre || '') + ' &middot; Generado el ' + UI.fechaLarga() + '.</p>' +
      Export.firmas() + '</div>';
  }

  function hojaPlan(sel) {
    var acts = PlanUtil.actividades(sel, false);
    var enc = Export.encabezadoExcel('PLAN DE EVALUACIÓN — ' + ZZ.tituloLapso(sel.lapso).toUpperCase());
    var filas = acts.map(function (a, n) {
      return [
        n + 1, a.nombre, a.tipo, a.contenido, a.tecnica, a.instrumento,
        { v: ZZ.numero(a.ponderacion) || 0, c: 'aprobado' },
        PlanUtil.puntosDe(a.ponderacion)
      ];
    });
    var total = ZZ.sumaPonderacion(acts);
    return {
      nombre: 'Plan ' + sel.lapso + ' L',
      titulo: enc.titulo,
      subtitulos: enc.subtitulos.concat([
        ZZ.nombreAsignatura(estado(), sel.asignatura) + '  |  ' + sel.anio + '° Año, sección «' + sel.seccion + '»  |  ' + ZZ.tituloLapso(sel.lapso)
      ]),
      columnas: ['N°', 'Actividad evaluativa', 'Tipo', 'Contenido / referente', 'Técnica', 'Instrumento', 'Ponderación %', 'Puntos'],
      anchos: [40, 210, 130, 330, 150, 160, 90, 70],
      filas: filas,
      pie: ['TOTAL DE LA PONDERACIÓN: ' + ZZ.fmt2(total) + ' % de 100 % — equivale a ' + ZZ.fmt2(PlanUtil.puntosDe(total)) + ' puntos',
        total === 100 ? 'Ponderación correcta: alcanza el 100 %.' : 'ATENCIÓN: la ponderación no alcanza el 100 %.'],
      nota: 'El docente puede modificar la ponderación de cada evaluación; el sistema calcula los puntos equivalentes sobre 20.'
    };
  }

  VISTAS.plan = {
    render: render,
    iniciar: iniciar,
    refrescarSelectores: refrescarSelectores,
    documento: documentoPlan,
    hojaExcel: hojaPlan,
    seleccion: seleccion
  };
})(typeof window !== 'undefined' ? window : globalThis);
