@echo off
REM ---------------------------------------------------------------
REM  Disenador de Flyers - arranque de un clic
REM  Levanta un servidor local y abre el editor en el navegador.
REM  Hace falta servidor (no doble clic en index.html) porque el
REM  editor usa modulos ES y exporta imagenes desde canvas.
REM ---------------------------------------------------------------
setlocal
set PUERTO=8900

cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo.
  echo  No se encontro Python en el PATH.
  echo  Instalalo desde https://python.org o abri la carpeta con otro
  echo  servidor estatico ^(por ejemplo: npx serve^).
  echo.
  pause
  exit /b 1
)

echo.
echo  Diseñador de Flyers  --  http://localhost:%PUERTO%
echo  Dejá esta ventana abierta mientras trabajás.
echo  Para cerrar el servidor: Ctrl+C o cerrá la ventana.
echo.

start "" http://localhost:%PUERTO%
python -m http.server %PUERTO%
