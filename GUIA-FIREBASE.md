# Guía: guardar los datos en internet (Firebase de Google) — gratis

Esta guía explica, paso a paso y sin conocimientos previos, cómo hacer que **cada docente entre con su
usuario y sus datos se guarden en la web** (no en el navegador de una sola computadora), y cómo publicar
la aplicación en GitHub Pages para que cualquiera pueda usarla desde un enlace.

---

## 1. Entienda primero dos cosas importantes

**1) GitHub Pages es solo para mostrar la página, no para guardar datos.**
GitHub Pages es un servicio gratuito que publica archivos (HTML, CSS, JS). No tiene base de datos: si solo
sube la aplicación a GitHub, cada docente seguirá guardando sus datos en *su* navegador. Para que los datos
vivan en internet hace falta un servicio de base de datos. Aquí usaremos **Cloud Firestore** de Firebase.

**2) La contraseña general de la página (`zazarabicoa123`) es un portón, no una caja fuerte.**
Está escrita dentro de la página, así que alguien con conocimientos podría verla. Sirve para que un
estudiante que tome el teléfono no entre por casualidad. La seguridad de verdad la da **Firebase
Authentication**: cada docente con su correo y su contraseña, y reglas que impiden que un docente lea los
datos de otro. Por eso esta guía es la parte importante.

---

## 2. Qué es Firebase y cuánto cuesta

