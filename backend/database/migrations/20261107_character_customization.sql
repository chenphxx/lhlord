SET NAMES utf8mb4;

USE `lhlord`;

DROP PROCEDURE IF EXISTS `lhlord_add_column_if_missing`;
DROP PROCEDURE IF EXISTS `lhlord_drop_column_if_exists`;

DELIMITER $$

CREATE PROCEDURE `lhlord_add_column_if_missing`
(
    IN p_table_name VARCHAR(64),
    IN p_column_name VARCHAR(64),
    IN p_column_definition TEXT
)
BEGIN
    IF NOT EXISTS
    (
        SELECT 1
          FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = p_table_name
           AND COLUMN_NAME = p_column_name
    )
    THEN
        SET @ddl = CONCAT(
            'ALTER TABLE `', p_table_name, '` ADD COLUMN `', p_column_name, '` ', p_column_definition
        );
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$

CREATE PROCEDURE `lhlord_drop_column_if_exists`
(
    IN p_table_name VARCHAR(64),
    IN p_column_name VARCHAR(64)
)
BEGIN
    IF EXISTS
    (
        SELECT 1
          FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = p_table_name
           AND COLUMN_NAME = p_column_name
    )
    THEN
        SET @ddl = CONCAT('ALTER TABLE `', p_table_name, '` DROP COLUMN `', p_column_name, '`');
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$

DELIMITER ;

CALL `lhlord_add_column_if_missing`('race', 'aptitude_bonus', 'INT DEFAULT 0 COMMENT ''资质加成''');
CALL `lhlord_add_column_if_missing`('race', 'comprehension_bonus', 'INT DEFAULT 0 COMMENT ''悟性加成''');
CALL `lhlord_add_column_if_missing`('race', 'max_hp_bonus', 'INT DEFAULT 0 COMMENT ''气血加成''');
CALL `lhlord_add_column_if_missing`('race', 'attack_bonus', 'INT DEFAULT 0 COMMENT ''攻击加成''');
CALL `lhlord_add_column_if_missing`('race', 'defense_bonus', 'INT DEFAULT 0 COMMENT ''防御加成''');
CALL `lhlord_add_column_if_missing`('race', 'cultivation_bonus', 'INT DEFAULT 0 COMMENT ''修炼效率加成(百分比)''');

