SET NAMES utf8mb4;

-- 初始化种子数据: 种族 / 天赋 / 职业 / 门派职务 / 门派 / 字典 / 用户
-- 依赖 backend/database/schema/init.sql 已执行(先建表, 再导数据)
-- 使用方法: mysql -u root -p < init_seed.sql
-- 说明: 均使用 INSERT IGNORE, 可重复执行, 不会覆盖已存在的数据

USE `lhlord`;

-- 种族
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

-- 天赋
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

-- 职业
INSERT IGNORE INTO `class` (`class_id`, `class_code`, `class_name`, `class_description`) VALUES
(1, 'CLASS_SWORDSMAN', '剑修', '以剑入道, 攻伐凌厉'),
(2, 'CLASS_BODY',      '体修', '淬炼肉身, 以力证道'),
(3, 'CLASS_QI',        '气修', '御气修行, 法术广博'),
(4, 'CLASS_ALCHEMIST', '丹修', '精研丹道的炼丹师'),
(5, 'CLASS_FORGER',    '器修', '精于炼器的炼器师'),
(6, 'CLASS_TALISMAN',  '符修', '精于刻画灵纹的炼符师'),
(7, 'CLASS_FORMATION', '阵修', '精研阵法的阵道修士'),
(8, 'CLASS_SPIRIT',    '神修', '专修神魂与神念的修士');

-- 境界(参考 docs/背景信息/境界.md)
INSERT IGNORE INTO `realm` (`realm_id`, `realm_code`, `realm_name`, `realm_world`, `realm_level`, `realm_description`) VALUES
-- 小世界(天道规则不完整, 最高化神)
(1,  'REALM_LIANQI',    '炼气',   1, 1, '刚踏入修仙世界'),
(2,  'REALM_ZHUJI',     '筑基',   1, 2, '筑就道基, 灵气凝于丹田'),
(3,  'REALM_JINDAN',    '金丹',   1, 3, '体内凝聚金丹'),
(4,  'REALM_YUANYING',  '元婴',   1, 4, '修出元婴, 元婴不灭, 修士不灭'),
(5,  'REALM_HUASHEN',   '化神',   1, 5, '被小世界天道察觉, 全力出手则会被天道排斥, 有强制飞升的风险'),
-- 大世界(飞升而来, 天道规则完整)
(6,  'REALM_LIANXU',    '炼虚',   2, 1, '炼虚合道, 感悟天地'),
(7,  'REALM_HETI',      '合体',   2, 2, '神魂与肉身合一, 实力大增'),
(8,  'REALM_DACHENG',   '大乘',   2, 3, '大乘圆满, 距离飞升一步之遥'),
(9,  'REALM_DUJIE',     '渡劫',   2, 4, '大世界仙道顶点, 所求均是早日飞升仙界'),
-- 仙界(修炼仙气, 资源纯粹)
(10, 'REALM_RENXIAN',   '人仙',   3, 1, '飞升仙界, 褪凡为仙'),
(11, 'REALM_ZHENXIAN',  '真仙',   3, 2, '仙体稳固, 掌握仙法'),
(12, 'REALM_TIANXIAN',  '天仙',   3, 3, '仙法通玄, 可开宗立派'),
(13, 'REALM_XUANXIAN',  '玄仙',   3, 4, '参悟玄妙, 仙界一方强者'),
(14, 'REALM_SHENGXIAN', '圣仙',   3, 5, '仙界顶点, 圣人之姿'),
-- 上层位面(参悟法则与大道)
(15, 'REALM_HUNDUNXIAN', '混沌仙', 4, 1, '于混沌中开辟己道'),
(16, 'REALM_JINXIAN',    '金仙',   4, 2, '大道不朽, 万法不侵'),
(17, 'REALM_ZHIZUNXIAN', '至尊仙', 4, 3, '至尊仙中的至强者可被称作至尊, 一般是统御一个种族的存在'),
(18, 'REALM_XIANDI',     '仙帝',   4, 4, '现有修炼体系的尽头, 仙帝与仙帝亦有差距');

-- 门派职务
INSERT IGNORE INTO `sect_position` (`position_id`, `position_code`, `position_name`, `position_description`) VALUES
(1, 'POS_LEADER',   '掌门', '门派最高掌权者'),
(2, 'POS_ELDER',    '长老', '门派核心决策层'),
(3, 'POS_STEWARD',  '执事', '负责门派日常事务'),
(4, 'POS_DISCIPLE', '弟子', '普通入门弟子');

