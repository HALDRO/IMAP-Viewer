:: файл: make_debug.bat  (положите рядом с package.json)
@echo off
title Electron-Forge DEBUG build

rem 1. включаем подробный вывод Forge + пакеджера
set "DEBUG=electron-forge:*,electron-packager,appx,make-squirrel"

rem 2. запускаем make с флагом --verbose
call npm run make -- --verbose

rem 3. чтобы консоль не закрылась сразу
pause