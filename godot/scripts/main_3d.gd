extends Node3D

## NEXO: FRONTIER — modo 3D. Construye el mapa, la zona, el jugador humanoide
## y los bots. Todo se genera por código para funcionar también headless.

const MAP_HALF := 60.0
const BOT_COUNT := 7

var player: HumanoidRig
var camera: Camera3D
var cam_yaw := 0.0
var zone_mesh: MeshInstance3D
var zone: NexoZone
var rng: NexoRng
var bots: Array[HumanoidRig] = []
var hud: CanvasLayer
var hp_bar: ProgressBar
var zone_label: Label
var alive_label: Label


func _ready() -> void:
	rng = NexoRng.new(int(Time.get_unix_time_from_system() * 1000.0) % 2147483647)
	zone = NexoZone.initial(rng)
	_build_environment()
	_build_map()
	_build_zone_ring()
	_spawn_player()
	_spawn_bots()
	_build_hud()


func _build_environment() -> void:
	var world_env := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(0.09, 0.13, 0.23)
	sky_mat.sky_horizon_color = Color(0.32, 0.42, 0.6)
	sky_mat.ground_bottom_color = Color(0.05, 0.07, 0.12)
	sky_mat.ground_horizon_color = Color(0.25, 0.32, 0.45)
	sky.sky_material = sky_mat
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.glow_enabled = true
	env.glow_intensity = 0.5
	world_env.environment = env
	add_child(world_env)

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-52.0, 35.0, 0.0)
	sun.light_color = Color(1.0, 0.95, 0.85)
	sun.light_energy = 1.3
	sun.shadow_enabled = true
	add_child(sun)


func _build_map() -> void:
	var ground := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(MAP_HALF * 2.0, MAP_HALF * 2.0)
	var ground_mat := StandardMaterial3D.new()
	ground_mat.albedo_color = Color(0.16, 0.24, 0.2)
	ground_mat.roughness = 1.0
	plane.material = ground_mat
	ground.mesh = plane
	add_child(ground)

	var rng_map := NexoRng.new(777)
	var building_mat := StandardMaterial3D.new()
	building_mat.albedo_color = Color(0.23, 0.28, 0.38)
	building_mat.roughness = 0.8
	var roof_mat := StandardMaterial3D.new()
	roof_mat.albedo_color = Color(0.3, 0.36, 0.5)
	for i in range(14):
		var bx := rng_map.range_val(-MAP_HALF + 8.0, MAP_HALF - 8.0)
		var bz := rng_map.range_val(-MAP_HALF + 8.0, MAP_HALF - 8.0)
		var bw := rng_map.range_val(4.0, 9.0)
		var bh := rng_map.range_val(3.0, 8.0)
		var bd := rng_map.range_val(4.0, 9.0)
		_add_box(Vector3(bx, bh / 2.0, bz), Vector3(bw, bh, bd), building_mat, true)
		_add_box(Vector3(bx, bh + 0.15, bz), Vector3(bw + 0.6, 0.3, bd + 0.6), roof_mat, false)
	var trunk_mat := StandardMaterial3D.new()
	trunk_mat.albedo_color = Color(0.3, 0.2, 0.12)
	var leaves_mat := StandardMaterial3D.new()
	leaves_mat.albedo_color = Color(0.13, 0.4, 0.2)
	leaves_mat.roughness = 1.0
	for i in range(40):
		var tx := rng_map.range_val(-MAP_HALF + 3.0, MAP_HALF - 3.0)
		var tz := rng_map.range_val(-MAP_HALF + 3.0, MAP_HALF - 3.0)
		var th := rng_map.range_val(2.5, 4.5)
		_add_box(Vector3(tx, th / 2.0, tz), Vector3(0.5, th, 0.5), trunk_mat, true)
		var leaves := MeshInstance3D.new()
		var sphere := SphereMesh.new()
		sphere.radius = rng_map.range_val(1.2, 2.0)
		sphere.height = sphere.radius * 2.0
		sphere.material = leaves_mat
		leaves.mesh = sphere
		leaves.position = Vector3(tx, th + sphere.radius * 0.6, tz)
		add_child(leaves)


func _add_box(pos: Vector3, size: Vector3, mat: Material, with_collision: bool) -> void:
	var mi := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = size
	box.material = mat
	mi.mesh = box
	mi.position = pos
	add_child(mi)
	if with_collision:
		var body := StaticBody3D.new()
		var shape := CollisionShape3D.new()
		var box_shape := BoxShape3D.new()
		box_shape.size = size
		shape.shape = box_shape
		body.add_child(shape)
		body.position = pos
		add_child(body)


