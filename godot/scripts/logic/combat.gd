class_name NexoCombat
extends RefCounted

## Combate determinista: escudo primero, resistencia de personaje y buffs de habilidad.

const MAX_HP := 100.0
const MAX_SHIELD := 100.0


static func apply_damage(hp: float, shield: float, damage: float, resistance: float) -> Dictionary:
	var remaining: float = max(0.0, damage) * resistance
	var new_shield: float = shield
	if new_shield > 0.0:
		var absorbed: float = min(new_shield, remaining)
		new_shield -= absorbed
		remaining -= absorbed
	var new_hp: float = hp - remaining
	return {"hp": max(0.0, new_hp), "shield": max(0.0, new_shield), "dead": new_hp <= 0.0}


static func heal(hp: float, amount: float, heal_mult: float) -> float:
	return min(MAX_HP, hp + amount * heal_mult)


static func shield_up(shield: float, amount: float) -> float:
	return min(MAX_SHIELD, shield + amount)


static func bullet_damage(base_damage: float, rarity_mult: float, overcharge_active: bool) -> float:
	return base_damage * rarity_mult * (1.3 if overcharge_active else 1.0)


static func effective_radius(prone: bool, sliding: bool) -> float:
	if prone:
		return 10.0
	if sliding:
		return 12.0
	return 14.0
