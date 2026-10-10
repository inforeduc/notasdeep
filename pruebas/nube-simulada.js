/* ============================================================================
   nube-simulada.js — Prueba del almacenamiento en la nube SIN internet.

   Sustituye el api de Firebase por una base de datos simulada en memoria y
   comprueba el ciclo completo contra la aplicación real:
     • al guardar se escriben sólo los documentos que cambiaron
     • al cargar se reconstruye el estado exactamente igual
     • los datos de cada docente quedan aislados en su propia ruta
   Se ejecuta desde pruebas/ejecutar-e2e-nodo.js
   ========================================================================== */
'use strict';

function clonar(x) { return JSON.parse(JSON.stringify(x === undefined ? null : x)); }

/** Mini Firestore en memoria: documentos y subcolecciones por docente. */
function crearApiSimulada() {
  const docs = new Map();          // "docentes/uid" -> datos
  const subdocs = new Map();       // "uid/coleccion/id" -> datos
  const cuenta = { lecturas: 0, escrituras: 0, borrados: 0, listados: 0 };

  return {
    cuenta: cuenta,
    escribir: [],
    leerDoc: function (ruta) {
      cuenta.lecturas += 1;
      const k = ruta.join('/');
      return Promise.resolve(docs.has(k) ? clonar(docs.get(k)) : null);
    },
    escribirDoc: function (ruta, datos) {
      cuenta.escrituras += 1;
      this.escribir.push(ruta.join('/'));
      docs.set(ruta.join('/'), clonar(datos));
      return Promise.resolve();
    },
    escribirSubdoc: function (uid, coleccion, id, datos) {
      cuenta.escrituras += 1;
      this.escribir.push(uid + '/' + coleccion + '/' + id);
      subdocs.set(uid + '/' + coleccion + '/' + id, clonar(datos));
      return Promise.resolve();
    },
    borrarSubdoc: function (uid, coleccion, id) {
      cuenta.borrados += 1;
      subdocs.delete(uid + '/' + coleccion + '/' + id);
      return Promise.resolve();
    },
    listarSubcoleccion: function (uid, coleccion) {
      cuenta.listados += 1;
      const prefijo = uid + '/' + coleccion + '/';
      const salida = [];
      subdocs.forEach(function (v, k) {
        if (k.indexOf(prefijo) === 0) salida.push({ id: k.slice(prefijo.length), datos: clonar(v) });
      });
      return Promise.resolve(salida);
    }
  };
}

/** Estado de prueba con planes y notas. */
function estadoDePrueba(ZZ) {
  const e = ZZ.estadoInicial();
  e.config.anios = [1, 3];
  e.config.secciones = ['A', 'B'];
  e.config.asignaturas = [{ id: 'of3', nombre: 'Matemática' }, { id: 'as_x', nombre: 'C.R.P.', oficial: false }];
  e.config.docente.nombres = 'Miguel Ángel';
  e.config.docente.apellidos = 'Pérez';
  e.estudiantes = [
    { id: 'e1', cedula: 'V-11.111.111', apellidos: 'LÓPEZ', nombres: 'MARÍA', anio: 1, seccion: 'A' },
    { id: 'e2', cedula: 'V-22.222.222', apellidos: 'DÍAZ', nombres: 'PEDRO', anio: 1, seccion: 'A' }
  ];
  const k1 = ZZ.clave({ anio: 1, seccion: 'A', asignatura: 'of3', lapso: 1 });
  e.planes[k1] = {
    actividades: [
      { id: 'a1', nombre: 'Taller grupal', tipo: 'Taller grupal', contenido: 'Funciones', tecnica: 'Observación directa', instrumento: 'Escala de estimación', ponderacion: 40 },
      { id: 'a2', nombre: 'Prueba escrita', tipo: 'Prueba escrita', contenido: 'Ecuaciones', tecnica: 'Prueba escrita', instrumento: 'Prueba objetiva', ponderacion: 60 }
    ]
  };
  e.notas[k1] = { e1: { a1: 15, a2: 18 }, e2: { a1: 9, a2: 10 } };
  const k2 = ZZ.clave({ anio: 1, seccion: 'A', asignatura: 'of3', lapso: 2 });
  e.planes[k2] = { actividades: [{ id: 'b1', nombre: 'Proyecto', tipo: 'Proyecto', contenido: '', tecnica: 'Análisis de producción', instrumento: 'Rúbrica', ponderacion: 100 }] };
  e.notas[k2] = { e1: { b1: 20 } };
  e.ultimoContexto = { anio: '1', seccion: 'A', asignatura: 'of3', lapso: '1' };
  return e;
}

