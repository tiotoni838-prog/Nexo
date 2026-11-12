# NEXO: FRONTIER — Proyecto Godot 4.3

Cliente 3D con **personajes humanoides con cuerpo** (torso, cabeza, brazos, piernas,
animación procedural de caminata), mapa 3D con edificios y árboles, zona dinámica
y HUD. La lógica pura (zona, combate, personajes, flujo de partida) está portada
a GDScript determinista en `scripts/logic/` y se verifica headless.

## Estructura

- `project.godot` — proyecto Godot 4.3 (input WASD/salto/habilidad configurado)
- `scenes/main.tscn` — escena raíz (todo se construye por código)
- `scripts/main_3d.gd` — entorno, mapa, zona, jugador, bots, HUD
- `scripts/humanoid_rig.gd` — personaje humanoide `CharacterBody3D` con ciclo de caminata
- `scripts/logic/` — lógica pura determinista (`NexoRng`, `NexoZone`, `NexoCombat`,
  `NexoCharacters`, `NexoMatchLogic`), portada de `game/src/shared/`
- `tests/logic_tests.gd` — suite headless (29 checks)

## Verificación headless (sin pantalla)

```bash
godot --headless --path godot --import              # importa recursos
godot --headless --path godot --script res://tests/logic_tests.gd
```

## Ejecutar con ventana

```bash
godot --path godot
```

WASD mueve, ratón gira la cámara (clic captura el ratón), Espacio salta,
C despliega el **Muro de Cuarzo** (Aurora).

## Estado honesto

- ✅ Verificado en esta máquina: importación headless + 29/29 checks de lógica
  con Godot 4.3 stable (`4.3.stable.official.77dcf97d8`).
- ⛔ **Exportación APK/AAB bloqueada en el entorno de desarrollo**: no hay Android
  SDK ni plantillas de exportación. Para generar el APK, instala Godot 4.3 en tu
  equipo, añade *Android Build Templates* y exporta desde *Project > Export*.
- El disparo/daño 3D usa la lógica de `scripts/logic/`; el modo multijugador del
  cliente 3D se conectará al mismo protocolo v2 del servidor autoritativo.
