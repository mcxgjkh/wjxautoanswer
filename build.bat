@echo off
chcp 65001
title 问卷星自动作答器 构建器 V7.1.2
setlocal enabledelayedexpansion

color 0a
echo ========================
echo 问卷星自动作答器 构建器 V7.1.2
echo=
echo 作者：MCXGJKH
echo ========================
echo=
pause
cls

color 03
echo 正在检验node.js
node -v
if !errorlevel!==0 (
    echo node.js环境检测通过
) else (
    echo 检测到node.js未安装
    echo 下载请访问https://nodejs.org/en/download
    pause
    cls
    exit /b
)
echo=
pause
cls

echo 正在复制必要构建文件...
set localpath=%~dp0
set filepath=%LOCALAPPDATA%\electron\Cache\
if exist %filepath% (
	xcopy .\build_dependencies\electron-v25.9.8-win32-x64.zip %LOCALAPPDATA%\electron\Cache
    xcopy .\build_dependencies\electron-v25.9.8-win32-ia32.zip %LOCALAPPDATA%\electron\Cache
) else (
    cd %LOCALAPPDATA%
    mkdir -p \electron\Cache\
    xcopy %localpath%\build_dependencies\electron-v25.9.8-win32-x64.zip %LOCALAPPDATA%\Local\electron\Cache
    xcopy %localpath%\build_dependencies\electron-v25.9.8-win32-ia32.zip %LOCALAPPDATA%\Local\electron\Cache
)
set filepath2=%LOCALAPPDATA%\electron-builder\Cache
if exist %filepath2% (
	xcopy .\build_dependencies\nsis %LOCALAPPDATA%\electron-builder\Cache /E
    xcopy .\build_dependencies\winCodeSign %LOCALAPPDATA%\electron-builder\Cache /E
) else (
    cd %LOCALAPPDATA%
    mkdir -p \electron-builder\Cache
    xcopy %localpath%\build_dependencies\nsis %LOCALAPPDATA%\electron-builder\Cache /E
    xcopy %localpath%\build_dependencies\winCodeSign %LOCALAPPDATA%\electron-builder\Cache /E
)
pause
cls

color 0f
echo 按0可退出
echo=
echo 选择构建版本：
echo=
echo 1=Windows64位安装包 Windows x64 installer
echo 2=Windows32位安装包 Windows ia32 installer
echo 3=Windows64位免安装绿色版 Windows x64 portable
echo 4=Windows32位免安装绿色版 Windows ia32 portable
echo 5=Windows全安装包 Windows x64 installer ^& Windows ia32 installer
echo 6=Windows全免安装绿色版 Windows Windows x64 portable ^& Windows ia32 portable
echo 7=全部版本 All versions
echo 8=清理构建目录
echo=
set /p userinput=请输入序号：
if %userinput%==0 (exit /b)
if %userinput%==1 (npm run build:win)
if %userinput%==2 (npm run build:win32)
if %userinput%==3 (npm run build:portable)
if %userinput%==4 (npm run build:portable32)
if %userinput%==5 (npm run build:standard)
if %userinput%==6 (npm run build:portable-all)
if %userinput%==7 (npm run build:all)
if %userinput%==8 (npm run clean)
if %userinput% gtr 8 (echo 输入值非法，请关闭后重试)
pause