# lhlord

一款修仙模拟器, 还在开发中 

## 功能

- **修行**, 探索可获取草药与灵石; 修行可获得修为, 修为满后可尝试突破 
- **炼丹房**, 可根据单方或者自行搭配药材探索新的单方 

## 快速开始

> 可通过脚本[start.bat](start.bat)一键启动 

- 进入`backend/database/schema/`执行`init.sql`初始化数据库与表 

- 执行`schema/`下的`alchemy.sql`与`game.sql` 

- 执行`seed/`下的`alchemy_seed.sql`与`item_seed.sql`

### 后端

```bash
# 后端(端口 7100)
cd backend
npm install
copy .env.example .env   # 填入数据库账号密码
npm run dev
```

### 前端

```bash
# 前端(端口 5173, 开发代理 /api -> 127.0.0.1:7100)
cd frontend
npm install
npm run dev
```

访问: http://localhost:5173 

## 文档

见`docs/` 