[Firebase](https://firebase.google.com) es la plataforma de Google para aplicaciones web. Usaremos dos
servicios, ambos con plan gratuito:

| Servicio | Para qué | Plan gratuito «Spark» |
|---|---|---|
| **Authentication** | Cuentas de los docentes (correo y contraseña) | Gratis (correo/contraseña sin costo) |
| **Cloud Firestore** | Guardar configuración, nóminas, planes y notas | ≈1 GiB almacenado, ≈50.000 lecturas y 20.000 escrituras por día |

Para el uso de un plantel (decenas de docentes, unos cientos de estudiantes) el plan gratuito es de sobra.
Puede verificar los límites vigentes en [firebase.google.com/pricing](https://firebase.google.com/pricing).
No se pide tarjeta de crédito para el plan Spark.

---

## 3. Paso a paso en Firebase (10 minutos)

> **Antes de empezar — dos diseños de consola.**
> Google tiene dos versiones del panel de Firebase:
>
> * **Consola clásica:** el menú izquierdo muestra **Compilación** (dentro están Authentication, Firestore, etc.).
> * **Consola nueva:** ya **no existe el menú «Compilación»**; los productos están agrupados en categorías:
>   **Bases de datos y almacenamiento**, **Seguridad**, **Servicios de IA**, **Hosting y sin servidores**,
>   **DevOps y participación** y **Analytics**.
>
> Si tiene la consola nueva:
>
> * **Authentication** está dentro de la categoría **🔒 Seguridad** (haga clic para que se despliegue).
> * **Cloud Firestore** está dentro de **🗄️ Bases de datos y almacenamiento**.
> * La forma más rápida y segura en cualquier versión: use el **buscador «Buscar productos»** (arriba a la
>   izquierda) y escriba `Authentication` o `Firestore`.
> * O use los **enlaces directos** de abajo (cambie `SU-PROYECTO` por el identificador de su proyecto).

### 3.0 Enlaces directos (los más cómodos)

> **Atajo dentro de la consola:** en un proyecto nuevo, el menú izquierdo muestra arriba
> **«Accesos directos a proyectos»** con **Firestore** y **Authentication**: un clic y entra sin buscar.
> Si no aparecen, use el buscador **«Buscar productos»** o los enlaces directos de abajo.
> El botón **«+ Agregar app»** (arriba, en la página del proyecto) es el que se usa en el paso 3.5 para
> registrar la app web y obtener el `firebaseConfig`.

Su proyecto se llama **Notaszazarabicoa**. Su **identificador** (ID del proyecto) suele ser el nombre en
minúsculas: `notaszazarabicoa`. Para confirmarlo: **⚙️ Configuración del proyecto → General → «ID del proyecto»**.

| Qué necesita | Enlace directo |
|---|---|
| Cuentas de docentes | `https://console.firebase.google.com/project/SU-PROYECTO/authentication` |
| Métodos de acceso (Email/Password) | `https://console.firebase.google.com/project/SU-PROYECTO/authentication/providers` |
| Dominios autorizados | `https://console.firebase.google.com/project/SU-PROYECTO/authentication/settings` |
| Base de datos | `https://console.firebase.google.com/project/SU-PROYECTO/firestore` |
| **Reglas de seguridad** | `https://console.firebase.google.com/project/SU-PROYECTO/firestore/rules` |
| Configuración del proyecto (para el `firebaseConfig`) | `https://console.firebase.google.com/project/SU-PROYECTO/settings/general` |

Sustituya `SU-PROYECTO` por `notaszazarabicoa` (o por el ID que vea en Configuración del proyecto).

### 3.1 Crear el proyecto
1. Entre a **<https://console.firebase.google.com>** con su cuenta de Google.
2. Pulse **«Crear un proyecto»** (o *Agregar proyecto*).
3. Nombre del proyecto: `zazarabicoa` (o el que prefiera). Acepte y continúe.
4. Google Analytics: puede **desactivarlo** (no lo necesitamos). Pulse *Crear proyecto* y espere.

### 3.2 Activar las cuentas de docentes (Authentication)
1. Abra **Authentication** (consola clásica: *Compilación → Authentication*; consola nueva: *Seguridad →
   Authentication* o el atajo **Authentication** del menú izquierdo; o el enlace directo
   `.../project/SU-PROYECTO/authentication`).
2. Pulse **«Comenzar»** (*Get started*).
3. En la pestaña **Sign-in method** (Método de acceso), elija **Correo electrónico/Contraseña**.
4. Active la primera opción (**Correo electrónico/Contraseña**) y guarde.
   > Si no activa esto, la aplicación mostrará: *«Falta activar Email/Password en Firebase → Authentication»*.

**Cuando termine, así debe verse:** en *Proveedores de acceso*, la fila
**Correo electrónico/contraseña** con el estado **Habilitada**. ✔️

> ⚠️ **Dos avisos que aparecen ahí y NO debe activar:**
>
> | Aviso en pantalla | Qué hacer |
> |---|---|
> | *«Se recomienda Acceder con Google para reducir las vulnerabilidades…»* (franja naranja) | **Ignórelo.** La aplicación usa correo y contraseña; no necesita Google |
> | *«Autenticación de varios factores a través de SMS → Actualizar para habilitar»* (bloque azul) | **Ignórelo.** Eso es un plan de pago (Identity Platform) y no hace falta |

### 3.3 Crear la base de datos (Cloud Firestore)
1. Abra **Firestore Database** (*Bases de datos y almacenamiento → Firestore* en la consola nueva;
   *Compilación → Firestore Database* en la clásica; o el enlace directo).
2. Pulse **«Crear base de datos»**.
3. Elija **modo de producción** (las reglas del paso 3.4 lo protegen).
4. Ubicación: la más cercana, por ejemplo `us-central1` (EE. UU.) o `southamerica-east1` (São Paulo). Pulse *Habilitar*.

> ⚠️ **No confunda dos cuadros que se llaman parecido:**
>
> | Cuadro | Qué es | Qué hacer |
> |---|---|---|
> | **Configuración del proyecto → «Tipo de entorno» → Producción** | Solo una **etiqueta visual** («Prod») para el panel. No crea ni cambia nada | Pulse **Cancelar** (o elija lo que quiera; es indiferente) |
> | **Firestore → «Crear base de datos» → Modo de producción** | **Este sí es el que importa**: crea la base de datos | Elija **modo de producción** y luego la ubicación |
>
> El primero aparece en la página de *Configuración del proyecto*; el segundo, al pulsar *Crear base de datos*
> dentro de **Firestore**.

### 3.4 Pegar las reglas de seguridad (¡paso clave!)
Las reglas son lo que garantiza que **un docente no pueda ver ni tocar los datos de otro**.

1. En **Firestore Database**, abra la pestaña **Reglas** (*Rules*) — enlace directo:
   `https://console.firebase.google.com/project/SU-PROYECTO/firestore/rules`.
2. Borre lo que aparezca y pegue **exactamente** esto:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /docentes/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      match /{documento=**} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }
  }
}
```

3. Pulse **Publicar**.
   > Con estas reglas, cada docente solo puede leer y escribir lo que está bajo su propio `uid`.
   > Si no las cambia, verá el error *«Firebase rechazó la operación: revise las reglas de Firestore»*.

### 3.5 Obtener la configuración de la aplicación web
1. Abra **⚙️ Configuración del proyecto** (enlace directo:
   `https://console.firebase.google.com/project/SU-PROYECTO/settings/general`).
