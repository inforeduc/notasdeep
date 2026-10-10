/* Verificación de integridad estática de la aplicación:
   - todos los id usados desde JavaScript existen en index.html
   - los archivos referenciados por index.html existen
   - las pestañas corresponden a vistas existentes
   - todas las funciones de módulo usadas desde app.js están declaradas
   Ejecutar:  node pruebas/integridad.js                                     */
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const archivos = fs.readdirSync(path.join(RAIZ, 'js')).filter(f => f.endsWith('.js')).sort();
const fuentes = {};
archivos.forEach(f => { fuentes[f] = fs.readFileSync(path.join(RAIZ, 'js', f), 'utf8'); });
const todo = Object.values(fuentes).join('\n');

const problemas = [];
const avisos = [];

/* 1. ids declarados en el HTML -------------------------------------------------*/
const idsHtml = new Set();
for (const m of html.matchAll(/\sid="([^"]+)"/g)) idsHtml.add(m[1]);

/* 2. ids usados desde JavaScript ----------------------------------------------*/
const patrones = [
  /UI\.\$\('([^']+)'\)/g,
  /UI\.ponerValor\('([^']+)'/g,
  /UI\.texto\('([^']+)'/g,
  /UI\.mostrar\('([^']+)'/g,
  /UI\.valor\('([^']+)'/g,
  /UI\.llenarSelect\('([^']+)'/g,
  /UI\.seleccionar\('([^']+)'/g,
  /UI\.listaAvisos\('([^']+)'/g,
  /getElementById\('([^']+)'\)/g
];
const usados = new Map();
for (const re of patrones) {
  for (const m of todo.matchAll(re)) {
    if (!usados.has(m[1])) usados.set(m[1], 0);
    usados.set(m[1], usados.get(m[1]) + 1);
  }
}
/* ids dinámicos construidos con plantillas: prefijo + sufijo */
Object.entries(fuentes).forEach(([f, src]) => {
  for (const m of src.matchAll(/(?:UI\.\$\(|UI\.valor\(|UI\.texto\(|UI\.mostrar\()([A-Za-z]+) \+ '-([a-z-]+)'\)/g)) {
    const base = m[1], sufijo = m[2];
    ['plan', 'ec'].forEach(p => { if (base === 'prefijo') return; });
  }
});

const dinamicosConocidos = new Set([
  'plan-medidor', 'plan-total-texto', 'plan-total-detalle', 'plan-total-barra', 'plan-total-mensaje',
  'ec-medidor', 'ec-total-texto', 'ec-total-detalle', 'ec-total-barra', 'ec-total-mensaje'
]);

const faltantes = [...usados.keys()].filter(id => !idsHtml.has(id) && !dinamicosConocidos.has(id));
if (faltantes.length) {
  problemas.push('ids usados en JavaScript que NO existen en index.html: ' + faltantes.join(', '));
}

/* 3. ids del HTML que nunca se usan (informativo) ------------------------------*/
const sinUso = [...idsHtml].filter(id => !usados.has(id) && !/^(vista-|grupo-|cuerpo-|cabeza-|pie-|tabla-|modal|fondo-|avisos-)/.test(id));
if (sinUso.length) avisos.push('ids del HTML sin referencia directa en JS (puede ser normal): ' + sinUso.join(', '));

/* 4. archivos referenciados ----------------------------------------------------*/
for (const m of html.matchAll(/<script src="([^"]+)"/g)) {
  if (!fs.existsSync(path.join(RAIZ, m[1]))) problemas.push('script no encontrado: ' + m[1]);
}
for (const m of html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)) {
  if (!fs.existsSync(path.join(RAIZ, m[1]))) problemas.push('hoja de estilo no encontrada: ' + m[1]);
}

/* 5. pestañas <-> vistas -------------------------------------------------------*/
const pestanas = [...html.matchAll(/data-vista="([^"]+)"/g)].map(m => m[1]);
const vistasHtml = new Set([...html.matchAll(/<section class="vista[^"]*" id="vista-([^"]+)"/g)].map(m => m[1]));
pestanas.forEach(p => { if (!vistasHtml.has(p)) problemas.push('la pestaña "' + p + '" no tiene sección #vista-' + p); });
vistasHtml.forEach(v => { if (!pestanas.includes(v)) problemas.push('la vista "' + v + '" no tiene pestaña'); });

/* 6. módulos registrados ------------------------------------------------------*/
const registrados = new Set([...todo.matchAll(/VISTAS\.([a-z]+)\s*=/g)].map(m => m[1]));
['configuracion', 'nomina', 'plan', 'continua', 'sabana', 'respaldo'].forEach(v => {
  if (!registrados.has(v)) problemas.push('no se registró el módulo VISTAS.' + v);
});
const appSrc = fuentes['app.js'] || '';
for (const m of appSrc.matchAll(/VISTAS\.([a-z]+)\./g)) {
  if (!registrados.has(m[1])) problemas.push('app.js usa VISTAS.' + m[1] + ' que no existe');
}

/* 7. funciones exigidas por los módulos a la capa global ----------------------*/
const exigidas = [
  ['App', ['iniciar', 'guardar', 'cambio', 'notificar', 'alCambiar', 'estado', 'leerCopias',
    'guardarCopia', 'restaurarCopia', 'borrarCopia', 'reemplazarEstado', 'borrarTodo', 'resumen',
    'refrescarSelectores', 'actualizarCabecera', 'ponerEscudoCabecera', 'disponible']],
  ['UI', ['$', '$$', 'esc', 'valor', 'ponerValor', 'texto', 'mostrar', 'avisoFlotante', 'modal',
    'confirmar', 'descargar', 'leerArchivo', 'escudoHtml', 'llenarSelect', 'seleccionar',
    'listaAvisos', 'fechaLarga', 'fechaHora', 'selloArchivo', 'nombresFirmas']],
  ['Export', ['membrete', 'ficha', 'firmas', 'imprimir', 'excel', 'libroHtml', 'hojaHtml',
    'encabezadoExcel', 'hojaSabana', 'nombreHoja', 'celdaHtml']],
  ['ZZ', ['estadoInicial', 'clave', 'partesClave', 'planDe', 'asegurarPlan', 'actividadesDe',
    'notasDe', 'estudiantesDe', 'sumaPonderacion', 'puntosDe', 'redondearOficial',
    'calcularDefinitiva', 'estadisticas', 'consolidarAnual', 'consolidarGeneral',
    'normalizarCedula', 'normalizarSexo', 'parsearNomina', 'normalizarEstado', 'fmt2', 'fmtNota',
    'fmtPct', 'escapar', 'nuevoId', 'nombreDocente', 'nombreCompleto', 'tituloLapso']]
];
const declarado = (nombre) => {
  const n = nombre.replace(/[$]/g, '\\$');
  return new RegExp('(^|[\\s{,])\\s*' + n + '\\s*:', 'm').test(todo) ||
    new RegExp('function\\s+' + n + '\\b').test(todo) ||
    new RegExp('(^|[\\s.])' + n + '\\s*=\\s*function', 'm').test(todo) ||
    new RegExp('(^|[\\s.])' + n + '\\s*:\\s*function', 'm').test(todo);
};
exigidas.forEach(([objeto, funciones]) => {
  funciones.forEach(fn => {
    if (!declarado(fn)) problemas.push('falta la función ' + objeto + '.' + fn);
  });
});

/* 8. equilibrado de llaves/paréntesis por archivo (ignorando cadenas y comentarios) */
function limpiarCodigo(src) {
  let salida = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i], c2 = src[i + 1];
    if (c === '/' && c2 === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && c2 === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const comilla = c; i++;
      while (i < n && src[i] !== comilla) { if (src[i] === '\\') i++; i++; }
      i++; salida += '""'; continue;
    }
    if (c === '/' && c2 !== '/' && c2 !== '*') {
      // posible expresión regular: sólo si lo anterior no es un valor
      const antes = salida.replace(/\s+$/, '');
      const ultimo = antes[antes.length - 1] || '';
      if (!/[\w\)\]$'"]/.test(ultimo)) {
        i++;
        let enClase = false;
        while (i < n && (src[i] !== '/' || enClase)) {
          if (src[i] === '\\') i++;
          else if (src[i] === '[') enClase = true;
          else if (src[i] === ']') enClase = false;
          i++;
        }
        i++; salida += 'RE'; continue;
      }
    }
    salida += c; i++;
  }
  return salida;
}

