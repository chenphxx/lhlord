USE `lhlord`;

CREATE TABLE IF NOT EXISTS `game_save` (
    `save_id` TINYINT NOT NULL DEFAULT 1 COMMENT '本地单机存档槽位',
    `character_id` BIGINT NOT NULL COMMENT '玩家角色id(逻辑外键: character.character_id)',
    `realm_stage` TINYINT NOT NULL DEFAULT 1 COMMENT '当前境界小境界(1-3)',
    `cultivation` INT NOT NULL DEFAULT 0 COMMENT '当前小境界修为',
    `spirit_stones` INT NOT NULL DEFAULT 100 COMMENT '灵石',
    `day_count` INT NOT NULL DEFAULT 1 COMMENT '已度过天数',
    `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '存档创建时间',
    `update_time` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '存档更新时间',
    PRIMARY KEY (`save_id`),
    UNIQUE KEY `uk_game_save_character` (`character_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='本地单机游戏存档';

CREATE TABLE IF NOT EXISTS `game_event` (
    `event_id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '游戏事件id',
    `save_id` TINYINT NOT NULL DEFAULT 1 COMMENT '存档槽位',
    `event_type` VARCHAR(32) NOT NULL COMMENT '事件类型',
    `title` VARCHAR(64) NOT NULL COMMENT '事件标题',
    `description` VARCHAR(255) NOT NULL COMMENT '事件描述',
    `create_time` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '事件时间',
    PRIMARY KEY (`event_id`),
    KEY `idx_game_event_save` (`save_id`, `event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='单机游戏事件记录';
