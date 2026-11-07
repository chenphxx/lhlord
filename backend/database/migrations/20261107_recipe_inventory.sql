SET NAMES utf8mb4;

USE `lhlord`;

DROP PROCEDURE IF EXISTS `lhlord_add_recipe_column`;

DELIMITER $$

CREATE PROCEDURE `lhlord_add_recipe_column`()
BEGIN
    IF NOT EXISTS
    (
        SELECT 1
          FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'pill_recipe'
           AND COLUMN_NAME = 'recipe_item_id'
    )
    THEN
        ALTER TABLE `pill_recipe`
            ADD COLUMN `recipe_item_id` BIGINT DEFAULT NULL
            COMMENT '丹方物品id(逻辑外键: item.item_id)' AFTER `pill_id`;
    END IF;
END$$

DELIMITER ;

CALL `lhlord_add_recipe_column`();
DROP PROCEDURE IF EXISTS `lhlord_add_recipe_column`;

SET @index_ddl = IF(
    EXISTS
    (
        SELECT 1
          FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'pill_recipe'
           AND INDEX_NAME = 'uk_pill_recipe_item'
    ),
    'SELECT 1',
    'ALTER TABLE `pill_recipe` ADD UNIQUE KEY `uk_pill_recipe_item` (`recipe_item_id`)'
);
PREPARE stmt FROM @index_ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO `item_category`
    (`item_category_id`, `item_category_code`, `item_category_name`, `item_category_description`)
VALUES
    (12, 'CAT_RECIPE', '丹方', '记录丹药炼制药性要求的可收藏物品')
ON DUPLICATE KEY UPDATE
    `item_category_code` = VALUES(`item_category_code`),
    `item_category_name` = VALUES(`item_category_name`),
    `item_category_description` = VALUES(`item_category_description`);

INSERT INTO `item`
    (`item_id`, `item_code`, `item_category_id`, `item_name`, `quality`, `level`, `description`)
VALUES
    (137, 'RECIPE_HUICHUN',   12, '回春丹方',   1, 1,  '记载回春丹的主药, 辅药与药引要求'),
    (138, 'RECIPE_JULING',    12, '聚灵丹方',   2, 2,  '记载聚灵丹的完整药性配比'),
    (139, 'RECIPE_PEIYUAN',   12, '培元丹方',   3, 3,  '记载培元丹的完整药性配比'),
    (140, 'RECIPE_POJING',    12, '破境丹方',   4, 4,  '记载破境丹的完整药性配比'),
    (141, 'RECIPE_NINGYING',  12, '凝婴丹方',   5, 5,  '记载凝婴丹的完整药性配比'),
    (142, 'RECIPE_KUANGBAO',  12, '狂暴丹方',   3, 3,  '记载狂暴丹的完整药性配比'),
    (143, 'RECIPE_JUSHEN',    12, '聚神丹方',   4, 4,  '记载聚神丹的完整药性配比'),
    (144, 'RECIPE_XUANBING',  12, '玄冰丹方',   4, 4,  '记载玄冰丹的完整药性配比'),
    (145, 'RECIPE_JIANXIN',   12, '剑心丹方',   5, 5,  '记载剑心丹的完整药性配比'),
    (146, 'RECIPE_LEIJIE',    12, '雷劫丹方',   5, 5,  '记载雷劫丹的完整药性配比'),
    (147, 'RECIPE_HUASHEN',   12, '化神丹方',   6, 6,  '记载化神丹的完整药性配比'),
    (148, 'RECIPE_LIANXU',    12, '炼虚丹方',   7, 7,  '记载炼虚丹的完整药性配比'),
    (149, 'RECIPE_HETI',      12, '合体丹方',   8, 8,  '记载合体丹的完整药性配比'),
    (150, 'RECIPE_DACHENG',   12, '大乘丹方',   9, 9,  '记载大乘丹的完整药性配比'),
    (151, 'RECIPE_RENXIAN',   12, '人仙丹方',   10, 10, '记载人仙丹的完整药性配比'),
    (152, 'RECIPE_ZHENXIAN',  12, '真仙丹方',   11, 11, '记载真仙丹的完整药性配比'),
    (153, 'RECIPE_TIANXIAN',  12, '天仙丹方',   12, 12, '记载天仙丹的完整药性配比'),
    (154, 'RECIPE_TIANXIN',   12, '天心丹方',   7, 7,  '记载天心丹的完整药性配比'),
    (155, 'RECIPE_LEIYIN',    12, '雷音剑丹方', 8, 8,  '记载雷音剑丹的完整药性配比'),
    (156, 'RECIPE_XUANHUANG', 12, '玄黄丹方',   9, 9,  '记载玄黄丹的完整药性配比'),
    (157, 'RECIPE_XINGHE',    12, '星河丹方',   10, 10, '记载星河丹的完整药性配比')
ON DUPLICATE KEY UPDATE
    `item_code` = VALUES(`item_code`),
    `item_category_id` = VALUES(`item_category_id`),
    `item_name` = VALUES(`item_name`),
    `quality` = VALUES(`quality`),
    `level` = VALUES(`level`),
    `description` = VALUES(`description`);

UPDATE `pill_recipe` SET `recipe_item_id` =
    CASE `pill_id`
        WHEN 61 THEN 137
        WHEN 63 THEN 138
        WHEN 64 THEN 139
        WHEN 65 THEN 140
        WHEN 66 THEN 141
        WHEN 67 THEN 142
        WHEN 105 THEN 143
        WHEN 106 THEN 144
        WHEN 107 THEN 145
        WHEN 108 THEN 146
        WHEN 113 THEN 147
        WHEN 114 THEN 148
        WHEN 115 THEN 149
        WHEN 116 THEN 150
        WHEN 117 THEN 151
        WHEN 118 THEN 152
        WHEN 119 THEN 153
        WHEN 133 THEN 154
        WHEN 134 THEN 155
        WHEN 135 THEN 156
        WHEN 136 THEN 157
        ELSE `recipe_item_id`
    END
WHERE `pill_id` IN (61, 63, 64, 65, 66, 67, 105, 106, 107, 108, 113, 114, 115, 116, 117, 118, 119, 133, 134, 135, 136);

INSERT INTO `character_inventory` (`character_id`, `item_id`, `quantity`)
SELECT gs.`character_id`, pr.`recipe_item_id`, 1
  FROM `game_save` gs
  JOIN `pill_recipe` pr ON pr.`recipe_item_id` IS NOT NULL
ON DUPLICATE KEY UPDATE `quantity` = GREATEST(`quantity`, 1);
