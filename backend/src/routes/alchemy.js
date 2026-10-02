import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const int = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
};
const basePower = (level) => 10 * 2 ** (int(level, 1) - 1);

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function notFound(message) {
  const err = new Error(message);
  err.status = 404;
  return err;
}

async function getRecipe(recipeId) {
  const [recipes] = await pool.query(
    `SELECT r.*, i.item_name, i.item_code, i.level, p.pill_category, p.effect_type, p.base_effect,
            p.duration, p.toxicity, p.breakthrough_bonus, p.buff_code
       FROM pill_recipe r
       JOIN item i ON i.item_id = r.pill_id
       JOIN pill p ON p.item_id = r.pill_id
      WHERE r.recipe_id = ?`,
    [recipeId]
  );
  if (recipes.length === 0) throw notFound(`丹方不存在: ${recipeId}`);
  const recipe = recipes[0];
  const [slots] = await pool.query(
    `SELECT slot_type, slot_index, effect_code, required_power
       FROM pill_recipe_slot
      WHERE recipe_id = ?
      ORDER BY FIELD(slot_type, 'main', 'secondary', 'guide'), slot_index`,
    [recipeId]
  );
  recipe.slots = slots;
  return recipe;
}

async function findRecipeForSelected(selected) {
  const [rows] = await pool.query(
    `SELECT recipe_id FROM pill_recipe WHERE status = 1 ORDER BY recipe_level`
  );
  for (const row of rows) {
    const recipe = await getRecipe(row.recipe_id);
    let ok = true;
    for (const slot of recipe.slots) {
      const matched = selected.filter((item) => item.slot_type === slot.slot_type && Number(item.slot_index || 0) === Number(slot.slot_index || 0));
      const power = matched.reduce((sum, item) => {
        if (slot.slot_type === 'guide') return sum + herbPower(item) * Number(item.quantity || 0);
        const effect = slot.slot_type === 'main' ? item.main_effect : item.secondary_effect;
        return effect === slot.effect_code ? sum + herbPower(item) * Number(item.quantity || 0) : sum;
      }, 0);
      if (power < Number(slot.required_power)) {
        ok = false;
        break;
      }
    }
    if (ok) return recipe;
  }
  return null;
}

async function getFurnace(itemId) {
  const [rows] = await pool.query(
    `SELECT i.item_id, i.item_name, i.item_code, i.level, f.*
       FROM item i
       JOIN alchemy_furnace f ON f.item_id = i.item_id
      WHERE i.item_id = ?`,
    [itemId]
  );
  if (rows.length === 0) throw notFound(`炼丹炉不存在: ${itemId}`);
  return rows[0];
}

async function getCharacterSkill(characterId) {
  const [rows] = await pool.query(
    `SELECT * FROM character_alchemy_skill WHERE character_id = ?`,
    [characterId]
  );
  if (rows.length === 0) {
    return {
      character_id: characterId,
      alchemy_level: 1,
      pharmacology_level: 1,
      fire_control_level: 1,
      tolerance_level: 0,
      success_count: 0,
      best_recipe_level: 0,
    };
  }
  return rows[0];
}

async function getInventory(characterId) {
  const [rows] = await pool.query(
    `SELECT ci.inventory_id, ci.item_id, ci.quantity, i.item_name, i.item_code, i.level, i.description,
            h.main_effect, h.secondary_effect, h.guide_effect,
            p.effect_type, p.base_effect, p.breakthrough_bonus, p.toxicity, p.buff_code
       FROM character_inventory ci
       JOIN item i ON i.item_id = ci.item_id
       LEFT JOIN herb h ON h.item_id = ci.item_id
       LEFT JOIN pill p ON p.item_id = ci.item_id
      WHERE ci.character_id = ?
      ORDER BY i.level, i.item_id`,
    [characterId]
  );
  return rows;
}

async function getInventoryMap(characterId) {
  const rows = await getInventory(characterId);
  return new Map(rows.map((r) => [Number(r.item_id), Number(r.quantity)]));
}

function signOf(guideEffect) {
  if (guideEffect === '性寒') return -1;
  if (guideEffect === '性热') return 1;
  return 0;
}

function herbPower(item) {
  return basePower(item.level || 1);
}

function sortByLevel(a, b) {
  return Number(a.level || 1) - Number(b.level || 1) || Number(a.item_id) - Number(b.item_id);
}

