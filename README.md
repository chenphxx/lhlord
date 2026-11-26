# lhlord

一款修仙模拟器, 还在开发中

- **前端**, TypeScript + Vite, Phaser 暂时未引入
- **后端**, Python + FastAPI
- **主数据库**, PostgreSQL

## 现有功能 

- 卡片支持有序自定义字段、预设关联、自定义关联、反向关系展示、关联对象内联新建与删除

- 顶部对象入口支持拖拽排序, 并可在主栏与其他分类之间互相拖动

- 支持导入导出, 导入为覆盖式导入 

## 环境准备

1. 在 PostgreSQL 中创建 `lhlord` 数据库
2. 在 `backend` 下创建虚拟环境并安装依赖
3. 将 `backend/.env.example` 复制为 `backend/.env`, 填写 `DATABASE_URL`
4. 在 `frontend` 下执行 `npm install`

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env

cd ..\frontend
npm install
```

## 启动

双击根目录的 `start.bat` 可自动执行数据库迁移、写入幂等示例数据并启动前后端

也可手动启动

```powershell
cd backend
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m app.seed
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 7100 --reload

cd ..\frontend
npm run dev
```

- 网页 `http://127.0.0.1:5173`
- API 文档 `http://127.0.0.1:7100/docs`
- 健康检查 `http://127.0.0.1:7100/api/health`

## 验证

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest

cd ..\frontend
npm run build
```

## 文档

见 `docs/`

## 许可

MIT
