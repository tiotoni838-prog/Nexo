class_name HumanoidRig
extends CharacterBody3D

## Personaje humanoide 3D: torso, cabeza, brazos y piernas con animación
## procedural de caminata. Los personajes tienen cuerpo — nada de "pastillas".

const WALK_SPEED := 6.0
const SPRINT_SPEED := 9.5
const GRAVITY := 24.0
const JUMP_SPEED := 8.0

var character_id := "aurora"
var is_bot := false
var display_name := "Jugador"

var _torso: MeshInstance3D
var _head: MeshInstance3D
var _arm_l: MeshInstance3D
var _arm_r: MeshInstance3D
var _leg_l: MeshInstance3D
var _leg_r: MeshInstance3D
var _gun: MeshInstance3D
var _walk_phase := 0.0
var _cam_yaw := 0.0
var _hp := 100.0
var _gravity_vel := 0.0


func _ready() -> void:
	var def: Dictionary = NexoCharacters.def(character_id)
	var body_color: Color = def["color"]
	var skin := Color(0.91, 0.8, 0.68)

	_torso = _add_part(CapsuleMesh.new(), body_color, Vector3(0.0, 1.05, 0.0), Vector3(0.42, 0.62, 0.28))
	_capsule_orient_y(_torso)
	_head = _add_part(SphereMesh.new(), skin, Vector3(0.0, 1.62, 0.0), Vector3(0.3, 0.3, 0.3))
	var helmet := _add_part(SphereMesh.new(), body_color.darkened(0.25), Vector3(0.0, 1.68, 0.0), Vector3(0.33, 0.26, 0.33))
	helmet.name = "Helmet"
	_arm_l = _add_part(CapsuleMesh.new(), body_color.darkened(0.1), Vector3(-0.34, 1.1, 0.1), Vector3(0.12, 0.26, 0.12))
	_capsule_orient_y(_arm_l)
	_arm_r = _add_part(CapsuleMesh.new(), body_color.darkened(0.1), Vector3(0.34, 1.1, 0.1), Vector3(0.12, 0.26, 0.12))
	_capsule_orient_y(_arm_r)
	_leg_l = _add_part(CapsuleMesh.new(), Color(0.16, 0.2, 0.3), Vector3(-0.14, 0.38, 0.0), Vector3(0.14, 0.34, 0.14))
	_capsule_orient_y(_leg_l)
	_leg_r = _add_part(CapsuleMesh.new(), Color(0.16, 0.2, 0.3), Vector3(0.14, 0.38, 0.0), Vector3(0.14, 0.34, 0.14))
	_capsule_orient_y(_leg_r)
	_gun = _add_part(BoxMesh.new(), Color(0.1, 0.13, 0.2), Vector3(0.3, 1.12, 0.5), Vector3(0.09, 0.12, 0.62))

	var collision := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.35
	capsule.height = 1.7
	collision.shape = capsule
	collision.position = Vector3(0.0, 0.85, 0.0)
	add_child(collision)

	var label := Label3D.new()
	label.text = display_name
	label.font_size = 40
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.position = Vector3(0.0, 2.15, 0.0)
	label.modulate = Color(0.91, 0.93, 0.97)
	add_child(label)


func _capsule_orient_y(part: MeshInstance3D) -> void:
	pass


func _add_part(mesh: Mesh, color: Color, pos: Vector3, scale_v: Vector3) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mesh.material = StandardMaterial3D.new()
	(mesh.material as StandardMaterial3D).albedo_color = color
	(mesh.material as StandardMaterial3D).roughness = 0.65
	mi.mesh = mesh
	mi.position = pos
	mi.scale = scale_v
	add_child(mi)
	return mi


func set_cam_yaw(yaw: float) -> void:
	_cam_yaw = yaw


func take_damage(amount: float) -> void:
	_hp = max(0.0, _hp - amount)


func hp_value() -> float:
	return _hp


func _physics_process(delta: float) -> void:
	var input_vec := Vector2.ZERO
	if not is_bot:
		input_vec = Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var dir := (transform.basis * Vector3(input_vec.x, 0.0, input_vec.y))
	if is_bot and is_inside_tree():
		dir = _bot_direction()
	var speed := WALK_SPEED
	velocity.x = dir.x * speed
	velocity.z = dir.z * speed
	if not is_on_floor():
		_gravity_vel -= GRAVITY * delta
		velocity.y = _gravity_vel
	elif velocity.y < 0.0:
		_gravity_vel = 0.0
		velocity.y = 0.0
	if not is_bot and Input.is_action_just_pressed("jump") and is_on_floor():
		_gravity_vel = JUMP_SPEED
		velocity.y = JUMP_SPEED
	move_and_slide()
	_animate(delta, dir.length() > 0.1)


func _bot_direction() -> Vector3:
	return Vector3.ZERO


func _animate(delta: float, moving: bool) -> void:
	if moving:
		_walk_phase += delta * 9.0
		var swing := sin(_walk_phase) * 0.35
		if _leg_l:
			_leg_l.rotation.x = swing
			_leg_l.position.z = sin(_walk_phase) * 0.18
		if _leg_r:
			_leg_r.rotation.x = -swing
			_leg_r.position.z = -sin(_walk_phase) * 0.18
		if _arm_l:
			_arm_l.rotation.x = -swing * 0.7
		if _arm_r:
			_arm_r.rotation.x = swing * 0.7
		if _torso:
			_torso.position.y = 1.05 + abs(sin(_walk_phase)) * 0.04
	else:
		_walk_phase = 0.0
		for part in [_leg_l, _leg_r, _arm_l, _arm_r]:
			if part:
				part.rotation.x = lerpf(part.rotation.x, 0.0, 0.2)
				part.position.z = lerpf(part.position.z, 0.0 if part != _leg_l and part != _leg_r else 0.0, 0.2)
		if _torso:
			_torso.position.y = lerpf(_torso.position.y, 1.05, 0.2)
