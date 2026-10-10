/* ============================================================================
   Evaluación Docente de Zazarabicoa
   nucleo.js — Lógica pura (sin DOM): estado, cálculos, redondeo oficial,
   estadísticas y análisis de nóminas pegadas desde Excel/Word.
   ========================================================================== */
(function (raiz) {
  'use strict';

  var VERSION_DATOS = 1;

  var ASIGNATURAS_OFICIALES = [
    'Lenguaje y Literatura',
    'Idiomas',
    'Matemática',
    'Educación Física',
    'Biología, Ambiente y Tecnología',
    'Física',
    'Química',
    'Geografía, Historia y Soberanía Nacional',
    'Innovación Tecnológica y Productiva',
    'Orientación Vocacional'
  ];

  var LAPSOS = [
    { n: 1, titulo: '1er Lapso' },
    { n: 2, titulo: '2do Lapso' },
    { n: 3, titulo: '3er Lapso' }
  ];

  var TIPOS_ACTIVIDAD = [
    'Taller grupal', 'Taller individual', 'Prueba escrita', 'Prueba práctica',
    'Exposición', 'Producción escrita', 'Informe', 'Proyecto', 'Investigación',
    'Mapa mental / esquema', 'Debate / discusión socializada', 'Demostración',
    'Rasgos actitudinales / convivencia', 'Participación', 'Tarea / asignación',
    'Portafolio', 'Práctica de laboratorio', 'Otra'
  ];

  var TECNICAS = [
    'Observación directa', 'Entrevista', 'Análisis de producción',
    'Prueba escrita', 'Interrogatorio', 'Exposición oral', 'Demostración',
    'Análisis de desempeño', 'Revisión documental'
  ];

  var INSTRUMENTOS = [
    'Escala de estimación', 'Rúbrica', 'Lista de cotejo',
    'Registro anecdótico', 'Escala de actitudes', 'Prueba objetiva',
    'Registro descriptivo', 'Portafolio de evidencias'
  ];

  var MODOS_REDONDEO = [
    { id: 'estandar', titulo: 'Estándar: la fracción ≥ 0,50 sube a la unidad superior',
      detalle: 'Ej.: 9,50 → 10 · 15,49 → 15 · 10,50 → 11' },
    { id: 'aprobatoria', titulo: 'Restringido: la fracción ≥ 0,50 sube sólo si ya es aprobatoria',
      detalle: 'Ej.: 10,50 → 11 · 9,50 → 9 · 15,60 → 16' },
    { id: 'truncar', titulo: 'Sin redondeo: se toma la parte entera del acumulado',
      detalle: 'Ej.: 9,99 → 9 · 15,90 → 15' }
  ];

  /* ---------------------------------------------------------------- utilidades */

  var contador = 0;
  function nuevoId(prefijo) {
    contador += 1;
    return (prefijo || 'id') + '_' + Date.now().toString(36) + '_' +
      contador.toString(36) + Math.floor(Math.random() * 1296).toString(36);
  }

  function redondear(x, decimales) {
    var f = Math.pow(10, decimales == null ? 2 : decimales);
    return Math.round((x + Number.EPSILON) * f) / f;
  }

  function numero(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var t = String(v).trim().replace(/\s/g, '').replace(',', '.');
    if (t === '' || isNaN(Number(t))) return null;
    return Number(t);
  }

  function limpiar(v) {
    return String(v == null ? '' : v).replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
  }

  function unicos(lista) {
    var visto = {}, salida = [];
    (lista || []).forEach(function (x) {
      var k = String(x);
      if (!visto[k]) { visto[k] = true; salida.push(x); }
    });
    return salida;
  }

  function fmt2(x) {
    if (x === null || x === undefined || x === '') return '';
    var n = numero(x);
    if (n === null) return '';
    return n.toFixed(2).replace('.', ',');
  }

  function fmtNota(x) {
    var n = numero(x);
    if (n === null) return '';
    return (Math.round(n * 100) / 100).toString().replace('.', ',');
  }

  function fmtPct(x) {
    var n = numero(x);
    if (n === null) return '0,00 %';
    return n.toFixed(2).replace('.', ',') + ' %';
  }

  function escapar(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ------------------------------------------------------- estado por defecto */

  function estadoInicial() {
    return {
      version: VERSION_DATOS,
      creado: new Date().toISOString(),
      modificado: new Date().toISOString(),
      config: {
        docente: {
          nombres: '', apellidos: '', cedulaTipo: 'V', cedula: '',
          telefono: '', correo: '', titulo: '', area: ''
        },
        institucion: {
          nombre: 'Complejo Educativo "Zazarabicoa"',
          fundado: 1946,
          codigoDEA: 'S4375D1305',
          circuito: 'José Morales "Cachimba"',
          municipio: 'Morán',
          estado: 'Lara',
          anioEscolar: '2024-2025',
          director: 'Rosana Rodríguez',
          coordinador: 'Rocío García',
          coordinador2: 'Eli Torrealba',
          escudo: ''
        },
        anios: [],
        secciones: [],
        asignaturas: [],
        ajustes: {
          minima: 10,
          umbral: 0.5,
          modoRedondeo: 'estandar',
          revisionDesde: 9,
          escalaMax: 20
        }
      },
      estudiantes: [],
      planes: {},
      notas: {},
      ultimoContexto: { anio: '', seccion: '', asignatura: '', lapso: '' }
    };
  }

  function asignaturasOficiales() {
    return ASIGNATURAS_OFICIALES.map(function (nombre, i) {
      return { id: 'of' + (i + 1), nombre: nombre, oficial: true };
    });
  }

  /* ------------------------------------------------------------- claves/index */

  function clave(sel) {
    return [sel.anio, sel.seccion, sel.asignatura, sel.lapso].join('||');
  }

  function partesClave(k) {
    var p = String(k).split('||');
    return { anio: p[0], seccion: p[1], asignatura: p[2], lapso: p[3] };
  }

  function planDe(estado, sel) {
    var p = estado.planes[clave(sel)];
    if (!p || !Array.isArray(p.actividades)) return { actividades: [] };
    return p;
  }

  function asegurarPlan(estado, sel) {
    var k = clave(sel);
    if (!estado.planes[k] || !Array.isArray(estado.planes[k].actividades)) {
      estado.planes[k] = { actividades: [] };
    }
    return estado.planes[k];
  }

  function actividadesDe(estado, sel) {
    return planDe(estado, sel).actividades;
  }

  function notasDe(estado, sel) {
    var n = estado.notas[clave(sel)];
    return n && typeof n === 'object' ? n : {};
  }

  function estudiantesDe(estado, anio, seccion) {
    var a = String(anio), s = String(seccion);
    return (estado.estudiantes || []).filter(function (e) {
      return String(e.anio) === a && String(e.seccion) === s;
    }).sort(function (x, y) {
      var ax = (x.apellidos || '') + ' ' + (x.nombres || '');
      var ay = (y.apellidos || '') + ' ' + (y.nombres || '');
      return ax.localeCompare(ay, 'es');
    });
  }

  function asignaturaPorId(estado, id) {
    var lista = (estado.config && estado.config.asignaturas) || [];
    for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i];
    return null;
  }

  function nombreAsignatura(estado, id) {
    var a = asignaturaPorId(estado, id);
    return a ? a.nombre : '(asignatura eliminada)';
  }

  function tituloLapso(n) {
    for (var i = 0; i < LAPSOS.length; i++) if (String(LAPSOS[i].n) === String(n)) return LAPSOS[i].titulo;
    return n + '° Lapso';
  }

  /* ------------------------------------------------------------- cálculos */

  function sumaPonderacion(actividades) {
    var t = 0;
    (actividades || []).forEach(function (a) {
      var p = numero(a.ponderacion);
      if (p !== null) t += p;
    });
    return redondear(t, 2);
  }

  /**
   * Puntos acumulados = Σ (nota_i × %_i / 100)
   * Devuelve null si el estudiante no tiene ninguna nota registrada.
   */
  function puntosDe(actividades, notasEstudiante) {
    var acts = actividades || [];
    var notas = notasEstudiante || {};
    var total = 0, conNota = 0, ponderado = 0, registradas = 0;
    for (var i = 0; i < acts.length; i++) {
      var a = acts[i];
      var p = numero(a.ponderacion);
      if (p === null) p = 0;
      var n = numero(notas[a.id]);
      if (n !== null) {
        registradas += 1;
        total += n * p / 100;
        ponderado += p;
      }
      if (p > 0) conNota += 1;
    }
    if (registradas === 0) return null;
    return {
      puntos: redondear(total, 4),
      ponderado: redondear(ponderado, 2),
      registradas: registradas,
      actividades: acts.length,
      completo: acts.length > 0 && registradas === acts.length
    };
  }

  /**
   * Redondeo oficial según la normativa configurada.
   */
  function redondearOficial(valor, ajustes) {
    var aj = ajustes || {};
    var minima = numero(aj.minima) === null ? 10 : numero(aj.minima);
    var umbral = numero(aj.umbral) === null ? 0.5 : numero(aj.umbral);
    var modo = aj.modoRedondeo || 'estandar';
    var v = redondear(numero(valor) === null ? 0 : numero(valor), 4);
    var entero = Math.floor(v + 1e-9);
    var frac = redondear(v - entero, 4);
    if (modo === 'truncar') return entero;
    if (frac + 1e-9 < umbral) return entero;
    if (modo === 'aprobatoria') return entero >= minima - 1e-9 ? entero + 1 : entero;
    return entero + 1;
  }

  function calcularDefinitiva(puntos, ajustes) {
    var aj = ajustes || {};
    var minima = numero(aj.minima) === null ? 10 : numero(aj.minima);
    if (puntos === null || puntos === undefined) {
      return { exacto: null, definitiva: null, condicion: 'SIN DATOS' };
    }
    var exacto = redondear(puntos, 2);
    var def = redondearOficial(exacto, aj);
    var tope = numero(aj.escalaMax) === null ? 20 : numero(aj.escalaMax);
    if (def > tope) def = tope;
    if (def < 0) def = 0;
    return {
      exacto: exacto,
      definitiva: def,
      condicion: def >= minima ? 'APROBADO' : 'REPROBADO'
    };
  }

  /**
   * filas: [{definitiva: number|null, evaluado: boolean}]
   */
  function estadisticas(filas, ajustes) {
    var aj = ajustes || {};
    var minima = numero(aj.minima) === null ? 10 : numero(aj.minima);
    var lista = filas || [];
    var ev = lista.filter(function (f) { return f && f.definitiva !== null && f.definitiva !== undefined; });
    var aprob = ev.filter(function (f) { return f.definitiva >= minima; });
    var reprob = ev.filter(function (f) { return f.definitiva < minima; });
    var suma = 0;
    ev.forEach(function (f) { suma += numero(f.definitiva) || 0; });
    var prom = ev.length ? redondear(suma / ev.length, 2) : null;
    return {
      matricula: lista.length,
      evaluados: ev.length,
      aprobados: aprob.length,
      reprobados: reprob.length,
      porcAprobados: ev.length ? redondear(aprob.length * 100 / ev.length, 2) : 0,
      porcReprobados: ev.length ? redondear(reprob.length * 100 / ev.length, 2) : 0,
      promedio: prom,
      suma: redondear(suma, 2)
    };
  }

  /**
   * Sábana anual: consolida los 3 lapsos de un estudiante en una asignatura.
   */
  function consolidarAnual(porLapso, ajustes) {
    var aj = ajustes || {};
    var valores = [], faltantes = [];
    [1, 2, 3].forEach(function (n) {
      var d = porLapso[n];
      if (d === null || d === undefined) faltantes.push(n); else valores.push(numero(d));
    });
    if (!valores.length) {
      return { l1: null, l2: null, l3: null, promedio: null, definitiva: null, condicion: 'SIN DATOS', revision: false, faltantes: faltantes };
    }
    var suma = 0;
    valores.forEach(function (v) { suma += v; });
    var promedio = redondear(suma / valores.length, 2);
    var def = redondearOficial(promedio, aj);
    var minima = numero(aj.minima) === null ? 10 : numero(aj.minima);
    var desde = numero(aj.revisionDesde) === null ? 9 : numero(aj.revisionDesde);
    var condicion, revision = false;
    if (def >= minima) {
      condicion = 'APROBADO';
    } else if (promedio >= desde - 1e-9) {
      condicion = 'REPROBADO / DERECHO A REVISIÓN';
      revision = true;
    } else {
      condicion = 'REPROBADO';
    }
    return {
      l1: numero(porLapso[1]), l2: numero(porLapso[2]), l3: numero(porLapso[3]),
      promedio: promedio, definitiva: def, condicion: condicion,
      revision: revision, faltantes: faltantes, parcial: faltantes.length > 0
    };
  }

  /**
   * Consolidado de todas las asignaturas de un estudiante (promedio general).
   */
  function consolidarGeneral(porAsignatura, ajustes) {
    var prom = [];
    Object.keys(porAsignatura || {}).forEach(function (k) {
      var c = porAsignatura[k];
      if (c && c.promedio !== null && c.promedio !== undefined) prom.push(numero(c.promedio));
    });
    if (!prom.length) return { promedio: null, definitiva: null, condicion: 'SIN DATOS' };
    var suma = 0;
    prom.forEach(function (v) { suma += v; });
    var promedio = redondear(suma / prom.length, 2);
    var def = redondearOficial(promedio, ajustes);
    var minima = numero((ajustes || {}).minima) === null ? 10 : numero((ajustes || {}).minima);
    return { promedio: promedio, definitiva: def, condicion: def >= minima ? 'APROBADO' : 'REPROBADO' };
  }

  /* --------------------------------------------------- cédulas y estudiantes */

  function normalizarCedula(texto) {
    var t = String(texto == null ? '' : texto).toUpperCase().replace(/\s/g, '');
    var m = t.match(/^([VEJPGC])?[-.]?(\d{4,10})$/);
    if (!m) {
      var solo = t.replace(/[^0-9]/g, '');
      if (solo.length >= 4) {
        var letra = (t.match(/^[VEJPGC]/) || [])[0] || '';
        return { tipo: letra, numero: solo, texto: (letra ? letra + '-' : '') + agruparMiles(solo) };
      }
      return { tipo: '', numero: '', texto: limpiar(texto) };
    }
    return { tipo: m[1] || '', numero: m[2], texto: (m[1] || '') + (m[1] ? '-' : '') + agruparMiles(m[2]) };
  }

  function agruparMiles(digitos) {
    return String(digitos).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function normalizarSexo(texto) {
    var t = String(texto == null ? '' : texto).trim().toUpperCase();
    if (!t) return '';
    if (/^(M|MAS|MASC|MASCULINO|V|VARON|VARÓN|H|HOMBRE)$/.test(t)) return 'M';
    if (/^(F|FEM|FEMENINO|MUJER)$/.test(t)) return 'F';
    return '';
  }

  function quitarAcentos(t) {
    return String(t == null ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function esEncabezado(linea) {
    var t = quitarAcentos(linea).toLowerCase();
    return /cedula/.test(t) && /(apellido|nombre|alumno|estudiante)/.test(t);
  }

  function dividirCampos(linea) {
    if (linea.indexOf('\t') >= 0) return linea.split('\t');
    if (linea.indexOf(';') >= 0) return linea.split(';');
    if (linea.indexOf(',') >= 0) return linea.split(',');
    if (/\s{2,}/.test(linea)) return linea.split(/\s{2,}/);
    return [linea];
  }

  function pareceCedula(campo) {
    var t = String(campo == null ? '' : campo).trim();
    if (!/\d/.test(t)) return false;
    var limpio = t.replace(/[\s.\-]/g, '');
    return /^[VEJPGC]?\d{4,10}$/i.test(limpio);
  }

  /**
   * Cuando la línea viene como texto corrido sin separadores claros
   * (p. ej. "V-20123456 Salazar Rivas Luis Alberto M"), se aísla la cédula
   * del inicio y el sexo del final antes de repartir nombres.
   */
  function descomponerTextoCorrido(linea) {
    var resto = linea, cedula = '', sexo = '';
    var mCed = resto.match(/^\s*([VEJPGC]?\s*-?\s*\d{4,10}(?:[.,]\d{3})*)\s+(.+)$/i);
    if (mCed && pareceCedula(mCed[1]) && /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(mCed[2])) {
      cedula = mCed[1];
      resto = mCed[2];
    }
    var mSexo = resto.match(/(?:^|\s)(M|F|H|V|MASCULINO|FEMENINO|VARON|VARÓN|MUJER)\s*\.?$/i);
    if (mSexo) {
      sexo = mSexo[1];
      resto = resto.slice(0, mSexo.index).trim();
    }
    return [cedula, resto, sexo].filter(function (x) { return x !== ''; });
  }

  /**
   * Analiza una lista pegada desde Excel o Word.
   * Formatos admitidos: Cédula, Apellidos, Nombres, Sexo (en cualquier orden de
   * separadores: tabulación, punto y coma, coma, doble espacio o texto corrido).
   * Devuelve { filas: [...], advertencias: [...] }
   */
  function parsearNomina(texto) {
    var lineas = String(texto == null ? '' : texto).split(/\r?\n/);
    var filas = [], advertencias = [];
    lineas.forEach(function (lineaOriginal, idx) {
      var linea = lineaOriginal.replace(/\u00a0/g, ' ').trim();
      if (!linea) return;
      if (esEncabezado(linea)) return;
      var campos = dividirCampos(linea).map(function (c) { return limpiar(c); })
        .filter(function (c) { return c !== ''; });
      if (campos.length === 1) {
        var descompuesto = descomponerTextoCorrido(campos[0]);
        if (descompuesto.length > 1) campos = descompuesto;
      }

      var cedula = '', sexo = '', apellidos = '', nombres = '';
      var restantes = [];

      // 1) Cédula: primer campo que parezca cédula
      campos.forEach(function (c) {
        if (!cedula && pareceCedula(c)) {
          cedula = normalizarCedula(c).texto;
        } else {
          restantes.push(c);
        }
      });

      // 2) Sexo
      var tmp = [];
      restantes.forEach(function (c) {
        var s = normalizarSexo(c);
        if (!sexo && s) sexo = s; else tmp.push(c);
      });
      restantes = tmp;

      // 3) Nombres y apellidos
      if (restantes.length >= 2) {
        apellidos = restantes[0];
        nombres = restantes.slice(1).join(' ');
      } else if (restantes.length === 1) {
        var unico = restantes[0];
        var mComa = unico.match(/^([^,]+),\s*(.+)$/);
        if (mComa) { apellidos = mComa[1].trim(); nombres = mComa[2].trim(); }
        else {
          var tok = unico.split(/\s+/).filter(Boolean);
          if (tok.length >= 4) { apellidos = tok.slice(0, 2).join(' '); nombres = tok.slice(2).join(' '); }
          else if (tok.length === 3) { apellidos = tok.slice(0, 2).join(' '); nombres = tok[2]; }
          else if (tok.length === 2) { apellidos = tok[0]; nombres = tok[1]; }
          else { apellidos = unico; nombres = ''; }
        }
      }

      if (!apellidos && !nombres) {
        advertencias.push('Línea ' + (idx + 1) + ': no se reconoció ningún nombre — "' + linea + '"');
        return;
      }
      if (!cedula) advertencias.push('Línea ' + (idx + 1) + ': sin cédula (' + (apellidos || nombres) + ')');

      filas.push({
        id: nuevoId('est'),
        cedula: cedula,
        apellidos: apellidos.toUpperCase(),
        nombres: nombres.toUpperCase(),
        anio: '',
        seccion: ''
      });
    });
    return { filas: filas, advertencias: advertencias };
  }

  function nombreCompleto(e) {
    if (!e) return '';
    return limpiar((e.apellidos || '') + ' ' + (e.nombres || '')).trim();
  }

  function nombreDocente(config) {
    var d = (config || {}).docente || {};
    var n = limpiar((d.nombres || '') + ' ' + (d.apellidos || '')).trim();
    return n || '__________________________';
  }

  /** Coordinadores de evaluación registrados (puede haber más de uno). */
  function coordinadores(config) {
    var i = (config || {}).institucion || {};
    return [i.coordinador, i.coordinador2].map(function (c) { return limpiar(c); }).filter(Boolean);
  }

  /**
   * Áreas de desempeño disponibles para el docente: las asignaturas que ofrece
   * la institución (las 10 oficiales) más las adicionales que se hayan agregado.
   */
  function areasDisponibles(config) {
    var lista = ASIGNATURAS_OFICIALES.slice();
    ((config || {}).asignaturas || []).forEach(function (a) {
      if (a && a.nombre && lista.indexOf(a.nombre) < 0) lista.push(a.nombre);
    });
    return lista;
  }

  /* ───────────────────── huella de contraseñas (acceso) ───────────────────── */

  var K_SHA = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  var H_SHA = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

  /** SHA-256 en JavaScript puro (funciona siempre, incluso sin crypto.subtle). */
  function sha256Hex(texto) {
    var bytes = [];
    var s = unescape(encodeURIComponent(String(texto)));
    for (var i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i));
    var bits = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (var k = 7; k >= 0; k--) bytes.push((bits / Math.pow(2, k * 8)) & 0xFF);

    var h = H_SHA.slice();
    var w = new Array(64);
    function rr(x, n) { return (x >>> n) | (x << (32 - n)); }

    for (var bloque = 0; bloque < bytes.length; bloque += 64) {
      for (var t = 0; t < 16; t++) {
        w[t] = (bytes[bloque + t * 4] << 24) | (bytes[bloque + t * 4 + 1] << 16) |
          (bytes[bloque + t * 4 + 2] << 8) | (bytes[bloque + t * 4 + 3]);
      }
      for (t = 16; t < 64; t++) {
        var s0 = rr(w[t - 15], 7) ^ rr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        var s1 = rr(w[t - 2], 17) ^ rr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (t = 0; t < 64; t++) {
        var S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (hh + S1 + ch + K_SHA[t] + w[t]) | 0;
        var S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + temp1) | 0;
        d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }
    return h.map(function (x) { return ('00000000' + (x >>> 0).toString(16)).slice(-8); }).join('');
  }

  /** Huella de la contraseña con sal (nunca se guarda la contraseña). */
  function hashClave(clave, sal) {
    return sha256Hex('zazarabicoa::' + (sal || '') + '::' + String(clave));
  }

  function salAleatoria() {
    var t = '';
    for (var i = 0; i < 4; i++) t += Math.floor(Math.random() * 4294967296).toString(36);
    return t;
  }

  /* ─────────────────────── diferencias para la nube ─────────────────────── */

  function clavesUnidas(a, b) {
    var vistos = {}, salida = [];
    (a || []).concat(b || []).forEach(function (k) {
      if (!vistos[k]) { vistos[k] = true; salida.push(k); }
    });
    return salida;
  }

  function igualesJson(a, b) {
    return JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
  }

  /**
   * Compara dos estados y devuelve sólo lo que cambió, para escribir en la nube
   * únicamente los documentos necesarios.
   *   { principal: {config, estudiantes, ultimoContexto} | null,
   *     planes: {clave: {actividades} | null}, notas: {clave: {est:{act:nota}} | null} }
   * El valor null indica que ese documento debe borrarse.
   */
  function diffEstado(antes, despues) {
    var a = antes || {}, d = despues || {};
    var salida = { principal: null, planes: {}, notas: {} };
    var pa = { config: a.config, estudiantes: a.estudiantes, ultimoContexto: a.ultimoContexto };
    var pd = { config: d.config, estudiantes: d.estudiantes, ultimoContexto: d.ultimoContexto };
    if (!igualesJson(pa, pd)) salida.principal = pd;
    clavesUnidas(Object.keys(a.planes || {}), Object.keys(d.planes || {})).forEach(function (k) {
      if (!igualesJson((a.planes || {})[k], (d.planes || {})[k])) {
        salida.planes[k] = (d.planes || {})[k] || null;
      }
    });
    clavesUnidas(Object.keys(a.notas || {}), Object.keys(d.notas || {})).forEach(function (k) {
      if (!igualesJson((a.notas || {})[k], (d.notas || {})[k])) {
        salida.notas[k] = (d.notas || {})[k] || null;
      }
    });
    return salida;
  }

  function hayDiferencias(diff) {
    return !!diff && (!!diff.principal ||
      Object.keys(diff.planes).length > 0 || Object.keys(diff.notas).length > 0);
  }

  function copiaProfunda(obj) {
    return JSON.parse(JSON.stringify(obj === undefined ? null : obj));
  }

  /* -------------------------------------------------- normalización de datos */

  function normalizarEstado(crudo) {
    var base = estadoInicial();
    if (!crudo || typeof crudo !== 'object') return base;
    var e;
    try { e = JSON.parse(JSON.stringify(crudo)); } catch (err) { return base; }
    var cfg = e.config && typeof e.config === 'object' ? e.config : {};
    ['docente', 'institucion', 'ajustes'].forEach(function (k) {
      base.config[k] = Object.assign({}, base.config[k], (cfg[k] && typeof cfg[k] === 'object') ? cfg[k] : {});
    });
    base.config.anios = unicos((Array.isArray(cfg.anios) ? cfg.anios : []).map(Number)
      .filter(function (n) { return n >= 1 && n <= 5; })).sort(function (a, b) { return a - b; });
    base.config.secciones = unicos((Array.isArray(cfg.secciones) ? cfg.secciones : [])
      .map(function (s) { return limpiar(s).toUpperCase(); }).filter(Boolean));
    base.config.asignaturas = (Array.isArray(cfg.asignaturas) ? cfg.asignaturas : [])
      .filter(function (a) { return a && a.nombre; })
      .map(function (a) { return { id: a.id || nuevoId('as'), nombre: limpiar(a.nombre), oficial: !!a.oficial }; });
    var aj = base.config.ajustes;
    ['minima', 'umbral', 'revisionDesde', 'escalaMax'].forEach(function (k) {
      var v = numero(aj[k]);
      if (v !== null) aj[k] = v;
    });
    if (MODOS_REDONDEO.map(function (m) { return m.id; }).indexOf(aj.modoRedondeo) < 0) aj.modoRedondeo = 'estandar';
    e.config = base.config;
    e.version = VERSION_DATOS;
    var uc = (e.ultimoContexto && typeof e.ultimoContexto === 'object') ? e.ultimoContexto : {};
    e.ultimoContexto = {
      anio: uc.anio == null ? '' : String(uc.anio),
      seccion: uc.seccion == null ? '' : String(uc.seccion),
      asignatura: uc.asignatura == null ? '' : String(uc.asignatura),
      lapso: uc.lapso == null ? '' : String(uc.lapso)
    };
    e.estudiantes = (Array.isArray(e.estudiantes) ? e.estudiantes : []).filter(function (x) { return x && (x.apellidos || x.nombres); })
      .map(function (x) {
        return {
          id: x.id || nuevoId('est'),
          cedula: limpiar(x.cedula), apellidos: limpiar(x.apellidos), nombres: limpiar(x.nombres),
          sexo: normalizarSexo(x.sexo), anio: x.anio === '' || x.anio == null ? '' : Number(x.anio),
          seccion: limpiar(x.seccion).toUpperCase()
        };
      });
    e.planes = e.planes && typeof e.planes === 'object' ? e.planes : {};
    Object.keys(e.planes).forEach(function (k) {
      var p = e.planes[k] || {};
      p.actividades = (Array.isArray(p.actividades) ? p.actividades : []).map(function (a) {
        return {
          id: a.id || nuevoId('act'),
          nombre: limpiar(a.nombre), tipo: limpiar(a.tipo),
          contenido: limpiar(a.contenido), tecnica: limpiar(a.tecnica),
          instrumento: limpiar(a.instrumento),
          ponderacion: numero(a.ponderacion) === null ? 0 : numero(a.ponderacion)
        };
      });
      e.planes[k] = p;
    });
    e.notas = e.notas && typeof e.notas === 'object' ? e.notas : {};
    Object.keys(e.notas).forEach(function (k) {
      var m = e.notas[k];
      if (!m || typeof m !== 'object') { delete e.notas[k]; return; }
      Object.keys(m).forEach(function (est) {
        if (!m[est] || typeof m[est] !== 'object') { delete m[est]; return; }
        Object.keys(m[est]).forEach(function (act) {
          var v = numero(m[est][act]);
          if (v === null) delete m[est][act]; else m[est][act] = v;
        });
      });
    });
    return e;
  }

  /* --------------------------------------------------------------- export */

  var ZZ = {
    VERSION_DATOS: VERSION_DATOS,
    ASIGNATURAS_OFICIALES: ASIGNATURAS_OFICIALES,
    LAPSOS: LAPSOS,
    TIPOS_ACTIVIDAD: TIPOS_ACTIVIDAD,
    TECNICAS: TECNICAS,
    INSTRUMENTOS: INSTRUMENTOS,
    MODOS_REDONDEO: MODOS_REDONDEO,
    nuevoId: nuevoId,
    redondear: redondear,
    numero: numero,
    limpiar: limpiar,
    fmt2: fmt2,
    fmtNota: fmtNota,
    fmtPct: fmtPct,
    escapar: escapar,
    estadoInicial: estadoInicial,
    asignaturasOficiales: asignaturasOficiales,
    clave: clave,
    partesClave: partesClave,
    planDe: planDe,
    asegurarPlan: asegurarPlan,
    actividadesDe: actividadesDe,
    notasDe: notasDe,
    estudiantesDe: estudiantesDe,
    asignaturaPorId: asignaturaPorId,
    nombreAsignatura: nombreAsignatura,
    tituloLapso: tituloLapso,
    sumaPonderacion: sumaPonderacion,
    puntosDe: puntosDe,
    redondearOficial: redondearOficial,
    calcularDefinitiva: calcularDefinitiva,
    estadisticas: estadisticas,
    consolidarAnual: consolidarAnual,
    consolidarGeneral: consolidarGeneral,
    normalizarCedula: normalizarCedula,
    agruparMiles: agruparMiles,
    normalizarSexo: normalizarSexo,
    parsearNomina: parsearNomina,
    nombreCompleto: nombreCompleto,
    nombreDocente: nombreDocente,
    coordinadores: coordinadores,
    areasDisponibles: areasDisponibles,
    sha256Hex: sha256Hex,
    hashClave: hashClave,
    salAleatoria: salAleatoria,
    diffEstado: diffEstado,
    hayDiferencias: hayDiferencias,
    copiaProfunda: copiaProfunda,
    normalizarEstado: normalizarEstado
  };

  raiz.ZZ = ZZ;
  if (typeof module === 'object' && module.exports) module.exports = ZZ;
})(typeof globalThis !== 'undefined' ? globalThis : this);