-- 门派
INSERT IGNORE INTO `sect` (`sect_id`, `sect_code`, `sect_name`, `sect_realm`, `sect_region`, `sect_leader_id`, `sect_level`, `sect_style`, `sect_tenet`, `sect_status`, `sect_description`) VALUES
(1, 'SECT_QINGYUN',   '青云宗',   1, '青云山脉', NULL, 3, '剑修', '剑心澄明, 守正辟邪',        1, '小世界正道大派, 剑修云集, 门下弟子需轮值灵田与守山'),
(2, 'SECT_DANXIA',    '丹霞谷',   1, '丹霞山',   NULL, 2, '丹修', '丹道济世, 医者仁心',        1, '小世界丹道圣地, 弟子日常负责种植灵药与炼丹'),
(3, 'SECT_XUANTIE',   '玄铁门',   1, '玄铁峰',   NULL, 2, '器修', '百炼成钢, 器道通神',        1, '小世界炼器名门, 以锻造法器闻名, 弟子多习炼器之术'),
(4, 'SECT_TIANJI',    '天机阁',   1, '天机峰',   NULL, 1, '阵修', '推演天机, 阵法通玄',        1, '小世界隐世宗门, 精研阵法与推演之道'),
(5, 'SECT_TAIXU',     '太虚剑派', 2, '太虚山',   NULL, 5, '剑修', '一剑破万法',                1, '大世界剑道巨擘, 一剑可裂苍穹'),
(6, 'SECT_WANYAO',    '万妖盟',   2, '万妖岭',   NULL, 4, '体修', '万妖共主, 自强不息',        1, '大世界妖族联盟, 统领万妖, 以肉身与天赋神通见长'),
(7, 'SECT_ZIXIAO',    '紫霄宫',   3, '紫霄天',   NULL, 6, '法修', '紫气东来, 道法自然',        1, '仙界顶级仙门, 弟子修习正统仙法, 坐拥仙脉灵田'),
(8, 'SECT_HUNDUN',    '混沌圣殿', 4, '混沌海',   NULL, 8, '混元', '参悟混元, 道临诸天',        1, '上层位面神秘圣地, 殿中修士皆参悟法则与大道');

-- 系统字典
INSERT IGNORE INTO `sys_dict` (`dict_type`, `dict_code`, `dict_name`, `dict_sort`, `dict_status`) VALUES
('gender', '1', '男', 1, 1), ('gender', '2', '女', 2, 1),
('sect_realm', '1', '小世界', 1, 1), ('sect_realm', '2', '大世界', 2, 1), ('sect_realm', '3', '仙界', 3, 1), ('sect_realm', '4', '上层位面', 4, 1),
('sect_status', '1', '存续', 1, 1), ('sect_status', '0', '解散', 2, 1),
('member_status', '1', '在门', 1, 1), ('member_status', '0', '已离开', 2, 1),
('user_status', '1', '启用', 1, 1), ('user_status', '0', '停用', 2, 1),
('item_quality', '1', '银白', 1, 1), ('item_quality', '2', '灰白', 2, 1), ('item_quality', '3', '青铜', 3, 1),
('item_quality', '4', '碧绿', 4, 1), ('item_quality', '5', '天蓝', 5, 1), ('item_quality', '6', '紫韵', 6, 1),
('item_quality', '7', '橙金', 7, 1), ('item_quality', '8', '鎏金', 8, 1), ('item_quality', '9', '赤金', 9, 1),
('item_quality', '10', '七彩', 10, 1), ('item_quality', '11', '虹霓', 11, 1), ('item_quality', '12', '赤红', 12, 1),
('material_attribute', 'JIN', '金', 1, 1), ('material_attribute', 'MU', '木', 2, 1), ('material_attribute', 'SHUI', '水', 3, 1),
('material_attribute', 'HUO', '火', 4, 1), ('material_attribute', 'TU', '土', 5, 1), ('material_attribute', 'SHENNIAN', '神念', 6, 1),
('material_attribute', 'JIAN', '剑', 7, 1), ('material_attribute', 'HUNYUAN', '混元', 8, 1),
('material_type', 'PILIN', '皮/鳞片', 1, 1), ('material_type', 'YAGU', '牙/骨', 2, 1), ('material_type', 'LINGWU', '灵物', 3, 1),
('material_type', 'JINSHU', '金属', 4, 1), ('material_type', 'SHI', '石', 5, 1),
('material_yin_yang', 'TIANYANG', '天阳', 1, 1), ('material_yin_yang', 'DIYIN', '地阴', 2, 1),
('herb_guide_effect', 'PING', '性平', 1, 1), ('herb_guide_effect', 'HAN', '性寒', 2, 1), ('herb_guide_effect', 'RE', '性热', 3, 1);

