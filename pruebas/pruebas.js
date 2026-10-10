/* Pruebas automatizadas del núcleo lógico.
   Ejecutar:  node pruebas/pruebas.js                                        */
'use strict';
const ZZ = require('../js/nucleo.js');

let ok = 0, fallos = 0;
function prueba(nombre, fn) {
  try { fn(); ok++; console.log('  OK   ' + nombre); }
  catch (e) { fallos++; console.log('  FALLA ' + nombre + '\n        ' + e.message); }
}
function igual(recibido, esperado, etiqueta) {
  const a = JSON.stringify(recibido), b = JSON.stringify(esperado);
  if (a !== b) throw new Error((etiqueta || 'valor') + ': se esperaba ' + b + ' y se obtuvo ' + a);
}

console.log('\n== Ponderación y puntos acumulados ==');
prueba('suma de ponderaciones', () => {
  igual(ZZ.sumaPonderacion([{ ponderacion: 20 }, { ponderacion: 30.5 }, { ponderacion: 49.5 }]), 100);
});
prueba('Σ (nota × % / 100) con decimales', () => {
  const acts = [{ id: 'a', ponderacion: 25 }, { id: 'b', ponderacion: 25 }, { id: 'c', ponderacion: 50 }];
  const r = ZZ.puntosDe(acts, { a: 18, b: 15, c: 12 });
  // 18*0.25 + 15*0.25 + 12*0.50 = 4.5 + 3.75 + 6 = 14.25
  igual(r.puntos, 14.25, 'puntos');
  igual(r.completo, true, 'completo');
});
prueba('estudiante sin notas devuelve null', () => {
  igual(ZZ.puntosDe([{ id: 'a', ponderacion: 100 }], {}), null);
});
prueba('notas parciales usan sólo lo ponderado registrado', () => {
  igual(ZZ.puntosDe([{ id: 'a', ponderacion: 40 }, { id: 'b', ponderacion: 60 }], { a: 10 }).puntos, 4);
});

console.log('\n== Redondeo oficial ==');
const aj = (modo) => ({ minima: 10, umbral: 0.5, modoRedondeo: modo, escalaMax: 20, revisionDesde: 9 });
prueba('estándar: 9,50 → 10', () => igual(ZZ.redondearOficial(9.5, aj('estandar')), 10));
prueba('estándar: 15,49 → 15', () => igual(ZZ.redondearOficial(15.49, aj('estandar')), 15));
prueba('estándar: 10,50 → 11', () => igual(ZZ.redondearOficial(10.5, aj('estandar')), 11));
prueba('restringido: 9,50 → 9 y 10,50 → 11', () => {
  igual(ZZ.redondearOficial(9.5, aj('aprobatoria')), 9);
  igual(ZZ.redondearOficial(10.5, aj('aprobatoria')), 11);
});
prueba('truncar: 9,99 → 9', () => igual(ZZ.redondearOficial(9.99, aj('truncar')), 9));
prueba('sin errores de coma flotante (14,10 → 14)', () => {
  igual(ZZ.redondearOficial(14.1, aj('estandar')), 14);
  igual(ZZ.redondearOficial(0.5, aj('estandar')), 1);
  igual(ZZ.redondearOficial(19.99, aj('estandar')), 20);
});
prueba('condición y tope de escala', () => {
  igual(ZZ.calcularDefinitiva(9.4, aj('estandar')).condicion, 'REPROBADO');
  igual(ZZ.calcularDefinitiva(9.5, aj('estandar')).condicion, 'APROBADO');
  igual(ZZ.calcularDefinitiva(25, aj('estandar')).definitiva, 20);
  igual(ZZ.calcularDefinitiva(null, aj('estandar')).condicion, 'SIN DATOS');
});