async function autoPlan({ recipe, inventory, batchCount }) {
  const remaining = new Map(inventory.map((item) => [Number(item.item_id), Number(item.quantity)]));
  const selected = [];
  const requiredTotal = recipe.slots.reduce((sum, slot) => sum + Number(slot.required_power || 0), 0) * batchCount;

  const pickForEffect = (effectCode, targetPower, slotType, slotIndex) => {
    let need = targetPower;
    const candidates = inventory
      .filter((item) => {
        if ((remaining.get(Number(item.item_id)) || 0) <= 0) return false;
        if (slotType === 'main') return item.main_effect === effectCode;
        if (slotType === 'secondary') return item.secondary_effect === effectCode;
        return false;
      })
      .sort(sortByLevel);

    while (need > 0) {
      const item = candidates.find((candidate) => (remaining.get(Number(candidate.item_id)) || 0) > 0);
      if (!item) {
        throw badRequest(`库存不足, 缺少${slotType === 'main' ? '主药' : '辅药'}药性 ${effectCode}`);
      }
      const available = remaining.get(Number(item.item_id)) || 0;
      const unitPower = herbPower(item);
      const needUnits = Math.ceil(need / unitPower);
      const take = Math.min(needUnits, available);
      if (take <= 0) {
        throw badRequest(`库存不足, 缺少药性 ${effectCode}`);
      }
      selected.push({
        item_id: Number(item.item_id),
        item_name: item.item_name,
        level: Number(item.level || 1),
        guide_effect: item.guide_effect,
        slot_type: slotType,
        slot_index: slotIndex,
        effect_code: effectCode,
        quantity: take,
      });
      remaining.set(Number(item.item_id), available - take);
      need -= take * unitPower;
    }
  };

  for (const slot of recipe.slots.filter((s) => s.slot_type !== 'guide')) {
    pickForEffect(slot.effect_code, Number(slot.required_power) * batchCount, slot.slot_type, Number(slot.slot_index || 0));
  }

  let nonGuideTemp = selected.reduce(
    (sum, item) => sum + signOf(item.guide_effect) * herbPower(item) * item.quantity,
    0
  );
  const guideTarget = recipe.slots
    .filter((slot) => slot.slot_type === 'guide')
    .reduce((sum, slot) => sum + Number(slot.required_power || 0), 0) * batchCount;

  const tolerance = Math.max(20, requiredTotal * 0.04);
  let desiredSign = 0;
  if (nonGuideTemp < -tolerance) desiredSign = 1;
  else if (nonGuideTemp > tolerance) desiredSign = -1;

  let guidePower = 0;
  while (guidePower < guideTarget) {
    const candidates = inventory
      .filter((item) => {
        if ((remaining.get(Number(item.item_id)) || 0) <= 0) return false;
        if (item.guide_effect === null || item.guide_effect === undefined) return false;
        if (desiredSign === 0) return signOf(item.guide_effect) === 0;
        return signOf(item.guide_effect) === desiredSign || signOf(item.guide_effect) === 0;
      })
      .sort((a, b) => {
        const sa = signOf(a.guide_effect) === desiredSign ? 0 : 1;
        const sb = signOf(b.guide_effect) === desiredSign ? 0 : 1;
        return sa - sb || sortByLevel(a, b);
      });
    const item = candidates.find((candidate) => (remaining.get(Number(candidate.item_id)) || 0) > 0);
    if (!item) {
      if (desiredSign !== 0) {
        desiredSign = 0;
        continue;
      }
      throw badRequest('库存不足, 缺少药引');
    }
    const available = remaining.get(Number(item.item_id)) || 0;
    const unitPower = herbPower(item);
    const take = Math.min(Math.ceil((guideTarget - guidePower) / unitPower), available);
    selected.push({
      item_id: Number(item.item_id),
      item_name: item.item_name,
      level: Number(item.level || 1),
      guide_effect: item.guide_effect,
      slot_type: 'guide',
      slot_index: 0,
      effect_code: item.guide_effect,
      quantity: take,
    });
    remaining.set(Number(item.item_id), available - take);
    guidePower += take * unitPower;
  }

  return { selected, requiredTotal };
}

