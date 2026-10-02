# lhlord

## 技术架构

- 前端Vue3+Element Plus 

- 后端Node.js+Express, 通过 RESTful API 读写 MySQL 

### 目录结构

```
lhlord/
|-- frontend/        # Vue 3 + Vite + Element Plus 管理后台
|   `-- src/
|       |-- api/       # axios 封装
|       |-- utils/     # 公共工具(字段类型常量等)
|       `-- views/     # 页面组件(数据表浏览/增删改查)
|-- server/          # Node.js + Express 后端, 提供 RESTful API
|   `-- src/
|       |-- index.js   # 服务入口
|       |-- db.js      # MySQL 连接池(mysql2)
|       `-- routes/    # 数据表 API 路由
|-- database/        # SQL 建表与种子数据
|-- background/      # 游戏设定
|-- README.md
`-- CHANGELOG.md
```

## 当前功能

- 炼丹系统V2026.8.16实装 
- 初始化药材以及丹方 

## 后端API

| 方法     | 路径                                      | 说明                    |
| ------ | --------------------------------------- | --------------------- |
| GET    | /api/tables                             | 数据表列表                 |
| POST   | /api/tables                             | 新建数据表                 |
| GET    | /api/tables/:table                      | 表结构(字段/类型/主键/注释)      |
| POST   | /api/tables/:table/columns              | 新增字段                  |
| PUT    | /api/tables/:table/columns/:column      | 修改字段(改名/类型/可空/默认值/注释) |
| DELETE | /api/tables/:table/columns/:column      | 删除字段                  |
| GET    | /api/tables/:table/columns/:column/refs | 字段影响分析(同名字段/逻辑外键引用)   |
| GET    | /api/tables/:table/data                 | 表数据(分页 + 模糊搜索)        |
| POST   | /api/tables/:table                      | 新增记录                  |
| POST   | /api/tables/:table/import               | 批量导入记录                |
| PUT    | /api/tables/:table/:id                  | 按主键更新记录               |
| DELETE | /api/tables/:table/:id                  | 按主键删除记录               |
| GET    | /api/debug/databases                    | 可用数据库列表               |
| POST   | /api/debug/use                          | 切换调试数据库               |
| POST   | /api/debug/query                        | SQL 调试(仅只读语句)         |

## 本地启动

确保MySQL正在运行, `lhlord` 库已按 [database/schema/init.sql](database/schema/init.sql) 建表并导入种子数据 

提供脚本[start.bat](start.bat)一键启动 

```bash
# 1. 后端(端口 7100)
cd server
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

参见 [database/mysql.md](database/mysql.md) 

建表脚本位于 [database/schema/init.sql](database/schema/init.sql) 

种子数据位于 [database/seed/init_seed.sql](database/seed/init_seed.sql) 与 [database/seed/item_seed.sql](database/seed/item_seed.sql) 
