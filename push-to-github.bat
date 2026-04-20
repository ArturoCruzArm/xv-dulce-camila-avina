@echo off
echo ========================================
echo  PUBLICAR INVITACION EN GITHUB
echo  XV Años Dulce Camila
echo ========================================
echo.

:: Verificar si hay cambios
git status

echo.
echo ¿Deseas continuar con el commit y push? (S/N)
set /p confirm=

if /i "%confirm%"=="S" (
    echo.
    echo Ingresa el mensaje del commit:
    set /p message=

    echo.
    echo Agregando archivos...
    git add .

    echo Creando commit...
    git commit -m "%message%"

    echo Subiendo a GitHub...
    git push

    echo.
    echo ========================================
    echo  COMPLETADO!
    echo ========================================
    echo.
    echo La invitacion se actualizara en 1-2 minutos
    echo URL: https://[tu-usuario].github.io/xv-anos-dulce-camila/
    echo.
) else (
    echo.
    echo Operacion cancelada.
)

pause