function calculateOutcome({ recipe, furnace, skill, selected, batchCount, randomValue = 0 }) {
  const actual = {};
  const required = {};
  for (const slot of recipe.slots) {
    const key = `${slot.slot_type}:${slot.slot_index}`;
    required[key] = Number(slot.required_power || 0) * batchCount;
    actual[key] = 0;
  }
  let actualTotal = 0;
  let requiredTotal = 0;
  let temperature = 0;

  for (const item of selected) {
    const unitPower = herbPower(item);
    const power = unitPower * Number(item.quantity || 0);
    actualTotal += power;
    const key = `${item.slot_type}:${item.slot_index}`;
    if (actual[key] !== undefined) actual[key] += power;
    temperature += signOf(item.guide_effect) * power;
  }

  for (const slot of recipe.slots) {
    requiredTotal += Number(slot.required_power || 0) * batchCount;
  }

  const coverage = recipe.slots.map((slot) => {
    const key = `${slot.slot_type}:${slot.slot_index}`;
    return { slot, power: actual[key] || 0, required: required[key] };
  });
  const covered = coverage.every((c) => c.power >= c.required);
  const surplus = Math.max(0, actualTotal - requiredTotal);
  const surplusRate = requiredTotal > 0 ? clamp(surplus / requiredTotal, 0, 1) : 0;
  const tolerance = Math.max(20, requiredTotal * 0.04);
  const balance = clamp(1 - Math.abs(temperature) / tolerance, 0, 1);
  const pillLevel = Number(recipe.recipe_level || 1);
  const furnaceLevel = Number(furnace.furnace_level || 1);
  const levelGap = pillLevel - furnaceLevel;
  const furnaceMatch = clamp(furnaceLevel - pillLevel, -1, 2) * 10;
  const alchemyMatch = clamp(Number(skill.alchemy_level || 1) - pillLevel, -4, 5) * 6;
  const fireMatch = clamp(Number(skill.fire_control_level || 1) - pillLevel, -3, 4) * 4;
  const crossRisk = levelGap <= 0 ? 0 : levelGap === 1 ? 15 : 35;
  const heatBonus = Number(furnace.heat_stability || 0);
  const stability = clamp(
    50 +
      30 * balance +
      furnaceMatch +
      alchemyMatch +
      fireMatch +
      heatBonus -
      20 * surplusRate -
      crossRisk +
      randomValue,
    0,
    100
  );

  let outcome = '成丹';
  let quality = '下品';
  if (!covered) {
    outcome = '药渣';
    quality = '废丹';
  } else if (stability < 20) {
    outcome = levelGap >= 1 ? '炸炉' : '药渣';
    quality = '废丹';
  } else if (stability < 40) {
    outcome = '废丹';
    quality = '废丹';
  } else if (stability < 60) {
    quality = '下品';
  } else if (stability < 80) {
    quality = '中品';
  } else if (stability < 90) {
    quality = '上品';
  } else {
    quality = '极品';
  }

  const levelGap2 = pillLevel - furnaceLevel;
  const durabilityCost =
    levelGap2 <= 0
      ? (furnaceLevel > pillLevel ? 1 : 2) * batchCount
      : levelGap2 === 1
        ? 40 * batchCount
        : levelGap2 === 2
          ? 80 * batchCount
          : Infinity;

  return {
    coverage,
    temperature,
    tolerance,
    balance,
    surplusRate,
    stability,
    outcome,
    quality,
    quantity: outcome === '成丹' ? batchCount : 0,
    durabilityCost,
    levelGap: levelGap2,
    selected,
  };
}

function buildFreeResult(selected, furnace, skill, batchCount) {
  let totalPower = 0;
  let temperature = 0;
  for (const item of selected) {
    const power = herbPower(item) * Number(item.quantity || 0);
    totalPower += power;
    temperature += signOf(item.guide_effect) * power;
  }
  const tolerance = Math.max(20, totalPower * 0.04);
  const balance = clamp(1 - Math.abs(temperature) / tolerance, 0, 1);
  const furnaceLevel = Number(furnace.furnace_level || 1);
  const alchemyMatch = clamp(Number(skill.alchemy_level || 1) - 1, -4, 5) * 6;
  const fireMatch = clamp(Number(skill.fire_control_level || 1) - 1, -3, 4) * 4;
  const stability = clamp(
    20 + 20 * balance + alchemyMatch + fireMatch + Number(furnace.heat_stability || 0),
    0,
    100
  );
  return {
    coverage: [],
    temperature,
    tolerance,
    balance,
    surplusRate: 0,
    stability,
    outcome: stability < 20 ? '炸炉' : '药渣',
    quality: '废丹',
    quantity: 0,
    durabilityCost: 2 * batchCount,
    levelGap: 0,
    selected,
  };
}

function durabilityAllowed(furnace, cost) {
  return cost < Number(furnace.durability || 0);
}

async function fetchFullSelected(selected, characterId) {
  const inventory = await getInventory(characterId);
  const byId = new Map(inventory.map((item) => [Number(item.item_id), item]));
  return selected.map((item) => {
    const full = byId.get(Number(item.item_id));
    if (!full) throw badRequest(`物品不存在或不在背包中: ${item.item_id}`);
    return {
      ...item,
      item_name: item.item_name || full.item_name,
      level: Number(item.level || full.level || 1),
      guide_effect: item.guide_effect || full.guide_effect,
      main_effect: full.main_effect,
      secondary_effect: full.secondary_effect,
    };
  });
}

function slotForSelected(recipe, full) {
  const mainSlot = recipe.slots.find(
    (slot) => slot.slot_type === 'main' && full.main_effect === slot.effect_code
  );
  if (mainSlot) {
    return { slot_type: 'main', slot_index: Number(mainSlot.slot_index || 0) };
  }
  const secondarySlot = recipe.slots.find(
    (slot) => slot.slot_type === 'secondary' && full.secondary_effect === slot.effect_code
  );
  if (secondarySlot) {
    return { slot_type: 'secondary', slot_index: Number(secondarySlot.slot_index || 0) };
  }
  return { slot_type: 'guide', slot_index: 0 };
}

