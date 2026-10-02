USE `lhlord`;

UPDATE `item`
SET `quality` = `level`
WHERE `level` IS NOT NULL
  AND `quality` <> `level`;

INSERT IGNORE INTO `item`
  (`item_id`, `item_code`, `item_category_id`, `item_name`, `quality`, `level`, `description`)
VALUES
  (95, 'HERB_LONGXUE',    1, '龙血草',   5, 5, '龙血浸染而生, 活血续脉, 兼具锻体之效'),
  (96, 'HERB_TIANLEI',    1, '天雷竹',   5, 5, '雷击竹节而成, 御气凝剑意'),
  (97, 'HERB_XINGCHEN',   1, '星辰花',   6, 6, '夜沐星辉, 聚元开悟'),
  (98, 'HERB_YUEHUA',     1, '月华草',   4, 4, '月华凝露而生, 生息养魂'),
  (99, 'HERB_DIXIN',      1, '地心莲',   4, 4, '生于地火岩浆, 聚元强火'),
  (100, 'HERB_XUANBING',  1, '玄冰花',   4, 4, '玄冰之中绽放, 净血强水'),
  (101, 'HERB_JIUYE',     1, '九叶剑草', 6, 6, '九叶如剑, 御气凝剑意'),
  (102, 'HERB_ZIJIN',     1, '紫金藤',   5, 5, '紫金之气缠绕, 炼魔固元'),
  (103, 'HERB_HUIYANG',   1, '回阳花',   3, 3, '回阳救逆, 生息培元'),
  (104, 'HERB_WANGYOU',   1, '忘忧花',   3, 3, '清心忘忧, 生息养神'),
  (105, 'PILL_JUSHEN',    3, '聚神丹',   4, 4, '开悟凝神, 提升悟性'),
  (106, 'PILL_XUANBING',  3, '玄冰丹',   4, 4, '玄冰入药, 疗伤护脉'),
  (107, 'PILL_JIANXIN',   3, '剑心丹',   5, 5, '剑意入丹, 提升攻伐'),
  (108, 'PILL_LEIJIE',    3, '雷劫丹',   5, 5, '避劫护道, 提升突破成功率'),
  (109, 'HERB_HUNDUN',    1, '混沌草',   9, 9, '生于混沌边缘, 聚元避劫'),
  (110, 'HERB_DALUO',     1, '大罗仙芝', 10, 10, '大罗仙气凝成, 聚元化神'),
  (111, 'HERB_HUNYUANGUO',1, '混元道果', 11, 11, '混元大道所结, 聚元道蕴'),
  (112, 'HERB_BUXIU',     1, '不朽仙莲', 12, 12, '不朽仙气孕育, 生息益寿'),
  (113, 'PILL_HUASHEN',   3, '化神丹',   6, 6, '辅助化神突破'),
  (114, 'PILL_LIANXU',    3, '炼虚丹',   7, 7, '辅助炼虚突破'),
  (115, 'PILL_HETI',      3, '合体丹',   8, 8, '辅助合体突破'),
  (116, 'PILL_DACHENG',   3, '大乘丹',   9, 9, '辅助大乘突破'),
  (117, 'PILL_RENXIAN',   3, '人仙丹',   10, 10, '辅助人仙突破'),
  (118, 'PILL_ZHENXIAN',  3, '真仙丹',   11, 11, '辅助真仙突破'),
  (119, 'PILL_TIANXIAN',  3, '天仙丹',   12, 12, '辅助天仙突破'),
  (120, 'FURNACE_ALC_L2', 6, '二级炼丹炉', 2, 2, '容量更大, 火候更稳'),
  (121, 'FURNACE_ALC_L4', 6, '四级炼丹炉', 4, 4, '中品丹炉, 可炼四级丹药'),
  (122, 'FURNACE_ALC_L6', 6, '六级炼丹炉', 6, 6, '上品丹炉, 双主药格'),
  (123, 'FURNACE_ALC_L7', 6, '七级炼丹炉', 7, 7, '上品丹炉, 适合高阶炼制'),
  (124, 'FURNACE_ALC_L8', 6, '八级炼丹炉', 8, 8, '上品丹炉, 火候精纯'),
  (125, 'FURNACE_ALC_L9', 6, '九级炼丹炉', 9, 9, '仙品丹炉, 三辅药格'),
  (126, 'FURNACE_ALC_L10',6, '十级炼丹炉', 10, 10, '仙品丹炉, 双药引格'),
  (127, 'FURNACE_ALC_L11',6, '十一级炼丹炉', 11, 11, '道器丹炉, 可炼十一级丹药'),
  (128, 'FURNACE_ALC_L12',6, '十二级炼丹炉', 12, 12, '至宝丹炉, 可炼十二级丹药'),
  (129, 'HERB_TIANXIN',   1, '天心花',   7, 7, '天心清明, 聚元开悟'),
  (130, 'HERB_LEIYIN',    1, '雷音竹',   8, 8, '雷音入竹, 御气凝剑意'),
  (131, 'HERB_XUANHUANG', 1, '玄黄芝',   9, 9, '玄黄之气凝成, 聚元固元'),
  (132, 'HERB_XINGHE',    1, '星河花',   10, 10, '星河灵光所化, 聚元养魂'),
  (133, 'PILL_TIANXIN',   3, '天心丹',   7, 7, '天心通明, 提升悟性'),
  (134, 'PILL_LEIYIN',    3, '雷音剑丹', 8, 8, '雷音剑意, 提升攻伐'),
  (135, 'PILL_XUANHUANG', 3, '玄黄丹',   9, 9, '玄黄固本, 提升修炼'),
  (136, 'PILL_XINGHE',    3, '星河丹',   10, 10, '星河养魂, 提升修炼');

