USE `lhlord`;

CREATE TABLE IF NOT EXISTS `pill` (
  `item_id` BIGINT NOT NULL COMMENT '物品id(逻辑外键: item.item_id)',
  `pill_category` VARCHAR(32) DEFAULT NULL COMMENT '丹药类别(疗伤/战斗/突破/修炼)',
  `effect_type` VARCHAR(32) DEFAULT NULL COMMENT '效果类型(heal/buff/breakthrough/toxin_remove)',
  `base_effect` INT DEFAULT NULL COMMENT '基础效果值',
  `duration` INT DEFAULT 0 COMMENT 'buff持续时间(天)',
  `toxicity` INT DEFAULT 0 COMMENT '基础丹毒',
  `breakthrough_bonus` INT DEFAULT 0 COMMENT '突破成功率加成',
  `buff_code` VARCHAR(64) DEFAULT NULL COMMENT '对应buff编码',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='丹药定义扩展表, 保存丹药类别, 效果类型, 基础效果, buff编码, 丹毒与突破成功率加成';

CREATE TABLE IF NOT EXISTS `pill_recipe` (
  `recipe_id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '丹方id',
  `pill_id` BIGINT DEFAULT NULL COMMENT '丹药id(逻辑外键: item.item_id)',
  `recipe_level` TINYINT DEFAULT NULL COMMENT '丹方等级',
  `min_furnace_level` TINYINT DEFAULT NULL COMMENT '最低丹炉等级',
  `base_days` INT DEFAULT NULL COMMENT '基础炼制时间',
  `status` TINYINT(1) DEFAULT 1 COMMENT '状态(1-启用 0-停用)',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`recipe_id`),
  UNIQUE KEY `uk_pill_recipe_pill` (`pill_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='丹方主表, 定义丹药等级, 最低丹炉等级与基础炼制时间';

CREATE TABLE IF NOT EXISTS `pill_recipe_slot` (
  `recipe_slot_id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '丹方槽位id',
  `recipe_id` BIGINT DEFAULT NULL COMMENT '丹方id(逻辑外键: pill_recipe.recipe_id)',
  `slot_type` VARCHAR(16) DEFAULT NULL COMMENT '槽位类型(main/secondary/guide)',
  `slot_index` TINYINT DEFAULT 0 COMMENT '槽位序号',
  `effect_code` VARCHAR(64) DEFAULT NULL COMMENT '所需药性编码',
  `required_power` INT DEFAULT NULL COMMENT '需求药力',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`recipe_slot_id`),
  UNIQUE KEY `uk_recipe_slot` (`recipe_id`, `slot_type`, `slot_index`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='丹方槽位需求表, 描述主药, 辅药, 药引的药性编码与药力下限';

CREATE TABLE IF NOT EXISTS `alchemy_furnace` (
  `item_id` BIGINT NOT NULL COMMENT '物品id(逻辑外键: item.item_id)',
  `furnace_level` TINYINT DEFAULT NULL COMMENT '丹炉等级',
  `capacity` INT DEFAULT NULL COMMENT '总草药容量',
  `main_slots` TINYINT DEFAULT 1 COMMENT '主药格数',
  `secondary_slots` TINYINT DEFAULT 2 COMMENT '辅药格数',
  `guide_slots` TINYINT DEFAULT 1 COMMENT '药引格数',
  `durability` INT DEFAULT 100 COMMENT '当前耐久',
  `heat_stability` INT DEFAULT 0 COMMENT '火候稳定性加成',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='炼丹炉扩展表, 记录丹炉等级, 药格容量, 耐久与火候稳定性';

CREATE TABLE IF NOT EXISTS `buff` (
  `buff_id` BIGINT NOT NULL AUTO_INCREMENT COMMENT 'buff定义id',
  `buff_code` VARCHAR(64) NOT NULL COMMENT 'buff编码',
  `buff_name` VARCHAR(64) DEFAULT NULL COMMENT 'buff名称',
  `stat_key` VARCHAR(64) DEFAULT NULL COMMENT '影响属性',
  `value_type` VARCHAR(16) DEFAULT NULL COMMENT '数值类型(flat/percent)',
  `default_value` INT DEFAULT NULL COMMENT '默认数值',
  `duration` INT DEFAULT 0 COMMENT '默认持续时间(天)',
  `description` VARCHAR(255) DEFAULT NULL COMMENT '描述',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`buff_id`),
  UNIQUE KEY `uk_buff_code` (`buff_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='战斗buff定义表, 定义buff编码, 属性目标, 数值类型与默认持续时间';

CREATE TABLE IF NOT EXISTS `character_inventory` (
  `inventory_id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '背包id',
  `character_id` BIGINT DEFAULT NULL COMMENT '角色id(逻辑外键: character.character_id)',
  `item_id` BIGINT DEFAULT NULL COMMENT '物品id(逻辑外键: item.item_id)',
  `quantity` INT DEFAULT 0 COMMENT '数量',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`inventory_id`),
  UNIQUE KEY `uk_character_item` (`character_id`, `item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色背包表, 保存角色持有的物品数量, 用于炼丹材料消耗与丹药产出';

CREATE TABLE IF NOT EXISTS `character_alchemy_skill` (
  `character_id` BIGINT NOT NULL COMMENT '角色id(逻辑外键: character.character_id)',
  `alchemy_level` TINYINT DEFAULT 1 COMMENT '丹道等级',
  `pharmacology_level` TINYINT DEFAULT 1 COMMENT '药理等级',
  `fire_control_level` TINYINT DEFAULT 1 COMMENT '控火等级',
  `tolerance_level` TINYINT DEFAULT 0 COMMENT '耐药等级',
  `success_count` INT DEFAULT 0 COMMENT '累计成功次数',
  `best_recipe_level` TINYINT DEFAULT 0 COMMENT '已掌握最高丹方等级',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`character_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='丹修能力表, 保存丹道, 药理, 控火, 耐药等级与累计炼丹成果';

CREATE TABLE IF NOT EXISTS `character_attribute` (
  `character_id` BIGINT NOT NULL COMMENT '角色id(逻辑外键: character.character_id)',
  `aptitude` INT DEFAULT 10 COMMENT '资质(影响修炼速度)',
  `comprehension` INT DEFAULT 10 COMMENT '悟性(影响功法与术法领悟速度)',
  `metal_root` INT DEFAULT 0 COMMENT '金灵根',
  `wood_root` INT DEFAULT 0 COMMENT '木灵根',
  `water_root` INT DEFAULT 0 COMMENT '水灵根',
  `fire_root` INT DEFAULT 0 COMMENT '火灵根',
  `earth_root` INT DEFAULT 0 COMMENT '土灵根',
  `max_hp` INT DEFAULT 100 COMMENT '生命上限',
  `attack` INT DEFAULT 10 COMMENT '攻击力',
  `defense` INT DEFAULT 10 COMMENT '防御力',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`character_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色修炼属性表, 保存资质, 悟性, 五行灵根与基础战斗属性';

CREATE TABLE IF NOT EXISTS `character_buff` (
  `buff_id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '角色buff id',
  `character_id` BIGINT DEFAULT NULL COMMENT '角色id(逻辑外键: character.character_id)',
  `buff_code` VARCHAR(64) DEFAULT NULL COMMENT 'buff编码',
  `source_type` VARCHAR(32) DEFAULT NULL COMMENT '来源类型',
  `source_item_id` BIGINT DEFAULT NULL COMMENT '来源物品id',
  `buff_value` INT DEFAULT NULL COMMENT '生效数值',
  `expires_at` DATETIME DEFAULT NULL COMMENT '过期时间',
  `status` TINYINT(1) DEFAULT 1 COMMENT '状态(1-生效 0-已过期)',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`buff_id`),
  KEY `idx_character_buff_character` (`character_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色buff状态表, 记录角色当前获得的战斗buff, 来源, 数值与过期时间';

CREATE TABLE IF NOT EXISTS `character_drug_toxin` (
  `character_id` BIGINT NOT NULL COMMENT '角色id(逻辑外键: character.character_id)',
  `toxin_value` INT DEFAULT 0 COMMENT '丹毒值',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`character_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色丹毒表, 保存角色累计丹毒值, 用于限制丹药滥用';

CREATE TABLE IF NOT EXISTS `spirit_field` (
  `field_id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '灵田id',
  `character_id` BIGINT DEFAULT NULL COMMENT '角色id(逻辑外键: character.character_id)',
  `item_id` BIGINT DEFAULT NULL COMMENT '种植草药id(逻辑外键: item.item_id)',
  `field_level` TINYINT DEFAULT 1 COMMENT '灵田等级',
  `planted_at` DATETIME DEFAULT NULL COMMENT '种植时间',
  `ready_at` DATETIME DEFAULT NULL COMMENT '成熟时间',
  `status` VARCHAR(32) DEFAULT 'empty' COMMENT '状态(empty/growing/ready)',
  `yield` INT DEFAULT 1 COMMENT '预计产量',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`field_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='灵田表, 保存角色灵田的种植草药, 成长状态, 成熟时间与产量';

CREATE TABLE IF NOT EXISTS `alchemy_batch` (
  `batch_id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '炼丹批次id',
  `character_id` BIGINT DEFAULT NULL COMMENT '角色id',
  `recipe_id` BIGINT DEFAULT NULL COMMENT '丹方id',
  `furnace_item_id` BIGINT DEFAULT NULL COMMENT '丹炉物品id',
  `batch_count` INT DEFAULT 1 COMMENT '批量数量',
  `input_json` JSON DEFAULT NULL COMMENT '投入材料',
  `output_json` JSON DEFAULT NULL COMMENT '产出明细',
  `temperature` INT DEFAULT 0 COMMENT '最终寒热值',
  `balance_score` DECIMAL(5, 4) DEFAULT 0 COMMENT '平衡度',
  `stability_score` INT DEFAULT 0 COMMENT '稳定性评分',
  `outcome` VARCHAR(32) DEFAULT NULL COMMENT '结果(成丹/废丹/药渣/炸炉)',
  `quality` VARCHAR(16) DEFAULT NULL COMMENT '品质',
  `quantity` INT DEFAULT 0 COMMENT '产出数量',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`batch_id`),
  KEY `idx_alchemy_batch_character` (`character_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='炼丹批次记录表, 保存投入材料, 寒热平衡, 稳定性评分与产出结果';