func _build_zone_ring() -> void:
	zone_mesh = MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = zone.radius / 20.0
	torus.outer_radius = zone.radius / 20.0 + 0.4
	torus.rings = 64
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.22, 0.88, 0.78)
	mat.emission_enabled = true
	mat.emission = Color(0.22, 0.88, 0.78)
	mat.emission_energy_multiplier = 2.0
	torus.material = mat
	zone_mesh.mesh = torus
	zone_mesh.position = Vector3(zone.cx, 0.4, zone.cy)
	add_child(zone_mesh)


func _spawn_player() -> void:
	player = HumanoidRig.new()
	player.character_id = "aurora"
	player.display_name = "Tú"
	player.position = Vector3(0.0, 0.2, 0.0)
	add_child(player)

	var pivot := Node3D.new()
	pivot.name = "CamPivot"
	pivot.position = Vector3(0.0, 2.0, 0.0)
	player.add_child(pivot)
	camera = Camera3D.new()
	camera.position = Vector3(0.0, 2.2, 5.5)
	camera.rotation_degrees = Vector3(-16.0, 0.0, 0.0)
	pivot.add_child(camera)
	camera.make_current()


func _spawn_bots() -> void:
	var ids: Array = NexoCharacters.ids()
	for i in range(BOT_COUNT):
		var bot := HumanoidRig.new()
		bot.character_id = String(ids[i % ids.size()])
		bot.is_bot = true
		bot.display_name = "BOT %d" % (i + 1)
		var angle: float = rng.next() * TAU
		var dist: float = rng.range_val(15.0, MAP_HALF - 6.0)
		bot.position = Vector3(cos(angle) * dist, 0.2, sin(angle) * dist)
		add_child(bot)
		bots.append(bot)


func _build_hud() -> void:
	hud = CanvasLayer.new()
	add_child(hud)
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud.add_child(root)

	hp_bar = ProgressBar.new()
	hp_bar.position = Vector2(24.0, 640.0)
	hp_bar.size = Vector2(320.0, 26.0)
	hp_bar.min_value = 0.0
	hp_bar.max_value = 100.0
	hp_bar.value = 100.0
	hp_bar.show_percentage = false
	root.add_child(hp_bar)

	zone_label = Label.new()
	zone_label.position = Vector2(24.0, 24.0)
	zone_label.text = "Zona"
	zone_label.add_theme_font_size_override("font_size", 20)
	root.add_child(zone_label)

	alive_label = Label.new()
	alive_label.position = Vector2(24.0, 56.0)
	alive_label.text = "Vivos: %d" % (1 + bots.size())
	alive_label.add_theme_font_size_override("font_size", 20)
	root.add_child(alive_label)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		cam_yaw -= event.relative.x * 0.0025
	elif event is InputEventMouseButton and event.pressed and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event.is_action_pressed("ability"):
		_use_player_ability()


func _use_player_ability() -> void:
	if player == null:
		return
	_deploy_wall()


func _deploy_wall() -> void:
	var forward := Vector3(sin(cam_yaw), 0.0, cos(cam_yaw))
	var wall_pos := player.position + forward * 3.0
	var wall := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(4.0, 2.6, 0.4)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.49, 0.91, 1.0, 0.85)
	mat.emission_enabled = true
	mat.emission = Color(0.49, 0.91, 1.0)
	mat.emission_energy_multiplier = 1.2
	box.material = mat
	wall.mesh = box
	wall.position = wall_pos + Vector3(0.0, 1.3, 0.0)
	wall.rotation.y = cam_yaw
	add_child(wall)
	var body := StaticBody3D.new()
	var shape := CollisionShape3D.new()
	var box_shape := BoxShape3D.new()
	box_shape.size = Vector3(4.0, 2.6, 0.4)
	shape.shape = box_shape
	body.add_child(shape)
	body.position = wall.position
	body.rotation.y = cam_yaw
	add_child(body)
	var timer := get_tree().create_timer(12.0)
	timer.timeout.connect(func() -> void:
		if is_instance_valid(wall):
			wall.queue_free()
		if is_instance_valid(body):
			body.queue_free()
	)


func _process(delta: float) -> void:
	zone.update(delta * 1000.0, rng)
	if zone_mesh:
		zone_mesh.position = Vector3(zone.cx, 0.4, zone.cy)
		var torus := zone_mesh.mesh as TorusMesh
		torus.inner_radius = zone.radius / 20.0
		torus.outer_radius = zone.radius / 20.0 + 0.4
	if player:
		var pivot := player.get_node("CamPivot") as Node3D
		if pivot:
			pivot.rotation.y = cam_yaw
		hp_bar.value = player.hp_value()
	zone_label.text = "Zona: %s (fase %d) — %.0fs" % [zone.mode, zone.phase + 1, max(0.0, zone.timer_ms / 1000.0)]
	alive_label.text = "Vivos: %d" % (1 + bots.size())