INSERT IGNORE INTO `pill`
  (`item_id`, `pill_category`, `effect_type`, `base_effect`, `duration`, `toxicity`, `breakthrough_bonus`, `buff_code`)
VALUES
  (61, '疗伤', 'heal', 100, 0, 2, 0, 'HEAL'),
  (62, '疗伤', 'heal', 200, 0, 4, 0, 'HEAL'),
  (63, '修炼', 'buff', 15, 7, 4, 0, 'CULTIVATION_UP'),
  (64, '修炼', 'buff', 20, 7, 6, 0, 'CULTIVATION_UP'),
  (65, '突破', 'breakthrough', 0, 0, 8, 10, NULL),
  (66, '突破', 'breakthrough', 0, 0, 10, 8, NULL),
  (67, '战斗', 'buff', 30, 3, 6, 0, 'ATTACK_UP'),
  (68, '战斗', 'buff', 30, 3, 6, 0, 'DEFENSE_UP'),
  (69, '疗伤', 'toxin_remove', 20, 0, 0, 0, NULL),
  (70, '修炼', 'buff', 10, 30, 10, 0, 'CULTIVATION_UP'),
  (105, '修炼', 'buff', 20, 7, 6, 0, 'COMPREHENSION_UP'),
  (106, '疗伤', 'heal', 300, 0, 8, 0, 'HEAL'),
  (107, '战斗', 'buff', 40, 3, 10, 0, 'ATTACK_UP'),
  (108, '突破', 'breakthrough', 0, 0, 12, 15, NULL),
  (113, '突破', 'breakthrough', 0, 0, 14, 18, NULL),
  (114, '突破', 'breakthrough', 0, 0, 16, 20, NULL),
  (115, '突破', 'breakthrough', 0, 0, 18, 22, NULL),
  (116, '突破', 'breakthrough', 0, 0, 20, 24, NULL),
  (117, '突破', 'breakthrough', 0, 0, 22, 26, NULL),
  (118, '突破', 'breakthrough', 0, 0, 24, 28, NULL),
  (119, '突破', 'breakthrough', 0, 0, 26, 30, NULL),
  (133, '修炼', 'buff', 25, 7, 7, 0, 'COMPREHENSION_UP'),
  (134, '战斗', 'buff', 45, 3, 9, 0, 'ATTACK_UP'),
  (135, '修炼', 'buff', 30, 7, 11, 0, 'CULTIVATION_UP'),
  (136, '修炼', 'buff', 35, 7, 13, 0, 'CULTIVATION_UP');

INSERT IGNORE INTO `pill_recipe`
  (`pill_id`, `recipe_level`, `min_furnace_level`, `base_days`, `status`)
VALUES
  (61, 1, 1, 3, 1),
  (63, 2, 1, 4, 1),
  (64, 3, 1, 5, 1),
  (65, 4, 1, 6, 1),
  (66, 5, 1, 7, 1),
  (67, 3, 1, 5, 1),
  (105, 4, 1, 6, 1),
  (106, 4, 1, 6, 1),
  (107, 5, 1, 7, 1),
  (108, 5, 1, 7, 1),
  (113, 6, 1, 8, 1),
  (114, 7, 1, 9, 1),
  (115, 8, 1, 10, 1),
  (116, 9, 1, 11, 1),
  (117, 10, 1, 12, 1),
  (118, 11, 1, 13, 1),
  (119, 12, 1, 14, 1),
  (133, 7, 1, 9, 1),
  (134, 8, 1, 10, 1),
  (135, 9, 1, 11, 1),
  (136, 10, 1, 12, 1);