CREATE TABLE IF NOT EXISTS `talent` (
    `talent_id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '天赋id',
    `talent_code` CHAR(64) NOT NULL COMMENT '天赋编码',
    `talent_name` CHAR(64) NOT NULL COMMENT '天赋名称',
    `talent_description` VARCHAR(255) DEFAULT NULL COMMENT '天赋描述',
    `rarity` VARCHAR(16) DEFAULT '凡品' COMMENT '天赋稀有度',
    `aptitude_bonus` INT DEFAULT 0 COMMENT '资质加成',
    `comprehension_bonus` INT DEFAULT 0 COMMENT '悟性加成',
    `max_hp_bonus` INT DEFAULT 0 COMMENT '气血加成',
    `attack_bonus` INT DEFAULT 0 COMMENT '攻击加成',
    `defense_bonus` INT DEFAULT 0 COMMENT '防御加成',
    `cultivation_bonus` INT DEFAULT 0 COMMENT '修炼效率加成(百分比)',
    `alchemy_bonus` INT DEFAULT 0 COMMENT '炼丹效率加成(百分比)',
    `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`talent_id`),
    UNIQUE KEY `uk_talent_code` (`talent_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='天赋定义表';

CREATE TABLE IF NOT EXISTS `character_talent` (
    `character_id` BIGINT NOT NULL COMMENT '角色id(逻辑外键: character.character_id)',
    `talent_id` BIGINT NOT NULL COMMENT '天赋id(逻辑外键: talent.talent_id)',
    `acquired_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '获得时间',
    PRIMARY KEY (`character_id`, `talent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色天赋关系表';

CALL `lhlord_drop_column_if_exists`('character', 'race_subsp_id');
DROP TABLE IF EXISTS `race_subspecies`;

DROP PROCEDURE IF EXISTS `lhlord_add_column_if_missing`;
DROP PROCEDURE IF EXISTS `lhlord_drop_column_if_exists`;

INSERT INTO `race`
    (`race_id`, `race_code`, `race_name`, `race_description`,
     `aptitude_bonus`, `comprehension_bonus`, `max_hp_bonus`, `attack_bonus`, `defense_bonus`, `cultivation_bonus`)
VALUES
(1, 'RACE_HUMAN',  '人族', '万物之灵, 灵根资质参差但悟性出众, 修炼体系最为完善', 0, 2, 0, 0, 0, 0),
(2, 'RACE_YAOZU',  '妖族', '草木禽兽开智修炼而成, 肉身强横, 寿命悠长', 1, 0, 30, 1, 1, 0),
(3, 'RACE_MOZU',   '魔族', '生于魔渊煞气, 好战嗜杀, 肉身与神魂同修', 1, 1, 10, 3, 0, 2),
(4, 'RACE_LINGZU', '灵族', '天地灵物所化, 天生亲和五行灵气, 灵体纯净', 0, 3, 0, 0, 1, 3),
(5, 'RACE_GUIZU',  '鬼族', '神魂凝聚所成, 擅长神魂之术与隐匿潜行', 0, 4, -10, 0, 0, 1),
(6, 'RACE_LONGZU', '龙族', '上古神兽后裔, 肉身冠绝万族, 血脉神通强大', 2, 0, 50, 2, 3, 2),
(7, 'RACE_FENGZU', '凤族', '上古神鸟后裔, 火属性亲和, 拥有涅槃重生之能', 1, 2, 20, 1, 1, 4),
(8, 'RACE_XIANZU', '仙族', '仙界原生种族, 天生仙体, 生而亲和仙气', 3, 3, 20, 1, 2, 5)
ON DUPLICATE KEY UPDATE
    `race_code` = VALUES(`race_code`),
    `race_name` = VALUES(`race_name`),
    `race_description` = VALUES(`race_description`),
    `aptitude_bonus` = VALUES(`aptitude_bonus`),
    `comprehension_bonus` = VALUES(`comprehension_bonus`),
    `max_hp_bonus` = VALUES(`max_hp_bonus`),
    `attack_bonus` = VALUES(`attack_bonus`),
    `defense_bonus` = VALUES(`defense_bonus`),
    `cultivation_bonus` = VALUES(`cultivation_bonus`);

INSERT INTO `talent`
    (`talent_id`, `talent_code`, `talent_name`, `talent_description`, `rarity`,
     `aptitude_bonus`, `comprehension_bonus`, `max_hp_bonus`, `attack_bonus`, `defense_bonus`,
     `cultivation_bonus`, `alchemy_bonus`)
VALUES
(1, 'TALENT_CLEAR_MIND',   '灵台清明', '灵台无尘, 悟性出众',          '凡品', 0, 3, 0, 0, 0, 0, 0),
(2, 'TALENT_HEAVENLY_ROOT','天资卓绝', '天生修道之资, 修炼事半功倍',  '上品', 3, 1, 0, 0, 0, 4, 0),
(3, 'TALENT_LONG_BREATH',  '气脉绵长', '经脉宽阔, 周天运转更加顺畅',  '中品', 1, 1, 10, 0, 0, 6, 0),
(4, 'TALENT_IRON_BONE',    '铜皮铁骨', '肉身坚韧, 气血充盈',          '中品', 0, 0, 60, 2, 4, 0, 0),
(5, 'TALENT_GOD_STRENGTH', '天生神力', '力大无穷, 攻伐凌厉',          '中品', 0, 0, 20, 6, 0, 0, 0),
(6, 'TALENT_ALCHEMY_HEART','丹心通明', '天生亲近药性, 精于炉火',      '上品', 1, 2, 0, 0, 0, 0, 12),
(7, 'TALENT_SPIRIT_SENSE', '神识敏锐', '神魂感知远超同辈',            '中品', 0, 4, 0, 0, 1, 1, 0),
(8, 'TALENT_BALANCED_ROOT','五行调和', '五行灵根协调, 根基稳固',      '极品', 2, 2, 20, 2, 2, 3, 3)
ON DUPLICATE KEY UPDATE
    `talent_code` = VALUES(`talent_code`),
    `talent_name` = VALUES(`talent_name`),
    `talent_description` = VALUES(`talent_description`),
    `rarity` = VALUES(`rarity`),
    `aptitude_bonus` = VALUES(`aptitude_bonus`),
    `comprehension_bonus` = VALUES(`comprehension_bonus`),
    `max_hp_bonus` = VALUES(`max_hp_bonus`),
    `attack_bonus` = VALUES(`attack_bonus`),
    `defense_bonus` = VALUES(`defense_bonus`),
    `cultivation_bonus` = VALUES(`cultivation_bonus`),
    `alchemy_bonus` = VALUES(`alchemy_bonus`);