Object.entries(fuentes).forEach(([f, src]) => {
  const limpio = limpiarCodigo(src);
  const l = (limpio.match(/\{/g) || []).length, r = (limpio.match(/\}/g) || []).length;
  if (l !== r) problemas.push(f + ': llaves desequilibradas (' + l + ' vs ' + r + ')');
  const p1 = (limpio.match(/\(/g) || []).length, p2 = (limpio.match(/\)/g) || []).length;
  if (p1 !== p2) problemas.push(f + ': paréntesis desequilibrados (' + p1 + ' vs ' + p2 + ')');
});
{
  const l = (html.match(/<div/g) || []).length, r = (html.match(/<\/div>/g) || []).length;
  if (l !== r) problemas.push('index.html: <div> desequilibrados (' + l + ' vs ' + r + ')');
  const s1 = (html.match(/<section/g) || []).length, s2 = (html.match(/<\/section>/g) || []).length;
  if (s1 !== s2) problemas.push('index.html: <section> desequilibrados (' + s1 + ' vs ' + s2 + ')');
}

/* 9. balance de llaves en el CSS ----------------------------------------------*/
const css = fs.readFileSync(path.join(RAIZ, 'css', 'estilos.css'), 'utf8');
{
  const l = (css.match(/\{/g) || []).length, r = (css.match(/\}/g) || []).length;
  if (l !== r) problemas.push('estilos.css: llaves desequilibradas (' + l + ' vs ' + r + ')');
}

