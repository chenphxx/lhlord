CREATE DATABASE IF NOT EXISTS `lhlord`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `lhlord`;

-- 物品分类
CREATE TABLE IF NOT EXISTS `item_category` (
  `item_category_id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '物品分类id',
  `item_category_code` CHAR(64) DEFAULT NULL COMMENT '物品分类编码',
  `item_category_name` CHAR(64) DEFAULT NULL COMMENT '物品分类名称',
  `item_category_description` VARCHAR(255) DEFAULT NULL COMMENT '物品分类描述',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `create_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `update_by` BIGINT DEFAULT NULL COMMENT '更新人',
  PRIMARY KEY (`item_category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='物品分类表';

-- 物品(基础表, 具体类型属性存放于扩展表)
CREATE TABLE IF NOT EXISTS `item` (
  `item_id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '物品id',
  `item_code` CHAR(64) DEFAULT NULL COMMENT '物品编码',
  `item_category_id` BIGINT DEFAULT NULL COMMENT '物品分类id(逻辑外键: item_category.item_category_id)',
  `item_name` VARCHAR(255) DEFAULT NULL COMMENT '物品名称',
  `quality` TINYINT DEFAULT NULL COMMENT '品质等级(1-12, 颜色见 sys_dict item_quality)',
  `level` TINYINT DEFAULT NULL COMMENT '物品等级(1-12)',
  `description` VARCHAR(255) DEFAULT NULL COMMENT '物品描述',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `create_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `update_by` BIGINT DEFAULT NULL COMMENT '更新人',
  PRIMARY KEY (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='物品表(基础表)';

-- 草药(物品扩展表)
CREATE TABLE IF NOT EXISTS `herb` (
  `item_id` BIGINT NOT NULL COMMENT '物品id(逻辑外键: item.item_id)',
  `main_effect` VARCHAR(64) DEFAULT NULL COMMENT '主药效果',
  `secondary_effect` VARCHAR(64) DEFAULT NULL COMMENT '辅药效果',
  `guide_effect` VARCHAR(64) DEFAULT NULL COMMENT '药引(性平/性寒/性热)',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='草药扩展表';

-- 材料(物品扩展表)
CREATE TABLE IF NOT EXISTS `material` (
  `item_id` BIGINT NOT NULL COMMENT '物品id(逻辑外键: item.item_id)',
  `attribute` VARCHAR(64) DEFAULT NULL COMMENT '属性(金木水火土/神念/剑/混元)',
  `material_type` VARCHAR(64) DEFAULT NULL COMMENT '种类(皮鳞/牙骨/灵物/金属/石)',
  `yin_yang` VARCHAR(64) DEFAULT NULL COMMENT '阴阳(天阳/地阴)',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='材料扩展表';

-- 武器(物品扩展表)
CREATE TABLE IF NOT EXISTS `weapon` (
  `item_id` BIGINT NOT NULL COMMENT '物品id(逻辑外键: item.item_id)',
  `weapon_type` VARCHAR(64) DEFAULT NULL COMMENT '武器类型',
  `attack` INT DEFAULT NULL COMMENT '攻击力',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='武器扩展表';

-- 防具(物品扩展表)
CREATE TABLE IF NOT EXISTS `armor` (
  `item_id` BIGINT NOT NULL COMMENT '物品id(逻辑外键: item.item_id)',
  `armor_type` VARCHAR(64) DEFAULT NULL COMMENT '防具类型',
  `defense` INT DEFAULT NULL COMMENT '防御力',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='防具扩展表';

-- 职业
CREATE TABLE IF NOT EXISTS `class` (
  `class_id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '职业id',
  `class_code` CHAR(64) DEFAULT NULL COMMENT '职业编码',
  `class_name` CHAR(64) DEFAULT NULL COMMENT '职业名称',
  `class_description` VARCHAR(255) DEFAULT NULL COMMENT '职业描述',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `create_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `update_by` BIGINT DEFAULT NULL COMMENT '更新人',
  PRIMARY KEY (`class_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='职业表';

-- 境界
CREATE TABLE IF NOT EXISTS `realm` (
  `realm_id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '境界id',
  `realm_code` CHAR(64) DEFAULT NULL COMMENT '境界编码',
  `realm_name` CHAR(64) DEFAULT NULL COMMENT '境界名称',
  `realm_world` TINYINT DEFAULT NULL COMMENT '所属位面(1-小世界 2-大世界 3-仙界 4-上层位面)',
  `realm_level` TINYINT DEFAULT NULL COMMENT '位面内境界序号(由低到高)',
  `realm_description` VARCHAR(255) DEFAULT NULL COMMENT '境界描述',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `create_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `update_by` BIGINT DEFAULT NULL COMMENT '更新人',
  PRIMARY KEY (`realm_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='境界表';

-- 角色
CREATE TABLE IF NOT EXISTS `character` (
  `character_id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '角色id',
  `character_name` CHAR(64) DEFAULT NULL COMMENT '角色名称',
  `gender` TINYINT DEFAULT NULL COMMENT '角色性别(1-男 2-女, 见 sys_dict gender)',
  `age` INT DEFAULT NULL COMMENT '角色年龄',
  `race_id` BIGINT DEFAULT NULL COMMENT '种族id(逻辑外键: race.race_id)',
  `race_subsp_id` BIGINT DEFAULT NULL COMMENT '亚种id(逻辑外键: race_subspecies.race_subspecies_id)',
  `class_id` BIGINT DEFAULT NULL COMMENT '职业id(逻辑外键: class.class_id)',
  `realm_id` BIGINT DEFAULT NULL COMMENT '境界id(逻辑外键: realm.realm_id)',
  `character_description` VARCHAR(255) DEFAULT NULL COMMENT '角色描述',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `create_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `update_by` BIGINT DEFAULT NULL COMMENT '更新人',
  PRIMARY KEY (`character_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色';

-- 种族
CREATE TABLE IF NOT EXISTS `race` (
  `race_id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '种族id',
  `race_code` CHAR(64) DEFAULT NULL COMMENT '种族编码',
  `race_name` CHAR(64) DEFAULT NULL COMMENT '种族名称',
  `race_description` VARCHAR(255) DEFAULT NULL COMMENT '种族描述',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `create_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `update_by` BIGINT DEFAULT NULL COMMENT '更新人',
  PRIMARY KEY (`race_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='种族表';

-- 种族的亚种分类
CREATE TABLE IF NOT EXISTS `race_subspecies` (
  `race_subspecies_id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '亚种id',
  `race_id` BIGINT DEFAULT NULL COMMENT '所属种族id(逻辑外键: race.race_id)',
  `race_subspecies_code` CHAR(64) DEFAULT NULL COMMENT '亚种编码',
  `race_subspecies_name` VARCHAR(255) DEFAULT NULL COMMENT '亚种名称',
  `race_subspecies_description` VARCHAR(255) DEFAULT NULL COMMENT '亚种描述',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `create_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `update_by` BIGINT DEFAULT NULL COMMENT '更新人',
  PRIMARY KEY (`race_subspecies_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='亚种分类表';

-- 门派
CREATE TABLE IF NOT EXISTS `sect` (
  `sect_id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '门派id',
  `sect_code` CHAR(64) DEFAULT NULL COMMENT '门派编码',
  `sect_name` VARCHAR(255) DEFAULT NULL COMMENT '门派名称',
  `sect_realm` TINYINT DEFAULT NULL COMMENT '门派所在位面(见 sys_dict sect_realm)',
  `sect_region` VARCHAR(255) DEFAULT NULL COMMENT '门派驻地/地盘',
  `sect_leader_id` BIGINT DEFAULT NULL COMMENT '掌门角色id(逻辑外键: character.character_id)',
  `sect_level` TINYINT DEFAULT NULL COMMENT '门派等级',
  `sect_style` VARCHAR(64) DEFAULT NULL COMMENT '门派流派倾向(如剑修/丹修/器修/阵修)',
  `sect_tenet` VARCHAR(255) DEFAULT NULL COMMENT '门规/宗旨',
  `sect_status` TINYINT(1) DEFAULT 1 COMMENT '门派状态(1-存续 0-解散)',
  `sect_description` VARCHAR(255) DEFAULT NULL COMMENT '门派描述',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `create_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `update_by` BIGINT DEFAULT NULL COMMENT '更新人',
  PRIMARY KEY (`sect_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='门派表';

-- 门派职务
CREATE TABLE IF NOT EXISTS `sect_position` (
  `position_id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '职务id',
  `position_code` CHAR(64) DEFAULT NULL COMMENT '职务编码',
  `position_name` CHAR(64) DEFAULT NULL COMMENT '职务名称',
  `position_description` VARCHAR(255) DEFAULT NULL COMMENT '职务描述',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `create_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `update_by` BIGINT DEFAULT NULL COMMENT '更新人',
  PRIMARY KEY (`position_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='门派职务表';

-- 门派成员(角色-门派关系表)
CREATE TABLE IF NOT EXISTS `sect_member` (
  `sect_member_id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '门派成员id',
  `sect_id` BIGINT DEFAULT NULL COMMENT '门派id(逻辑外键: sect.sect_id)',
  `character_id` BIGINT DEFAULT NULL COMMENT '角色id(逻辑外键: character.character_id)',
  `member_name` VARCHAR(64) DEFAULT NULL COMMENT '门派内名称/道号',
  `position_id` BIGINT DEFAULT NULL COMMENT '门派职务id(逻辑外键: sect_position.position_id)',
  `sect_contribution` BIGINT DEFAULT 0 COMMENT '门派贡献值',
  `join_time` DATETIME DEFAULT NULL COMMENT '入门时间',
  `leave_time` DATETIME DEFAULT NULL COMMENT '离开时间',
  `member_status` TINYINT(1) DEFAULT 1 COMMENT '成员状态(1-在门 0-已离开)',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `create_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `update_by` BIGINT DEFAULT NULL COMMENT '更新人',
  PRIMARY KEY (`sect_member_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='门派成员表';

-- 系统字典
CREATE TABLE IF NOT EXISTS `sys_dict` (
  `dict_id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '字典id',
  `dict_type` VARCHAR(64) NOT NULL COMMENT '字典类型',
  `dict_code` VARCHAR(64) NOT NULL COMMENT '字典编码',
  `dict_name` VARCHAR(64) NOT NULL COMMENT '字典名称',
  `dict_sort` TINYINT DEFAULT 0 COMMENT '排序',
  `dict_status` TINYINT(1) DEFAULT 1 COMMENT '状态(1-启用 0-停用)',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `create_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `update_by` BIGINT DEFAULT NULL COMMENT '更新人',
  PRIMARY KEY (`dict_id`),
  UNIQUE KEY `uk_dict_type_code` (`dict_type`, `dict_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统字典表';

-- 用户(create_by/update_by 逻辑外键目标, 登录功能后续实现)
CREATE TABLE IF NOT EXISTS `user` (
  `user_id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '用户id',
  `username` VARCHAR(64) NOT NULL COMMENT '用户名',
  `password_hash` VARCHAR(255) DEFAULT NULL COMMENT '密码哈希(预留)',
  `display_name` VARCHAR(64) DEFAULT NULL COMMENT '显示名称',
  `user_status` TINYINT(1) DEFAULT 1 COMMENT '状态(1-启用 0-停用)',
  `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `create_by` BIGINT DEFAULT NULL COMMENT '创建人',
  `update_by` BIGINT DEFAULT NULL COMMENT '更新人',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uk_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 错误代码表字段定义待补充