console.log('\n== Estadísticas del lapso ==');
prueba('matrícula, evaluados, aprobados, reprobados y promedio', () => {
  const filas = [
    { definitiva: 18 }, { definitiva: 12 }, { definitiva: 9 }, { definitiva: 15 }, { definitiva: null }
  ];
  const s = ZZ.estadisticas(filas, { minima: 10 });
  igual(s.matricula, 5, 'matrícula');
  igual(s.evaluados, 4, 'evaluados');
  igual(s.aprobados, 3, 'aprobados');
  igual(s.reprobados, 1, 'reprobados');
  igual(s.porcAprobados, 75, '% aprobados');
  igual(s.porcReprobados, 25, '% reprobados');
  igual(s.promedio, 13.5, 'promedio');
});
prueba('curso sin evaluados', () => {
  const s = ZZ.estadisticas([{ definitiva: null }], { minima: 10 });
  igual([s.evaluados, s.porcentaje, s.promedio], [0, undefined, null]);
});

console.log('\n== Sábana anual ==');
prueba('promedio y definitiva de los 3 lapsos', () => {
  const c = ZZ.consolidarAnual({ 1: 15, 2: 12, 3: 14 }, aj('estandar'));
  igual([c.promedio, c.definitiva, c.condicion], [13.67, 14, 'APROBADO']);
});
prueba('9,5 anual es APROBADO con redondeo estándar', () => {
  const c = ZZ.consolidarAnual({ 1: 10, 2: 9, 3: 9.5 }, aj('estandar'));
  igual([c.promedio, c.definitiva, c.condicion], [9.5, 10, 'APROBADO']);
});
prueba('derecho a revisión entre 9 y 10', () => {
  const c = ZZ.consolidarAnual({ 1: 9, 2: 9, 3: 9.4 }, aj('estandar'));
  igual([c.definitiva, c.revision, c.condicion], [9, true, 'REPROBADO / DERECHO A REVISIÓN']);
});
prueba('marca lapsos faltantes', () => {
  const c = ZZ.consolidarAnual({ 1: 14, 2: null, 3: 16 }, aj('estandar'));
  igual([c.promedio, c.parcial, c.faltantes], [15, true, [2]]);
});
prueba('promedio general entre asignaturas', () => {
  const g = ZZ.consolidarGeneral({ a: { promedio: 15 }, b: { promedio: 14 }, c: { promedio: null } }, aj('estandar'));
  igual([g.promedio, g.definitiva, g.condicion], [14.5, 15, 'APROBADO']);
});

console.log('\n== Cédulas y sexo ==');
prueba('formato de cédula venezolana', () => {
  igual(ZZ.normalizarCedula('v-12345678').texto, 'V-12.345.678');
  igual(ZZ.normalizarCedula('12345678').texto, '12.345.678');
  igual(ZZ.normalizarCedula('E 8.123.456').texto, 'E-8.123.456');
  igual(ZZ.normalizarCedula('V-12345678').numero, '12345678');
});
prueba('normalización de sexo', () => {
  igual([ZZ.normalizarSexo('M'), ZZ.normalizarSexo('Masculino'), ZZ.normalizarSexo('V'), ZZ.normalizarSexo('H'), ZZ.normalizarSexo('F'), ZZ.normalizarSexo('x')],
        ['M', 'M', 'M', 'M', 'F', '']);
});

console.log('\n== Carga masiva de nóminas ==');
prueba('pegado desde Excel (tabulaciones)', () => {
  const r = ZZ.parsearNomina('Cédula\tApellidos\tNombres\tSexo\nV-12345678\tPérez Gómez\tJuan Carlos\tM\nE-8123456\tRodríguez\tAna\tF');
  igual(r.filas.length, 2);
  igual([r.filas[0].cedula, r.filas[0].apellidos, r.filas[0].nombres],
        ['V-12.345.678', 'PÉREZ GÓMEZ', 'JUAN CARLOS']);
  igual(r.filas[0].sexo, undefined);
  igual(r.filas[1].cedula, 'E-8.123.456');
});
prueba('pegado desde Word separado por punto y coma', () => {
  const r = ZZ.parsearNomina('V-11111111; LÓPEZ; MARÍA; F');
  igual([r.filas[0].apellidos, r.filas[0].nombres], ['LÓPEZ', 'MARÍA']);
  igual(r.filas[0].sexo, undefined);
});
prueba('texto corrido sin separadores fuertes', () => {
  const r = ZZ.parsearNomina('V-20123456 Salazar Rivas Luis Alberto M');
  igual([r.filas[0].apellidos, r.filas[0].nombres, r.filas[0].cedula],
        ['SALAZAR RIVAS', 'LUIS ALBERTO', 'V-20.123.456']);
});
prueba('formato "Apellidos, Nombres"', () => {
  const r = ZZ.parsearNomina('12.345.678, Marcano Pérez, José Gregorio, M');
  igual([r.filas[0].apellidos, r.filas[0].nombres], ['MARCANO PÉREZ', 'JOSÉ GREGORIO']);
});
prueba('sin cédula genera advertencia y conserva el nombre', () => {
  const r = ZZ.parsearNomina('Gómez Ruiz Pedro; M');
  igual(r.filas.length, 1);
  igual(r.advertencias.length, 1);
});
prueba('línea vacías y encabezados se ignoran', () => {
  const r = ZZ.parsearNomina('\n\nCédula Apellidos Nombres Sexo\n\nV-1.234.567\tDíaz\tLuis\tM\n');
  igual(r.filas.length, 1);
});