async function hydrateSelected(recipe, selected, characterId) {
  const inventory = await getInventory(characterId);
  const byId = new Map(inventory.map((item) => [Number(item.item_id), item]));
  return selected.map((item) => {
    const full = byId.get(Number(item.item_id));
    if (!full) throw badRequest(`物品不存在或不在背包中: ${item.item_id}`);
    const slot = item.slot_type
      ? {
          slot_type: item.slot_type,
          slot_index: Number(item.slot_index || 0),
        }
      : slotForSelected(recipe, full);
    return {
      ...full,
      item_name: full.item_name,
      level: Number(full.level || 1),
      guide_effect: full.guide_effect,
      quantity: Number(item.quantity || 0),
      slot_type: slot.slot_type,
      slot_index: slot.slot_index,
    };
  });
}

async function getCharacterAttribute(characterId) {
  const [rows] = await pool.query(
    `SELECT * FROM character_attribute WHERE character_id = ?`,
    [characterId]
  );
  if (rows.length > 0) return rows[0];
  return {
    character_id: characterId,
    aptitude: 10,
    comprehension: 10,
    metal_root: 0,
    wood_root: 0,
    water_root: 0,
    fire_root: 0,
    earth_root: 0,
    max_hp: 100,
    attack: 10,
    defense: 10,
  };
}

async function getCharacterDetail(characterId) {
  const [[base]] = await pool.query(
    `SELECT c.character_id, c.character_name, c.gender, c.age, c.race_id, c.race_subsp_id,
            c.class_id, c.realm_id, c.character_description,
            r.realm_name, cl.class_name, ra.race_name
       FROM \`character\` c
       LEFT JOIN realm r ON r.realm_id = c.realm_id
       LEFT JOIN class cl ON cl.class_id = c.class_id
       LEFT JOIN race ra ON ra.race_id = c.race_id
      WHERE c.character_id = ?`,
    [characterId]
  );
  if (!base) throw notFound(`角色不存在: ${characterId}`);
  const skill = await getCharacterSkill(characterId);
  const attribute = await getCharacterAttribute(characterId);
  const [[toxin]] = await pool.query(
    `SELECT toxin_value FROM character_drug_toxin WHERE character_id = ?`,
    [characterId]
  );
  return {
    ...base,
    alchemy_skill: skill,
    attribute,
    toxin_value: toxin?.toxin_value || 0,
  };
}

router.get('/overview', async (req, res, next) => {
  try {
    const [characters] = await pool.query(
      `SELECT c.character_id, c.character_name, r.realm_name, cl.class_name
         FROM \`character\` c
         LEFT JOIN realm r ON r.realm_id = c.realm_id
         LEFT JOIN class cl ON cl.class_id = c.class_id
        ORDER BY c.character_id`
    );
    const [recipes] = await pool.query(
      `SELECT r.recipe_id, r.pill_id, r.recipe_level, r.min_furnace_level, r.base_days,
              i.item_name, i.level, p.pill_category, p.effect_type, p.base_effect,
              p.duration, p.toxicity, p.breakthrough_bonus, p.buff_code
         FROM pill_recipe r
         JOIN item i ON i.item_id = r.pill_id
         JOIN pill p ON p.item_id = r.pill_id
        WHERE r.status = 1
        ORDER BY r.recipe_level, r.pill_id`
    );
    const [furnaces] = await pool.query(
      `SELECT i.item_id, i.item_name, i.level, f.furnace_level, f.capacity,
              f.main_slots, f.secondary_slots, f.guide_slots, f.durability, f.heat_stability
         FROM item i
         JOIN alchemy_furnace f ON f.item_id = i.item_id
        ORDER BY f.furnace_level`
    );
    res.json({ ok: true, data: { characters, recipes, furnaces } });
  } catch (err) {
    next(err);
  }
});

router.get('/characters/:characterId', async (req, res, next) => {
  try {
    const characterId = int(req.params.characterId, 0);
    if (!characterId) throw badRequest('characterId 不能为空');
    res.json({ ok: true, data: await getCharacterDetail(characterId) });
  } catch (err) {
    next(err);
  }
});

