# lhlord

一款修仙模拟器, 还在开发中 

## 功能

- **修行**, 开局选择种族, 职业, 五行灵根与天赋; 探索可获取草药与灵石; 修为满后可尝试突破
- **炼丹房**, 草药, 丹炉与丹方均从角色背包读取, 支持丹方炼制与自由配药
- **背包**, 查看角色持有的草药, 丹药, 丹炉, 丹方与材料
- **管理后台**, 管理当前角色的全部属性, 天赋, 丹道能力与背包物品

## 快速开始

> 可通过脚本[start.bat](start.bat)一键启动 

- 进入`backend/database/schema/`执行`init.sql`初始化数据库与表 

- 执行`schema/`下的`alchemy.sql`与`game.sql` 

- 执行`seed/`下的`alchemy_seed.sql`与`item_seed.sql` 

导入前请以 `utf8mb4` 连接数据库, 避免中文数据及表字段注释乱码 

已有数据库升级时执行: 

```bash
mysql --default-character-set=utf8mb4 -u root -p lhlord < backend/database/migrations/20261107_character_customization.sql
mysql --default-character-set=utf8mb4 -u root -p lhlord < backend/database/migrations/20261107_recipe_inventory.sql
```

例如: 

```sql
mysql --default-character-set=utf8mb4 -u root -p
source D:/Projects/lhlord/backend/database/seed/init_seed.sql;
```

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
