class_name NexoRng
extends RefCounted

## PRNG determinista (LCG de 31 bits) para simulaciones reproducibles.

var state: int


func _init(seed_value: int) -> void:
	state = abs(seed_value) % 2147483647
	if state == 0:
		state = 1


func next() -> float:
	state = (state * 48271) % 2147483647
	return float(state) / 2147483647.0


func range_val(a: float, b: float) -> float:
	return a + next() * (b - a)


func int_val(a: int, b: int) -> int:
	return a + int(next() * float(b - a + 1))


func pick(arr: Array) -> Variant:
	if arr.is_empty():
		return null
	return arr[int_val(0, arr.size() - 1)]
