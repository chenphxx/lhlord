# MySQL 数据结构说明

> 本文档说明项目数据库设计, 与 `database/schema/init.sql` 保持一致, 表结构变更后需同步更新本文档

## 1. 项目背景

本项目目标是一款修仙题材游戏, 当前处于前期启动阶段: 先用 JS 搭建 Web 应用模拟各个模块, 后期再迁移到游戏引擎 游戏设定见 `background/概述.md` 与 `background/境界.md`

数据库采用 MySQL, 库名 `lhlord`, 字符集 `utf8mb4`,排序规则 `utf8mb4_unicode_ci`, 表引擎统一为 InnoDB

## 2. 设计约定

- 表名,字段名统一使用 `snake_case`
- 每张表主键统一为 `{表名}_id`, 类型 `BIGINT NOT NULL AUTO_INCREMENT`
- 每张业务表均包含通用审计字段: `create_time`,`update_time`,`create_by`,`update_by`; 物品扩展表只保留时间字段
- 暂不建立物理外键约束, 关联通过"逻辑外键"字段体现, 类型与所关联主键保持一致 游戏项目常因分库/分服/迁移而采用逻辑外键
- 字典值(状态,位面,品质等)统一录入 `sys_dict` 字典表, 不在代码中散落写死; 枚举字段注释中标注对应字典类型
- 基础表 + 扩展表: 公共字段放基础表, 具体类型属性放扩展表(如 `item` + `herb`/`material`/`weapon`/`armor`), 后续新增类型只需新增扩展表

## 3. 关系总览

```mermaid
erDiagram
    item_category ||--o{ item : "物品分类(1:N)"
    item ||--o| herb : "草药扩展(1:1)"
    item ||--o| material : "材料扩展(1:1)"
    item ||--o| weapon : "武器扩展(1:1)"
    item ||--o| armor : "防具扩展(1:1)"
    race ||--o{ race_subspecies : "种族亚种(1:N)"
    race ||--o{ character : "角色种族(1:N)"
    race_subspecies ||--o{ character : "角色亚种(1:N)"
    class ||--o{ character : "角色职业(1:N)"
    realm ||--o{ character : "角色境界(1:N)"
    sect ||--o{ sect_member : "门派成员(1:N)"
    character ||--o{ sect_member : "成员角色(1:N)"
    sect_position ||--o{ sect_member : "成员职务(1:N)"
    character ||--o{ sect : "掌门(1:N)"
```

说明

- 物品 `item` 通过 `item_category_id` 归属分类, 具体属性按分类写入对应扩展表(`herb`/`material`/`weapon`/`armor`), 扩展表与 `item` 一一对应
- 角色 `character` 通过 `race_id`,`race_subsp_id`,`class_id` 关联种族,亚种与职业
- 角色境界通过 `realm_id` 关联境界表 `realm`(炼气~仙帝, 见 `background/境界.md`)
- 门派成员 `sect_member` 是角色-门派关系表, 记录入门/离开历史与职务,贡献
- `create_by`/`update_by` 逻辑上指向用户表 `user.user_id`

## 4. 表结构详解

### 4.1 物品分类表 `item_category`

物品的分类字典(原 `item_sort` 更名), 如草药,材料,符箓,炼丹炉,炼器炉等

| 字段 | 类型 | 可空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| item_category_id | BIGINT | 否 | 自增 | 物品分类id(主键) |
| item_category_code | CHAR(64) | 是 | NULL | 物品分类编码 |
| item_category_name | CHAR(64) | 是 | NULL | 物品分类名称 |
| item_category_description | VARCHAR(255) | 是 | NULL | 物品分类描述 |
| create_time / update_time / create_by / update_by | - | 是 | - | 通用审计字段 |

关联: 被 `item.item_category_id` 引用, 一对多

### 4.2 物品基础表 `item`

物品基础表, 只保存公共字段, 不保存具体类型属性; 类型属性存放于扩展表, 保证后续新增物品类型无需改动基础表