async function probarNube(ctx) {
  const { App, ZZ, Nube } = ctx;
  const fallos = [];
  let ok = 0;
  const v = (nombre, cond, detalle) => { if (cond) ok += 1; else fallos.push(nombre + (detalle ? ' → ' + detalle : '')); };

  const api = crearApiSimulada();
  Nube.establecerApi(api);
  v('la nube simulada queda conectada', Nube.listo() === true && Nube.modo === 'nube');

  const usuario = { id: 'uid-miguel', nombre: 'Miguel Ángel Pérez', correo: 'miguel@zazarabicoa.edu.ve' };
  const estado = estadoDePrueba(ZZ);

  /* ---------------------------------------------- subir todo */
  const antes = api.cuenta.escrituras;
  await Nube.subir(usuario, estado);
  const escrituras = api.cuenta.escrituras - antes;
  v('al subir se escribe el documento del docente y sus subcolecciones',
    escrituras === 5, 'se esperaban 5 escrituras (1 principal + 2 planes + 2 notas), hubo ' + escrituras);
  v('los documentos quedan bajo la ruta del docente',
    api.escribir.filter(r => r.indexOf('uid-miguel') === 0).length === 4 &&
    api.escribir.indexOf('docentes/uid-miguel') >= 0);
  /* ---------------------------------------------- leer y comparar */
  const recuperado = await Nube.cargar(usuario);
  const esperado = ZZ.normalizarEstado(estado);
  v('al cargar se recupera la configuración', JSON.stringify(recuperado.config) === JSON.stringify(esperado.config));
  v('al cargar se recupera la nómina', JSON.stringify(recuperado.estudiantes) === JSON.stringify(esperado.estudiantes));
  v('al cargar se recuperan los planes y las ponderaciones',
    JSON.stringify(recuperado.planes) === JSON.stringify(esperado.planes),
    JSON.stringify(Object.keys(recuperado.planes)));
  v('al cargar se recuperan todas las notas',
    JSON.stringify(recuperado.notas) === JSON.stringify(esperado.notas));
  v('al cargar se recupera el último curso usado',
    JSON.stringify(recuperado.ultimoContexto) === JSON.stringify(esperado.ultimoContexto));

  /* ---------------------------------- guardado incremental (sólo diferencias) */
  let copia = ZZ.copiaProfunda(estado);
  const estado2 = ZZ.copiaProfunda(estado);
  const clave1 = ZZ.clave({ anio: 1, seccion: 'A', asignatura: 'of3', lapso: 1 });
  estado2.notas[clave1].e1.a1 = 17;
  const antes2 = api.cuenta.escrituras;
  copia = await Nube.guardarDiferencias(usuario, estado2, copia);
  const escrituras2 = api.cuenta.escrituras - antes2;
  v('al cambiar una sola nota se escribe un solo documento', escrituras2 === 1, String(escrituras2));

  const antes3 = api.cuenta.escrituras;
  await Nube.guardarDiferencias(usuario, estado2, copia);
  v('sin cambios no se escribe nada', api.cuenta.escrituras === antes3);

  // Cambiar la configuración escribe sólo el documento principal
  const estado3 = ZZ.copiaProfunda(estado2);
  estado3.config.docente.telefono = '0414-0000000';
  const antes4 = api.cuenta.escrituras;
  copia = await Nube.guardarDiferencias(usuario, estado3, copia);
  v('al cambiar la configuración se escribe sólo el documento principal',
    api.cuenta.escrituras - antes4 === 1);

  // Borrar un lapso elimina su documento en la nube
  const estado4 = ZZ.copiaProfunda(estado3);
  delete estado4.planes[ZZ.clave({ anio: 1, seccion: 'A', asignatura: 'of3', lapso: 2 })];
  const antes5 = api.cuenta.borrados;
  copia = await Nube.guardarDiferencias(usuario, estado4, copia);
  v('al borrar un plan se elimina su documento en la nube', api.cuenta.borrados - antes5 === 1);

  /* ------------------------------------------- aislamiento entre docentes */
  const usuario2 = { id: 'uid-carlos', nombre: 'Carlos Ruiz', correo: 'carlos@zazarabicoa.edu.ve' };
  const estadoCarlos = ZZ.estadoInicial();
  estadoCarlos.config.anios = [2];
  estadoCarlos.config.docente.nombres = 'Carlos';
  estadoCarlos.estudiantes = [{ id: 'e9', cedula: 'V-99.999.999', apellidos: 'ROJAS', nombres: 'LUIS', anio: 2, seccion: 'C' }];
  await Nube.subir(usuario2, estadoCarlos);

  const deMiguel = await Nube.cargar(usuario);
  const deCarlos = await Nube.cargar(usuario2);
  v('Miguel sigue viendo sus 2 estudiantes', deMiguel.estudiantes.length === 2, String(deMiguel.estudiantes.length));
  v('Carlos sólo ve su propio estudiante', deCarlos.estudiantes.length === 1 && deCarlos.estudiantes[0].apellidos === 'ROJAS');
  v('los datos de un docente no aparecen en el otro',
    deMiguel.estudiantes.every(e => e.apellidos !== 'ROJAS') &&
    deCarlos.estudiantes.every(e => e.apellidos !== 'LÓPEZ'));
  v('cada docente tiene sus propios planes y notas',
    Object.keys(deMiguel.planes).length === 1 && Object.keys(deCarlos.planes).length === 0 &&
    Object.keys(deMiguel.notas).length === 2 && Object.keys(deCarlos.notas).length === 0);
  v('la configuración de cada docente es independiente',
    deMiguel.config.anios.join(',') === '1,3' && deCarlos.config.anios.join(',') === '2');

  /* ------------------------------ integración con la aplicación (App + Nube) */
  await App.entrarCon({ id: 'uid-miguel', nombre: 'Miguel Ángel Pérez' }, 'nube');
  v('la aplicación entra en modo nube', App.modo === 'nube' && App.enNube() === true);
  v('la aplicación carga los datos del docente desde la nube',
    App.estado.estudiantes.length === 2 && Object.keys(App.estado.notas).length === 2);
  v('la copia de control queda inicializada', !!App._snapshot);

  App.estado.notas[clave1].e2.a1 = 12;
  const antesSync = api.cuenta.escrituras;
  const sincronizado = await App.sincronizar();
  v('la sincronización automática escribe sólo lo que cambió',
    sincronizado === true && api.cuenta.escrituras - antesSync === 1,
    String(api.cuenta.escrituras - antesSync));
  const trasSync = await Nube.cargar({ id: 'uid-miguel' });
  v('el cambio llegó a la nube', trasSync.notas[clave1].e2.a1 === 12);

  const antesTodo = api.cuenta.escrituras;
  await App.subirTodoANube();
  v('«subir todo» reescribe el paquete completo del docente', api.cuenta.escrituras - antesTodo === 4,
    String(api.cuenta.escrituras - antesTodo));

  /* ------------------------------------- borrar todo el estado del docente */
  App.estado = ZZ.estadoInicial();
  await Nube.guardarDiferencias(usuario, App.estado, trasSync ? ZZ.copiaProfunda(trasSync) : null);
  const vacio = await Nube.cargar(usuario);
  v('al vaciar los datos también se limpian los documentos de la nube',
    vacio.estudiantes.length === 0 && Object.keys(vacio.planes).length === 0 && Object.keys(vacio.notas).length === 0,
    JSON.stringify({ est: vacio.estudiantes.length, planes: Object.keys(vacio.planes).length, notas: Object.keys(vacio.notas).length }));
  const carlosIntacto = await Nube.cargar(usuario2);
  v('vaciar los datos de un docente no afecta al otro', carlosIntacto.estudiantes.length === 1);

  return { ok: ok, fallos: fallos };
}

module.exports = { probarNube: probarNube, crearApiSimulada: crearApiSimulada, estadoDePrueba: estadoDePrueba };
