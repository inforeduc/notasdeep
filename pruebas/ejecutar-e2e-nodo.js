/* ============================================================================
   ejecutar-e2e-nodo.js — Ejecuta la aplicación completa y la autoprueba de
   extremo a extremo dentro de Node, usando el DOM mínimo (dom-minimo.js).

   Fases:
     1. Autoprueba completa de la aplicación (clave, usuarios, nómina, plan,
        notas, sábana, documentos, Excel, respaldo y dos docentes).
     2. Reinicio: cada docente recupera sus datos sin mezclarse.
     3. Nube simulada: guardado incremental, carga exacta y aislamiento.
     4. Detección del modo nube con la configuración real de Firebase
        (archivo local file:// = modo local; página publicada https = modo nube).

   Ejecutar:  node pruebas/ejecutar-e2e-nodo.js
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const dom = require('./dom-minimo.js');

const RAIZ = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const esperar = ms => new Promise(r => setTimeout(r, ms));

/* ─────────────────────────────── entorno ─────────────────────────────── */

const documento = dom.crearDocumento(html);
const almacen = dom.crearLocalStorage();
const oyentesGlobales = {};

globalThis.window = globalThis;
globalThis.document = documento;
globalThis.localStorage = almacen;
globalThis.Event = dom.Evento;
globalThis.CustomEvent = dom.Evento;
try { Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Node/DOM-minimo' }, configurable: true }); } catch (e) { }
globalThis.print = function () { };
globalThis.scrollTo = function () { };
globalThis.alert = function () { };
globalThis.confirm = function () { return true; };
globalThis.addEventListener = function (tipo, fn) { (oyentesGlobales[tipo] = oyentesGlobales[tipo] || []).push(fn); };
globalThis.removeEventListener = function (tipo, fn) {
  if (oyentesGlobales[tipo]) oyentesGlobales[tipo] = oyentesGlobales[tipo].filter(f => f !== fn);
};
globalThis.Blob = class { constructor(partes) { this.partes = partes; } };
globalThis.URL = { createObjectURL: () => 'blob:falso', revokeObjectURL: () => { } };
globalThis.FileReader = class {
  readAsText() { this.onload && this.onload({ target: { result: '' } }); }
  readAsDataURL() { this.onload && this.onload({ target: { result: '' } }); }
};
globalThis.requestAnimationFrame = fn => setTimeout(fn, 0);

/* ─────────────────────── montaje de la aplicación ────────────────────── */

/** Quita la configuración de Firebase para probar el modo local. */
function sinNube(codigo, ruta) {
  if (!/firebase-config\.js$/.test(ruta)) return codigo;
  return codigo.replace(/(apiKey|projectId|appId|authDomain):\s*(['"])[^'"]*\2/g, (m, campo) => campo + ': ""');
}

/**
 * Crea un documento nuevo y carga los módulos de la aplicación en él.
 * opciones: { e2e: bool, nubeReal: bool, protocolo: 'file:'|'https:' }
 */
function montarAplicacion(opciones) {
  const op = opciones || {};
  const doc = dom.crearDocumento(html);
  globalThis.document = doc;
  const loc = { href: 'file:///EvaluacionDocenteZazarabicoa/index.html', protocol: op.protocolo || 'file:' };
  try { Object.defineProperty(globalThis, 'location', { value: loc, configurable: true, writable: true }); }
  catch (e) { globalThis.location = loc; }
  ['VISTAS', 'App', 'UI', 'ZZ', 'Export', 'PlanUtil', 'ESCUDO_SVG', 'Nube', 'Acceso', 'FIREBASE_CONFIG'].forEach(k => {
    delete globalThis[k];
  });

  const lista = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
  if (op.e2e) lista.push('pruebas/e2e.js');
  const errores = [];
  lista.forEach(ruta => {
    const p = path.join(RAIZ, ruta);
    if (!fs.existsSync(p)) { errores.push('no existe ' + ruta); return; }
    let codigo = fs.readFileSync(p, 'utf8');
    if (!op.nubeReal) codigo = sinNube(codigo, ruta);
    try {
      vm.runInThisContext(codigo, { filename: p });
    } catch (e) {
      errores.push('error al cargar ' + ruta + ': ' + e.message);
    }
  });
  return { doc: doc, errores: errores };
}

const montaje = montarAplicacion({ e2e: true, nubeReal: false, protocolo: 'file:' });
if (montaje.errores.length) {
  console.log('\nERRORES AL CARGAR LOS MÓDULOS:');
  montaje.errores.forEach(e => console.log(' - ' + e));
  process.exit(3);
}
console.log('\nMódulos cargados: ' + [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].length + ' scripts + autoprueba');
console.log('Módulos registrados: ' + Object.keys(globalThis.VISTAS || {}).join(', '));
console.log('Modo de las pruebas 1-3: local (configuración de Firebase vaciada a propósito)');

/* ───────────────────────────── fase 1: e2e ───────────────────────────── */

(oyentesGlobales['load'] || []).forEach(fn => {
  try { fn(new dom.Evento('load')); } catch (e) { console.log('error en load: ' + e.message); }
});

/* ─────────────────────── fase 2: reinicio y usuarios ─────────────────── */

function iniciarSesionEn(doc, indiceUsuario, clave) {
  const campo = doc.getElementById('acceso-clave');
  campo.value = 'zazarabicoa123';
  doc.getElementById('btn-acceso-clave').click();
  const botones = doc.querySelectorAll('[data-entrar]');
  if (!botones[indiceUsuario]) throw new Error('no se encontró el usuario ' + indiceUsuario + ' en la lista');
  botones[indiceUsuario].click();
  const entrada = doc.getElementById('modal-texto').querySelector('input');
  if (!entrada) throw new Error('no apareció el campo de contraseña');
  entrada.value = clave;
  doc.getElementById('modal-aceptar').click();
}

async function comprobarPersistencia() {
  const m = montarAplicacion({ nubeReal: false, protocolo: 'file:' });
  const doc2 = m.doc;
  const App2 = globalThis.App, ZZ2 = globalThis.ZZ, VISTAS2 = globalThis.VISTAS;
  const problemas = [];
  const v = (nombre, cond, detalle) => { if (!cond) problemas.push(nombre + (detalle ? ' → ' + detalle : '')); };

  v('al reabrir, la aplicación vuelve a pedir la clave', doc2.getElementById('pantalla-acceso').hidden === false);
  v('los dos docentes quedaron registrados', App2.usuarios().length === 2, String(App2.usuarios().length));

  iniciarSesionEn(doc2, 0, 'miguel123');
  await esperar(80);

  v('se entra con la contraseña del docente', App2.usuario && App2.usuario.nombre === 'Miguel Ángel Pérez',
    App2.usuario ? App2.usuario.nombre : 'sin sesión');
  v('la pantalla de acceso se cierra', doc2.getElementById('pantalla-acceso').hidden === true);
  v('se recuperaron los 5 estudiantes', App2.estado.estudiantes.length === 5, String(App2.estado.estudiantes.length));
  v('se recuperaron los años y secciones',
    App2.estado.config.anios.join(',') === '1,3' && App2.estado.config.secciones.join(',') === 'A,B',
    App2.estado.config.anios.join(',') + ' / ' + App2.estado.config.secciones.join(','));
  v('se recuperaron las 3 asignaturas', App2.estado.config.asignaturas.length === 3);
  v('se recuperó el área de desempeño', App2.estado.config.docente.area === 'Matemática');
  v('se recuperó el docente', /María Alejandra/.test(ZZ2.nombreDocente(App2.estado.config)));
  v('se recuperaron los datos del plantel',
    App2.estado.config.institucion.codigoDEA === 'S4375D1305' &&
    ZZ2.coordinadores(App2.estado.config).length === 2);
  let totalNotas = 0;
  Object.keys(App2.estado.notas).forEach(k => {
    Object.keys(App2.estado.notas[k]).forEach(est => { totalNotas += Object.keys(App2.estado.notas[k][est]).length; });
  });
  v('se recuperaron las 9 notas', totalNotas === 9, String(totalNotas));
  const planes = Object.keys(App2.estado.planes);
  const conActividades = planes.filter(k => App2.estado.planes[k].actividades.length === 2);
  v('se recuperó el plan de evaluación con sus 2 actividades', conActividades.length === 1,
    planes.length + ' contextos de plan');
  v('se conservaron las ponderaciones 40/60',
    conActividades.length === 1 && ZZ2.sumaPonderacion(App2.estado.planes[conActividades[0]].actividades) === 100);
  v('se recordó el curso con el que se trabajaba (año, sección y asignatura)',
    String(App2.estado.ultimoContexto.anio) === '1' && App2.estado.ultimoContexto.seccion === 'A' &&
    !!App2.estado.ultimoContexto.asignatura,
    JSON.stringify(App2.estado.ultimoContexto));

  VISTAS2.sabana.render();
  const filasSabana = doc2.querySelectorAll('#cuerpo-sabana tr').length;
  v('la sábana se redibuja con 5 estudiantes', filasSabana === 5, String(filasSabana));
  VISTAS2.continua.render();
  const filasNotas = doc2.querySelectorAll('#cuerpo-notas tr').length;
  v('la matriz de notas se redibuja con el curso recordado', filasNotas === 5, String(filasNotas));
  const texto = doc2.querySelector('#cuerpo-notas').textContent.replace(/\s+/g, ' ');
  v('la nota definitiva recuperada de Rodríguez es 10', /10\s*\(9,80\)/.test(texto), texto.slice(0, 200));
  v('la condición APROBADO se recalcula', /APROBADO/.test(texto));
  const est = doc2.querySelector('#ec-estadisticas').textContent;
  v('las estadísticas del lapso se recuperan (promedio 12,00)',
    /12,00/.test(est) && /5Evaluados/.test(est.replace(/\s+/g, '')), est.slice(0, 200));

  // Cambiar de docente: Carlos conserva SUS datos, distintos de los de Miguel
  doc2.getElementById('btn-cambiar-docente').click();
  doc2.getElementById('modal-aceptar').click();
  await esperar(30);
  v('el cambio de docente cierra la sesión', App2.usuario === null &&
    doc2.getElementById('pantalla-acceso').hidden === false);

  iniciarSesionEn(doc2, 1, 'carlos123');
  await esperar(80);
  v('Carlos entra con su propia contraseña', App2.usuario && App2.usuario.nombre === 'Carlos Ruiz',
    App2.usuario ? App2.usuario.nombre : 'sin sesión');
  v('Carlos conserva sus 3 estudiantes', App2.estado.estudiantes.length === 3, String(App2.estado.estudiantes.length));
  v('Carlos conserva su año 2° y su sección C',
    App2.estado.config.anios.join(',') === '2' && App2.estado.config.secciones.join(',') === 'C',
    App2.estado.config.anios.join(',') + ' / ' + App2.estado.config.secciones.join(','));
  v('Carlos conserva su asignatura y su área',
    App2.estado.config.asignaturas.length === 1 && App2.estado.config.docente.area === 'Biología, Ambiente y Tecnología');
  v('los datos de Miguel no aparecen en la sesión de Carlos',
    ZZ2.estudiantesDe(App2.estado, 1, 'A').length === 0 &&
    App2.estado.estudiantes.every(e => e.apellidos !== 'PÉREZ GÓMEZ'));

  // Volver a Miguel: su libro Excel (con planes y notas) es el que se valida aparte
  doc2.getElementById('btn-cambiar-docente').click();
  doc2.getElementById('modal-aceptar').click();
  await esperar(30);
  iniciarSesionEn(doc2, 0, 'miguel123');
  await esperar(80);
  v('al volver, Miguel conserva todo intacto después de la sesión de Carlos',
    App2.usuario && App2.usuario.nombre === 'Miguel Ángel Pérez' &&
    App2.estado.estudiantes.length === 5 && App2.estado.config.asignaturas.length === 3,
    App2.usuario ? App2.usuario.nombre + ' · ' + App2.estado.estudiantes.length : 'sin sesión');

  return { problemas: problemas, App: App2, ZZ: ZZ2, VISTAS: VISTAS2, doc: doc2, XLSX: globalThis.XLSX };
}

/* ─────────────────── fase 4: detección del modo nube ─────────────────── */

function comprobarModoNube() {
  const problemas = [];
  const v = (nombre, cond, detalle) => { if (!cond) problemas.push(nombre + (detalle ? ' → ' + detalle : '')); };

  // 4a) Configuración real + archivo local (file://) → modo local con aviso
  montarAplicacion({ nubeReal: true, protocolo: 'file:' });
  const N1 = globalThis.Nube, A1 = globalThis.Acceso, d1 = globalThis.document;
  v('la configuración real de Firebase se lee correctamente',
    N1.configurado() === true && N1.modo === 'local', 'configurado=' + N1.configurado());
  v('el proyecto configurado es notaszazarabicoa',
    (globalThis.FIREBASE_CONFIG || {}).projectId === 'notaszazarabicoa' &&
    /^1:\d+:web:/.test((globalThis.FIREBASE_CONFIG || {}).appId || ''),
    (globalThis.FIREBASE_CONFIG || {}).appId);
  v('al abrir el archivo local se usa el modo local', A1.modo === 'local');
  v('se avisa que la nube se activará al publicar la página',
    /publicada/.test(d1.getElementById('acceso-modo-chip').textContent),
    d1.getElementById('acceso-modo-chip').textContent);
  v('en modo local se ofrece crear el usuario en este equipo',
    d1.getElementById('acceso-nube').hasAttribute('hidden') === true ||
    d1.getElementById('acceso-paso-usuario').hidden === true);

  // 4b) Configuración real + página publicada (https) → modo nube
  montarAplicacion({ nubeReal: true, protocolo: 'https:' });
  const N2 = globalThis.Nube, A2 = globalThis.Acceso, d2 = globalThis.document;
  v('en una página publicada se activa el modo nube', A2.modo === 'nube' && A2.situacion.enLinea === true,
    'modo=' + A2.modo);
  v('el aviso indica que los datos se guardan en internet',
    /internet/.test(d2.getElementById('acceso-modo-chip').textContent),
    d2.getElementById('acceso-modo-chip').textContent);
  v('la pantalla de acceso pide la clave general',
    d2.getElementById('pantalla-acceso').hidden === false &&
    d2.getElementById('acceso-paso-clave').hidden === false);
  v('el formulario de correo y contraseña existe para el modo nube',
    d2.getElementById('acceso-correo') !== null && d2.getElementById('btn-nube-crear') !== null);

  // Al pasar la clave aparece el formulario de la nube (aunque no haya internet)
  d2.getElementById('acceso-clave').value = 'zazarabicoa123';
  d2.getElementById('btn-acceso-clave').click();
  v('al entrar la clave se muestra el formulario de la nube',
    d2.getElementById('acceso-paso-usuario').hidden === false &&
    d2.getElementById('acceso-nube').hidden === false,
    'nube oculto=' + d2.getElementById('acceso-nube').hidden);
  v('en modo nube no se ofrece crear usuarios locales',
    d2.getElementById('acceso-local').hidden === true);
  v('sin internet no se rompe: aparece un aviso claro',
    d2.getElementById('acceso-avisos').textContent.length > 0,
    d2.getElementById('acceso-avisos').textContent.slice(0, 120));

  return { problemas: problemas };
}

/* ─────────────────────────────── ejecución ───────────────────────────── */

setTimeout(async () => {
  const docActual = globalThis.document;
  const pre = docActual.getElementById('resultado-e2e');
  if (!pre) {
    console.log('\nLa autoprueba no produjo resultados. Últimos 1200 caracteres del documento:');
    console.log(docActual.body.textContent.slice(-1200));
    process.exit(2);
  }
  const texto = pre.textContent;
  console.log('\n' + texto);

  console.log('\n== Fase 2: reinicio de la aplicación (guardado y usuarios) ==');
  let r;
  try {
    r = await comprobarPersistencia();
  } catch (e) {
    console.log('PERSISTENCIA: FALLÓ con una excepción: ' + (e && e.message ? e.message : e));
    process.exit(1);
  }
  if (r.problemas.length) {
    console.log('PERSISTENCIA: FALLÓ (' + r.problemas.length + ')');
    r.problemas.forEach(p => console.log(' - ' + p));
  } else {
    console.log('PERSISTENCIA: OK — cada docente recupera sus datos, sin mezclarse');
  }

  const resumen = volcarExcel(r.App, r.VISTAS, r.ZZ, r.XLSX);
  console.log('\nLibro Excel (.xlsx nativo) generado con ' + resumen.hojas.length +
    ' hojas y ' + resumen.bytes + ' bytes:');
  resumen.hojas.forEach(h => console.log(' - ' + h));

  console.log('\n== Fase 3: nube (Firebase simulado, sin internet) ==');
  let nube = { ok: 0, fallos: ['no se pudo ejecutar la prueba de nube'] };
  try {
    nube = await require('./nube-simulada.js').probarNube({
      App: r.App, ZZ: r.ZZ, Nube: globalThis.Nube, UI: globalThis.UI
    });
  } catch (e) {
    nube.fallos = ['excepción en la prueba de nube: ' + (e && e.message ? e.message : e)];
  }
  if (nube.fallos.length) {
    console.log('NUBE: FALLÓ (' + nube.fallos.length + ')');
    nube.fallos.forEach(f => console.log(' - ' + f));
  } else {
    console.log('NUBE: OK — ' + nube.ok + ' verificaciones (guardado incremental, carga exacta y aislamiento por docente)');
  }

  console.log('\n== Fase 4: modo nube con la configuración real de Firebase ==');
  let modo = { problemas: [] };
  try {
    modo = comprobarModoNube();
  } catch (e) {
    modo.problemas = ['excepción al comprobar el modo nube: ' + (e && e.message ? e.message : e)];
  }
  if (modo.problemas.length) {
    console.log('MODO NUBE: FALLÓ (' + modo.problemas.length + ')');
    modo.problemas.forEach(p => console.log(' - ' + p));
  } else {
    console.log('MODO NUBE: OK — archivo local = modo local con aviso; página publicada = modo nube');
  }

  const fallos = (/E2E FALLAS: 0/.test(texto) ? 0 : 1) + r.problemas.length + nube.fallos.length + modo.problemas.length;
  process.exit(fallos === 0 ? 0 : 1);
}, 900);

/* Guarda los Excel reales generados por la aplicación para inspección externa. */
function volcarExcel(App2, VISTAS2, ZZ2, XLSX) {
  const dir = path.join(__dirname, 'salida');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const hojas = VISTAS2.sabana.libroCompleto();
  const libroHtml = globalThis.Export.libroHtml(hojas);
  fs.writeFileSync(path.join(dir, 'libro-compatibilidad.xls'), '\ufeff' + libroHtml, 'utf8');
  const bytes = XLSX.libro(hojas);
  fs.writeFileSync(path.join(dir, 'libro-completo-prueba.xlsx'), Buffer.from(bytes));
  return { hojas: hojas.map(h => h.nombre), bytes: bytes.length };
}
