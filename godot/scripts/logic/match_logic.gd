class_name NexoMatchLogic
extends RefCounted

## Flujo de partida determinista: jugadores, zona, habilidades, victoria.
## Portado de shared/sim.ts (subconjunto de lógica pura, sin físicas 3D).

const PLAYER_SPEED := 170.0
const PRONE_SPEED_MULT := 0.45
const SLIDE_BOOST_MULT := 1.6

var zone: NexoZone
var rng: NexoRng
var time_ms := 0.0
var players := {}
var next_player_id := 1
var winner_id := -1
var over := false


func _init(seed_value: int) -> void:
	rng = NexoRng.new(seed_value)
	zone = NexoZone.initial(rng)


func add_player(name: String, character_id: String = "aurora") -> int:
	if not NexoCharacters.is_valid(character_id):
		character_id = "aurora"
	var id := next_player_id
	next_player_id += 1
	players[id] = {
		"id": id, "name": name, "character_id": character_id,
		"x": 0.0, "y": 0.0, "hp": 100.0, "shield": 0.0,
		"alive": true, "kills": 0,
		"ability_ready_ms": 0.0, "ability_ends_ms": -1.0,
		"prone": false, "sliding": false, "slide_ends_ms": -1.0, "next_slide_ms": 0.0,
	}
	return id


func use_ability(player_id: int) -> String:
	if over or not players.has(player_id):
		return ""
	var p: Dictionary = players[player_id]
	if not p["alive"] or time_ms < float(p["ability_ready_ms"]):
		return ""
	var def: Dictionary = NexoCharacters.def(p["character_id"])
	p["ability_ready_ms"] = time_ms + float(def["cooldown_ms"])
	if float(def["duration_ms"]) > 0.0:
		p["ability_ends_ms"] = time_ms + float(def["duration_ms"])
	match String(def["ability"]):
		"pulso":
			p["hp"] = NexoCombat.heal(float(p["hp"]), 30.0, float(def["heal_mult"]))
		"recarga":
			pass
		"muro":
			pass
	return String(def["ability"])


func _ability_active(p: Dictionary, ability: String) -> bool:
	var def: Dictionary = NexoCharacters.def(p["character_id"])
	return float(p["ability_ends_ms"]) > time_ms and String(def["ability"]) == ability


func apply_damage(victim_id: int, damage: float) -> bool:
	if over or not players.has(victim_id):
		return false
	var p: Dictionary = players[victim_id]
	if not bool(p["alive"]):
		return false
	var def: Dictionary = NexoCharacters.def(p["character_id"])
	var resistance: float = float(def["resistance"])
	if _ability_active(p, "resistencia"):
		resistance *= 0.5
	var res: Dictionary = NexoCombat.apply_damage(float(p["hp"]), float(p["shield"]), damage, resistance)
	p["hp"] = res["hp"]
	p["shield"] = res["shield"]
	if bool(res["dead"]):
		p["alive"] = false
		_check_victory()
	return true


func move_player(player_id: int, mx: float, my: float, dt_ms: float) -> void:
	if over or not players.has(player_id):
		return
	var p: Dictionary = players[player_id]
	if not bool(p["alive"]):
		return
	var def: Dictionary = NexoCharacters.def(p["character_id"])
	var moving: bool = abs(mx) > 0.0 or abs(my) > 0.0
	p["prone"] = false
	p["sliding"] = false
	var stance: float = 1.0
	if _ability_active(p, "sprint"):
		stance = 1.55
	var speed: float = 170.0 * float(def["speed_mult"]) * stance * (dt_ms / 1000.0)
	var len := sqrt(mx * mx + my * my)
	if len > 1.0:
		mx /= len
		my /= len
	p["x"] = p["x"] + mx * speed
	p["y"] = p["y"] + my * speed


func tick(dt_ms: float) -> void:
	if over:
		return
	time_ms += dt_ms
	zone.update(dt_ms, rng)
	for id in players:
		var p: Dictionary = players[id]
		if not bool(p["alive"]):
			continue
		if float(p["ability_ends_ms"]) > 0.0 and time_ms >= float(p["ability_ends_ms"]):
			p["ability_ends_ms"] = -1.0
		if zone.is_outside(float(p["x"]), float(p["y"])):
			apply_damage(int(id), zone.dps() * dt_ms / 1000.0)


func _check_victory() -> void:
	var alive := _alive_ids()
	if alive.size() <= 1:
		over = true
		winner_id = alive[0] if alive.size() == 1 else -1


func _alive_ids() -> Array:
	var out: Array = []
	for id in players:
		if bool(players[id]["alive"]):
			out.append(int(id))
	return out


func alive_count() -> int:
	return _alive_ids().size()