-- 用户(登录功能后续实现, 密码哈希暂为空)
INSERT IGNORE INTO `user` (`user_id`, `username`, `password_hash`, `display_name`, `user_status`) VALUES
(1, 'admin', NULL, '管理员', 1);

-- 角色(示例修士, 境界按年龄与职位设定)
INSERT IGNORE INTO `character` (`character_id`, `character_name`, `gender`, `age`, `race_id`, `class_id`, `realm_id`, `character_description`) VALUES
(1,  '林清玄', 1, 28,  1, 1, 2,  '青云宗剑修弟子, 悟性出众, 剑心澄明'),
(2,  '苏云裳', 2, 24,  1, 4, 2,  '丹霞谷丹修弟子, 精通草木药理'),
(3,  '铁如山', 1, 42,  1, 2, 3,  '体修, 肉身强横, 玄铁门执事'),
(4,  '白灵',   2, 320, 2, 8, 7,  '妖族大修, 神念通玄, 万妖盟之主'),
(5,  '陆沉舟', 1, 35,  1, 7, 4,  '阵修, 天机阁掌门, 善推演天机'),
(6,  '阿蛮',   2, 19,  2, 2, 3,  '妖族少女, 天生神力, 拜入万妖盟'),
(7,  '墨渊',   1, 580, 3, 1, 8,  '魔族剑修, 性情孤傲, 大世界散修, 曾入太虚剑派后离门'),
(8,  '云中鹤', 1, 120, 2, 3, 6,  '妖族气修, 身法如风, 太虚剑派弟子'),
(9,  '玄清',   1, 2000, 8, 3, 11, '仙族气修, 紫霄宫长老, 道法高深'),
(10, '火灵儿', 2, 88,  4, 5, 3,  '灵族化形, 天生控火, 师从玄铁门炼器'),
(11, '敖烈',   1, 800, 6, 1, 7,  '龙族血脉, 剑道天赋卓绝, 太虚剑派弟子'),
(12, '凤九歌', 2, 300, 7, 4, 5,  '凤族血脉, 涅槃重生, 丹霞谷掌门');

-- 门派成员(角色-门派关系, 含已离开历史记录)
INSERT IGNORE INTO `sect_member` (`sect_member_id`, `sect_id`, `character_id`, `member_name`, `position_id`, `sect_contribution`, `join_time`, `leave_time`, `member_status`) VALUES
(1,  1, 1,  '清玄子',   4, 1200,  '2024-03-15 08:00:00', NULL,                1),
(2,  2, 2,  '云裳',     4, 800,   '2025-01-20 08:00:00', NULL,                1),
(3,  3, 3,  '铁山',     3, 3500,  '2019-06-01 08:00:00', NULL,                1),
(4,  6, 4,  '灵狐仙',   1, 20000, '2001-11-11 08:00:00', NULL,                1),
(5,  4, 5,  '沉舟道人', 1, 8800,  '2018-02-14 08:00:00', NULL,                1),
(6,  6, 6,  '蛮蛮',     4, 500,   '2025-05-05 08:00:00', NULL,                1),
(7,  5, 7,  '墨渊',     4, 1500,  '2015-08-08 08:00:00', '2020-09-09 08:00:00', 0),
(8,  5, 8,  '鹤仙',     4, 2300,  '2023-07-07 08:00:00', NULL,                1),
(9,  7, 9,  '玄清真人', 2, 99999, '1990-01-01 08:00:00', NULL,                1),
(10, 3, 10, '灵火',     4, 900,   '2024-10-10 08:00:00', NULL,                1),
(11, 5, 11, '敖烈',     4, 3100,  '2022-12-12 08:00:00', NULL,                1),
(12, 2, 12, '九歌',     1, 45000, '2005-03-03 08:00:00', NULL,                1);

-- 门派掌门指向示例角色
UPDATE `sect` SET `sect_leader_id` = 12 WHERE `sect_id` = 2;
UPDATE `sect` SET `sect_leader_id` = 5  WHERE `sect_id` = 4;
UPDATE `sect` SET `sect_leader_id` = 4  WHERE `sect_id` = 6;