| 字段 | 类型 | 可空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| item_id | BIGINT | 否 | 自增 | 物品id(主键) |
| item_code | CHAR(64) | 是 | NULL | 物品编码 |
| item_category_id | BIGINT | 是 | NULL | 物品分类id(逻辑外键: item_category.item_category_id) |
| item_name | VARCHAR(255) | 是 | NULL | 物品名称 |
| quality | TINYINT | 是 | NULL | 品质等级(1-12, 对应颜色见 sys_dict item_quality) |
| level | TINYINT | 是 | NULL | 物品等级(1-12) |
| description | VARCHAR(255) | 是 | NULL | 物品描述 |
| create_time / update_time / create_by / update_by | - | 是 | - | 通用审计字段 |

关联: `item_category_id` -> `item_category`; 被 `herb`/`material`/`weapon`/`armor` 的 `item_id` 引用(1:1)

### 4.3 草药扩展表 `herb`

草药类物品扩展属性, 与 `item` 一一对应

| 字段 | 类型 | 可空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| item_id | BIGINT | 否 | - | 物品id(主键, 逻辑外键: item.item_id) |
| main_effect | VARCHAR(64) | 是 | NULL | 主药效果(活血/生息/聚元等) |
| secondary_effect | VARCHAR(64) | 是 | NULL | 辅药效果(道蕴/锻体/凝神等) |
| guide_effect | VARCHAR(64) | 是 | NULL | 药引(性平/性寒/性热, 见 sys_dict herb_guide_effect) |
| create_time / update_time | - | 是 | - | 时间审计字段 |

### 4.4 材料扩展表 `material`

材料类物品扩展属性

| 字段 | 类型 | 可空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| item_id | BIGINT | 否 | - | 物品id(主键, 逻辑外键: item.item_id) |
| attribute | VARCHAR(64) | 是 | NULL | 属性(金木水火土/神念/剑/混元, 见 sys_dict material_attribute) |
| material_type | VARCHAR(64) | 是 | NULL | 种类(皮鳞/牙骨/灵物/金属/石, 见 sys_dict material_type) |
| yin_yang | VARCHAR(64) | 是 | NULL | 阴阳(天阳/地阴, 见 sys_dict material_yin_yang) |
| create_time / update_time | - | 是 | - | 时间审计字段 |

### 4.5 武器扩展表 `weapon`

武器类物品扩展属性

| 字段 | 类型 | 可空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| item_id | BIGINT | 否 | - | 物品id(主键, 逻辑外键: item.item_id) |
| weapon_type | VARCHAR(64) | 是 | NULL | 武器类型(剑/刀/枪等) |
| attack | INT | 是 | NULL | 攻击力 |
| create_time / update_time | - | 是 | - | 时间审计字段 |

### 4.6 防具扩展表 `armor`

防具类物品扩展属性

| 字段 | 类型 | 可空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| item_id | BIGINT | 否 | - | 物品id(主键, 逻辑外键: item.item_id) |
| armor_type | VARCHAR(64) | 是 | NULL | 防具类型(法衣/盾等) |
| defense | INT | 是 | NULL | 防御力 |
| create_time / update_time | - | 是 | - | 时间审计字段 |

### 4.7 职业表 `class`

修士职业字典, 如剑修,丹修,器修等

| 字段 | 类型 | 可空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| class_id | BIGINT | 否 | 自增 | 职业id(主键) |
| class_code | CHAR(64) | 是 | NULL | 职业编码 |
| class_name | CHAR(64) | 是 | NULL | 职业名称 |
| class_description | VARCHAR(255) | 是 | NULL | 职业描述 |
| create_time / update_time / create_by / update_by | - | 是 | - | 通用审计字段 |

关联: 被 `character.class_id` 引用

### 4.8 角色表 `character`

游戏角色(修士), 记录种族,亚种,职业等基础信息

