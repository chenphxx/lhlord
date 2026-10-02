# lhlord

## 本地启动

确保MySQL正在运行, `lhlord` 库已按 [backend/database/schema/init.sql](backend/database/schema/init.sql) 与 [backend/database/schema/game.sql](backend/database/schema/game.sql) 建表并导入种子数据 

提供脚本[start.bat](start.bat)一键启动 

```bash
# 1. 后端(端口 7100)
cd backend
npm install
copy .env.example .env   # 填入数据库账号密码
npm run dev

# 2. 前端(端口 5173, 开发代理 /api -> 127.0.0.1:7100)
cd frontend
npm install
npm run dev
```

浏览器打开 http://localhost:5173 即可进入 

## 文档 
见`docs/` 
