# lhlord

灵寰录(lhlord) 是一款修仙题材游戏的 Web 原型, 当前以 JS 实现各游戏模块, 后期再迁移到游戏引擎 

## 技术架构

- 前端Vue3+Element Plus 
- 后端Node.js+Express, 通过 RESTful API 读写 MySQL 
- 数据库 MySQL, 建表与种子数据位于 `backend/database/` 

### 目录结构

```
lhlord/
|-- frontend/        # Vue 3 + Vite + Element Plus 管理后台
|   `-- src/
|       |-- api/       # axios 封装
|       |-- utils/     # 公共工具(字段类型常量等)
|       `-- views/     # 页面组件(数据表浏览/炼丹系统)
|-- backend/         # Node.js + Express 后端, 提供 RESTful API
|   |-- src/
|   |   |-- index.js   # 服务入口
|   |   |-- db.js      # MySQL 连接池(mysql2)
|   |   `-- routes/    # 管理后台/调试/炼丹 API 路由
|   `-- database/      # SQL 建表与种子数据
|       |-- schema/    # 建表脚本
|       `-- seed/      # 种子数据
|-- assets/          # 静态资源(界面截图等)
|-- docs/            # 项目文档
|   |-- 技术方案/      # 各模块技术方案
|   `-- 背景信息/      # 游戏设定
|-- start.bat        # 本地一键启动脚本
|-- README.md
|-- CHANGELOG.md
`-- LICENSE
```

## 文档

| 文档 | 说明 |
| --- | --- |
| [docs/技术方案/管理后台.md](docs/技术方案/管理后台.md) | 表结构与数据管理接口的技术方案 |
| [docs/技术方案/炼丹系统.md](docs/技术方案/炼丹系统.md) | 炼丹, 丹药与灵田接口及前端交互的技术方案 |
| [docs/技术方案/数据库设计.md](docs/技术方案/数据库设计.md) | MySQL 数据结构说明 |
| [docs/背景信息/概述.md](docs/背景信息/概述.md) | 游戏设定总览 |
| [CHANGELOG.md](CHANGELOG.md) | 功能变化记录 |

## 本地启动

确保MySQL正在运行, `lhlord` 库已按 [backend/database/schema/init.sql](backend/database/schema/init.sql) 建表并导入种子数据 

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

## 数据库设计

参见 [docs/技术方案/数据库设计.md](docs/技术方案/数据库设计.md) 

建表脚本位于 [backend/database/schema/init.sql](backend/database/schema/init.sql) 

种子数据位于 [backend/database/seed/init_seed.sql](backend/database/seed/init_seed.sql) 与 [backend/database/seed/item_seed.sql](backend/database/seed/item_seed.sql) 