console.log('\n== Estado: claves, normalización y persistencia ==');
prueba('clave única por año/sección/asignatura/lapso', () => {
  const k1 = ZZ.clave({ anio: 1, seccion: 'A', asignatura: 'of1', lapso: 1 });
  const k2 = ZZ.clave({ anio: 1, seccion: 'A', asignatura: 'of1', lapso: 2 });
  if (k1 === k2) throw new Error('las claves deben ser distintas');
});
prueba('estado inicial coherente', () => {
  const e = ZZ.estadoInicial();
  igual([e.config.anios.length, e.estudiantes.length, Object.keys(e.planes).length], [0, 0, 0]);
  igual(e.config.ajustes.minima, 10);
});
prueba('normalizarEstado repara datos corruptos', () => {
  const e = ZZ.normalizarEstado({
    config: { anios: ['1', 9, 3], secciones: ['a', ' B '], asignaturas: [{ nombre: 'Arte y Patrimonio' }] },
    estudiantes: [{ apellidos: 'Pérez', nombres: 'Luis', anio: '2', seccion: 'a', sexo: 'm' }],
    planes: { k: { actividades: [{ nombre: 'Taller', ponderacion: '25,5' }] } },
    notas: { k: { est1: { act1: '15,5', act2: null } } }
  });
  igual(e.config.anios, [1, 3]);
  igual(e.config.secciones, ['A', 'B']);
  igual([e.estudiantes[0].anio, e.estudiantes[0].seccion, e.estudiantes[0].sexo], [2, 'A', 'M']);
  igual(e.planes.k.actividades[0].ponderacion, 25.5);
  igual(e.notas.k.est1, { act1: 15.5 });
  igual(e.config.institucion.fundado, 1946);
});
prueba('estudiantesDe filtra y ordena alfabéticamente', () => {
  const e = ZZ.estadoInicial();
  e.estudiantes = [
    { apellidos: 'Zapata', nombres: 'Ana', anio: 1, seccion: 'A' },
    { apellidos: 'Álvarez', nombres: 'Beto', anio: 1, seccion: 'A' },
    { apellidos: 'Mora', nombres: 'Carlos', anio: 1, seccion: 'B' }
  ];
  const r = ZZ.estudiantesDe(e, 1, 'A');
  igual(r.map(x => x.apellidos), ['Álvarez', 'Zapata']);
});

console.log('\n== Formato venezolano ==');
prueba('separador decimal con coma', () => {
  igual([ZZ.fmt2(14.25), ZZ.fmtNota(15.5), ZZ.fmtPct(75)], ['14,25', '15,5', '75,00 %']);
});

