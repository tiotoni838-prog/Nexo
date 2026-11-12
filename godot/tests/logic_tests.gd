extends SceneTree

## Tests headless de la lógica pura de NEXO: FRONTIER.
## Ejecutar: godot --headless --path godot --script res://tests/logic_tests.gd

var failures := 0
var checks := 0


func check(cond: bool, label: String) -> void:
	checks += 1
	if cond:
		print("  OK  ", label)
	else:
		failures += 1
		printerr("  FALLO: ", label)


func _init() -> void:
	print("== Tests de logica NEXO: FRONTIER ==")
	test_rng()
	test_zone()
	test_combat()
	test_characters()
	test_match_flow()
	print("== %d checks, %d fallos ==" % [checks, failures])
	quit(1 if failures > 0 else 0)


func test_rng() -> void:
	print("[NexoRng]")
	var a := NexoRng.new(12345)
	var b := NexoRng.new(12345)
	var same := true
	for i in range(100):
		if a.next() != b.next():
			same = false
	check(same, "misma semilla produce la misma secuencia")
	var r := NexoRng.new(7)
	var in_range := true
	for i in range(200):
		var v: float = r.range_val(3.0, 9.0)
		if v < 3.0 or v >= 9.0:
			in_range = false
	check(in_range, "range_val respeta el rango")


func test_zone() -> void:
	print("[NexoZone]")
	var zone := NexoZone.initial(NexoRng.new(42))
	check(zone.mode == "wait", "la zona inicia en espera")
	check(abs(zone.radius - 1200.0 * 0.92) < 0.01, "radio inicial = 92% del mundo")
	var start_radius := zone.radius
	zone.update(26000.0, NexoRng.new(1))
	zone.update(31000.0, NexoRng.new(2))
	check(zone.radius < start_radius, "la zona se encoge tras esperar y encoger")
	check(zone.dps() > 0.0, "el dps de zona es positivo")
	var outside := NexoZone.initial(NexoRng.new(5))
	check(not outside.is_outside(outside.cx, outside.cy), "el centro esta dentro de la zona")
	check(outside.is_outside(outside.cx + outside.radius + 10.0, outside.cy), "lejos del centro esta fuera")


func test_combat() -> void:
	print("[NexoCombat]")
	var res := NexoCombat.apply_damage(100.0, 50.0, 80.0, 1.0)
	check(abs(float(res["shield"])) < 0.001, "el escudo absorbe primero")
	check(abs(float(res["hp"]) - 70.0) < 0.01, "el resto del dano pasa a la vida")
	var dead := NexoCombat.apply_damage(10.0, 0.0, 50.0, 1.0)
	check(bool(dead["dead"]), "dano letal mata")
	var resisted := NexoCombat.apply_damage(100.0, 0.0, 50.0, 0.5)
	check(abs(float(resisted["hp"]) - 75.0) < 0.01, "la resistencia reduce el dano")
	check(abs(NexoCombat.heal(80.0, 30.0, 1.25) - 100.0) < 0.01, "la curacion respeta el multiplicador y el maximo")
	check(abs(NexoCombat.bullet_damage(20.0, 1.4, true) - 36.4) < 0.01, "sobrecarga multiplica el dano")
	check(NexoCombat.effective_radius(true, false) < NexoCombat.effective_radius(false, false), "prone reduce el perfil")


func test_characters() -> void:
	print("[NexoCharacters]")
	check(NexoCharacters.ids().size() == 6, "existen 6 personajes")
	check(NexoCharacters.is_valid("aurora"), "aurora es valido")
	check(not NexoCharacters.is_valid("nope"), "id invalido rechazado")
	var all_have_ability := true
	for id in NexoCharacters.ids():
		var def: Dictionary = NexoCharacters.def(String(id))
		if float(def["cooldown_ms"]) <= 0.0:
			all_have_ability = false
	check(all_have_ability, "todos tienen cooldown de habilidad")


func test_match_flow() -> void:
	print("[NexoMatchLogic]")
	var m := NexoMatchLogic.new(999)
	var p1 := m.add_player("Aurora", "aurora")
	var p2 := m.add_player("Sombra", "sombra")
	var p3 := m.add_player("Vita", "vita")
	check(m.alive_count() == 3, "3 jugadores vivos al inicio")
	check(m.use_ability(p1) == "muro", "Aurora activa el muro")
	check(m.use_ability(p1) == "", "el cooldown bloquea el reuso")
	m.players[p2]["hp"] = 40.0
	check(m.use_ability(p2) == "sprint", "Sombra activa sprint")
	m.players[p3]["hp"] = 40.0
	check(m.use_ability(p3) == "pulso", "Vita activa pulso")
	check(abs(float(m.players[p3]["hp"]) - 77.5) < 0.01, "pulso cura 30 x 1.25 (heal_mult de Vita)")
	var determinism_a := NexoMatchLogic.new(555)
	var determinism_b := NexoMatchLogic.new(555)
	for i in range(500):
		determinism_a.tick(33.0)
		determinism_b.tick(33.0)
	check(abs(determinism_a.zone.cx - determinism_b.zone.cx) < 0.0001, "la zona es determinista con la misma semilla")
	m.apply_damage(p2, 150.0)
	check(not bool(m.players[p2]["alive"]), "dano letal elimina")
	m.apply_damage(p3, 150.0)
	check(m.over, "con un solo vivo la partida termina")
	check(m.winner_id == p1, "el ultimo en pie gana")
