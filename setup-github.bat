@echo off
echo ========================================
echo  CONFIGURACION INICIAL DE GITHUB
echo  XV Años Dulce Camila
echo ========================================
echo.

echo Este script te ayudara a publicar la invitacion en GitHub Pages
echo.
echo Prerrequisitos:
echo - Tener Git instalado
echo - Tener GitHub CLI (gh) instalado
echo - Estar autenticado en GitHub
echo.
pause

echo.
echo 1. Inicializando repositorio Git...
git init

echo.
echo 2. Agregando archivos...
git add .

echo.
echo 3. Creando primer commit...
git commit -m "Initial commit: XV años Dulce Camila Aviña Franco - Invitación web"

echo.
echo 4. ¿Quieres crear el repositorio en GitHub? (S/N)
set /p create=

if /i "%create%"=="S" (
    echo.
    echo Creando repositorio en GitHub...
    echo Nota: Debes estar autenticado en GitHub CLI (gh auth login)
    echo.

    gh repo create xv-anos-dulce-camila --public --source=. --remote=origin --description "Invitación web para los XV años de Dulce Camila Aviña Franco - 16 Mayo 2026"

    echo.
    echo 5. Subiendo archivos a GitHub...
    git push -u origin main

    echo.
    echo 6. Habilitando GitHub Pages...
    timeout /t 5 /nobreak
    gh repo edit --enable-pages --pages-branch main

    echo.
    echo ========================================
    echo  CONFIGURACION COMPLETADA!
    echo ========================================
    echo.
    echo Tu invitacion estara disponible en:
    echo https://[tu-usuario].github.io/xv-anos-dulce-camila/
    echo.
    echo Para ver el repositorio:
    gh repo view --web
    echo.
) else (
    echo.
    echo Configuracion de GitHub omitida.
    echo.
    echo Para crear el repositorio manualmente:
    echo 1. gh repo create xv-anos-dulce-camila --public --source=. --remote=origin
    echo 2. git push -u origin main
    echo 3. gh repo edit --enable-pages --pages-branch main
)

echo.
echo ========================================
echo  PROXIMOS PASOS
echo ========================================
echo.
echo 1. Espera 1-2 minutos para que GitHub Pages se active
echo 2. Visita tu invitacion en el navegador
echo 3. Comparte el link por WhatsApp
echo 4. Usa push-to-github.bat para futuras actualizaciones
echo.

pause