console.log('\n== Datos por defecto del plantel ==');
prueba('los datos de Zazarabicoa vienen precargados', () => {
  const i = ZZ.estadoInicial().config.institucion;
  igual([i.nombre, i.fundado, i.codigoDEA], ['Complejo Educativo "Zazarabicoa"', 1946, 'S4375D1305']);
  igual([i.circuito, i.municipio, i.estado], ['José Morales "Cachimba"', 'Morán', 'Lara']);
  igual([i.director, i.coordinador, i.coordinador2], ['Rosana Rodríguez', 'Rocío García', 'Eli Torrealba']);
  igual(i.anioEscolar, '2024-2025');
});
prueba('el docente ya no tiene título sino área de desempeño', () => {
  const d = ZZ.estadoInicial().config.docente;
  igual(d.area, '');
  if (!('titulo' in d)) throw new Error('se esperaba conservar la clave por compatibilidad');
});
prueba('coordinadores devuelve los dos nombres', () => {
  const c = ZZ.estadoInicial().config;
  igual(ZZ.coordinadores(c), ['Rocío García', 'Eli Torrealba']);
  c.institucion.coordinador2 = '';
  igual(ZZ.coordinadores(c), ['Rocío García']);
});
prueba('áreas disponibles: las 10 asignaturas de la institución', () => {
  const c = ZZ.estadoInicial().config;
  const areas = ZZ.areasDisponibles(c);
  igual(areas.length, 10);
  if (areas.indexOf('Biología, Ambiente y Tecnología') < 0) throw new Error('falta Biología');
  if (areas.indexOf('Orientación Vocacional') < 0) throw new Error('falta Orientación Vocacional');
});
prueba('las asignaturas adicionales se suman a las áreas sin repetirse', () => {
  const c = ZZ.estadoInicial().config;
  c.asignaturas = [{ id: 'as1', nombre: 'C.R.P.' }, { id: 'of3', nombre: 'Matemática' }];
  const areas = ZZ.areasDisponibles(c);
  igual(areas.length, 11);
  igual(areas.filter(a => a === 'Matemática').length, 1);
  igual(areas[areas.length - 1], 'C.R.P.');
});

console.log('\n== Nómina sin columna de sexo ==');
prueba('una lista con columna de sexo se carga sin ese dato', () => {
  const r = ZZ.parsearNomina('V-12345678\tPérez Gómez\tJuan Carlos\tM\nE-8123456\tRodríguez\tAna María\tF');
  igual(r.filas.length, 2);
  igual(r.filas[0].sexo, undefined);
  igual([r.filas[0].cedula, r.filas[0].apellidos, r.filas[0].nombres], ['V-12.345.678', 'PÉREZ GÓMEZ', 'JUAN CARLOS']);
  igual([r.filas[1].cedula, r.filas[1].nombres], ['E-8.123.456', 'ANA MARÍA']);
});
prueba('el texto corrido no contamina los nombres con la letra del sexo', () => {
  const r = ZZ.parsearNomina('V-20123456 Salazar Rivas Luis Alberto M');
  igual([r.filas[0].apellidos, r.filas[0].nombres], ['SALAZAR RIVAS', 'LUIS ALBERTO']);
  igual(r.filas[0].sexo, undefined);
});
prueba('las tres columnas siguen reconociéndose en cualquier separador', () => {
  const r = ZZ.parsearNomina('Cédula; Apellidos; Nombres\nV-1.234.567; Díaz; Luis');
  igual([r.filas[0].apellidos, r.filas[0].nombres, r.filas[0].cedula], ['DÍAZ', 'LUIS', 'V-1.234.567']);
});