| 字段 | 类型 | 可空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| character_id | BIGINT | 否 | 自增 | 角色id(主键) |
| character_name | CHAR(64) | 是 | NULL | 角色名称 |
| gender | TINYINT | 是 | NULL | 角色性别(1-男 2-女, 见 sys_dict gender) |
| age | INT | 是 | NULL | 角色年龄 |
| race_id | BIGINT | 是 | NULL | 种族id(逻辑外键: race.race_id) |
| race_subsp_id | BIGINT | 是 | NULL | 亚种id(逻辑外键: race_subspecies.race_subspecies_id) |
| class_id | BIGINT | 是 | NULL | 职业id(逻辑外键: class.class_id) |
| realm_id | BIGINT | 是 | NULL | 境界id(逻辑外键: realm.realm_id) |
| character_description | VARCHAR(255) | 是 | NULL | 角色描述 |
| create_time / update_time / create_by / update_by | - | 是 | - | 通用审计字段 |

关联: `race_id` -> `race`; `race_subsp_id` -> `race_subspecies`(亚种必须属于该种族); `class_id` -> `class`; `realm_id` -> `realm` 门派关系不直接存 `sect_id`, 而是通过 `sect_member` 表达

### 4.9 种族表 `race`

种族字典(原 `race_sort` 更名), 不同种族有各自的特性与修炼天赋

| 字段 | 类型 | 可空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| race_id | BIGINT | 否 | 自增 | 种族id(主键) |
| race_code | CHAR(64) | 是 | NULL | 种族编码 |
| race_name | CHAR(64) | 是 | NULL | 种族名称 |
| race_description | VARCHAR(255) | 是 | NULL | 种族描述 |
| create_time / update_time / create_by / update_by | - | 是 | - | 通用审计字段 |

关联: 被 `character.race_id`,`race_subspecies.race_id` 引用

### 4.10 种族亚种分类表 `race_subspecies`

种族下的亚种字典

| 字段 | 类型 | 可空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| race_subspecies_id | BIGINT | 否 | 自增 | 亚种id(主键) |
| race_id | BIGINT | 是 | NULL | 所属种族id(逻辑外键: race.race_id) |
| race_subspecies_code | CHAR(64) | 是 | NULL | 亚种编码 |
| race_subspecies_name | VARCHAR(255) | 是 | NULL | 亚种名称 |
| race_subspecies_description | VARCHAR(255) | 是 | NULL | 亚种描述 |
| create_time / update_time / create_by / update_by | - | 是 | - | 通用审计字段 |

关联: `race_id` -> `race`; 被 `character.race_subsp_id` 引用

### 4.11 门派表 `sect`

游戏中的门派, 为修士提供修行场所, 弟子参与种植灵田,炼丹,炼气,战斗等工作维持宗门运转

| 字段 | 类型 | 可空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| sect_id | BIGINT | 否 | 自增 | 门派id(主键) |
| sect_code | CHAR(64) | 是 | NULL | 门派编码 |
| sect_name | VARCHAR(255) | 是 | NULL | 门派名称 |
| sect_realm | TINYINT | 是 | NULL | 门派所在位面(见 sys_dict sect_realm) |
| sect_region | VARCHAR(255) | 是 | NULL | 门派驻地/地盘 |
| sect_leader_id | BIGINT | 是 | NULL | 掌门角色id(逻辑外键: character.character_id) |
| sect_level | TINYINT | 是 | NULL | 门派等级 |
| sect_style | VARCHAR(64) | 是 | NULL | 门派流派倾向(如剑修/丹修/器修/阵修) |
| sect_tenet | VARCHAR(255) | 是 | NULL | 门规/宗旨 |
| sect_status | TINYINT(1) | 是 | 1 | 门派状态(见 sys_dict sect_status) |
| sect_description | VARCHAR(255) | 是 | NULL | 门派描述 |
| create_time / update_time / create_by / update_by | - | 是 | - | 通用审计字段 |

关联: 弟子关系通过 `sect_member` 表表达

### 4.12 门派职务表 `sect_position`

门派职务字典, 避免"掌门/掌 门/门主"等字符串歧义

| 字段 | 类型 | 可空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| position_id | BIGINT | 否 | 自增 | 职务id(主键) |
| position_code | CHAR(64) | 是 | NULL | 职务编码 |
| position_name | CHAR(64) | 是 | NULL | 职务名称 |
| position_description | VARCHAR(255) | 是 | NULL | 职务描述 |
| create_time / update_time / create_by / update_by | - | 是 | - | 通用审计字段 |

