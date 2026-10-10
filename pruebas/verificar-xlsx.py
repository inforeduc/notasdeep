"""Verificación del libro .xlsx generado por la aplicación con openpyxl.
Comprueba que Excel/LibreOffice lo abran: hojas, valores, tipos y colores."""
import sys
from openpyxl import load_workbook

ruta = sys.argv[1] if len(sys.argv) > 1 else 'pruebas/salida/libro-completo-prueba.xlsx'
problemas = []
ok = []


def v(nombre, condicion, detalle=''):
    if condicion:
        ok.append(nombre)
    else:
        problemas.append(nombre + (' → ' + str(detalle) if detalle else ''))


libro = load_workbook(ruta, data_only=True)
hojas = libro.sheetnames
v('el libro se abre y declara 5 hojas', len(hojas) == 5, hojas)
for esperada in ['Configuración', 'Nómina 1A', 'Lapso 1', 'Sábana 1° A', 'Resumen general 1A']:
    v('existe la hoja «%s»' % esperada, esperada in hojas, hojas)

faltantes = [h for h in ['Lapso 1', 'Nómina 1A', 'Sábana 1° A', 'Resumen general 1A', 'Configuración'] if h not in hojas]
if faltantes:
    print('')
    print('No se puede continuar: faltan las hojas %s.' % ', '.join(faltantes))
    print('Genere de nuevo el libro de prueba con: node pruebas/ejecutar-e2e-nodo.js')
    sys.exit(2)

# --- Hoja de evaluación continua -------------------------------------------------
lapso = libro['Lapso 1']
texto = []
for fila in lapso.iter_rows(values_only=True):
    for c in fila:
        if isinstance(c, str):
            texto.append(c)
junto = ' | '.join(texto)
v('la hoja incluye el membrete oficial',
  'REPÚBLICA BOLIVARIANA DE VENEZUELA' in junto and 'MINISTERIO DEL PODER POPULAR PARA LA EDUCACIÓN' in junto)
v('la hoja identifica el plantel y su fundación',
  'ZAZARABICOA' in junto.upper() and '1946' in junto)
v('la hoja muestra la asignatura y el lapso',
  'Matemática' in junto and '1er Lapso' in junto)
v('aparecen los cinco estudiantes de la prueba',
  all(n in junto for n in ['PÉREZ GÓMEZ', 'RODRÍGUEZ', 'SALAZAR RIVAS', 'MARCANO PÉREZ', 'GÓMEZ RUIZ']))
v('se registran las condiciones APROBADO y REPROBADO',
  'APROBADO' in junto and 'REPROBADO' in junto)
v('se incluyen las estadísticas del lapso',
  'Aprobados' in junto and 'Promedio general' in junto and 'Evaluados' in junto)
v('se indica la ponderación total', 'PONDERACIÓN TOTAL' in junto)

# --- Notas como números ----------------------------------------------------------
numeros = [c for fila in lapso.iter_rows(values_only=True) for c in fila if isinstance(c, (int, float))]
v('las calificaciones se guardan como números', len(numeros) >= 10, len(numeros))
v('el acumulado 16,8 está presente como número', any(abs(n - 16.8) < 1e-9 for n in numeros))

# --- Colores (formato condicional de aprobados/reprobados) -----------------------
colores = {}
for fila in lapso.iter_rows():
    for celda in fila:
        relleno = celda.fill
        if relleno is not None and relleno.fgColor is not None and relleno.patternType == 'solid':
            rgb = str(relleno.fgColor.rgb)
            colores[rgb] = colores.get(rgb, 0) + 1
v('hay celdas con relleno verde de aprobado (D8F2E0)', colores.get('FFD8F2E0', 0) > 0, colores)
v('hay celdas con relleno rojo de reprobado (FDE8E6)', colores.get('FFFDE8E6', 0) > 0, colores)
v('el encabezado usa el verde institucional (0F6B3D)', colores.get('FF0F6B3D', 0) > 0, colores)
v('el título usa el verde profundo (0B4D2C)', colores.get('FF0B4D2C', 0) > 0, colores)

# --- Sábana anual ---------------------------------------------------------------
sabana = libro['Sábana 1° A']
juntoS = ' | '.join(str(c) for fila in sabana.iter_rows(values_only=True) for c in fila if c is not None)
v('la sábana declara el consolidado anual',
  'CONSOLIDADO' in juntoS.upper() and 'Promedio' in juntoS)
v('la sábana marca el derecho a revisión', 'DERECHO A REVISIÓN' in juntoS or 'REVISIÓN' in juntoS.upper())
v('la sábana cita los tres lapsos',
  '1er Lapso' in juntoS and '2do Lapso' in juntoS and '3er Lapso' in juntoS)

# --- Nómina y configuración ------------------------------------------------------
nomina = libro['Nómina 1A']
juntoN = ' | '.join(str(c) for fila in nomina.iter_rows(values_only=True) for c in fila if c is not None)
v('la nómina lista la cédula, los apellidos y los nombres',
  'V-12.345.678' in juntoN and 'PÉREZ GÓMEZ' in juntoN and 'JUAN CARLOS' in juntoN)
v('la nómina ya no tiene columna de sexo', 'Sexo' not in juntoN and 'F (hembra)' not in juntoN)
v('la nómina informa la matrícula', 'Matrícula total: 5' in juntoN)

conf = libro['Configuración']
juntoC = ' | '.join(str(c) for fila in conf.iter_rows(values_only=True) for c in fila if c is not None)
v('la configuración registra al docente y su cédula',
  'María Alejandra' in juntoC and 'Rodríguez Pérez' in juntoC and 'V-12.345.678' in juntoC)
v('la configuración registra el área donde se desempeña', 'Matemática' in juntoC)
v('la configuración ya no pide título ni especialidad',
  'Título' not in juntoC and 'especialidad' not in juntoC.lower())
v('la configuración registra los datos reales del plantel',
  'ZAZARABICOA' in juntoC.upper() and 'S4375D1305' in juntoC and '2024-2025' in juntoC)
v('la configuración registra el circuito, el municipio y el estado',
  'Cachimba' in juntoC and 'Morán' in juntoC and 'Lara' in juntoC)
v('la configuración registra la directora y las dos coordinadoras',
  'Rosana Rodríguez' in juntoC and 'Rocío García' in juntoC and 'Eli Torrealba' in juntoC)
v('la configuración incluye la asignatura adicional C.R.P.', 'C.R.P.' in juntoC)
v('la configuración documenta el criterio de redondeo', 'fracción' in juntoC.lower())

# --- Anchos y paneles congelados --------------------------------------------------
v('las columnas tienen ancho personalizado',
  any(d.width and d.width > 0 for d in lapso.column_dimensions.values()))
v('las filas de encabezado quedan congeladas',
  lapso.freeze_panes is not None, lapso.freeze_panes)

print('')
print('== Verificación del .xlsx con openpyxl ==')
print('  Archivo: %s' % ruta)
print('  Hojas: %s' % ', '.join(hojas))
for n in ok:
    print('  OK   ' + n)
for p in problemas:
    print('  FALLA ' + p)
print('')
print('XLSX: %d correctas, %d fallidas' % (len(ok), len(problemas)))
sys.exit(0 if not problemas else 1)
