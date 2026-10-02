@echo off
chcp 65001 >nul
title lhlord launcher
cd /d "%~dp0"

echo ============================================
echo   lhlord 管理后台启动器
echo ============================================
echo.

where node >nul 2>nul
if %errorlevel%==0 goto :node_ok
echo [ERROR] 未检测到 Node.js, 请先安装: https://nodejs.org
echo.
pause
exit /b 1
:node_ok

if exist "server\node_modules" goto :backend_ok
echo [ERROR] 后端依赖未安装。
echo 请先执行:  cd server  ^&^&  npm install
echo.
pause
exit /b 1
:backend_ok

if exist "frontend\node_modules" goto :frontend_ok
echo [ERROR] 前端依赖未安装。
echo 请先执行:  cd frontend  ^&^&  npm install
echo.
pause
exit /b 1
:frontend_ok

if exist "server\.env" goto :env_ok
copy "server\.env.example" "server\.env" >nul
echo [HINT] 已生成 server\.env
echo 请编辑其中的 DB_PASSWORD 填入 MySQL 密码, 然后重新运行本脚本。
echo.
pause
exit /b 1
:env_ok

netstat -ano | findstr LISTENING | findstr ":7100" >nul && echo [HINT] 端口 7100 已被占用(后端可能已在运行)
netstat -ano | findstr LISTENING | findstr ":5173" >nul && echo [HINT] 端口 5173 已被占用(前端可能已在运行)
echo.

echo 启动后端 http://127.0.0.1:7100 ...
start "lhlord-server" /d "%~dp0server" cmd /k "node src/index.js"

echo 启动前端 http://localhost:5173 ...
start "lhlord-frontend" /d "%~dp0frontend" cmd /k "npm.cmd run dev"

echo.
echo 等待服务启动...
timeout /t 5 /nobreak >nul

echo 状态检查:
netstat -ano | findstr LISTENING | findstr ":7100" >nul && echo   [OK] 后端  http://127.0.0.1:7100/api/health || echo   [FAIL] 后端未启动成功
netstat -ano | findstr LISTENING | findstr ":5173" >nul && echo   [OK] 前端  http://localhost:5173 || echo   [FAIL] 前端未启动成功
echo.

start "" http://localhost:5173
echo 访问地址:
echo   管理后台:       http://localhost:5173
echo   后端健康检查:   http://127.0.0.1:7100/api/health
echo.
echo 停止方式: 关闭弹出的两个命令行窗口即可停止服务
echo.
pause