/* 10. sin restos de texto corrupto o marcadores pendientes ---------------------*/
[['venue', /\bvenue\b/], ['FIXME', /\bFIXME\b/], ['XXX', /\bXXX\b/], ['TODO:', /TODO:/]].forEach(([nombre, re]) => {
  if (re.test(todo) || re.test(css) || re.test(html)) {
    problemas.push('aparece el marcador "' + nombre + '" en el código');
  }
});

/* 11. la regla [hidden] debe existir ------------------------------------------
   Sin ella, un elemento oculto cuyo estilo define display (por ejemplo el modal
   con display:flex) se muestra igual y bloquea toda la aplicación. */
if (!/\[hidden\]\s*\{[^}]*display:\s*none/.test(css)) {
  problemas.push('estilos.css no contiene la regla [hidden] { display: none }: los elementos ' +
    'ocultos con estilo propio (como el modal de confirmación) quedarían visibles y bloquearían la aplicación');
}

/* 12. escudo institucional real integrado -------------------------------------*/
const escudoReal = fuentes['escudo-real.js'] || '';
if (!/ESCUDO_REAL\s*=\s*'data:image\//.test(escudoReal)) {
  problemas.push('js/escudo-real.js no contiene el escudo institucional como imagen incrustada');
}
if (escudoReal.length < 20000) {
  problemas.push('js/escudo-real.js parece incompleto (' + escudoReal.length + ' caracteres)');
}
if (!/ESCUDO_REAL/.test(fuentes['ui.js'] || '')) {
  problemas.push('ui.js no usa el escudo institucional integrado (ESCUDO_REAL)');
}
const imgEscudo = path.join(RAIZ, 'img', 'escudo-zazarabicoa.jpg');
if (!fs.existsSync(imgEscudo)) problemas.push('no se encontró img/escudo-zazarabicoa.jpg');
else if (fs.statSync(imgEscudo).size < 5000) problemas.push('img/escudo-zazarabicoa.jpg parece vacío o dañado');