关联: 被 `sect_member.position_id` 引用

### 4.13 门派成员表 `sect_member`

角色与门派的关系表(弟子), 支持一个角色加入/离开多个门派的历史记录

| 字段 | 类型 | 可空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| sect_member_id | BIGINT | 否 | 自增 | 门派成员id(主键) |
| sect_id | BIGINT | 是 | NULL | 门派id(逻辑外键: sect.sect_id) |
| character_id | BIGINT | 是 | NULL | 角色id(逻辑外键: character.character_id) |
| member_name | VARCHAR(64) | 是 | NULL | 门派内名称/道号 |
| position_id | BIGINT | 是 | NULL | 门派职务id(逻辑外键: sect_position.position_id) |
| sect_contribution | BIGINT | 是 | 0 | 门派贡献值 |
| join_time | DATETIME | 是 | NULL | 入门时间 |
| leave_time | DATETIME | 是 | NULL | 离开时间 |
| member_status | TINYINT(1) | 是 | 1 | 成员状态(见 sys_dict member_status) |
| create_time / update_time / create_by / update_by | - | 是 | - | 通用审计字段 |

关联: `sect_id` -> `sect`; `character_id` -> `character`; `position_id` -> `sect_position`

### 4.14 境界表 `realm`

修炼境界字典, 划分参考 `background/境界.md`(小世界/大世界/仙界/上层位面)

| 字段 | 类型 | 可空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| realm_id | BIGINT | 否 | 自增 | 境界id(主键) |
| realm_code | CHAR(64) | 是 | NULL | 境界编码 |
| realm_name | CHAR(64) | 是 | NULL | 境界名称(炼气~仙帝) |
| realm_world | TINYINT | 是 | NULL | 所属位面(1-小世界 2-大世界 3-仙界 4-上层位面) |
| realm_level | TINYINT | 是 | NULL | 位面内境界序号(由低到高) |
| realm_description | VARCHAR(255) | 是 | NULL | 境界描述 |
| create_time / update_time / create_by / update_by | - | 是 | - | 通用审计字段 |

关联: 被 `character.realm_id` 引用

### 4.15 系统字典表 `sys_dict`

统一枚举字典, 所有固定配置(性别,位面,状态,品质等)都从这里取值, 避免写死散落

| 字段 | 类型 | 可空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| dict_id | BIGINT | 否 | 自增 | 字典id(主键) |
| dict_type | VARCHAR(64) | 否 | - | 字典类型(如 gender / sect_realm / item_quality) |
| dict_code | VARCHAR(64) | 否 | - | 字典编码 |
| dict_name | VARCHAR(64) | 否 | - | 字典名称 |
| dict_sort | TINYINT | 是 | 0 | 排序 |
| dict_status | TINYINT(1) | 是 | 1 | 状态(1-启用 0-停用) |
| create_time / update_time / create_by / update_by | - | 是 | - | 通用审计字段 |

唯一约束: `(dict_type, dict_code)`

### 4.16 用户表 `user`

后台用户, `create_by`/`update_by` 的逻辑外键目标; 登录鉴权功能后续实现, `password_hash` 预留

| 字段 | 类型 | 可空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| user_id | BIGINT | 否 | 自增 | 用户id(主键) |
| username | VARCHAR(64) | 否 | - | 用户名(唯一) |
| password_hash | VARCHAR(255) | 是 | NULL | 密码哈希(预留) |
| display_name | VARCHAR(64) | 是 | NULL | 显示名称 |
| user_status | TINYINT(1) | 是 | 1 | 状态(见 sys_dict user_status) |
| create_time / update_time / create_by / update_by | - | 是 | - | 通用审计字段 |

唯一约束: `username`

## 4.17 炼丹模块新增表

第一版炼丹系统新增以下表, 建表脚本位于 [schema/alchemy.sql](schema/alchemy.sql), 种子数据位于 [seed/alchemy_seed.sql](seed/alchemy_seed.sql)