console.log('\n== Huella de contraseñas (acceso) ==');
prueba('SHA-256 correcto (vector de prueba "abc")', () => {
  igual(ZZ.sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
prueba('SHA-256 de la cadena vacía', () => {
  igual(ZZ.sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});
prueba('la implementación coincide exactamente con la de Node (crypto)', () => {
  const crypto = require('crypto');
  ['abc', '', 'Evaluación docente de Zazarabicoa', 'ZAZARABICOA 1946 · Morán, Lara',
    'ñÑáéíóú 123', 'a'.repeat(1000), 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(64)].forEach(t => {
      igual(ZZ.sha256Hex(t), crypto.createHash('sha256').update(t, 'utf8').digest('hex'),
        'texto de ' + t.length + ' caracteres');
    });
});
prueba('la huella usa la sal y no guarda la contraseña', () => {
  const h1 = ZZ.hashClave('zazarabicoa123', 'sal1');
  const h2 = ZZ.hashClave('zazarabicoa123', 'sal2');
  if (h1 === h2) throw new Error('la sal no cambia el resultado');
  if (h1.indexOf('zazarabicoa') >= 0) throw new Error('la huella contiene la contraseña');
  igual(ZZ.hashClave('zazarabicoa123', 'sal1'), h1);
  igual(h1.length, 64);
});

console.log('\n== Diferencias para la nube ==');
const estA = () => {
  const e = ZZ.estadoInicial();
  e.estudiantes = [{ id: 'e1', apellidos: 'LÓPEZ', nombres: 'ANA', anio: 1, seccion: 'A' }];
  e.planes['1||A||of3||1'] = { actividades: [{ id: 'a1', nombre: 'Taller', ponderacion: 100 }] };
  e.notas['1||A||of3||1'] = { e1: { a1: 15 } };
  return e;
};
prueba('sin cambios no hay diferencias', () => {
  const a = estA();
  const d = ZZ.diffEstado(a, ZZ.copiaProfunda(a));
  igual(ZZ.hayDiferencias(d), false);
});
prueba('cambiar la configuración marca sólo el documento principal', () => {
  const a = estA(), b = ZZ.copiaProfunda(a);
  b.config.docente.telefono = '0414-1';
  const d = ZZ.diffEstado(a, b);
  igual([!!d.principal, Object.keys(d.planes).length, Object.keys(d.notas).length], [true, 0, 0]);
});
prueba('cambiar una nota marca sólo esa nota', () => {
  const a = estA(), b = ZZ.copiaProfunda(a);
  b.notas['1||A||of3||1'].e1.a1 = 18;
  const d = ZZ.diffEstado(a, b);
  igual([!!d.principal, Object.keys(d.notas)], [false, ['1||A||of3||1']]);
  igual(d.notas['1||A||of3||1'].e1.a1, 18);
});
prueba('agregar una nómina completa marca el documento principal', () => {
  const a = estA(), b = ZZ.copiaProfunda(a);
  b.estudiantes.push({ id: 'e2', apellidos: 'DÍAZ', nombres: 'LUIS', anio: 1, seccion: 'A' });
  const d = ZZ.diffEstado(a, b);
  igual(!!d.principal, true);
});
prueba('quitar un plan o una nota se marca como borrado (null)', () => {
  const a = estA(), b = ZZ.copiaProfunda(a);
  delete b.planes['1||A||of3||1'];
  delete b.notas['1||A||of3||1'];
  const d = ZZ.diffEstado(a, b);
  igual([d.planes['1||A||of3||1'], d.notas['1||A||of3||1']], [null, null]);
  igual(ZZ.hayDiferencias(d), true);
});

console.log('\n== Separación de datos por docente ==');
prueba('el estado inicial de cada docente es independiente', () => {
  const a = ZZ.estadoInicial(), b = ZZ.estadoInicial();
  a.config.docente.nombres = 'Miguel';
  a.estudiantes.push({ id: 'x', apellidos: 'PÉREZ', nombres: 'ANA' });
  igual([b.config.docente.nombres, b.estudiantes.length], ['', 0]);
});
prueba('normalizarEstado conserva el área y los dos coordinadores', () => {
  const e = ZZ.normalizarEstado({
    config: {
      docente: { nombres: 'Carlos', area: 'Biología, Ambiente y Tecnología' },
      institucion: { coordinador: 'Rocío García', coordinador2: 'Eli Torrealba', codigoDEA: 'S4375D1305' }
    }
  });
  igual([e.config.docente.area, ZZ.coordinadores(e.config)],
    ['Biología, Ambiente y Tecnología', ['Rocío García', 'Eli Torrealba']]);
});

console.log('\n---------------------------------------------');
console.log((fallos === 0 ? 'TODAS LAS PRUEBAS PASARON' : 'HAY FALLAS') + ': ' + ok + ' correctas, ' + fallos + ' fallidas\n');
process.exit(fallos === 0 ? 0 : 1);
