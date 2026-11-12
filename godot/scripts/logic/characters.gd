class_name NexoCharacters
extends RefCounted

## 6 personajes con 1 habilidad activa + pasivas, portados de shared/characters.ts.

const CHARACTERS := {
	"aurora": {
		"name_es": "Aurora", "name_en": "Aurora", "color": Color(0.22, 0.88, 0.78),
		"ability": "muro", "cooldown_ms": 15000.0, "duration_ms": 12000.0,
		"speed_mult": 1.0, "reload_mult": 1.0, "resistance": 1.0, "range_mult": 1.0, "heal_mult": 1.15,
	},
	"sombra": {
		"name_es": "Sombra", "name_en": "Shadow", "color": Color(0.69, 0.42, 1.0),
		"ability": "sprint", "cooldown_ms": 10000.0, "duration_ms": 2500.0,
		"speed_mult": 1.06, "reload_mult": 1.0, "resistance": 1.0, "range_mult": 1.0, "heal_mult": 1.0,
	},
	"titan": {
		"name_es": "Titan", "name_en": "Titan", "color": Color(0.95, 0.71, 0.2),
		"ability": "resistencia", "cooldown_ms": 18000.0, "duration_ms": 4000.0,
		"speed_mult": 1.0, "reload_mult": 1.0, "resistance": 0.92, "range_mult": 1.0, "heal_mult": 1.0,
	},
	"halcon": {
		"name_es": "Halcon", "name_en": "Falcon", "color": Color(0.31, 0.63, 1.0),
		"ability": "recarga", "cooldown_ms": 12000.0, "duration_ms": 0.0,
		"speed_mult": 1.0, "reload_mult": 0.94, "resistance": 1.0, "range_mult": 1.15, "heal_mult": 1.0,
	},
	"vita": {
		"name_es": "Vita", "name_en": "Vita", "color": Color(0.29, 0.87, 0.5),
		"ability": "pulso", "cooldown_ms": 14000.0, "duration_ms": 0.0,
		"speed_mult": 1.0, "reload_mult": 1.0, "resistance": 1.0, "range_mult": 1.0, "heal_mult": 1.25,
	},
	"vulcano": {
		"name_es": "Vulcano", "name_en": "Volcano", "color": Color(0.94, 0.36, 0.42),
		"ability": "sobrecarga", "cooldown_ms": 16000.0, "duration_ms": 3000.0,
		"speed_mult": 1.0, "reload_mult": 0.88, "resistance": 1.0, "range_mult": 1.0, "heal_mult": 1.0,
	},
}

const COVER_WALL := {"width": 110.0, "height": 16.0, "hp": 250.0, "duration_ms": 12000.0, "deploy_distance": 42.0}
const PRONE_SPEED_MULT := 0.45
const SLIDE_BOOST_MULT := 1.6
const SLIDE_DURATION_MS := 600.0
const SLIDE_COOLDOWN_MS := 2000.0


static func ids() -> Array:
	return CHARACTERS.keys()


static func def(character_id: String) -> Dictionary:
	return CHARACTERS[character_id]


static func is_valid(character_id: String) -> bool:
	return CHARACTERS.has(character_id)