| 表 | 说明 |
| --- | --- |
| pill | 丹药定义扩展表, 保存丹药类别,效果类型,基础效果,buff 编码,丹毒与突破成功率加成 |
| pill_recipe | 丹方主表, 定义丹药等级,最低丹炉等级与基础炼制时间 |
| pill_recipe_slot | 丹方槽位需求表, 描述主药,辅药,药引的药性编码与药力下限 |
| alchemy_furnace | 炼丹炉扩展表, 记录丹炉等级,药格容量,耐久与火候稳定性 |
| buff | 战斗 buff 定义表 |
| character_inventory | 角色背包表 |
| character_alchemy_skill | 丹修能力表 |
| character_attribute | 角色修炼属性表 |
| character_buff | 角色 buff 状态表 |
| character_drug_toxin | 角色丹毒表 |
| spirit_field | 灵田表 |
| alchemy_batch | 炼丹批次记录表 |

## 5. 设计建议与待办

- **定义表与实例表分离**: 后续玩家背包/装备系统建议拆 `item_instance`(实例, 含强化等级,耐久,绑定玩家), 与物品定义表 `item` 分离
- **功法/术法**: 概述中已定义功法(主修/辅修,12 等级,属性)与术法, 尚未建表, 后续需补充功法表,术法表, 以及多对多关系表(如 `character_skill`)
- **草药效果字典化**: 主药/辅药效果目前存字符串, 量大后可迁入 `sys_dict`(如 `herb_main_effect`/`herb_secondary_effect`)
- **错误代码**: 错误代码表(`error`)字段定义待补充
- **登录鉴权**: 管理后台暂未接入登录, `user` 表已就绪, 后续可增加 JWT 登录与权限控制

## 6. 种子数据

`database/seed/` 下存放初始化数据脚本, 均使用 `INSERT IGNORE`, 可重复执行

| 脚本 | 内容 |
| --- | --- |
| [init_seed.sql](seed/init_seed.sql) | 种族(8),亚种(30),职业(8),境界(18),门派职务(4),门派(8),门派成员(12, 含道号),角色(12, 含境界),系统字典(42),用户(1) |
| [item_seed.sql](seed/item_seed.sql) | 物品分类(11),物品基础(94),草药扩展(42, 主药/辅药均已补全),材料扩展(18),武器扩展(2),防具扩展(2) |
| [alchemy_seed.sql](seed/alchemy_seed.sql) | 炼丹扩展: 新增草药与丹药, 丹药定义(25), 丹方(21), 丹方槽位(66), 丹炉(12), buff(5), 角色背包, 灵田, 角色修炼属性与丹毒 |

导入顺序: 先执行 `database/schema/init.sql` 建表, 再执行 `database/schema/alchemy.sql` 建炼丹表, 最后依次执行三个种子脚本

## 7. 变更记录

| 日期 | 变更内容 |
| --- | --- |
| 2026-08-16 | 新增炼丹模块表与种子数据, 完善炼丹相关表注释 |
| 2026-08-10 | 新增境界表 `realm`(18 个境界); `character` 新增 `realm_id` 按年龄与职位分配境界; `sect_member` 新增 `member_name` 门派内道号; SQL 调试支持切换当前数据库 |
| 2026-08-10 | 数据库结构重构: `item_sort` 更名 `item_category`,`race_sort` 更名 `race`; `item` 调整为基础表(新增 quality/level), 新增扩展表 `herb`/`material`/`weapon`/`armor`; 新增 `class`/`sect_position`/`sys_dict`/`user` 表; `character` 新增 `class_id`; `sect_member` 的职务改为 `position_id` |
| 2026-08-10 | 管理后台新增: 新建表,表结构编辑(关键变更弹窗确认),多选导出导入,深色/浅色模式 |
| 2026-08-10 | 新增种子数据脚本 `init_seed.sql` 与 `item_seed.sql`, 已导入本地 MySQL(`lhlord`) |
| 2026-08-10 | 落地设计建议: `race_subspecies` 增加 `race_id` 关联所属种族; 新增门派成员表 `sect_member` |
| 2026-08-10 | 新增门派表 `sect`; 修正关联字段类型与主键保持一致 |
