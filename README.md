# NEXO: FRONTIER

Battle Royale original, competitivo y accesible. Este repositorio contiene la
**especificación de ingeniería** (`NEXO_FRONTIER_MEGA_SPEC.part*`, 100.000 fichas de
trabajo) y el **vertical slice jugable** en `game/`.

## Qué hay implementado (vertical slice v0.1, verificado)

- **Simulación autoritativa compartida** (`game/src/shared/`): movimiento con colisiones,
  6 armas originales con rarezas, granadas con daño por área, airdrops legendarios, loot,
  inventario, zona dinámica en 5 fases con daño creciente, victoria último-en-pie,
  espectador clicable y resultados.
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
- **Tienda PayPal solo server-side** (`game/src/paypal/`): catálogo 100% cosmético,
  OAuth client-credentials, create/capture order con idempotencia. Las credenciales se
  leen de variables de entorno (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`) — nunca en
  código, cliente, APK ni Git.

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
