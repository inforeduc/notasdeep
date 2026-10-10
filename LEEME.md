# Evaluación Docente de Zazarabicoa

Aplicación de registro y control de evaluación para el **Complejo Educativo "Zazarabicoa" (fundado en 1946)**,
Circuito Escolar **José Morales "Cachimba"**, Municipio **Morán**, Estado **Lara** — Código DEA **S4375D1305**.

Funciona **sin conexión a internet** y también puede trabajar **con los datos en la nube** (Firebase) para que
cada docente entre con su usuario desde cualquier computadora.

---

## 1. Cómo abrir la aplicación

1. Abra la carpeta `EvaluacionDocenteZazarabicoa`.
2. Haga doble clic en **`index.html`** (o en `Abrir aplicacion.bat`).
3. **Paso 1:** escriba la clave de acceso de la institución: **`zazarabicoa123`**
   (se cambia en `js/config-acceso.js`).
4. **Paso 2:** cree su usuario de docente (nombre y contraseña) o entre con el que ya tenga.
   Cada docente tiene **su propio espacio de datos**: su nómina, sus asignaturas, sus planes y sus notas
   nunca se mezclan con las de otro docente.

> **Importante sobre la clave de acceso:** viaja dentro de la página, así que alguien con conocimientos
> podría verla en el código. Es un portón de entrada, no seguridad real. La seguridad de verdad la da el
> **modo nube con Firebase** (usuario y contraseña por docente): vea [GUIA-FIREBASE.md](GUIA-FIREBASE.md).

---

## 2. Módulos

| Pestaña | Qué hace |
|---|---|
| **1 · Configuración** | Datos del docente evaluador (nombres, cédula V-/E-, teléfono, correo y **área donde se desempeña**, elegida entre las asignaturas que ofrece la institución), datos del plantel ya precargados (nombre, fundación 1946, código DEA, circuito escolar, municipio, estado, año escolar, directora y **dos coordinadoras de evaluación**), años que atiende (1° a 5°), secciones y asignaturas que imparte (las 10 oficiales + las que agregue, como C.R.P. o Arte y Patrimonio). |
| **2 · Nómina de estudiantes** | Nómina por año y sección con edición en línea (**cédula, apellidos y nombres**, sin columna de sexo), orden alfabético, y **carga masiva pegando desde Excel o Word** con vista previa editable y aviso de cédulas repetidas. |
| **3 · Plan de evaluación** | Por año, sección, asignatura y lapso (3 lapsos): actividad evaluativa, tipo, contenido programático o referente teórico-práctico, técnica/estrategia e instrumento. **Control de ponderación en tiempo real** que exige exactamente 100 % (20 puntos). |
| **4 · Evaluación continua y definitiva** | **La ponderación de cada evaluación la define y modifica el docente aquí mismo.** Matriz interactiva de notas en la escala vigesimal 01–20, cálculo automático de puntos acumulados y de la nota definitiva del lapso, condición APROBADO/REPROBADO y estadísticas oficiales. |
| **5 · Sábana definitiva anual** | Consolidado de los 3 lapsos por estudiante: definitiva de cada lapso, promedio anual, calificación definitiva final y condición (incluye **DERECHO A REVISIÓN**). Además, resumen general por asignatura y estadísticas finales. |
| **6 · Guardado y respaldo** | Guardado automático, descarga de respaldo `.json` por docente, restauración, copias internas, estado de la nube (sincronizar / subir todo) y borrado total. |

---

## 3. Acceso, usuarios y separación de datos

**Modo local (sin configurar nada más):**
cada docente crea su usuario en el equipo (nombre + contraseña de 4 caracteres o más). Las contraseñas se
guardan **cifradas con SHA-256 y sal**, nunca en texto claro. Los datos de cada docente viven en un espacio
aparte del navegador. En la pantalla de acceso aparecen los docentes registrados en ese equipo.

**Modo nube (Firebase configurado):**
el acceso es con **correo y contraseña** (Firebase Authentication) y los datos se guardan en **Cloud
Firestore**, separados por docente mediante reglas de seguridad. Así cualquier docente entra desde cualquier
computadora o teléfono. La guía completa, gratuita y paso a paso está en **[GUIA-FIREBASE.md](GUIA-FIREBASE.md)**.