/* 13. los elementos ocultos del HTML no deben tener display propio -------------*/
const conDisplayYHidden = [...html.matchAll(/<([a-z]+)[^>]*\bhidden\b[^>]*class="([^"]+)"/g)]
  .map(m => m[2])
  .filter(clase => clase.split(/\s+/).some(c => new RegExp('\\.' + c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{[^}]*display:', 'm').test(css)));
if (conDisplayYHidden.length && !/\[hidden\]\s*\{[^}]*display:\s*none/.test(css)) {
  problemas.push('elementos con atributo hidden y estilo display propio: ' + conDisplayYHidden.join(', '));
}

/* 14. capas (z-index): el modal y los avisos deben quedar por encima del acceso */
function zIndex(clase) {
  const m = css.match(new RegExp('\\.' + clase + '\\s*\\{[^}]*z-index:\\s*(\\d+)', 'm'));
  return m ? Number(m[1]) : null;
}
const zAcceso = zIndex('pantalla-acceso'), zModal = zIndex('fondo-modal'), zAvisos = zIndex('avisos-flotantes');
if (zAcceso === null) problemas.push('no se encontró el estilo de .pantalla-acceso');
if (zModal === null || zAcceso === null || zModal <= zAcceso) {
  problemas.push('el modal (z-index ' + zModal + ') debe quedar por encima de la pantalla de acceso (z-index ' + zAcceso + ')');
}
if (zAvisos === null || zModal === null || zAvisos <= zModal) {
  problemas.push('los avisos flotantes (z-index ' + zAvisos + ') deben quedar por encima del modal (z-index ' + zModal + ')');
}

/* 15. archivos de la nube y de acceso ----------------------------------------*/
['js/nube.js', 'js/acceso.js', 'js/firebase-config.js', 'js/config-acceso.js'].forEach(f => {
  if (!fs.existsSync(path.join(RAIZ, f))) problemas.push('falta el archivo ' + f);
});
const configAcceso = fuentes['config-acceso.js'] || '';
if (!/clave:\s*'[^']+'/.test(configAcceso)) problemas.push('config-acceso.js no define la clave de acceso');
const configNube = fuentes['firebase-config.js'] || '';
if (!/FIREBASE_CONFIG\s*=\s*\{/.test(configNube) || !/apiKey/.test(configNube)) {
  problemas.push('firebase-config.js no define el objeto FIREBASE_CONFIG');
}
/* Si la configuración está rellenada, debe estarlo completa y con formato válido */
{
  const bloque = configNube.match(/FIREBASE_CONFIG\s*=\s*\{([\s\S]*?)\}/);
  const campos = {};
  if (bloque) {
    for (const m of bloque[1].matchAll(/(\w+)\s*:\s*["']([^"']*)["']/g)) campos[m[1]] = m[2];
  }
  const relleno = !!(campos.apiKey && campos.apiKey.length > 10);
  if (relleno) {
    ['apiKey', 'authDomain', 'projectId', 'appId'].forEach(c => {
      if (!campos[c]) problemas.push('la configuración de Firebase está a medias: falta ' + c);
    });
    if (campos.apiKey && !/^AIza/.test(campos.apiKey)) {
      problemas.push('el apiKey de Firebase no parece válido (debería empezar por «AIza»)');
    }
    if (campos.appId && !/^1:\d+:web:[0-9a-f]+$/.test(campos.appId)) {
      problemas.push('el appId de Firebase no tiene el formato esperado (1:numero:web:hexadecimal)');
    }
    if (campos.authDomain && !/\.firebaseapp\.com$/.test(campos.authDomain)) {
      problemas.push('el authDomain no termina en .firebaseapp.com: ' + campos.authDomain);
    }
    avisos.push('configuración de Firebase activa para el proyecto «' + campos.projectId + '» (la nube se usará al publicar la página)');
  } else {
    avisos.push('Firebase sin configurar: la aplicación trabaja en modo local');
  }
}
const nube = fuentes['nube.js'] || '';
['configurado', 'conectar', 'cargar', 'guardarDiferencias', 'subir', 'establecerApi'].forEach(fn => {
  if (!new RegExp('\\b' + fn + '\\s*:').test(nube)) problemas.push('nube.js no expone ' + fn + '()');
});
const acceso = fuentes['acceso.js'] || '';
['iniciar', 'probarClave', 'pasoUsuarios', 'crearUsuarioLocal', 'entrarComo', 'salir'].forEach(fn => {
  if (!new RegExp('\\b' + fn + '\\s*:').test(acceso)) problemas.push('acceso.js no expone ' + fn + '()');
});
if (!/docentes/.test(nube) || !/planes/.test(nube)) {
  problemas.push('nube.js no guarda los datos separados por docente (docentes/planes)');
}

/* 16. la interfaz de acceso debe existir en index.html -----------------------*/
['pantalla-acceso', 'acceso-clave', 'btn-acceso-clave', 'acceso-paso-usuario', 'acceso-paso-clave',
  'acceso-usuarios-lista', 'acceso-nombre', 'acceso-nueva-clave', 'acceso-nueva-clave2',
  'btn-crear-usuario', 'acceso-avisos', 'acceso-nube', 'acceso-correo', 'btn-nube-entrar',
  'btn-nube-crear', 'btn-cambiar-docente', 'chip-nube'].forEach(id => {
  if (!idsHtml.has(id)) problemas.push('falta el elemento #' + id + ' en index.html (pantalla de acceso)');
});

/* 17. las columnas de sexo deben haber desaparecido ---------------------------*/
['cuerpo-nomina', 'cuerpo-masiva'].forEach(cont => {
  const m = html.match(new RegExp('<tbody id="' + cont + '"', 'i'));
  if (m) return;
  problemas.push('no se encontró el contenedor ' + cont);
});
if (/<th[^>]*>Sexo<\/th>/i.test(html)) problemas.push('index.html todavía muestra una columna «Sexo»');
if (/opcionSexo|data-campo="sexo"/.test(todo)) problemas.push('el código todavía ofrece capturar el sexo del estudiante');
if (/id="doc-titulo"/.test(html)) problemas.push('todavía se solicita el Título / Especialidad del docente');
if (/Título \/ [Ee]specialidad/.test(html)) problemas.push('index.html todavía muestra la etiqueta «Título / Especialidad»');
if (/inst-escudo-archivo|btn-escudo-quitar/.test(todo)) problemas.push('todavía se permite reemplazar el logo institucional');

/* 18. datos del plantel pedidos ----------------------------------------------*/
[['S4375D1305', 'código DEA'], ['Cachimba', 'circuito escolar'], ['Morán', 'municipio'], ['Lara', 'estado'],
  ['Rosana Rodríguez', 'directora'], ['Rocío García', 'coordinadora 1'], ['Eli Torrealba', 'coordinadora 2'],
  ['inst-coordinador2', 'campo de la segunda coordinadora']].forEach(([texto, nombre]) => {
  if (todo.indexOf(texto) < 0 && html.indexOf(texto) < 0) {
    problemas.push('no aparece ' + nombre + ' ("' + texto + '") en la aplicación');
  }
});

console.log('\n== Verificación de integridad ==');
console.log('  Archivos JS analizados: ' + archivos.join(', '));
console.log('  ids declarados en index.html: ' + idsHtml.size);
console.log('  ids utilizados desde JavaScript: ' + usados.size);
avisos.forEach(a => console.log('  aviso: ' + a));
if (problemas.length) {
  console.log('\n  PROBLEMAS ENCONTRADOS:');
  problemas.forEach(p => console.log('   - ' + p));
  console.log('\nINTEGRIDAD: FALLÓ\n');
  process.exit(1);
} else {
  console.log('\nINTEGRIDAD: OK — sin problemas detectados\n');
  process.exit(0);
}
