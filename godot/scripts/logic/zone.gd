class_name NexoZone
extends RefCounted

## Zona de tormenta en 5 fases (espera -> encogimiento), portada de shared/zone.ts.

const WORLD_RADIUS := 1200.0

const PHASES := [
	{"wait_ms": 25000.0, "shrink_ms": 30000.0, "radius_factor": 0.62, "dps": 2.0},
	{"wait_ms": 20000.0, "shrink_ms": 25000.0, "radius_factor": 0.55, "dps": 5.0},
	{"wait_ms": 15000.0, "shrink_ms": 20000.0, "radius_factor": 0.50, "dps": 8.0},
	{"wait_ms": 12000.0, "shrink_ms": 18000.0, "radius_factor": 0.45, "dps": 12.0},
	{"wait_ms": 10000.0, "shrink_ms": 15000.0, "radius_factor": 0.0, "dps": 18.0},
]

var phase := 0
var mode := "wait"
var timer_ms := 0.0
var cx := 0.0
var cy := 0.0
var radius := 0.0
var target_cx := 0.0
var target_cy := 0.0
var target_radius := 0.0
var start_cx := 0.0
var start_cy := 0.0
var start_radius := 0.0


static func clampf_(v: float, lo: float, hi: float) -> float:
	return max(lo, min(hi, v))


static func initial(rng: NexoRng) -> NexoZone:
	var zone := NexoZone.new()
	var radius := WORLD_RADIUS * 0.92
	var max_offset := WORLD_RADIUS - radius
	zone.radius = radius
	zone.target_radius = radius
	zone.start_radius = radius
	zone.cx = rng.range_val(-max_offset, max_offset)
	zone.cy = rng.range_val(-max_offset, max_offset)
	zone.target_cx = zone.cx
	zone.target_cy = zone.cy
	zone.start_cx = zone.cx
	zone.start_cy = zone.cy
	zone.timer_ms = float(PHASES[0]["wait_ms"])
	return zone


func _compute_target(rng: NexoRng) -> void:
	var ph: Dictionary = PHASES[phase]
	var next_radius: float = radius * float(ph["radius_factor"])
	var max_offset: float = max(0.0, radius - next_radius)
	var angle: float = rng.next() * TAU
	var offset: float = rng.next() * max_offset * 0.7
	target_radius = next_radius
	target_cx = clampf_(cx + cos(angle) * offset, -WORLD_RADIUS + next_radius, WORLD_RADIUS - next_radius)
	target_cy = clampf_(cy + sin(angle) * offset, -WORLD_RADIUS + next_radius, WORLD_RADIUS - next_radius)


func update(dt_ms: float, rng: NexoRng) -> void:
	if mode == "closed":
		return
	timer_ms -= dt_ms
	if mode == "wait":
		if timer_ms <= 0.0:
			_compute_target(rng)
			mode = "shrink"
			timer_ms = float(PHASES[phase]["shrink_ms"])
			start_cx = cx
			start_cy = cy
			start_radius = radius
		return
	if mode == "shrink":
		var ph: Dictionary = PHASES[phase]
		var shrink_ms: float = float(ph["shrink_ms"])
		var t: float = clampf_(1.0 - timer_ms / shrink_ms, 0.0, 1.0)
		cx = start_cx + (target_cx - start_cx) * t
		cy = start_cy + (target_cy - start_cy) * t
		radius = start_radius + (target_radius - start_radius) * t
		if timer_ms <= 0.0:
			cx = target_cx
			cy = target_cy
			radius = target_radius
			if phase >= PHASES.size() - 1 or radius <= 1.0:
				mode = "closed"
				timer_ms = 0.0
			else:
				phase += 1
				mode = "wait"
				timer_ms = float(PHASES[phase]["wait_ms"])


func dps() -> float:
	if mode == "closed":
		return float(PHASES[PHASES.size() - 1]["dps"])
	return float(PHASES[phase]["dps"])


func is_outside(x: float, y: float) -> bool:
	var dx := x - cx
	var dy := y - cy
	return dx * dx + dy * dy > radius * radius