router.put('/characters/:characterId/attributes', async (req, res, next) => {
  try {
    const characterId = int(req.params.characterId, 0);
    if (!characterId) throw badRequest('characterId 不能为空');
    const body = req.body || {};
    const attrFields = [
      'aptitude',
      'comprehension',
      'metal_root',
      'wood_root',
      'water_root',
      'fire_root',
      'earth_root',
      'max_hp',
      'attack',
      'defense',
    ];
    const attrValues = {};
    for (const field of attrFields) {
      if (body[field] !== undefined) attrValues[field] = int(body[field], 0);
    }
    if (Object.keys(attrValues).length > 0) {
      const columns = Object.keys(attrValues);
      const values = columns.map((column) => attrValues[column]);
      const updateSql = columns.map((column) => `\`${column}\` = ?`).join(', ');
      await pool.query(
        `INSERT INTO character_attribute (character_id, ${columns.map((c) => `\`${c}\``).join(', ')})
         VALUES (?, ${columns.map(() => '?').join(', ')})
         ON DUPLICATE KEY UPDATE ${updateSql}`,
        [characterId, ...values, ...values]
      );
    }

    const skillFields = [
      'alchemy_level',
      'pharmacology_level',
      'fire_control_level',
      'tolerance_level',
    ];
    const skillValues = {};
    for (const field of skillFields) {
      if (body[field] !== undefined) skillValues[field] = int(body[field], 1);
    }
    if (Object.keys(skillValues).length > 0) {
      const columns = Object.keys(skillValues);
      const values = columns.map((column) => skillValues[column]);
      const updateSql = columns.map((column) => `\`${column}\` = ?`).join(', ');
      await pool.query(
        `INSERT INTO character_alchemy_skill (character_id, ${columns.map((c) => `\`${c}\``).join(', ')})
         VALUES (?, ${columns.map(() => '?').join(', ')})
         ON DUPLICATE KEY UPDATE ${updateSql}`,
        [characterId, ...values, ...values]
      );
    }

    if (body.toxin_value !== undefined) {
      await pool.query(
        `INSERT INTO character_drug_toxin (character_id, toxin_value)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE toxin_value = VALUES(toxin_value)`,
        [characterId, int(body.toxin_value, 0)]
      );
    }

    if (body.age !== undefined) {
      await pool.query(
        `UPDATE \`character\` SET age = ? WHERE character_id = ?`,
        [int(body.age, 0), characterId]
      );
    }

    res.json({ ok: true, data: await getCharacterDetail(characterId) });
  } catch (err) {
    next(err);
  }
});

router.put('/furnaces/:itemId', async (req, res, next) => {
  try {
    const itemId = int(req.params.itemId, 0);
    if (!itemId) throw badRequest('itemId 不能为空');
    const furnaceLevel = int(req.body?.furnace_level, 0);
    const heatStability = int(req.body?.heat_stability, 0);
    const durability = req.body?.durability !== undefined ? int(req.body.durability, 0) : undefined;
    if (!furnaceLevel) throw badRequest('furnace_level 必填');
    const [rows] = await pool.query(
      `SELECT item_id FROM alchemy_furnace WHERE item_id = ?`,
      [itemId]
    );
    if (rows.length === 0) throw notFound(`炼丹炉不存在: ${itemId}`);
    await pool.query(
      `UPDATE alchemy_furnace
          SET furnace_level = ?, heat_stability = ?${durability !== undefined ? ', durability = ?' : ''}
        WHERE item_id = ?`,
      durability !== undefined
        ? [furnaceLevel, heatStability, durability, itemId]
        : [furnaceLevel, heatStability, itemId]
    );
    await pool.query(
      `UPDATE item SET level = ?, quality = ? WHERE item_id = ?`,
      [furnaceLevel, furnaceLevel, itemId]
    );
    res.json({ ok: true, data: await getFurnace(itemId) });
  } catch (err) {
    next(err);
  }
});

