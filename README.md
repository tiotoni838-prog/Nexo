# Nexo FPS

Battle Royale original, competitivo y accesible. Este repositorio contiene la
**especificación de ingeniería** (`NEXO_FRONTIER_MEGA_SPEC.part*`, 100.000 fichas de
trabajo) y el **vertical slice jugable** en `game/`.

## Qué hay implementado (v1.0.0, verificado)

- **Simulación autoritativa compartida** (`game/src/shared/`): movimiento con colisiones,
  **12 armas** con rarezas y daño inspirado en balística real (incluido **lanzacohetes
  explosivo** con daño por área), granadas, airdrops legendarios, loot,
  inventario, zona dinámica en 5 fases con daño creciente, victoria último-en-pie,
  espectador clicable y resultados.
- **3 mapas** (`game/src/shared/map.ts`): Nexo Urbano, Desierto Solar y Volcán Ceniza,
  cada uno con 8 puntos de interés propios, densidad de cobertura y paleta visual
  distinta. Selección con `NEXO_MAP=<id>` en el servidor; el cliente muestra el nombre
  del mapa y renderiza con su paleta.
- **Anti-hacker server-side** (`game/src/shared/antiCheat.ts`): detección de speedhack,
  teletransporte ilegal y posición fuera del mundo con strikes, expulsión automática y
  decaimiento; el cliente nunca decide daño, inventario ni resultados.
- **Doble moneda**: **NX** se gana jugando (kills + posición final, `computeMatchNxEarned`)
  y **USD** es la moneda de pago. La tienda tiene artículos de ambas monedas, todos
  cosméticos (sin pay-to-win).
- **Sistema de actualizaciones** (`game/src/shared/version.ts` + `/api/version`): el
  cliente compara su versión con la del servidor y muestra un banner "Actualizar" que
  recarga con la nueva build.
- **Logo y branding** (`game/client/logo.svg`): logo SVG original con degradado Nexo,
  favicon y menú con fondo animado.
- **Servidor de partida autoritativo** (`game/src/server/`): tick 30 Hz, snapshots 15 Hz,
  validación de mensajes, límites anti-abuso, versionado de protocolo, bots de
  entrenamiento, endpoint `/health`. El cliente nunca decide daño, inventario ni resultados.
- **Cliente web de alta resolución** (`game/client/` + `game/src/client/`): canvas con
  escalado por `devicePixelRatio` (hasta 3×), partículas con glow, sombras, viñeta,
  screen shake, tracers luminosos, SFX sintetizados originales (WebAudio, sin assets),
  teclado/ratón remapeable, controles táctiles, HUD completo, español/inglés, alto
  contraste y escalado de texto.
- **Modo "mi dispositivo es el servidor"** (requisito del propietario): el anfitrión
  ejecuta la MISMA simulación autoritativa en su dispositivo y los invitados se conectan
  por WebRTC con STUN (`game/src/client/p2p.ts`). Incluye además servidor dedicado Node.
- **Personajes con cuerpo y habilidades** (nivel 3): 6 personajes (Aurora, Sombra,
  Titán, Halcón, Vita, Vulcano) con 1 habilidad activa + pasivas estilo los grandes
  del género pero 100% originales: **Muro de Cuarzo** (cobertura desplegable que
  bloquea balas y granadas), Sprint Sombra, Piel de Titán, Recarga Táctica, Pulso
  Sanador y Sobrecarga. Movimiento avanzado: **deslizarse** (impulso con cooldown)
  y **cuerpo a tierra** (menos velocidad, perfil más pequeño). En el cliente web los
  jugadores se dibujan como **humanoides articulados** (torso, cabeza, brazos,
  piernas con ciclo de caminata, arma en manos) con **alas cosméticas** opcionales.
- **Proyecto Godot 4.3 real** (`godot/`): cliente 3D con personajes humanoides con
  cuerpo completo, mapa con edificios y árboles, zona dinámica y lógica pura
  determinista portada a GDScript, verificada headless (29/29 checks).
- **Tienda PayPal activa solo server-side** (`game/src/paypal/`): catálogo 100% cosmético,
  OAuth client-credentials, create/capture order con idempotencia. Las credenciales se
  leen de variables de entorno (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`) — nunca en
  código, cliente, APK ni Git. Copia `game/.env.example` a `game/.env` y rellénalo; el
  servidor lo carga al arrancar.
- **Panel de ganancias del propietario** (`/admin`): página protegida por token
  (`ADMIN_TOKEN`) que consulta la API de transacciones de PayPal y muestra total USD,
  número de operaciones y desglose por artículo. Endpoint JSON: `/api/admin/earnings?days=N`.

## Ejecutar

```bash
cd game
npm install
npm run build

# Servidor dedicado + cliente web
npm start            # juego en ws://localhost:7777, salud en http://localhost:8080/health
npm run client       # sirve el cliente en http://localhost:8080

# Pruebas
npm test

# Proyecto Godot 4 (verificación headless de lógica 3D)
godot --headless --path ../godot --script res://tests/logic_tests.gd
```

En el menú del juego: **Entrenamiento** (partida local con bots, sin red), **Crear
partida** (tu dispositivo hace de servidor P2P) o **Unirse** (WebSocket o P2P).

## Documentación

- [docs/RESEARCH.md](docs/RESEARCH.md) — investigación de referentes del género.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — arquitectura y decisiones.
- [docs/ADR-0001-motor-y-transporte.md](docs/ADR-0001-motor-y-transporte.md)
- [docs/TRACEABILITY.md](docs/TRACEABILITY.md) — matriz requisitos ↔ código ↔ pruebas.
- [docs/SECURITY.md](docs/SECURITY.md) — seguridad, privacidad, secretos, PayPal.
- [docs/OPERATIONS.md](docs/OPERATIONS.md) — operación, límites y limitaciones honestas.
- [docs/ROADMAP.md](docs/ROADMAP.md) — fases siguientes según la spec maestra.

## Estado honesto

Esto es un **vertical slice**, no el juego comercial completo: los builds nativos
(Android/iOS/Windows/Linux), matchmaking global, cuentas, moderación y voz quedan para
las fases 3–6 de la spec maestra. No se afirma rendimiento sin medir; no se declara
compatibilidad de plataforma sin build y pruebas reales.
