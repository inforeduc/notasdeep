/* ============================================================================
   nube.js — Almacenamiento en la nube con Firebase (Google), opcional.

   • Si js/firebase-config.js tiene datos, la aplicación trabaja en MODO NUBE:
     cada docente entra con su correo y contraseña (Firebase Authentication) y
     sus datos viven en Cloud Firestore, separados por usuario.
   • Si ese archivo está vacío, la aplicación sigue funcionando en MODO LOCAL
     (usuarios y datos dentro del navegador, con respaldo .json).

   El acceso a los datos se hace a través de un objeto «api» con cinco
   operaciones, de modo que la lógica se puede probar con un api simulado
   (pruebas/nube-simulada.js) sin necesidad de internet.
   ========================================================================== */
(function (raiz) {
  'use strict';

  var Nube = {
    modo: 'local',
    version: '',
    error: '',
    _mods: null,
    _app: null,
    _db: null,
    _authSdk: null,
    _api: null,

    /* ------------------------------------------------------------ estado */
    configurado: function () {
      var c = raiz.FIREBASE_CONFIG || {};
      return !!(c.apiKey && c.projectId && c.appId);
    },

    listo: function () { return Nube.modo === 'nube' && !!Nube._api; },

    /** Permite inyectar un api simulado (usado por las pruebas automáticas). */
    establecerApi: function (api, mods) {
      Nube._api = api;
      Nube._mods = mods || null;
      Nube.modo = 'nube';
      Nube.error = '';
      return Nube;
    },

    api: function () { return Nube._api; },

    /* --------------------------------------------------------- conexión */
    /** Carga el SDK desde el CDN de Google probando varias versiones. */
    conectar: function () {
      if (!Nube.configurado()) {
        return Promise.reject(new Error('Firebase todavía no está configurado (vea js/firebase-config.js).'));
      }
      if (Nube.listo()) return Promise.resolve(true);

      var versiones = [raiz.FIREBASE_VERSION]
        .concat(raiz.FIREBASE_VERSIONS_ALTERNAS || [])
        .filter(function (v, i, a) { return v && a.indexOf(v) === i; });

      function intentar(i, ultimoError) {
        if (i >= versiones.length) {
          return Promise.reject(new Error('No se pudo cargar el SDK de Firebase' +
            (ultimoError ? ': ' + ultimoError.message : '. Revise su conexión a internet.')));
        }
        var base = 'https://www.gstatic.com/firebasejs/' + versiones[i] + '/';
        return Promise.all([
          import(base + 'firebase-app.js'),
          import(base + 'firebase-auth.js'),
          import(base + 'firebase-firestore.js')
        ]).then(function (mods) { return { version: versiones[i], app: mods[0], auth: mods[1], fs: mods[2] }; })
          .catch(function (e) { return intentar(i + 1, e); });
      }

      return intentar(0).then(function (mods) {
        Nube._mods = mods;
        Nube.version = mods.version;
        Nube._app = mods.app.initializeApp(raiz.FIREBASE_CONFIG);
        Nube._db = mods.fs.getFirestore(Nube._app);
        Nube._authSdk = mods.auth.getAuth(Nube._app);
        Nube._api = apiFirebase(mods.fs, Nube._db);
        Nube.modo = 'nube';
        Nube.error = '';
        return true;
      }).catch(function (e) {
        Nube.error = e.message || String(e);
        throw e;
      });
    },

    /* ------------------------------------------------------------- sesión */
    auth: {
      /** Crea la cuenta del docente (correo y contraseña). */
      registrar: function (correo, clave) {
        if (!Nube._authSdk || !Nube._mods) return Promise.reject(new Error('La nube no está conectada.'));
        return Nube._mods.auth.createUserWithEmailAndPassword(Nube._authSdk, correo, clave)
          .then(function (cred) { return usuarioDe(cred.user); });
      },
      entrar: function (correo, clave) {
        if (!Nube._authSdk || !Nube._mods) return Promise.reject(new Error('La nube no está conectada.'));
        return Nube._mods.auth.signInWithEmailAndPassword(Nube._authSdk, correo, clave)
          .then(function (cred) { return usuarioDe(cred.user); });
      },
      salir: function () {
        if (!Nube._authSdk || !Nube._mods) return Promise.resolve();
        return Nube._mods.auth.signOut(Nube._authSdk);
      },
      actual: function () { return Nube._authSdk ? usuarioDe(Nube._authSdk.currentUser) : null; },
      observar: function (cb) {
        if (!Nube._authSdk || !Nube._mods) return;
        Nube._mods.auth.onAuthStateChanged(Nube._authSdk, function (u) { cb(usuarioDe(u)); });
      },
      /** Mensajes claros para los errores más comunes de Firebase. */
      traducirError: function (e) {
        var c = (e && e.code) || '';
        var mapa = {
          'auth/email-already-in-use': 'Ese correo ya tiene una cuenta. Use «Ingresar».',
          'auth/invalid-email': 'El correo no es válido (ejemplo: nombre@correo.com).',
          'auth/weak-password': 'La contraseña es muy corta: use al menos 6 caracteres.',
          'auth/user-not-found': 'No existe una cuenta con ese correo. Use «Crear cuenta».',
          'auth/wrong-password': 'La contraseña no es correcta.',
          'auth/invalid-credential': 'Correo o contraseña incorrectos.',
          'auth/too-many-requests': 'Demasiados intentos fallidos. Espere unos minutos e intente otra vez.',
          'auth/network-request-failed': 'Sin conexión a internet. Revise su red.',
          'auth/operation-not-allowed': 'Falta activar «Email/Password» en Firebase → Authentication.',
          'permission-denied': 'Firebase rechazó la operación: revise las reglas de Firestore (vea GUIA-FIREBASE.md).'
        };
        return mapa[c] || (e && e.message) || 'Ocurrió un error de conexión.';
      }
    },

    /* -------------------------------------------------------------- datos */
    /** Lee todos los datos de un docente y devuelve un estado completo. */
    cargar: function (usuario) {
      if (!Nube.listo()) return Promise.reject(new Error('La nube no está conectada.'));
      var uid = usuario.id;
      return Nube._api.leerDoc(['docentes', uid]).then(function (principal) {
        var estado = ZZ.estadoInicial();
        var d = principal && principal.datos;
        if (d) {
          if (d.config) estado.config = d.config;
          if (d.estudiantes) estado.estudiantes = d.estudiantes;
          if (d.ultimoContexto) estado.ultimoContexto = d.ultimoContexto;
        }
        return Promise.all([
          Nube._api.listarSubcoleccion(uid, 'planes'),
          Nube._api.listarSubcoleccion(uid, 'notas')
        ]).then(function (res) {
          (res[0] || []).forEach(function (doc) {
            if (doc && doc.datos && doc.datos.actividades) {
              estado.planes[doc.id] = { actividades: doc.datos.actividades };
            }
          });
          (res[1] || []).forEach(function (doc) {
            if (doc && doc.datos && doc.datos.estudiantes) {
              estado.notas[doc.id] = doc.datos.estudiantes;
            }
          });
          return ZZ.normalizarEstado(estado);
        });
      });
    },

    /** Escribe en la nube sólo lo que cambió. Devuelve la nueva copia de control. */
    guardarDiferencias: function (usuario, estado, snapshot) {
      if (!Nube.listo()) return Promise.reject(new Error('La nube no está conectada.'));
      var uid = usuario.id;
      var diff = ZZ.diffEstado(snapshot, estado);
      if (!ZZ.hayDiferencias(diff)) return Promise.resolve(ZZ.copiaProfunda(estado));

      var tareas = [];
      if (diff.principal) {
        tareas.push(Nube._api.escribirDoc(['docentes', uid], {
          datos: diff.principal,
          docente: ZZ.nombreDocente(estado.config),
          actualizado: new Date().toISOString(),
          version: ZZ.VERSION_DATOS
        }));
      }
      Object.keys(diff.planes).forEach(function (k) {
        tareas.push(diff.planes[k]
          ? Nube._api.escribirSubdoc(uid, 'planes', k, { actividades: diff.planes[k].actividades || [] })
          : Nube._api.borrarSubdoc(uid, 'planes', k));
      });
      Object.keys(diff.notas).forEach(function (k) {
        tareas.push(diff.notas[k]
          ? Nube._api.escribirSubdoc(uid, 'notas', k, { estudiantes: diff.notas[k] })
          : Nube._api.borrarSubdoc(uid, 'notas', k));
      });

      return Promise.all(tareas).then(function () { return ZZ.copiaProfunda(estado); });
    },

    /** Sube TODO el estado actual (por ejemplo, los datos locales del docente). */
    subir: function (usuario, estado) {
      return Nube.guardarDiferencias(usuario, estado, ZZ.estadoInicial());
    },

    /** Comprueba la conexión leyendo el documento del docente. */
    probar: function (usuario) {
      if (!Nube.listo()) return Promise.reject(new Error('La nube no está conectada.'));
      return Nube._api.leerDoc(['docentes', usuario.id]).then(function (d) {
        return { ok: true, existe: !!d, actualizado: d && d.actualizado ? d.actualizado : null };
      });
    }
  };

  function usuarioDe(u) {
    if (!u) return null;
    return {
      id: u.uid,
      correo: u.email || '',
      nombre: u.displayName || (u.email || '').split('@')[0] || 'Docente',
      modo: 'nube'
    };
  }

  /** Traduce el api de Firebase a las cinco operaciones que usa la aplicación. */
  function apiFirebase(fs, db) {
    return {
      leerDoc: function (ruta) {
        var ref = fs.doc.apply(null, [db].concat(ruta));
        return fs.getDoc(ref).then(function (snap) { return snap.exists() ? snap.data() : null; });
      },
      escribirDoc: function (ruta, datos) {
        var ref = fs.doc.apply(null, [db].concat(ruta));
        return fs.setDoc(ref, datos);
      },
      escribirSubdoc: function (uid, coleccion, id, datos) {
        return fs.setDoc(fs.doc(db, 'docentes', uid, coleccion, id), datos);
      },
      borrarSubdoc: function (uid, coleccion, id) {
        return fs.deleteDoc(fs.doc(db, 'docentes', uid, coleccion, id));
      },
      listarSubcoleccion: function (uid, coleccion) {
        return fs.getDocs(fs.collection(db, 'docentes', uid, coleccion)).then(function (snap) {
          var salida = [];
          snap.forEach(function (d) { salida.push({ id: d.id, datos: d.data() }); });
          return salida;
        });
      }
    };
  }

  raiz.Nube = Nube;
  if (typeof module === 'object' && module.exports) module.exports = Nube;
})(typeof window !== 'undefined' ? window : globalThis);