router.get('/recipes', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, i.item_name, p.pill_category, p.effect_type, p.base_effect,
              p.duration, p.toxicity, p.breakthrough_bonus, p.buff_code
         FROM pill_recipe r
         JOIN item i ON i.item_id = r.pill_id
         JOIN pill p ON p.item_id = r.pill_id
        WHERE r.status = 1
        ORDER BY r.recipe_level`
    );
    for (const recipe of rows) {
      const [slots] = await pool.query(
        `SELECT slot_type, slot_index, effect_code, required_power
           FROM pill_recipe_slot
          WHERE recipe_id = ?
          ORDER BY FIELD(slot_type, 'main', 'secondary', 'guide'), slot_index`,
        [recipe.recipe_id]
      );
      recipe.slots = slots;
    }
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/inventory', async (req, res, next) => {
  try {
    const characterId = int(req.query.characterId, 0);
    const inventoryCharacterId = int(req.query.inventoryCharacterId, characterId);
    if (!characterId) throw badRequest('characterId 不能为空');
    res.json({ ok: true, data: await getInventory(inventoryCharacterId) });
  } catch (err) {
    next(err);
  }
});

router.get('/fields', async (req, res, next) => {
  try {
    const characterId = int(req.query.characterId, 0);
    const params = [];
    let where = '';
    if (characterId) {
      where = ' WHERE sf.character_id = ?';
      params.push(characterId);
    }
    const [rows] = await pool.query(
      `SELECT sf.*, i.item_name, i.level AS herb_level
         FROM spirit_field sf
         LEFT JOIN item i ON i.item_id = sf.item_id
        ${where}
        ORDER BY sf.field_id`,
      params
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/plan', async (req, res, next) => {
  try {
    const characterId = int(req.query.characterId, 0);
    const inventoryCharacterId = int(req.query.inventoryCharacterId, characterId);
    const recipeId = int(req.query.recipeId, 0);
    const furnaceItemId = int(req.query.furnaceItemId, 0);
    const batchCount = clamp(int(req.query.batchCount, 1), 1, 99);
    if (!characterId || !recipeId || !furnaceItemId) {
      throw badRequest('characterId, recipeId, furnaceItemId 必填');
    }
    const recipe = await getRecipe(recipeId);
    const furnace = await getFurnace(furnaceItemId);
    const skill = await getCharacterSkill(characterId);
    const inventory = await getInventory(inventoryCharacterId);
    const planned = await autoPlan({ recipe, inventory, batchCount });
    const full = await fetchFullSelected(planned.selected, inventoryCharacterId);
    const result = calculateOutcome({ recipe, furnace, skill, selected: full, batchCount, randomValue: 0 });
    if (result.durabilityCost === Infinity) throw badRequest('丹药等级超过丹炉等级 3 级, 无法炼制');
    res.json({ ok: true, data: { ...result, durabilityAllowed: durabilityAllowed(furnace, result.durabilityCost), furnace } });
  } catch (err) {
    next(err);
  }
});

router.post('/plan', async (req, res, next) => {
  try {
    const characterId = int(req.body?.characterId, 0);
    const inventoryCharacterId = int(req.body?.inventoryCharacterId, characterId);
    const recipeId = int(req.body?.recipeId, 0);
    const furnaceItemId = int(req.body?.furnaceItemId, 0);
    const batchCount = clamp(int(req.body?.batchCount, 1), 1, 99);
    if (!characterId || !furnaceItemId) {
      throw badRequest('characterId, furnaceItemId 必填');
    }
    const recipe = recipeId ? await getRecipe(recipeId) : null;
    const furnace = await getFurnace(furnaceItemId);
    const skill = await getCharacterSkill(characterId);
    const selected = await hydrateSelected(recipe, req.body?.ingredients || [], inventoryCharacterId);
    if (selected.length === 0) throw badRequest('自由炼丹请先选择药材');
    const resolvedRecipe = recipe || (await findRecipeForSelected(selected));
    const result = resolvedRecipe
      ? calculateOutcome({ recipe: resolvedRecipe, furnace, skill, selected, batchCount, randomValue: 0 })
      : buildFreeResult(selected, furnace, skill, batchCount);
    if (result.durabilityCost === Infinity) throw badRequest('丹药等级超过丹炉等级 3 级, 无法炼制');
    res.json({ ok: true, data: { ...result, durabilityAllowed: durabilityAllowed(furnace, result.durabilityCost), furnace } });
  } catch (err) {
    next(err);
  }
});

router.post('/craft', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const characterId = int(req.body?.characterId, 0);
    const inventoryCharacterId = int(req.body?.inventoryCharacterId, characterId);
    const recipeId = int(req.body?.recipeId, 0);
    const furnaceItemId = int(req.body?.furnaceItemId, 0);
    const batchCount = clamp(int(req.body?.batchCount, 1), 1, 99);
    if (!characterId || !furnaceItemId) {
      throw badRequest('characterId, furnaceItemId 必填');
    }

    const recipe = recipeId ? await getRecipe(recipeId) : null;
    const furnace = await getFurnace(furnaceItemId);
    const skill = await getCharacterSkill(characterId);
    let selected = Array.isArray(req.body?.ingredients) ? req.body.ingredients : null;

    if (!selected || selected.length === 0) {
      if (!recipe) throw badRequest('未选择丹方时, 必须自行选择药材');
      const inventory = await getInventory(inventoryCharacterId);
      const planned = await autoPlan({ recipe, inventory, batchCount });
      selected = await fetchFullSelected(planned.selected, inventoryCharacterId);
    } else {
      selected = await hydrateSelected(recipe, selected, inventoryCharacterId);
    }

    const resolvedRecipe = recipe || (await findRecipeForSelected(selected));
    const result = resolvedRecipe
      ? calculateOutcome({
          recipe: resolvedRecipe,
          furnace,
          skill,
          selected,
          batchCount,
          randomValue: Math.floor(Math.random() * 11) - 5,
        })
      : buildFreeResult(selected, furnace, skill, batchCount);
    if (result.durabilityCost === Infinity) throw badRequest('丹药等级超过丹炉等级 3 级, 无法炼制');
    if (!durabilityAllowed(furnace, result.durabilityCost)) {
      throw badRequest('丹炉耐久不足, 继续炼制将炸炉');
    }

    await conn.beginTransaction();

    for (const item of selected) {
      await conn.query(
        `UPDATE character_inventory
            SET quantity = GREATEST(0, quantity - ?)
          WHERE character_id = ? AND item_id = ?`,
        [Number(item.quantity), inventoryCharacterId, Number(item.item_id)]
      );
    }

    await conn.query(
      `UPDATE alchemy_furnace
          SET durability = durability - ?
        WHERE item_id = ?`,
      [result.durabilityCost, furnaceItemId]
    );

    const output = {
      pill_id: resolvedRecipe ? Number(resolvedRecipe.pill_id) : null,
      pill_name: resolvedRecipe ? resolvedRecipe.item_name : '未知药渣',
      quantity: result.quantity,
      quality: result.quality,
      outcome: result.outcome,
      buff_code: resolvedRecipe ? resolvedRecipe.buff_code : null,
    };

    await conn.query(
      `INSERT INTO alchemy_batch
        (character_id, recipe_id, furnace_item_id, batch_count, input_json, output_json,
         temperature, balance_score, stability_score, outcome, quality, quantity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        characterId,
        resolvedRecipe ? resolvedRecipe.recipe_id : null,
        furnaceItemId,
        batchCount,
        JSON.stringify(selected),
        JSON.stringify(output),
        result.temperature,
        result.balance,
        result.stability,
        result.outcome,
        result.quality,
        result.quantity,
      ]
    );

    if (result.quantity > 0 && resolvedRecipe) {
      await conn.query(
        `INSERT INTO character_inventory (character_id, item_id, quantity)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
        [inventoryCharacterId, resolvedRecipe.pill_id, result.quantity]
      );
      await conn.query(
        `UPDATE character_alchemy_skill
            SET success_count = success_count + 1,
                best_recipe_level = GREATEST(best_recipe_level, ?)
          WHERE character_id = ?`,
        [resolvedRecipe.recipe_level, characterId]
      );
    }

    await conn.commit();
    res.json({ ok: true, data: result });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

router.post('/use-pill', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const characterId = int(req.body?.characterId, 0);
    const itemId = int(req.body?.itemId, 0);
    const quantity = clamp(int(req.body?.quantity, 1), 1, 999);
    if (!characterId || !itemId) throw badRequest('characterId, itemId 必填');

    const [pills] = await conn.query(
      `SELECT p.*, i.item_name, i.level
         FROM pill p
         JOIN item i ON i.item_id = p.item_id
        WHERE p.item_id = ?`,
      [itemId]
    );
    if (pills.length === 0) throw notFound(`丹药不存在: ${itemId}`);
    const pill = pills[0];

    await conn.beginTransaction();
    const [updated] = await conn.query(
      `UPDATE character_inventory
          SET quantity = quantity - ?
        WHERE character_id = ? AND item_id = ? AND quantity >= ?`,
      [quantity, characterId, itemId, quantity]
    );
    if (updated.affectedRows === 0) throw badRequest('丹药库存不足');

    const skill = await getCharacterSkill(characterId);
    const toxicityRatio = Math.max(0.4, 1 - Number(skill.tolerance_level || 0) * 0.05);
    const toxicity = Math.round(Number(pill.toxicity || 0) * quantity * toxicityRatio);
    await conn.query(
      `INSERT INTO character_drug_toxin (character_id, toxin_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE toxin_value = toxin_value + VALUES(toxin_value)`,
      [characterId, toxicity]
    );

    if (pill.effect_type === 'toxin_remove') {
      const remove = Number(pill.base_effect || 0) * quantity;
      await conn.query(
        `UPDATE character_drug_toxin
            SET toxin_value = GREATEST(0, toxin_value - ?)
          WHERE character_id = ?`,
        [remove, characterId]
      );
    } else if (pill.effect_type === 'buff' || pill.effect_type === 'heal') {
      const duration = Number(pill.duration || 0);
      await conn.query(
        `INSERT INTO character_buff
          (character_id, buff_code, source_type, source_item_id, buff_value, expires_at, status)
         VALUES (?, ?, 'pill', ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY), 1)`,
        [characterId, pill.buff_code, itemId, Number(pill.base_effect || 0) * quantity, duration]
      );
    } else if (pill.effect_type === 'breakthrough') {
      await conn.query(
        `INSERT INTO character_buff
          (character_id, buff_code, source_type, source_item_id, buff_value, expires_at, status)
         VALUES (?, 'BREAKTHROUGH_BONUS', 'pill', ?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY), 1)`,
        [characterId, itemId, Number(pill.breakthrough_bonus || 0) * quantity]
      );
    }

    await conn.commit();
    const [[toxinRow]] = await conn.query(
      `SELECT toxin_value FROM character_drug_toxin WHERE character_id = ?`,
      [characterId]
    );
    res.json({
      ok: true,
      data: {
        pill_name: pill.item_name,
        quantity,
        toxicityAdded: toxicity,
        toxin_value: toxinRow?.toxin_value || 0,
      },
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

router.get('/buffs', async (req, res, next) => {
  try {
    const characterId = int(req.query.characterId, 0);
    if (!characterId) throw badRequest('characterId 不能为空');
    const [rows] = await pool.query(
      `SELECT cb.*, b.buff_name, b.stat_key, b.value_type
         FROM character_buff cb
         LEFT JOIN buff b ON b.buff_code = cb.buff_code
        WHERE cb.character_id = ?
        ORDER BY cb.create_time DESC`,
      [characterId]
    );
    const [[toxin]] = await pool.query(
      `SELECT toxin_value FROM character_drug_toxin WHERE character_id = ?`,
      [characterId]
    );
    res.json({ ok: true, data: { buffs: rows, toxin_value: toxin?.toxin_value || 0 } });
  } catch (err) {
    next(err);
  }
});

router.get('/logs', async (req, res, next) => {
  try {
    const characterId = int(req.query.characterId, 0);
    const params = [];
    let where = '';
    if (characterId) {
      where = ' WHERE ab.character_id = ?';
      params.push(characterId);
    }
    const [rows] = await pool.query(
      `SELECT ab.*, c.character_name, i.item_name AS pill_name
         FROM alchemy_batch ab
         LEFT JOIN \`character\` c ON c.character_id = ab.character_id
         LEFT JOIN item i ON i.item_id = JSON_UNQUOTE(JSON_EXTRACT(ab.output_json, '$.pill_id'))
        ${where}
        ORDER BY ab.create_time DESC
        LIMIT 50`,
      params
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/fields/plant', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const characterId = int(req.body?.characterId, 0);
    const fieldId = int(req.body?.fieldId, 0);
    const itemId = int(req.body?.itemId, 0);
    if (!characterId || !fieldId || !itemId) throw badRequest('characterId, fieldId, itemId 必填');

    await conn.beginTransaction();
    const [fields] = await conn.query(
      `SELECT * FROM spirit_field WHERE field_id = ? AND character_id = ? FOR UPDATE`,
      [fieldId, characterId]
    );
    if (fields.length === 0) throw notFound('灵田不存在');
    const field = fields[0];
    if (field.status !== 'empty') throw badRequest('该灵田当前不可种植');

    const [herbs] = await conn.query(
      `SELECT i.item_id, i.level
         FROM item i
         JOIN herb h ON h.item_id = i.item_id
        WHERE i.item_id = ?`,
      [itemId]
    );
    if (herbs.length === 0) throw badRequest('只能种植草药');
    const herb = herbs[0];

    const [updated] = await conn.query(
      `UPDATE character_inventory
          SET quantity = quantity - 1
        WHERE character_id = ? AND item_id = ? AND quantity >= 1`,
      [characterId, itemId]
    );
    if (updated.affectedRows === 0) throw badRequest('草药库存不足');

    await conn.query(
      `UPDATE spirit_field
          SET item_id = ?, status = 'growing', planted_at = NOW(),
              ready_at = DATE_ADD(NOW(), INTERVAL ? DAY), yield = ?
        WHERE field_id = ?`,
      [itemId, Number(herb.level || 1), Number(herb.level || 1) + 1, fieldId]
    );
    await conn.commit();
    res.json({ ok: true, data: { fieldId, itemId, readyDays: Number(herb.level || 1) } });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

router.post('/fields/harvest', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const fieldId = int(req.body?.fieldId, 0);
    if (!fieldId) throw badRequest('fieldId 必填');

    await conn.beginTransaction();
    const [fields] = await conn.query(
      `SELECT * FROM spirit_field WHERE field_id = ? FOR UPDATE`,
      [fieldId]
    );
    if (fields.length === 0) throw notFound('灵田不存在');
    const field = fields[0];
    if (field.status !== 'ready') throw badRequest('草药尚未成熟');

    await conn.query(
      `INSERT INTO character_inventory (character_id, item_id, quantity)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
      [field.character_id, field.item_id, field.yield]
    );
    await conn.query(
      `UPDATE spirit_field
          SET item_id = NULL, planted_at = NULL, ready_at = NULL, status = 'empty', yield = 0
        WHERE field_id = ?`,
      [fieldId]
    );
    await conn.commit();
    res.json({ ok: true, data: { fieldId, itemId: field.item_id, yield: field.yield } });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

export default router;
