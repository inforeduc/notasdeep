/* ============================================================================
   continua.js — Módulo 4: registro de evaluación continua y definitiva del
   lapso. El docente define y modifica la ponderación de cada evaluación y
   carga las notas en la escala vigesimal (01 – 20).
   ========================================================================== */
(function (raiz) {
  'use strict';

  var VISTAS = raiz.VISTAS = raiz.VISTAS || {};
  var IDS = { anio: 'ec-anio', seccion: 'ec-seccion', asignatura: 'ec-asignatura', lapso: 'ec-lapso' };

  function estado() { return App.estado; }
  function config() { return App.estado.config; }
  function seleccion() { return PlanUtil.seleccion(IDS); }

  function refrescarSelectores() {
    var anios = config().anios.map(function (n) { return { valor: n, texto: n + '° Año' }; });
    var secciones = config().secciones.map(function (s) { return { valor: s, texto: 'Sección «' + s + '»' }; });
    var asignaturas = config().asignaturas.map(function (a) { return { valor: a.id, texto: a.nombre }; });
    UI.llenarSelect(IDS.anio, anios.length ? anios : [{ valor: '', texto: '(sin años)' }]);
    UI.llenarSelect(IDS.seccion, secciones.length ? secciones : [{ valor: '', texto: '(sin secciones)' }]);
    UI.llenarSelect(IDS.asignatura, asignaturas.length ? asignaturas : [{ valor: '', texto: '(sin asignaturas)' }]);
    UI.llenarSelect(IDS.lapso, ZZ.LAPSOS.map(function (l) { return { valor: l.n, texto: l.titulo }; }));
    App.aplicarContexto(IDS);
  }

  function render() {
    refrescarSelectores();
    pintarTodo();
  }

  function pintarTodo() {
    pintarPonderacion();
    pintarMatriz();
  }

  /* ══════════════════════ PONDERACIÓN MODIFICABLE ═══════════════════════ */

  function pintarPonderacion() {
    var sel = seleccion();
    var acts = PlanUtil.actividades(sel);
    var cuerpo = UI.$('cuerpo-ponderacion');
    var aviso = UI.$('ec-aviso-plan');
    if (!cuerpo) return;

    if (!PlanUtil.valida(sel)) {
      cuerpo.innerHTML = '<tr><td colspan="6" class="sin-datos">Complete la configuración en la pestaña 1 (años, secciones y asignaturas).</td></tr>';
      PlanUtil.medidor('ec', []);
      if (aviso) { aviso.className = 'mensaje-aviso'; aviso.innerHTML = 'Falta completar la configuración inicial para poder evaluar.'; }
      return;
    }

    if (!acts.length) {
      cuerpo.innerHTML = '<tr><td colspan="6" class="sin-datos">No hay evaluaciones definidas para este lapso. ' +
        'Agregue una evaluación o pulse «Traer actividades del plan de evaluación».</td></tr>';
    } else {
      cuerpo.innerHTML = acts.map(function (a, i) {
        return '<tr data-id="' + a.id + '">' +
          '<td class="celda-num">' + (i + 1) + '</td>' +
          '<td><input type="text" data-campo="nombre" data-id="' + a.id + '" value="' + UI.esc(a.nombre) + '"></td>' +
          '<td><input type="text" list="lista-tipos" data-campo="tipo" data-id="' + a.id + '" value="' + UI.esc(a.tipo) + '"></td>' +
          '<td class="celda-num"><input type="number" class="ponderacion" min="0" max="100" step="0.5" data-campo="ponderacion" data-id="' + a.id + '" value="' + ZZ.fmtNota(a.ponderacion) + '"></td>' +
          '<td class="celda-num" data-puntos-id="' + a.id + '">' + ZZ.fmt2(PlanUtil.puntosDe(a.ponderacion)) + ' pts</td>' +
          '<td class="col-acciones">' +
          '<button class="btn-icono" data-accion="subir" data-id="' + a.id + '" title="Subir">⬆️</button>' +
          '<button class="btn-icono" data-accion="bajar" data-id="' + a.id + '" title="Bajar">⬇️</button>' +
          '<button class="btn-icono" data-accion="duplicar" data-id="' + a.id + '" title="Duplicar">⧉</button>' +
          '<button class="btn-icono" data-accion="borrar" data-id="' + a.id + '" title="Eliminar">🗑️</button>' +
          '</td></tr>';
      }).join('');
    }
    var total = PlanUtil.medidor('ec', acts);

    if (aviso) {
      if (!acts.length) {
        aviso.className = 'mensaje-aviso';
        aviso.innerHTML = '⚠ Todavía no hay evaluaciones en este lapso. El docente debe definirlas aquí o traerlas del plan de evaluación.';
      } else if (total !== 100) {
        aviso.className = 'mensaje-aviso';
        aviso.innerHTML = '⚠ La ponderación suma <b>' + ZZ.fmt2(total) + ' %</b>. Debe alcanzar exactamente el 100 % ' +
          '(equivalente a ' + ZZ.fmtNota(config().ajustes.escalaMax) + ' puntos) para que las notas definitivas sean oficiales.';
      } else {
        aviso.className = 'mensaje-aviso oculto';
        aviso.innerHTML = '';
      }
    }
    return total;
  }

  /* ═══════════════════════════ MATRIZ DE NOTAS ══════════════════════════ */

  function pintarMatriz() {
    var sel = seleccion();
    var cabeza = UI.$('cabeza-notas');
    var cuerpo = UI.$('cuerpo-notas');
    var pie = UI.$('pie-notas');
    var chip = UI.$('ec-chip-notas');
    if (!cabeza || !cuerpo) return;

    if (!PlanUtil.valida(sel)) {
      cabeza.innerHTML = '';
      cuerpo.innerHTML = '<tr><td class="sin-datos">Complete la configuración inicial.</td></tr>';
      if (pie) pie.innerHTML = '';
      pintarEstadisticas(null);
      return;
    }

    var datos = PlanUtil.matriz(sel);
    var acts = datos.actividades;

    cabeza.innerHTML = '<tr>' +
      '<th class="col-num">N°</th>' +
      '<th class="celda-fija" style="min-width:230px">Apellidos y nombres</th>' +
      acts.map(function (a) {
        return '<th class="celda-num" title="' + UI.esc(a.nombre + ' — ' + a.tipo) + '">' +
          '<div>' + UI.esc(recortar(a.nombre, 22)) + '</div>' +
          '<div style="font-weight:400;font-size:11px">' + ZZ.fmtNota(a.ponderacion) + ' %</div></th>';
      }).join('') +
      '<th class="celda-num" style="min-width:96px">Puntos acumulados</th>' +
      '<th class="celda-num" style="min-width:92px">Nota definitiva</th>' +
      '<th class="celda-num" style="min-width:110px">Condición</th>' +
      '</tr>';

    if (!datos.filas.length) {
      cuerpo.innerHTML = '<tr><td colspan="' + (acts.length + 5) + '" class="sin-datos">No hay estudiantes registrados en ' +
        sel.anio + '° Año, sección «' + UI.esc(sel.seccion) + '». Cárguelos en la pestaña 2 (Nómina).</td></tr>';
    } else if (!acts.length) {
      cuerpo.innerHTML = '<tr><td colspan="5" class="sin-datos">Defina primero las evaluaciones y su ponderación.</td></tr>';
    } else {
      cuerpo.innerHTML = datos.filas.map(function (f, i) {
        return '<tr data-est="' + f.estudiante.id + '">' +
          '<td class="celda-num">' + (i + 1) + '</td>' +
          '<td class="celda-fija"><b>' + UI.esc(f.estudiante.apellidos) + '</b> ' + UI.esc(f.estudiante.nombres) +
          '<div class="ayuda" style="margin:0">' + UI.esc(f.estudiante.cedula || '') + '</div></td>' +
          acts.map(function (a) {
            var v = f.notas[a.id];
            return '<td class="celda-num"><input type="number" class="nota" min="0" max="' +
              (ZZ.numero(config().ajustes.escalaMax) || 20) + '" step="0.5" ' +
              'data-est="' + f.estudiante.id + '" data-act="' + a.id + '" value="' + (v == null ? '' : ZZ.fmtNota(v)) + '"></td>';
          }).join('') +
          '<td class="celda-num" data-celda="puntos">' + celdaPuntos(f) + '</td>' +
          '<td class="celda-num" data-celda="definitiva">' + celdaDefinitiva(f) + '</td>' +
          '<td class="celda-num" data-celda="condicion">' + celdaCondicion(f) + '</td>' +
          '</tr>';
      }).join('');
    }

    if (pie) {
      if (datos.filas.length && acts.length) {
        pie.innerHTML = '<tr><td class="celda-fija"></td><td class="celda-fija">Promedio del curso por evaluación</td>' +
          acts.map(function (a) {
            var vals = datos.filas.map(function (f) { return ZZ.numero(f.notas[a.id]); })
              .filter(function (v) { return v !== null; });
            var prom = vals.length ? ZZ.redondear(vals.reduce(function (x, y) { return x + y; }, 0) / vals.length, 2) : null;
            return '<td class="celda-num">' + (prom === null ? '—' : ZZ.fmt2(prom)) + '</td>';
          }).join('') +
          '<td class="celda-num">' + ZZ.fmt2(datos.estadisticas.promedio) + '</td>' +
          '<td class="celda-num">' + ZZ.fmt2(datos.estadisticas.promedio) + '</td>' +
          '<td class="celda-num">' + datos.estadisticas.aprobados + ' / ' + datos.filas.length + '</td></tr>';
      } else pie.innerHTML = '';
    }

    if (chip) {
      var registradas = 0, posibles = datos.filas.length * acts.length;
      datos.filas.forEach(function (f) { registradas += Object.keys(f.notas).length; });
      chip.textContent = registradas + ' de ' + posibles + ' notas registradas';
    }
    pintarEstadisticas(datos.estadisticas);
  }

  function recortar(t, n) {
    var s = String(t || '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  function celdaPuntos(f) {
    if (!f.calculo) return '<span class="sin-datos">—</span>';
    return ZZ.fmt2(f.calculo.puntos) + (f.calculo.completo ? '' : ' <span class="ayuda">*</span>');
  }

  function celdaDefinitiva(f) {
    if (f.definitiva.definitiva === null) return '<span class="sin-datos">—</span>';
    return '<b>' + ZZ.fmtNota(f.definitiva.definitiva) + '</b> <span class="ayuda">(' + ZZ.fmt2(f.definitiva.exacto) + ')</span>';
  }

  function celdaCondicion(f) {
    if (f.definitiva.definitiva === null) return '<span class="sin-datos">SIN DATOS</span>';
    var c = f.definitiva.condicion === 'APROBADO' ? 'aprobado' : 'reprobado';
    return '<span class="' + (c === 'aprobado' ? 'verde' : 'rojo') + '">' + f.definitiva.condicion + '</span>';
  }

  function pintarEstadisticas(est) {
    var caja = UI.$('ec-estadisticas');
    if (!caja) return;
    if (!est) { caja.innerHTML = '<p class="ayuda">Sin datos para mostrar.</p>'; return; }
    var max = config().ajustes.escalaMax;
    var tarjetas = [
      { r: 'Matrícula total', v: est.matricula, c: '' },
      { r: 'Evaluados', v: est.evaluados, c: '' },
      { r: 'Aprobados', v: est.aprobados, c: 'verde', extra: ZZ.fmtPct(est.porcAprobados) + ' de los evaluados' },
      { r: 'Reprobados', v: est.reprobados, c: 'roja', extra: ZZ.fmtPct(est.porcReprobados) + ' de los evaluados' },
      { r: 'Promedio general del curso', v: ZZ.fmt2(est.promedio), c: 'ambar', extra: 'sobre ' + ZZ.fmtNota(max) + ' puntos' },
      { r: 'Sin evaluar', v: Math.max(0, est.matricula - est.evaluados), c: '' }
    ];
    caja.innerHTML = tarjetas.map(function (t) {
      return '<div class="estadistica ' + t.c + '"><div class="valor">' + t.v + '</div>' +
        '<div class="rotulo">' + t.r + '</div>' +
        (t.extra ? '<div class="ayuda" style="margin:2px 0 0">' + t.extra + '</div>' : '') + '</div>';
    }).join('');
  }

  /** Actualiza sólo las celdas calculadas de un estudiante (sin redibujar). */
  function actualizarFila(idEst) {
    var sel = seleccion();
    var acts = PlanUtil.actividades(sel, false);
    var notas = ZZ.notasDe(estado(), sel)[idEst] || {};
    var calculo = ZZ.puntosDe(acts, notas);
    var f = { notas: notas, calculo: calculo, definitiva: ZZ.calcularDefinitiva(calculo ? calculo.puntos : null, config().ajustes) };
    var fila = UI.$$('#cuerpo-notas tr[data-est="' + idEst + '"]')[0];
    if (!fila) return;
    var c1 = fila.querySelector('[data-celda="puntos"]');
    var c2 = fila.querySelector('[data-celda="definitiva"]');
    var c3 = fila.querySelector('[data-celda="condicion"]');
    if (c1) c1.innerHTML = celdaPuntos(f);
    if (c2) c2.innerHTML = celdaDefinitiva(f);
    if (c3) c3.innerHTML = celdaCondicion(f);
    pintarEstadisticas(PlanUtil.matriz(sel).estadisticas);
  }

  /* ══════════════════════════════ EVENTOS ══════════════════════════════ */

  function iniciar() {
    ['ec-anio', 'ec-seccion', 'ec-asignatura', 'ec-lapso'].forEach(function (id) {
      var el = UI.$(id);
      if (el) el.addEventListener('change', function () {
        App.recordarContexto(seleccion());
        pintarTodo();
      });
    });

    /* Panel de ponderación ------------------------------------------------ */
    var cuerpoPond = UI.$('cuerpo-ponderacion');
    if (cuerpoPond) {
      cuerpoPond.addEventListener('input', function (ev) {
        var el = ev.target;
        var campo = el.getAttribute('data-campo');
        var id = el.getAttribute('data-id');
        if (!campo || !id) return;
        var acts = PlanUtil.actividades(seleccion());
        var act = acts.filter(function (a) { return a.id === id; })[0];
        if (!act) return;
        if (campo === 'ponderacion') {
          var v = ZZ.numero(el.value);
          act.ponderacion = v === null ? 0 : Math.max(0, Math.min(100, v));
          var celda = UI.$$('[data-puntos-id="' + id + '"]', cuerpoPond)[0];
          if (celda) celda.textContent = ZZ.fmt2(PlanUtil.puntosDe(act.ponderacion)) + ' pts';
          PlanUtil.medidor('ec', acts);
          pintarAvisoPlan(acts);
          App.cambio('ec-ponderacion', { redibujar: false });
        } else {
          act[campo] = el.value;
          App.cambio('ec-ponderacion', { redibujar: false });
        }
      });
      cuerpoPond.addEventListener('blur', function (ev) {
        var el = ev.target;
        if (el && el.getAttribute && el.getAttribute('data-campo') === 'ponderacion') {
          var v = ZZ.numero(el.value);
          el.value = ZZ.fmtNota(v === null ? 0 : v);
        }
      }, true);
      cuerpoPond.addEventListener('click', function (ev) {
        var btn = ev.target.closest ? ev.target.closest('[data-accion]') : null;
        if (!btn) return;
        var id = btn.getAttribute('data-id');
        var accion = btn.getAttribute('data-accion');
        var sel = seleccion();
        var acts = PlanUtil.actividades(sel);
        if (accion === 'subir' || accion === 'bajar') {
          PlanUtil.mover(acts, id, accion === 'subir' ? -1 : 1);
          App.cambio('ec'); pintarTodo();
        } else if (accion === 'duplicar') {
          PlanUtil.duplicar(acts, id);
          App.cambio('ec'); pintarTodo();
        } else if (accion === 'borrar') {
          var act = acts.filter(function (a) { return a.id === id; })[0];
          UI.confirmar('Eliminar evaluación',
            '¿Eliminar «' + UI.esc(act ? act.nombre : '') + '» y las notas registradas en ella?',
            function () {
              PlanUtil.quitarNotasActividad(sel, id);
              PlanUtil.eliminar(acts, id);
              App.cambio('ec'); pintarTodo();
            }, { aceptar: 'Sí, eliminar', peligro: true });
        }
      });
    }

    var btnAgregar = UI.$('btn-ec-agregar');
    if (btnAgregar) btnAgregar.addEventListener('click', function () {
      var sel = seleccion();
      if (!PlanUtil.valida(sel)) { UI.avisoFlotante('Complete año, sección, asignatura y lapso.', 'error'); return; }
      PlanUtil.agregar(sel, {});
      App.cambio('ec');
      pintarTodo();
      var nombres = UI.$$('#cuerpo-ponderacion input[data-campo="nombre"]');
      if (nombres.length) { nombres[nombres.length - 1].focus(); nombres[nombres.length - 1].select(); }
      UI.avisoFlotante('Evaluación agregada con la ponderación restante.');
    });

    var btnRepartir = UI.$('btn-ec-repartir');
    if (btnRepartir) btnRepartir.addEventListener('click', function () {
      var acts = PlanUtil.actividades(seleccion());
      if (!acts.length) { UI.avisoFlotante('No hay evaluaciones que repartir.', 'info'); return; }
      PlanUtil.repartir(acts);
      App.cambio('ec'); pintarTodo();
      UI.avisoFlotante('Ponderación repartida en partes iguales (100 %).');
    });

    var btnCompletar = UI.$('btn-ec-completar');
    if (btnCompletar) btnCompletar.addEventListener('click', function () {
      var acts = PlanUtil.actividades(seleccion());
      if (!PlanUtil.completar(acts)) { UI.avisoFlotante('La ponderación ya alcanza el 100 %.', 'info'); return; }
      App.cambio('ec'); pintarTodo();
      UI.avisoFlotante('Ponderación completada al 100 %.');
    });

    var btnTraer = UI.$('btn-ec-copiar-plan');
    if (btnTraer) btnTraer.addEventListener('click', function () {
      var sel = seleccion();
      if (!PlanUtil.valida(sel)) { UI.avisoFlotante('Complete año, sección, asignatura y lapso.', 'error'); return; }
      var origen = { anio: sel.anio, seccion: sel.seccion, asignatura: sel.asignatura, lapso: sel.lapso };
      var actsOrigen = PlanUtil.actividades(origen, false);
      if (!actsOrigen.length) {
        UI.avisoFlotante('El plan de evaluación de este lapso está vacío. Defina primero las actividades en la pestaña 3.', 'error');
        return;
      }
      UI.confirmar('Traer actividades del plan de evaluación',
        'Se reemplazarán las ' + PlanUtil.actividades(sel).length + ' evaluaciones actuales por las ' +
        actsOrigen.length + ' del plan de este lapso. Las notas de evaluaciones con el mismo nombre se conservan cuando sea posible.',
        function () {
          var actuales = PlanUtil.actividades(sel);
          var notas = estado().notas[ZZ.clave(sel)] || {};
          var mapaPorNombre = {};
          actuales.forEach(function (a) { mapaPorNombre[a.nombre.toLowerCase()] = a.id; });
          actuales.length = 0;
          actsOrigen.forEach(function (a) {
            var copia = JSON.parse(JSON.stringify(a));
            var idViejo = mapaPorNombre[copia.nombre.toLowerCase()];
            copia.id = ZZ.nuevoId('act');
            actuales.push(copia);
            if (idViejo) {
              Object.keys(notas).forEach(function (est) {
                if (notas[est][idViejo] !== undefined) {
                  notas[est][copia.id] = notas[est][idViejo];
                  delete notas[est][idViejo];
                }
              });
            }
          });
          App.cambio('ec'); pintarTodo();
          UI.avisoFlotante('Se trajeron ' + actsOrigen.length + ' actividades del plan de evaluación.');
        });
    });

    /* Matriz de notas ----------------------------------------------------- */
    var cuerpoNotas = UI.$('cuerpo-notas');
    if (cuerpoNotas) {
      cuerpoNotas.addEventListener('input', function (ev) {
        var el = ev.target;
        if (!el.classList || !el.classList.contains('nota')) return;
        var idEst = el.getAttribute('data-est');
        var idAct = el.getAttribute('data-act');
        var sel = seleccion();
        var clave = ZZ.clave(sel);
        var tope = ZZ.numero(config().ajustes.escalaMax) || 20;
        var m = estado().notas[clave] = estado().notas[clave] || {};
        m[idEst] = m[idEst] || {};
        if (String(el.value).trim() === '') delete m[idEst][idAct];
        else {
          var v = ZZ.numero(el.value);
          if (v === null) delete m[idEst][idAct];
          else m[idEst][idAct] = Math.max(0, Math.min(tope, v));
        }
        if (String(el.value).trim() !== '' && ZZ.numero(el.value) > tope) el.classList.add('invalida');
        else el.classList.remove('invalida');
        actualizarFila(idEst);
        App.cambio('ec-nota', { redibujar: false });
      });
      cuerpoNotas.addEventListener('blur', function (ev) {
        var el = ev.target;
        if (!el.classList || !el.classList.contains('nota')) return;
        var v = ZZ.numero(el.value);
        var tope = ZZ.numero(config().ajustes.escalaMax) || 20;
        if (v !== null) el.value = ZZ.fmtNota(Math.max(0, Math.min(tope, v)));
        el.classList.remove('invalida');
      }, true);
      cuerpoNotas.addEventListener('keydown', function (ev) {
        var el = ev.target;
        if (!el.classList || !el.classList.contains('nota')) return;
        if (ev.key === 'Enter' || ev.key === 'ArrowDown') {
          ev.preventDefault();
          moverFoco(el, 1);
        } else if (ev.key === 'ArrowUp') {
          ev.preventDefault();
          moverFoco(el, -1);
        }
      });
    }

    var btnLlenar = UI.$('btn-ec-llenar');
    if (btnLlenar) btnLlenar.addEventListener('click', function () {
      var sel = seleccion();
      var acts = PlanUtil.actividades(sel, false);
      var filas = ZZ.estudiantesDe(estado(), sel.anio, sel.seccion);
      if (!acts.length || !filas.length) { UI.avisoFlotante('No hay evaluaciones o estudiantes para llenar.', 'error'); return; }
      UI.modal({
        titulo: 'Llenar una evaluación',
        texto: 'Se cargará la misma nota a todos los estudiantes que aún no tengan calificación registrada en la evaluación elegida.',
        campo: 'select', etiqueta: 'Evaluación', aceptar: 'Continuar',
        opciones: acts.map(function (a) { return { valor: a.id, texto: a.nombre + ' (' + ZZ.fmtNota(a.ponderacion) + ' %)' }; }),
        onAceptar: function (idAct) {
          UI.modal({
            titulo: 'Nota a asignar',
            texto: 'Escriba la calificación (escala 01 – ' + ZZ.fmtNota(config().ajustes.escalaMax) + ').',
            campo: 'numero', etiqueta: 'Nota', valor: 10, min: 0, max: ZZ.numero(config().ajustes.escalaMax) || 20, paso: 0.5,
            aceptar: 'Llenar',
            onAceptar: function (v) {
              var nota = ZZ.numero(v);
              if (nota === null) { UI.avisoFlotante('Nota no válida.', 'error'); return; }
              var tope = ZZ.numero(config().ajustes.escalaMax) || 20;
              nota = Math.max(0, Math.min(tope, nota));
              var clave = ZZ.clave(sel);
              var m = estado().notas[clave] = estado().notas[clave] || {};
              var n = 0;
              filas.forEach(function (e) {
                m[e.id] = m[e.id] || {};
                if (m[e.id][idAct] === undefined) { m[e.id][idAct] = nota; n += 1; }
              });
              App.cambio('ec'); pintarTodo();
              UI.avisoFlotante('Se asignó ' + ZZ.fmtNota(nota) + ' a ' + n + ' estudiante(s) sin nota.');
            }
          });
        }
      });
    });

    var btnLimpiarNotas = UI.$('btn-ec-limpiar-notas');
    if (btnLimpiarNotas) btnLimpiarNotas.addEventListener('click', function () {
      var sel = seleccion();
      var clave = ZZ.clave(sel);
      if (!estado().notas[clave]) { UI.avisoFlotante('No hay notas registradas en este lapso.', 'info'); return; }
      UI.confirmar('Borrar todas las notas del lapso',
        'Se borrarán todas las calificaciones de ' + ZZ.nombreAsignatura(estado(), sel.asignatura) + ', ' +
        sel.anio + '° Año, sección «' + sel.seccion + '», ' + ZZ.tituloLapso(sel.lapso) + '. Las ponderaciones se mantienen. ¿Continuar?',
        function () {
          delete estado().notas[clave];
          App.cambio('ec'); pintarTodo();
          UI.avisoFlotante('Notas del lapso borradas.');
        }, { aceptar: 'Sí, borrar', peligro: true });
    });

    var btnOrdenar = UI.$('btn-ec-ordenar');
    if (btnOrdenar) btnOrdenar.addEventListener('click', function () {
      if (VISTAS.nomina && VISTAS.nomina.ordenar) VISTAS.nomina.ordenar();
      ordenarPorNota(false);
      App.cambio('ec'); pintarTodo();
      UI.avisoFlotante('Estudiantes ordenados por apellidos.');
    });

    var btnImp = UI.$('btn-ec-imprimir');
    if (btnImp) btnImp.addEventListener('click', function () {
      var sel = seleccion();
      if (!PlanUtil.valida(sel)) { UI.avisoFlotante('Seleccione año, sección, asignatura y lapso.', 'error'); return; }
      Export.imprimir(documentoContinua(sel));
    });

    var btnXls = UI.$('btn-ec-excel');
    if (btnXls) btnXls.addEventListener('click', function () {
      var sel = seleccion();
      if (!PlanUtil.valida(sel)) { UI.avisoFlotante('Seleccione año, sección, asignatura y lapso.', 'error'); return; }
      Export.excel('Zazarabicoa-Evaluacion-' + sel.anio + sel.seccion + '-L' + sel.lapso + '-' + UI.selloArchivo() + '.xls',
        [hojaContinua(sel)]);
    });

    App.alCambiar(function (motivo, op) {
      if (motivo === 'reemplazado' || motivo === 'restaurado') { refrescarSelectores(); pintarTodo(); }
      if (motivo === 'plan' || motivo === 'plan-ponderacion') pintarPonderacion();
    });
  }

  function pintarAvisoPlan(acts) {
    var aviso = UI.$('ec-aviso-plan');
    if (!aviso) return;
    var total = ZZ.sumaPonderacion(acts);
    if (!acts.length) {
      aviso.className = 'mensaje-aviso';
      aviso.innerHTML = '⚠ Todavía no hay evaluaciones en este lapso.';
    } else if (total !== 100) {
      aviso.className = 'mensaje-aviso';
      aviso.innerHTML = '⚠ La ponderación suma <b>' + ZZ.fmt2(total) + ' %</b>. Debe alcanzar exactamente el 100 %.';
    } else {
      aviso.className = 'mensaje-aviso oculto';
      aviso.innerHTML = '';
    }
  }

  function moverFoco(el, delta) {
    var inputs = UI.$$('#cuerpo-notas input.nota');
    var i = inputs.indexOf(el);
    if (i < 0) return;
    var siguiente = inputs[i + delta];
    if (siguiente) { siguiente.focus(); siguiente.select(); }
  }

  function ordenarPorNota(descendente) {
    var sel = seleccion();
    var datos = PlanUtil.matriz(sel);
    var orden = datos.filas.slice().sort(function (a, b) {
      var va = a.definitiva.definitiva === null ? -1 : a.definitiva.definitiva;
      var vb = b.definitiva.definitiva === null ? -1 : b.definitiva.definitiva;
      return descendente ? vb - va : va - vb;
    });
    var e = estado();
    var ids = orden.map(function (f) { return f.estudiante.id; });
    var otros = e.estudiantes.filter(function (x) { return ids.indexOf(x.id) < 0; });
    var porId = {};
    e.estudiantes.forEach(function (x) { porId[x.id] = x; });
    e.estudiantes = otros.concat(ids.map(function (id) { return porId[id]; }));
  }

  /* ══════════════════════ DOCUMENTO Y HOJA DE CÁLCULO ═══════════════════ */

  function documentoContinua(sel) {
    var d = PlanUtil.matriz(sel);
    var acts = d.actividades;
    var est = d.estadisticas;
    var i = config().institucion;

    var filas = d.filas.map(function (f, n) {
      return '<tr class="' + (f.definitiva.condicion === 'APROBADO' ? 'aprobado' : (f.definitiva.definitiva === null ? '' : 'reprobado')) + '">' +
        '<td class="c">' + (n + 1) + '</td>' +
        '<td class="c chico">' + UI.esc(f.estudiante.cedula || '') + '</td>' +
        '<td class="chico">' + UI.esc(f.estudiante.apellidos + ' ' + f.estudiante.nombres) + '</td>' +
        acts.map(function (a) {
          var v = f.notas[a.id];
          return '<td class="c">' + (v == null ? '' : ZZ.fmtNota(v)) + '</td>';
        }).join('') +
        '<td class="c">' + (f.calculo ? ZZ.fmt2(f.calculo.puntos) : '') + '</td>' +
        '<td class="c"><b>' + (f.definitiva.definitiva === null ? '' : ZZ.fmtNota(f.definitiva.definitiva)) + '</b></td>' +
        '<td class="c chico">' + (f.definitiva.definitiva === null ? 'SIN DATOS' : f.definitiva.condicion) + '</td></tr>';
    }).join('');

    return '<div class="doc-oficial doc-horizontal">' + Export.membrete() +
      '<h2 class="doc-titulo">Registro de evaluación continua y calificaciones definitivas</h2>' +
      '<p class="doc-subtitulo">' + UI.esc(i.anioEscolar || '') + ' &middot; ' + ZZ.tituloLapso(sel.lapso).toUpperCase() +
      ' &middot; ' + sel.anio + '° Año, sección «' + UI.esc(sel.seccion) + '»</p>' +
      Export.ficha([
        ['Asignatura', ZZ.nombreAsignatura(estado(), sel.asignatura)],
        ['Docente', ZZ.nombreDocente(config())],
        ['Cédula del docente', (config().docente.cedulaTipo || 'V') + '-' + (config().docente.cedula || '')],
        ['Momento / lapso', ZZ.tituloLapso(sel.lapso)]
      ]) +
      '<table class="tabla-doc"><thead><tr>' +
      '<th style="width:3%">N°</th><th style="width:8%">Cédula</th><th style="width:20%">Apellidos y nombres</th>' +
      acts.map(function (a) {
        return '<th title="' + UI.esc(a.nombre) + '">' + UI.esc(recortar(a.nombre, 16)) + '<br><span style="font-weight:400">' +
          ZZ.fmtNota(a.ponderacion) + ' %</span></th>';
      }).join('') +
      '<th style="width:7%">Puntos acum.</th><th style="width:7%">Nota def.</th><th style="width:9%">Condición</th>' +
      '</tr></thead><tbody>' + (filas || '<tr><td colspan="' + (acts.length + 6) + '" class="c">Sin estudiantes registrados</td></tr>') +
      '<tr><td colspan="' + (acts.length + 3) + '" style="text-align:right"><b>PONDERACIÓN TOTAL</b></td>' +
      '<td class="c"><b>' + ZZ.fmt2(ZZ.sumaPonderacion(acts)) + ' %</b></td><td colspan="2"></td></tr>' +
      '</tbody></table>' +
      '<table class="doc-estadisticas"><tr>' +
      '<td><span class="rotulo">Matrícula</span><span class="valor">' + est.matricula + '</span></td>' +
      '<td><span class="rotulo">Evaluados</span><span class="valor">' + est.evaluados + '</span></td>' +
      '<td><span class="rotulo">Aprobados</span><span class="valor">' + est.aprobados + '</span><span class="rotulo">' + ZZ.fmtPct(est.porcAprobados) + '</span></td>' +
      '<td><span class="rotulo">Reprobados</span><span class="valor">' + est.reprobados + '</span><span class="rotulo">' + ZZ.fmtPct(est.porcReprobados) + '</span></td>' +
      '<td><span class="rotulo">Promedio general</span><span class="valor">' + ZZ.fmt2(est.promedio) + '</span></td>' +
      '</tr></table>' +
      '<p class="doc-leyenda">Puntos acumulados = Σ (nota × % ÷ 100). Nota definitiva del lapso según el criterio de redondeo: ' +
      UI.esc((ZZ.MODOS_REDONDEO.filter(function (m) { return m.id === config().ajustes.modoRedondeo; })[0] || {}).titulo || '') +
      '. Nota mínima aprobatoria: ' + ZZ.fmtNota(config().ajustes.minima) + ' puntos. Escala vigesimal 01–' +
      ZZ.fmtNota(config().ajustes.escalaMax) + '.</p>' +
      '<p class="doc-nota-pie">Los porcentajes de aprobados y reprobados se calculan sobre los estudiantes evaluados. ' +
      'Generado el ' + UI.fechaLarga() + '.</p>' +
      Export.firmas() + '</div>';
  }

  function hojaContinua(sel) {
    var d = PlanUtil.matriz(sel);
    var acts = d.actividades;
    var est = d.estadisticas;
    var enc = Export.encabezadoExcel('REGISTRO DE EVALUACIÓN CONTINUA Y CALIFICACIONES DEFINITIVAS — ' +
      ZZ.tituloLapso(sel.lapso).toUpperCase());
    var columnas = ['N°', 'Cédula', 'Apellidos y nombres'].concat(acts.map(function (a) {
      return recortar(a.nombre, 24) + ' (' + ZZ.fmtNota(a.ponderacion) + '%)';
    })).concat(['Puntos acumulados', 'Nota definitiva', 'Condición']);
    var filas = d.filas.map(function (f, n) {
      var fila = [n + 1, f.estudiante.cedula || '', ZZ.nombreCompleto(f.estudiante)];
      acts.forEach(function (a) {
        var v = f.notas[a.id];
        fila.push(v == null ? { v: '', c: 'sin' } : v);
      });
      fila.push(f.calculo ? f.calculo.puntos : '');
      fila.push({ v: f.definitiva.definitiva === null ? '' : f.definitiva.definitiva,
        c: f.definitiva.condicion === 'APROBADO' ? 'aprobado' : (f.definitiva.definitiva === null ? '' : 'reprobado') });
      fila.push({ v: f.definitiva.definitiva === null ? 'SIN DATOS' : f.definitiva.condicion,
        c: f.definitiva.condicion === 'APROBADO' ? 'aprobado' : (f.definitiva.definitiva === null ? '' : 'reprobado') });
      return fila;
    });
    filas.push([{ v: 'PONDERACIÓN TOTAL', c: 'subtotal' }, '', ''].concat(
      acts.map(function (a) { return { v: ZZ.numero(a.ponderacion) || 0, c: 'subtotal' }; })
    ).concat([{ v: ZZ.sumaPonderacion(acts), c: 'subtotal' }, { v: '%', c: 'subtotal' }, '']));

    return {
      nombre: 'Lapso ' + sel.lapso,
      titulo: enc.titulo,
      subtitulos: enc.subtitulos.concat([
        ZZ.nombreAsignatura(estado(), sel.asignatura) + '  |  ' + sel.anio + '° Año, sección «' + sel.seccion + '»  |  ' + ZZ.tituloLapso(sel.lapso)
      ]),
      columnas: columnas,
      anchos: [40, 105, 240].concat(acts.map(function () { return 95; })).concat([100, 90, 130]),
      filas: filas,
      pie: [
        'Matrícula: ' + est.matricula + '   |   Evaluados: ' + est.evaluados +
        '   |   Aprobados: ' + est.aprobados + ' (' + ZZ.fmtPct(est.porcAprobados) + ')' +
        '   |   Reprobados: ' + est.reprobados + ' (' + ZZ.fmtPct(est.porcReprobados) + ')' +
        '   |   Promedio general: ' + ZZ.fmt2(est.promedio),
        'Puntos acumulados = Σ (nota × % ÷ 100). Nota definitiva según el criterio de redondeo configurado. Nota mínima aprobatoria: ' +
        ZZ.fmtNota(config().ajustes.minima) + ' puntos.'
      ],
      nota: 'Colores: verde = aprobado, rojo = reprobado. La ponderación de cada evaluación es modificable por el docente en la aplicación.'
    };
  }

  VISTAS.continua = {
    render: render,
    iniciar: iniciar,
    refrescarSelectores: refrescarSelectores,
    documento: documentoContinua,
    hojaExcel: hojaContinua,
    seleccion: seleccion
  };
})(typeof window !== 'undefined' ? window : globalThis);