2. Baje hasta **«Tus apps»** y pulse el icono **`</>`** (Web).
   * Si no ve el icono `</>`, escriba su nombre de app y regístrela: *Agregar app → Web*.
3. Apodo de la app: `Zazarabicoa Web`. **No** marque Firebase Hosting. Pulse *Registrar app*.
4. Google le mostrará un bloque así:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "zazarabicoa.firebaseapp.com",
  projectId: "zazarabicoa",
  storageBucket: "zazarabicoa.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};
```

### 3.6 Pegarlo en la aplicación
1. Abra el archivo **`js/firebase-config.js`** con el Bloc de notas (o cualquier editor).
2. Sustituya los valores vacíos por los suyos (respete las comillas y las comas):

```js
raiz.FIREBASE_CONFIG = {
  apiKey: "AIzaSy...",
  authDomain: "zazarabicoa.firebaseapp.com",
  projectId: "zazarabicoa",
  storageBucket: "zazarabicoa.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};
```

3. Guarde el archivo. **Listo**: cuando la página esté publicada, la pantalla de acceso pedirá
   **correo y contraseña**, y ofrecerá **«Crear cuenta nueva»**.

> **OJO — muy importante, para que no se asuste:**
> Firebase Authentication **solo funciona en páginas publicadas** (direcciones `http://` o `https://`).
> Si abre la aplicación con doble clic desde su computadora (dirección `file://`), la aplicación lo detecta,
> **sigue trabajando en modo local** (sus datos en este equipo) y le muestra este aviso en la pantalla de acceso:
>
> *«Modo local: la nube está configurada y se activará cuando la página esté publicada en internet (GitHub Pages).»*
>
> Es decir: **no está fallando**. Suba la página a GitHub Pages (sección 4) y el modo nube se activa solo.
>
> **Si quiere probar el modo nube en su computadora antes de publicar** (uso técnico), sirva la carpeta por
> `http` en vez de abrir el archivo: en la carpeta del proyecto ejecute `python -m http.server 8000` y entre a
> `http://localhost:8000`. `localhost` ya está autorizado en Firebase por defecto.

> Nota: si una versión del SDK de Firebase dejara de existir, la aplicación prueba automáticamente con
> otras versiones. Puede fijar otra en `raiz.FIREBASE_VERSION`.

### 3.7 Comprobar que quedó bien
| Lo que ve en la pantalla de acceso | Significa |
|---|---|
| «Conectando con la nube de Google…» y luego campos de **Correo electrónico** y **Contraseña** | ✅ Correcto: está en modo nube |
| «Modo local: la nube está configurada y se activará cuando la página esté publicada…» y ofrece crear usuario | ✅ Correcto: está abriendo el archivo local; publique la página |
| Ofrece crear usuario y no menciona la nube | La configuración no se guardó bien: revise `js/firebase-config.js` y recargue con **Ctrl+F5** |
| «No se pudo conectar con la nube: no se pudo cargar el SDK» | Sin internet, o la versión del SDK no existe (cambie `raiz.FIREBASE_VERSION`) |

---

## 4. Publicar la aplicación en GitHub Pages

1. Cree una cuenta en **<https://github.com>** (si no la tiene) e inicie sesión.
2. Pulse **«New repository»**. Nombre: `zazarabicoa-evaluacion`. Visibilidad: **Public**. *Create repository*.
3. En la página del repositorio, pulse **«uploading an existing file»**.
4. **Importante:** arrastre **el contenido** de la carpeta (los archivos y carpetas
   `index.html`, `css`, `js`, `img`, `LEEME.md`, `GUIA-FIREBASE.md`), **no la carpeta que los contiene**.
   El archivo `index.html` debe quedar en la raíz del repositorio.
5. Escriba un mensaje (por ejemplo «Versión inicial») y pulse **Commit changes**.
6. Entre a **Settings → Pages**. En *Source* elija **Deploy from a branch**;
   en *Branch* elija **main** y la carpeta **/ (root)**. Pulse **Save**.
7. Espere 1–2 minutos y recargue: aparecerá la dirección, por ejemplo
   **`https://suusuario.github.io/zazarabicoa-evaluacion/`**

### 4.1 Autorizar el dominio en Firebase (necesario para el modo nube)
Firebase Authentication solo acepta peticiones desde dominios autorizados:

1. Abra **Authentication → Settings → Authorized domains** (enlace directo:
   `https://console.firebase.google.com/project/SU-PROYECTO/authentication/settings`).
2. Pulse **Add domain** y agregue: **`suusuario.github.io`** (solo el dominio, sin la ruta).
3. Guarde. Si no lo hace, verá *«auth/unauthorized-domain»* y no podrá entrar en modo nube.

---

## 5. Cómo se usa después de configurarlo

1. El docente abre el enlace, escribe la clave de la institución (`zazarabicoa123`, cambiable en
   `js/config-acceso.js`) y pulsa *Entrar*.
2. La primera vez pulsa **«Crear cuenta nueva»** con su correo y una contraseña de 6 o más caracteres.
3. Ya dentro, llena su área de desempeño, sus años, secciones, asignaturas, nómina, planes y notas.
4. Todo se guarda en internet automáticamente (verá el letrero **☁️ Sincronizado** arriba a la derecha).
   Puede entrar desde otra computadora o desde el teléfono con el mismo correo y encontrará sus datos.
5. **Cada docente ve solo lo suyo.** El profesor Miguel y el profesor Carlos tienen nóminas, materias,
   planes y notas completamente aparte.

### ¿Ya tengo datos guardados en el navegador (modo local) y quiero pasarlos a la nube?
1. Entre en modo local como siempre.
2. Configure Firebase (secciones 3.1 a 3.6) y recargue la página.
3. Entre con su cuenta de la nube (créela).
4. Vaya a la pestaña **6 · Guardado y respaldo** y pulse **«⬆️ Subir todos mis datos a la nube»**.
   Sus datos locales quedarán copiados en su cuenta. (También puede descargar un respaldo `.json` antes,
   por seguridad.)

---

## 6. Problemas frecuentes y su solución

| Mensaje en pantalla | Qué hacer |
|---|---|
| «No se pudo conectar con la nube: no se pudo cargar el SDK» | Revise su conexión a internet, o cambie `raiz.FIREBASE_VERSION` en `js/firebase-config.js`. |
| «Falta activar "Email/Password" en Firebase → Authentication» | Sección 3.2 de esta guía. |
| «Firebase rechazó la operación: revise las reglas de Firestore» | Sección 3.4: pegue y publique las reglas. |
| «auth/unauthorized-domain» | Sección 4.1: agregue `suusuario.github.io` en dominios autorizados. |
| «Correo o contraseña incorrectos» | Use *Crear cuenta* la primera vez; después *Ingresar*. |
| «Demasiados intentos fallidos» | Espere unos minutos y vuelva a intentar. |
| «Sin conexión a internet» | Puede seguir trabajando en **modo local**; al volver la conexión, pulse *Sincronizar ahora*. |
| No aparece el modo nube aunque pegué la configuración | Verifique que guardó el archivo y recargue con **Ctrl+F5**. |
| **No encuentro el menú «Compilación»** | Su consola es la nueva. Use el buscador **«Buscar productos»** (arriba en el menú izquierdo) y escriba `Authentication` o `Firestore`, o use los enlaces directos de la sección 3.0. En la consola nueva: **Seguridad → Authentication** y **Bases de datos y almacenamiento → Firestore**. |
| **Me aparece «Tipo de entorno» y no sé si es Firestore** | No lo es: es solo una etiqueta visual del proyecto. Pulse *Cancelar*. La base de datos se crea dentro de **Firestore → Crear base de datos**. |

---

## 7. Alternativas gratuitas (por si prefiere otra)

| Opción | Ventajas | Inconvenientes |
|---|---|---|
| **Firebase (recomendada)** | Gratis, cuentas incluidas, reglas por usuario, muy rápido; ya viene lista en esta aplicación | Requiere crear el proyecto (esta guía) |
| **Supabase** | Base de datos PostgreSQL con cuentas incluidas; panel parecido a Firebase | Habría que adaptar el código (la app está preparada para Firebase) |
| **Google Apps Script + Google Sheets** | Los datos quedan en una hoja de cálculo suya, fácil de revisar | Más lento, límites de escritura, requiere programar el puente |
| **Solo GitHub Pages + respaldos .json** | Cero configuración; cada docente guarda en su equipo | Los datos no viajan entre computadoras |

La aplicación viene preparada para **Firebase**; si algún día prefiere Supabase u otra, la pieza que habría
que cambiar es solo `js/nube.js` (las cinco operaciones `leerDoc`, `escribirDoc`, `escribirSubdoc`,
`borrarSubdoc` y `listarSubcoleccion`), porque todo lo demás usa esas cinco operaciones a través de
`js/almacen.js`.

---

## 8. Cómo quedan organizados los datos en Firestore

```
docentes/
└── {uid del docente}                     ← un documento por docente
    ├── datos: { config, estudiantes, ultimoContexto }
    ├── planes/
    │   └── 1||A||of3||1   →  { actividades: [...] }     (año||sección||asignatura||lapso)
    └── notas/
        └── 1||A||of3||1   →  { estudiantes: { idEstudiante: { idActividad: nota } } }
```

Ventajas de esta organización:

* **Aislamiento total:** las reglas del paso 3.4 solo permiten `docentes/{uid}` con `uid == request.auth.uid`.
* **Documentos pequeños:** un documento por curso/asignatura/lapso, muy por debajo del límite de 1 MB de Firestore.
* **Ahorro de cuota:** la aplicación envía **solo lo que cambió** (`js/nucleo.js → diffEstado`), no todo el
  registro en cada tecla. Así el plan gratuito dura muchísimo.

---

## 9. Resumen en 6 líneas

1. Cree el proyecto en <https://console.firebase.google.com>.
2. Active **Authentication → Correo electrónico/Contraseña** (consola nueva: *Seguridad → Authentication*).
3. Cree **Firestore** y pegue las **reglas** de la sección 3.4.
4. Copie el `firebaseConfig` web (⚙️ Configuración del proyecto → Tus apps → `</>`) y péguelo en
   **`js/firebase-config.js`**.
5. Suba todo a un repositorio de GitHub y active **Pages**.
6. Agregue `suusuario.github.io` en **dominios autorizados** de Authentication.

Con eso: **clave de acceso para la página + usuario propio para cada docente + datos guardados en internet**.
