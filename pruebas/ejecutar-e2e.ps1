/* ============================================================================
   ejecutar-e2e.ps1 — Genera pruebas/autoprueba.html (index.html + la autoprueba
   inyectada) y la ejecuta en Chrome/Edge sin interfaz gráfica, mostrando el
   resultado de la autoprueba de extremo a extremo.
   Uso:  pwsh -File pruebas\ejecutar-e2e.ps1
   ========================================================================== */
[CmdletBinding()]
param(
  [string]$Navegador
)

$raiz = Split-Path -Parent $PSScriptRoot

if (-not $Navegador) {
  $candidatos = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
  )
  $Navegador = $candidatos | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $Navegador) { Write-Error 'No se encontró Chrome ni Edge.'; exit 2 }

$html = Get-Content -Raw -Encoding UTF8 (Join-Path $raiz 'index.html')
$html = $html -replace '(?s)</body>', '  <script src="e2e.js"></script>
</body>'
$html = $html -replace 'href="css/', 'href="../css/' -replace 'src="js/', 'src="../js/'
$destino = Join-Path $PSScriptRoot 'autoprueba.html'
Set-Content -Path $destino -Value $html -Encoding UTF8

$perfil = Join-Path $env:TEMP ('zazarabicoa-e2e-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $perfil -Force | Out-Null

$url = 'file:///' + ($destino -replace '\\', '/')
$salida = & $Navegador --headless=new --disable-gpu --no-first-run --no-default-browser-check `
  --allow-file-access-from-files --user-data-dir="$perfil" --virtual-time-budget=12000 `
  --dump-dom $url 2>$null

$texto = ($salida -join "`n")
$resultado = [regex]::Match($texto, '\[\[RESULTADO\]\](.*?)\[\[FIN\]\]', 'Singleline')
Write-Host ''
if ($resultado.Success) {
  Write-Host $resultado.Groups[1].Value.Trim()
} else {
  Write-Host 'No se pudo obtener el resultado de la autoprueba.'
  Write-Host 'Se muestran los últimos 800 caracteres del DOM:'
  if ($texto.Length -gt 800) { Write-Host $texto.Substring($texto.Length - 800) } else { Write-Host $texto }
}

Remove-Item -Recurse -Force $perfil -ErrorAction SilentlyContinue
if ($resultado.Success -and $resultado.Groups[1].Value -match 'E2E FALLAS: 0') { exit 0 } else { exit 1 }
