@echo off
chcp 65001 >nul
title lhlord launcher
cd /d "%~dp0"

echo ============================================
echo   lhlord 修仙模拟器启动器
echo ============================================
echo.

where python >nul 2>nul
if errorlevel 1 goto :python_missing

where node >nul 2>nul
if errorlevel 1 goto :node_missing

if exist "backend\.venv\Scripts\python.exe" goto :backend_ready
echo [ERROR] 后端虚拟环境不存在
echo 请执行:
echo   cd backend
echo   python -m venv .venv
echo   .venv\Scripts\python.exe -m pip install -r requirements.txt
echo.
pause
exit /b 1
:backend_ready

if exist "frontend\node_modules" goto :frontend_ready
echo [ERROR] 前端依赖未安装
echo 请执行:  cd frontend  ^&^&  npm install
echo.
pause
exit /b 1
:frontend_ready

if exist "backend\.env" goto :env_ready
copy "backend\.env.example" "backend\.env" >nul
echo [HINT] 已生成 backend\.env
echo 请将 DATABASE_URL 中的 CHANGE_ME 替换为本机 PostgreSQL 密码
echo 并确认数据库 lhlord 已创建, 然后重新运行本脚本
echo.
pause
exit /b 1
:env_ready

netstat -ano | findstr LISTENING | findstr ":7100" >nul && echo [HINT] 端口 7100 已被占用
netstat -ano | findstr LISTENING | findstr ":5173" >nul && echo [HINT] 端口 5173 已被占用
echo.

echo 启动后端 http://127.0.0.1:7100 ...
start "lhlord-backend" /d "%~dp0backend" cmd /k ".venv\Scripts\python.exe -m alembic upgrade head && .venv\Scripts\python.exe -m app.seed && .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 7100 --reload"

echo 启动前端 http://127.0.0.1:5173 ...
start "lhlord-frontend" /d "%~dp0frontend" cmd /k "npm.cmd run dev"

echo.
echo 等待服务启动...
ping 127.0.0.1 -n 6 >nul

echo 状态检查:
netstat -ano | findstr LISTENING | findstr ":7100" >nul && echo   [OK] 后端  http://127.0.0.1:7100/api/health || echo   [FAIL] 后端未启动成功
netstat -ano | findstr LISTENING | findstr ":5173" >nul && echo   [OK] 前端  http://127.0.0.1:5173 || echo   [FAIL] 前端未启动成功
echo.

start "" http://127.0.0.1:5173
echo 访问地址:
echo   万象谱:         http://127.0.0.1:5173
echo   后端健康检查:   http://127.0.0.1:7100/api/health
echo.
echo 停止方式: 关闭弹出的两个命令行窗口即可停止服务
echo.
pause
exit /b 0

:python_missing
echo [ERROR] 未检测到 Python, 请先安装 Python 3
echo.
pause
exit /b 1

:node_missing
echo [ERROR] 未检测到 Node.js, 请先安装: https://nodejs.org
echo.
pause
exit /b 1