INSERT IGNORE INTO `pill_recipe_slot`
  (`recipe_id`, `slot_type`, `slot_index`, `effect_code`, `required_power`)
VALUES
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 61), 'main', 0, '活血', 10),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 61), 'secondary', 0, '固元', 10),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 61), 'guide', 0, '性平', 10),

  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 63), 'main', 0, '聚元', 20),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 63), 'secondary', 0, '炼气', 20),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 63), 'guide', 0, '性平', 10),

  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 64), 'main', 0, '聚元', 40),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 64), 'secondary', 0, '培元', 40),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 64), 'guide', 0, '性平', 20),

  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 65), 'main', 0, '聚元', 80),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 65), 'secondary', 0, '洗髓', 40),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 65), 'secondary', 1, '凝神', 40),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 65), 'guide', 0, '性平', 40),

  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 66), 'main', 0, '聚元', 160),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 66), 'secondary', 0, '凝婴', 80),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 66), 'secondary', 1, '固元', 80),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 66), 'guide', 0, '性平', 80),

  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 67), 'main', 0, '振气', 40),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 67), 'secondary', 0, '锻体', 40),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 67), 'guide', 0, '性平', 20),

  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 105), 'main', 0, '聚元', 80),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 105), 'secondary', 0, '开悟', 40),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 105), 'secondary', 1, '凝神', 40),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 105), 'guide', 0, '性平', 40),

  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 106), 'main', 0, '净血', 80),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 106), 'secondary', 0, '强水', 40),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 106), 'guide', 0, '性平', 40),

  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 107), 'main', 0, '御气', 160),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 107), 'secondary', 0, '剑意', 80),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 107), 'guide', 0, '性平', 80),

  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 108), 'main', 0, '御气', 160),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 108), 'secondary', 0, '避劫', 80),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 108), 'guide', 0, '性平', 80),

  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 113), 'main', 0, '聚元', 320),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 113), 'secondary', 0, '化神', 160),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 113), 'guide', 0, '性平', 160),

  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 114), 'main', 0, '聚元', 640),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 114), 'secondary', 0, '开悟', 320),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 114), 'guide', 0, '性平', 320),

  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 115), 'main', 0, '聚元', 1280),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 115), 'secondary', 0, '养魂', 640),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 115), 'guide', 0, '性平', 640),

  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 116), 'main', 0, '聚元', 2560),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 116), 'secondary', 0, '避劫', 1280),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 116), 'guide', 0, '性平', 1280),

  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 117), 'main', 0, '聚元', 5120),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 117), 'secondary', 0, '化神', 2560),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 117), 'guide', 0, '性平', 2560),

  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 118), 'main', 0, '聚元', 10240),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 118), 'secondary', 0, '道蕴', 5120),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 118), 'guide', 0, '性平', 5120),

  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 119), 'main', 0, '聚元', 20480),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 119), 'secondary', 0, '混元', 10240),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 119), 'guide', 0, '性平', 10240),

  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 133), 'main', 0, '聚元', 640),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 133), 'secondary', 0, '开悟', 320),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 133), 'guide', 0, '性平', 320),

  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 134), 'main', 0, '御气', 1280),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 134), 'secondary', 0, '剑意', 640),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 134), 'guide', 0, '性平', 640),

  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 135), 'main', 0, '聚元', 2560),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 135), 'secondary', 0, '固元', 1280),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 135), 'guide', 0, '性平', 1280),

  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 136), 'main', 0, '聚元', 5120),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 136), 'secondary', 0, '养魂', 2560),
  ((SELECT recipe_id FROM pill_recipe WHERE pill_id = 136), 'guide', 0, '性平', 2560);

INSERT IGNORE INTO `alchemy_furnace`
  (`item_id`, `furnace_level`, `capacity`, `main_slots`, `secondary_slots`, `guide_slots`, `durability`, `heat_stability`)
VALUES
  (80, 1, 9, 1, 2, 1, 100, 0),
  (81, 3, 11, 1, 2, 1, 100, 2),
  (82, 5, 13, 1, 2, 1, 100, 4),
  (120, 2, 10, 1, 2, 1, 100, 1),
  (121, 4, 12, 1, 2, 1, 100, 3),
  (122, 6, 14, 2, 2, 1, 100, 5),
  (123, 7, 15, 2, 2, 1, 100, 6),
  (124, 8, 16, 2, 2, 1, 100, 7),
  (125, 9, 17, 2, 3, 2, 100, 8),
  (126, 10, 18, 2, 3, 2, 100, 9),
  (127, 11, 19, 2, 3, 2, 100, 10),
  (128, 12, 20, 2, 3, 2, 100, 11);