> **Sobre el archivo local y la nube:** Firebase solo funciona en páginas publicadas (`http`/`https`). Si abre
> `index.html` con doble clic (dirección `file://`), la aplicación **lo detecta y trabaja en modo local**, con
> un aviso en la pantalla de acceso («la nube se activará cuando la página esté publicada»). No es un error:
> publique la página (GitHub Pages) y el modo nube se activa solo.

En ambos modos: el botón **👤 Cambiar de docente** (arriba a la derecha) cierra la sesión y vuelve a la
pantalla de acceso.

---

## 4. Cálculos y criterios (importante)

**Puntos acumulados** = Σ (nota × % ÷ 100), con decimales exactos.

> Ejemplo: Taller 40 % con 15 pts y Prueba escrita 60 % con 18 pts →
> (15 × 40 ÷ 100) + (18 × 60 ÷ 100) = 6,00 + 10,80 = **16,80 puntos**.

**Nota definitiva del lapso**: se aplica el criterio de redondeo configurado en la pestaña 1:

| Criterio | Comportamiento | Ejemplos |
|---|---|---|
| **Estándar** (por defecto) | la fracción ≥ 0,50 sube a la unidad superior | 9,50 → 10 · 15,49 → 15 · 10,50 → 11 |
| **Restringido** | la fracción ≥ 0,50 sube sólo si ya es aprobatoria | 10,50 → 11 · 9,50 → 9 |
| **Sin redondeo** | se toma la parte entera | 9,99 → 9 · 15,90 → 15 |

- **Nota mínima aprobatoria**: 10 puntos (configurable).
- **Condición**: APROBADO (verde) si la definitiva ≥ nota mínima; REPROBADO (rojo) si es menor.
- **Promedio anual** = media de las calificaciones definitivas de los 3 lapsos. La **calificación definitiva final** aplica el mismo criterio de redondeo.
- **DERECHO A REVISIÓN**: se marca cuando el promedio anual queda entre 9,00 (configurable) y la nota mínima aprobatoria.
- **Estadísticas del lapso**: matrícula total, evaluados, aprobados (cantidad y %), reprobados (cantidad y %) y promedio general del curso. Los porcentajes se calculan **sobre los estudiantes evaluados**; el promedio general se calcula con las calificaciones definitivas disponibles.

---

## 4. Exportar a PDF

Cada módulo tiene su botón **🖨️ Imprimir** (también el botón *Imprimir vista* del encabezado). Se genera un
documento con el membrete oficial:

```
REPÚBLICA BOLIVARIANA DE VENEZUELA
MINISTERIO DEL PODER POPULAR PARA LA EDUCACIÓN
COMPLEJO EDUCATIVO "ZAZARABICOA" — Fundado en 1946
Código DEA · Circuito Escolar · Municipio · Estado · Año Escolar
```

con el escudo institucional, las tablas de notas y las **casillas de firmas**:
Docente de la Asignatura · Coordinador(a) de Evaluación y Control de Estudios · Director(a) del Plantel.

En el cuadro de impresión elija **Destino: Guardar como PDF** y pulse Guardar. Los cuadros anchos
(matriz de notas, plan de evaluación y sábana anual) salen automáticamente en **orientación horizontal**.

---

## 5. Exportar a Excel

Los botones **📊 Exportar a Excel (.xlsx)** generan un libro **.xlsx nativo** (OOXML) con varias hojas,
encabezado oficial, notas como números reales, colores (aprobados en verde, reprobados en rojo, derecho a
revisión en ámbar), anchos de columna y filas de encabezado congeladas. Se abre en Microsoft Excel,
LibreOffice Calc y Google Sheets.

- Cada módulo exporta lo suyo (configuración, nómina, plan, evaluación continua con estadísticas, sábana anual, resumen general).
- **📚 Exportar libro completo a Excel** reúne en un solo archivo: configuración, nómina de cada curso, evaluación de cada asignatura y lapso, sábanas anuales y resumen general.

---

## 6. Guardado y respaldo

- **Modo local:** todo se guarda **automáticamente** en el navegador, en el espacio de cada docente.
- **Modo nube:** además se sincroniza en internet (verá **☁️ Sincronizado** en la cabecera). Solo se envían los
  cambios, no todo el registro.
