/* ============================================================================
   app.js — Arranque de la aplicación: navegación por pestañas, cabecera,
   refresco de selectores y coordinación entre módulos.
   ========================================================================== */
(function (raiz) {
  'use strict';

  var vistaActiva = 'configuracion';

  /* ══════════════════════════════ CABECERA ══════════════════════════════ */

  App.ponerEscudoCabecera = function () {
    var caja = UI.$('escudo-app');
    if (caja) caja.innerHTML = UI.escudoHtml('escudo-cabecera');
  };

  App.actualizarCabecera = function () {
    var c = App.estado.config;
    var i = c.institucion, d = c.docente;
    var sub = UI.$('cabecera-contexto');
    if (sub) {
      var partes = [];
      partes.push(i.nombre || 'Complejo Educativo "Zazarabicoa"');
      if (i.fundado) partes.push('Fundado en ' + i.fundado);
      if (i.anioEscolar) partes.push('Año escolar ' + i.anioEscolar);
      var docente = ZZ.nombreDocente(c);
      if (docente.indexOf('_') !== 0) partes.push('Docente: ' + docente);
      if (d.area) partes.push('Área: ' + d.area);
      sub.textContent = partes.join(' · ');
    }
    var pie = UI.$('pie-version');
    if (pie) {
      pie.textContent = 'Versión de datos ' + ZZ.VERSION_DATOS + ' · ' +
        (App.modo === 'nube' ? 'Nube (Firebase)' : 'Local (este equipo)') + ' · ' + UI.fechaHora();
    }
    var pieModo = UI.$('pie-modo');
    if (pieModo) {
      pieModo.textContent = App.usuario
        ? 'Sesión de ' + App.usuario.nombre + ' · ' +
          (App.modo === 'nube' ? 'sus datos se guardan en internet' : 'sus datos se guardan en este equipo')
        : 'Evaluación Docente de Zazarabicoa';
    }
    document.title = 'Evaluación Docente de Zazarabicoa' +
      (i.anioEscolar ? ' — ' + i.anioEscolar : '') +
      (docente2(c) ? ' — ' + docente2(c) : '');
  };

  function docente2(c) {
    var n = ZZ.nombreDocente(c);
    return n.indexOf('_') === 0 ? '' : n;
  }

  /* ══════════════════════ SELECTORES Y NAVEGACIÓN ═══════════════════════ */

  App.refrescarSelectores = function () {
    Object.keys(VISTAS).forEach(function (k) {
      var v = VISTAS[k];
      if (v && typeof v.refrescarSelectores === 'function') {
        try { v.refrescarSelectores(); } catch (e) { console.error(e); }
      }
    });
  };

  function renderVista(nombre) {
    var v = VISTAS[nombre];
    if (v && typeof v.render === 'function') {
      try { v.render(); } catch (e) {
        console.error(e);
        UI.avisoFlotante('Ocurrió un error al dibujar la sección: ' + e.message, 'error');
      }
    }
    var txt = UI.$('sab-revision-texto');
    if (txt) txt.textContent = ZZ.fmt2(App.estado.config.ajustes.revisionDesde);
  }

  function cambiarVista(nombre) {
    vistaActiva = nombre;
    UI.$$('.pestana').forEach(function (p) {
      p.classList.toggle('activa', p.getAttribute('data-vista') === nombre);
    });
    UI.$$('.vista').forEach(function (s) {
      s.classList.toggle('activa', s.id === 'vista-' + nombre);
    });
    renderVista(nombre);
    raiz.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderVistaActiva() { renderVista(vistaActiva); }

  /* ══════════════════ IMPRESIÓN RÁPIDA DE LA VISTA ACTUAL ═══════════════ */

  function imprimirVistaActual() {
    var v = VISTAS[vistaActiva];
    if (!v || typeof v.documento !== 'function') {
      Export.imprimir(VISTAS.configuracion.documento());
      return;
    }
    if (vistaActiva === 'configuracion' || vistaActiva === 'respaldo') {
      Export.imprimir(VISTAS.configuracion.documento());
      return;
    }
    if (typeof v.seleccion === 'function') {
      var sel = v.seleccion();
      var faltan = !sel.anio || !sel.seccion;
      if (vistaActiva === 'continua' || vistaActiva === 'plan') faltan = faltan || !sel.asignatura || !sel.lapso;
      if (vistaActiva === 'sabana') faltan = faltan || !sel.asignatura;
      if (faltan) {
        UI.avisoFlotante('Complete los selectores de año, sección, asignatura y lapso antes de imprimir.', 'error');
        return;
      }
      Export.imprimir(v.documento(sel));
    } else {
      Export.imprimir(VISTAS.configuracion.documento());
    }
  }

  /* ══════════════════════════════ ARRANQUE ═════════════════════════════ */

  /** Dibuja todo lo que depende del docente que acaba de entrar. */
  App.iniciarSesion = function () {
    App.ponerEscudoCabecera();
    App.actualizarCabecera();
    App.refrescarSelectores();
    Object.keys(VISTAS).forEach(function (k) {
      if (VISTAS[k] && typeof VISTAS[k].render === 'function') {
        try { VISTAS[k].render(); } catch (e) { console.error(e); }
      }
    });
    cambiarVista('configuracion');
    if (App.usuario) {
      UI.avisoFlotante('Bienvenido(a), ' + App.usuario.nombre + '. ' +
        (App.estado.estudiantes.length
          ? 'Se cargaron ' + App.estado.estudiantes.length + ' estudiante(s) de sus cursos.'
          : 'Sus datos están listos; comience llenando la configuración.'));
    }
    if (App.modo === 'nube') {
      App.ponerChipNube('ok');
    } else {
      App.ponerChipNube('oculto');
      if (!App.disponible) {
        UI.avisoFlotante('Este navegador no permite el guardado automático. Descargue un respaldo .json antes de cerrar.', 'error');
      }
    }
  };

  /** Deja la pantalla sin datos del docente anterior al cerrar sesión. */
  App.limpiarVistas = function () {
    ['cuerpo-nomina', 'cuerpo-plan', 'cuerpo-ponderacion', 'cuerpo-notas', 'cabeza-notas',
      'pie-notas', 'cuerpo-sabana', 'cabeza-sabana', 'pie-sabana', 'cuerpo-resumen',
      'cabeza-resumen', 'cuerpo-copias', 'cuerpo-masiva', 'ec-estadisticas', 'sab-estadisticas',
      'resumen-datos', 'nube-detalle'].forEach(function (id) {
        var el = UI.$(id);
        if (el) el.innerHTML = '';
      });
    UI.mostrar('masiva-caja-preview', false);
    UI.listaAvisos('masiva-avisos', []);
    UI.listaAvisos('avisos-respaldo', []);
    var pie = UI.$('pie-nomina');
    if (pie) pie.innerHTML = '';
    var piePlan = UI.$('pie-plan');
    if (piePlan) piePlan.innerHTML = '';
    App.actualizarCabecera();
  };

  function iniciar() {
    App.iniciar();                       // comprueba el almacenamiento del navegador
    App.ponerEscudoCabecera();
    App.actualizarCabecera();

    // Eventos propios de cada módulo
    Object.keys(VISTAS).forEach(function (k) {
      var v = VISTAS[k];
      if (v && typeof v.iniciar === 'function') {
        try { v.iniciar(); } catch (e) { console.error('Error al iniciar ' + k, e); }
      }
    });

    // Pestañas
    UI.$$('.pestana').forEach(function (p) {
      p.addEventListener('click', function () { cambiarVista(p.getAttribute('data-vista')); });
    });

    // Botones globales
    var btnResp = UI.$('btn-respaldo-rapido');
    if (btnResp) btnResp.addEventListener('click', function () { VISTAS.respaldo.descargarRespaldo(); });
    var btnImp = UI.$('btn-imprimir-rapido');
    if (btnImp) btnImp.addEventListener('click', imprimirVistaActual);
    var btnCambiar = UI.$('btn-cambiar-docente');
    if (btnCambiar) btnCambiar.addEventListener('click', function () {
      UI.confirmar('Cambiar de docente',
        'Se cerrará su sesión' + (App.modo === 'nube' ? ' en la nube' : ' en este equipo') +
        (App.modo === 'local' ? ' y sus datos quedarán guardados con su usuario.' : '') +
        '\n¿Continuar?',
        function () { raiz.Acceso.salir(); }, { aceptar: 'Sí, cambiar de docente' });
    });

    // Cambios globales: guardar siempre, redibujar lo que corresponda
    App.alCambiar(function (motivo, op) {
      if (motivo === 'reemplazado' || motivo === 'restaurado') {
        App.ponerEscudoCabecera();
        App.actualizarCabecera();
        App.refrescarSelectores();
        Object.keys(VISTAS).forEach(function (k) {
          if (VISTAS[k] && typeof VISTAS[k].render === 'function') {
            try { VISTAS[k].render(); } catch (e) { console.error(e); }
          }
        });
        return;
      }
      App.actualizarCabecera();
      if (op && op.redibujar === false) return;
      renderVistaActiva();
    });

    // Atajos de teclado y guardado al cerrar
    document.addEventListener('keydown', function (ev) {
      if ((ev.ctrlKey || ev.metaKey) && (ev.key === 's' || ev.key === 'S')) {
        ev.preventDefault();
        if (!App.usuario) return;
        App.guardar(true);
        UI.avisoFlotante('Datos guardados. Recuerde descargar su respaldo .json con frecuencia.');
      }
    });
    raiz.addEventListener('beforeunload', function () { if (App.usuario) App.escribir(); });

    // Pantalla de acceso: los datos se cargan cuando el docente entra
    raiz.Acceso.iniciar();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();

  App.render = renderVistaActiva;
  App.irA = cambiarVista;
})(typeof window !== 'undefined' ? window : globalThis);