UPDATE `item` i
JOIN `alchemy_furnace` f ON f.item_id = i.item_id
SET i.`level` = f.`furnace_level`, i.`quality` = f.`furnace_level`;

INSERT IGNORE INTO `herb` (`item_id`, `main_effect`, `secondary_effect`, `guide_effect`)
VALUES
  (95, '活血', '锻体', '性热'),
  (96, '御气', '剑意', '性寒'),
  (97, '聚元', '开悟', '性平'),
  (98, '生息', '养魂', '性寒'),
  (99, '聚元', '强火', '性热'),
  (100, '净血', '强水', '性寒'),
  (101, '御气', '剑意', '性平'),
  (102, '炼魔', '固元', '性热'),
  (103, '生息', '培元', '性热'),
  (104, '生息', '清心', '性平'),
  (109, '聚元', '避劫', '性寒'),
  (110, '聚元', '化神', '性平'),
  (111, '聚元', '道蕴', '性平'),
  (112, '生息', '益寿', '性平'),
  (129, '聚元', '开悟', '性平'),
  (130, '御气', '剑意', '性寒'),
  (131, '聚元', '固元', '性平'),
  (132, '聚元', '养魂', '性平');

INSERT IGNORE INTO `buff`
  (`buff_code`, `buff_name`, `stat_key`, `value_type`, `default_value`, `duration`, `description`)
VALUES
  ('HEAL', '治疗', 'hp', 'flat', 100, 0, '立即恢复生命值'),
  ('CULTIVATION_UP', '修炼增益', 'cultivation_efficiency', 'percent', 15, 7, '提升修炼效率'),
  ('ATTACK_UP', '攻击增益', 'attack_percent', 'percent', 30, 3, '提升攻击力'),
  ('DEFENSE_UP', '防御增益', 'defense_percent', 'percent', 30, 3, '提升防御力'),
  ('COMPREHENSION_UP', '悟性增益', 'comprehension', 'percent', 20, 7, '提升悟性');

INSERT IGNORE INTO `character_alchemy_skill`
  (`character_id`, `alchemy_level`, `pharmacology_level`, `fire_control_level`, `tolerance_level`, `success_count`, `best_recipe_level`)
VALUES
  (2, 4, 4, 4, 3, 0, 5),
  (12, 5, 5, 5, 4, 0, 5);

INSERT IGNORE INTO `character_attribute`
  (`character_id`, `aptitude`, `comprehension`, `metal_root`, `wood_root`, `water_root`, `fire_root`, `earth_root`, `max_hp`, `attack`, `defense`)
VALUES
  (2, 18, 20, 8, 14, 12, 16, 10, 320, 28, 24),
  (12, 24, 18, 12, 10, 14, 30, 12, 520, 62, 48);

INSERT IGNORE INTO `character_drug_toxin` (`character_id`, `toxin_value`)
VALUES
  (2, 0),
  (12, 0);

INSERT IGNORE INTO `character_inventory` (`character_id`, `item_id`, `quantity`)
VALUES
  (2, 1, 30),
  (2, 2, 30),
  (2, 3, 20),
  (2, 4, 60),
  (2, 9, 30),
  (2, 12, 30),
  (2, 13, 60),
  (2, 17, 90),
  (2, 20, 60),
  (2, 21, 50),
  (2, 23, 90),
  (2, 31, 30),
  (2, 32, 50),
  (2, 36, 50),
  (2, 40, 30),
  (2, 41, 30),
  (2, 42, 60),
  (2, 95, 30),
  (2, 96, 30),
  (2, 97, 30),
  (2, 98, 30),
  (2, 99, 30),
  (2, 100, 30),
  (2, 101, 30),
  (2, 102, 30),
  (2, 103, 30),
  (2, 104, 30),
  (2, 109, 30),
  (2, 110, 30),
  (2, 111, 30),
  (2, 112, 30),
  (2, 80, 1),
  (2, 81, 1),
  (2, 82, 1);

INSERT IGNORE INTO `character_inventory` (`character_id`, `item_id`, `quantity`)
SELECT 2, `item_id`, 30
FROM `item`
WHERE `item_category_id` = 1;

INSERT IGNORE INTO `spirit_field`
  (`character_id`, `item_id`, `field_level`, `planted_at`, `ready_at`, `status`, `yield`)
VALUES
  (2, 1, 1, NOW(), DATE_ADD(NOW(), INTERVAL 0 DAY), 'ready', 6),
  (2, 17, 1, NOW(), DATE_ADD(NOW(), INTERVAL 0 DAY), 'ready', 6);