- **Descargar respaldo**: genera un archivo `.json` con todos los datos (el nombre incluye al docente).
- **Restaurar**: recupere cualquier respaldo `.json` (antes de reemplazar, la aplicación guarda una copia de seguridad automática).
- **Copias internas**: guarde copias con fecha y hora y restáurelas cuando quiera.
- **Nube (Firebase)**: «🔄 Sincronizar ahora» y «⬆️ Subir todos mis datos a la nube» (para pasar a la nube lo
  que ya tenía en modo local).
- Si su navegador no permitiera el guardado automático, la aplicación se lo avisa: en ese caso descargue
  siempre un respaldo `.json` antes de cerrar.
- ⚠️ No borre los "datos de navegación" del navegador sin haber descargado antes un respaldo.

---

## 7. Escudo institucional

La aplicación incluye el **escudo real del Complejo Educativo "Zazarabicoa" (Fundado en 1946)**, integrado
como imagen, por lo que aparece en la cabecera y en **todos** los documentos oficiales (pantalla e impresión)
sin depender de archivos externos ni de internet. El archivo original queda guardado en
`img/escudo-zazarabicoa.jpg`.

Es un distintivo fijo del plantel: **no se puede reemplazar desde la aplicación** (a propósito, para que los
documentos oficiales siempre salgan con el escudo correcto).

> Solo para mantenimiento técnico: si algún día cambia el escudo del plantel, sustituya
> `img/escudo-zazarabicoa.jpg` y ejecute `node pruebas/generar-escudo.js`; se regenera
> `js/escudo-real.js` con la nueva imagen incrustada.

---

## 8. Carga masiva de la nómina

Pegue la lista en la pestaña 2 con el formato **Cédula · Apellidos · Nombres**. Se aceptan:

```
V-12345678	Pérez Gómez	Juan Carlos        (columnas de Excel, tabulación)
E-8123456; Rodríguez; Ana María              (punto y coma)
12.345.679, Marcano Pérez, José Gregorio     (Apellidos, Nombres)
V-20123456 Salazar Rivas Luis Alberto        (texto corrido)
```

Si su lista trae una columna de sexo (M/F), **se ignora**: la nómina solo guarda cédula, apellidos y nombres.
Se ignoran los encabezados. La vista previa es **editable** antes de cargar y avisa de líneas sin cédula o
sin nombre, y de estudiantes repetidos en el mismo curso.

---

## 9. Estructura de archivos

```
EvaluacionDocenteZazarabicoa\
├── index.html               Interfaz completa (pantalla de acceso + 6 módulos)
├── Abrir aplicacion.bat     Abre la aplicación con doble clic
├── LEEME.md                 Este documento
├── GUIA-FIREBASE.md         Guía paso a paso para guardar los datos en internet (gratis)
├── css\estilos.css          Estilos de pantalla y hoja de impresión oficial
├── img\
│   └── escudo-zazarabicoa.jpg   Escudo institucional real (1946)
├── js\
│   ├── config-acceso.js     Clave general de acceso de la institución
│   ├── firebase-config.js   Configuración de la nube (vacía = modo local)
│   ├── nucleo.js            Lógica: ponderación, redondeo, estadísticas, nóminas, SHA-256, diferencias para la nube
│   ├── escudo.js            Emblema vectorial de respaldo (SVG)
│   ├── escudo-real.js       Escudo institucional real incrustado como imagen
│   ├── almacen.js           Estado, usuarios, guardado por docente, copias internas, sincronización
│   ├── nube.js              Conexión con Firebase (Auth + Firestore) y guardado incremental
│   ├── ui.js                Avisos, ventanas, descargas, utilidades
│   ├── xlsx.js              Generador de libros .xlsx (ZIP + OOXML) sin dependencias
│   ├── exportacion.js       Documentos PDF/impresión y motores de exportación
│   ├── configuracion.js     Módulo 1
│   ├── estudiantes.js       Módulo 2
│   ├── plan.js              Módulo 3 (+ utilidades compartidas PlanUtil)
│   ├── continua.js          Módulo 4
│   ├── sabana.js            Módulo 5
│   ├── respaldo.js          Módulo 6
│   ├── acceso.js            Pantalla de acceso, usuarios y sesión por docente
│   └── app.js               Arranque, pestañas y coordinación
└── pruebas\                 Verificación automática (uso técnico)
```

---

## 10. Verificación automática (uso técnico)

```powershell
node pruebas\pruebas.js              # lógica: ponderación, redondeo, estadísticas, nóminas, SHA-256, diferencias
node pruebas\integridad.js           # coherencia entre la interfaz, los estilos, el acceso y los módulos
node pruebas\ejecutar-e2e-nodo.js    # trabajo completo de dos docentes + nube simulada (180 verificaciones)
node pruebas\generar-escudo.js       # regenera el escudo incrustado desde img\
python pruebas\verificar-xlsx.py pruebas\salida\libro-completo-prueba.xlsx
```

`ejecutar-e2e-nodo.js` ejecuta la aplicación real (interfaz incluida) dentro de Node con un DOM mínimo y
comprueba todo el recorrido: clave de acceso, creación del usuario del docente, configuración, carga masiva de
5 estudiantes, plan de evaluación, cambio de ponderación, notas, definitivas y estadísticas, sábana anual,
documentos oficiales, Excel y respaldo; luego **reinicia la aplicación** para verificar que cada docente
recupera sus datos, y por último prueba **la nube con una base de datos simulada** (guardado incremental,
carga exacta y aislamiento entre docentes), todo sin necesidad de internet.

---

## 11. Notas y límites

- La exportación a PDF usa la impresión del navegador (Guardar como PDF): es el método estándar y no depende de internet.
- El `.xls` de compatibilidad (tabla HTML interpretada por Excel) sigue disponible para usos técnicos mediante `Export.excelLegado(...)`; los botones de la aplicación generan `.xlsx` nativo.
- El emblema vectorial (SVG) queda solo como respaldo: el escudo real del plantel es el que se muestra siempre.
- **La clave general de la página es un portón, no seguridad real** (está en el código de la página). La
  seguridad por docente la da el modo nube con Firebase (ver [GUIA-FIREBASE.md](GUIA-FIREBASE.md)).
- En **modo local**, los usuarios y sus contraseñas (cifradas) viven en el navegador de ese equipo: sirven para
  que varios docentes compartan una computadora sin mezclar datos, no para protegerlos de alguien con acceso
  a esa computadora.
- GitHub Pages publica la página pero **no guarda datos**: para eso hace falta Firebase (u otro servicio).
- Si no hay internet, la aplicación sigue funcionando en modo local y sincroniza cuando vuelva la conexión.

## 12. Historial de cambios

**Segunda versión (petición del plantel):**
- **Pantalla de acceso** con clave general (`zazarabicoa123`) y **usuario por docente**: cada docente crea su
  usuario y sus datos quedan totalmente separados (nóminas, asignaturas, planes y notas propios).
- **Guardado en internet** opcional con **Firebase** (Authentication + Firestore), con reglas que impiden que
  un docente vea los datos de otro, y guía paso a paso gratuita en `GUIA-FIREBASE.md`.
- Datos del plantel precargados: código DEA **S4375D1305**, circuito **José Morales "Cachimba"**, municipio
  **Morán**, estado **Lara**, directora **Rosana Rodríguez** y **dos coordinadoras** (Rocío García y Eli Torrealba).
- **Título / Especialidad** sustituido por **Área donde se desempeña**, con las asignaturas de la institución
  como sugerencias.
- **Eliminado** el texto sobre el logo institucional y la posibilidad de reemplazarlo.
- **Eliminada la columna de sexo** de la nómina, de la vista previa y de las exportaciones: solo cédula,
  apellidos y nombres.

**Primera versión:**
- **Cuadro «Confirmación» vacío que bloqueaba la aplicación**: el atributo `hidden` del modal era anulado por
  su propia regla `display:flex`, por lo que el modal aparecía siempre al abrir la página y tapaba todo.
  Se añadió la regla global `[hidden] { display: none !important; }` y el verificador de integridad ahora
  comprueba que esa regla exista (y que el modal quede por encima de la pantalla de acceso).
- **Escudo institucional real** sustituido por el emblema vectorial de respaldo.
- **Columna fija de las tablas**: solo la columna de nombres queda fija al desplazar, evitando superposiciones.
- **Memoria del curso**: la aplicación reabre en el año, sección, asignatura y lapso en que se trabajaba.
