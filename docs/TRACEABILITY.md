# Matriz de trazabilidad — vertical slice v0.1

Conexión requisitos de la spec maestra (y dominios de las fichas) ↔ código ↔ pruebas ↔ evidencia.

| Requisito (spec maestra / dominio) | Código | Pruebas | Evidencia |
|---|---|---|---|
| Servidor autoritativo; el cliente nunca decide resultados (08/09) | `game/src/shared/sim.ts` (todo el daño/loot/fases en servidor), `game/src/server/gameServer.ts` | `test/gameServer.test.ts` (input fuera de rango se satura; resultado autoritativo) | `npm test` 30/30 ✓ |
| Validación de entradas y límites anti-abuso (09) | `game/src/shared/validation.ts`, rate limiter en `gameServer.ts` | `test/validation.test.ts` | ídem |
| Versionado de protocolo / compatibilidad (08) | `PROTOCOL_VERSION`, rechazo en `gameServer.handleMessage` | `test/gameServer.test.ts` «versiones incompatibles» | ídem |
| Zona dinámica y legible (02) | `game/src/shared/zone.ts` (5 fases, DPS creciente), render de círculo + objetivo punteado + temporizador HUD | `test/sim.test.ts` «zona se encoge», «daño de zona» | ídem |
| Recolección / inventario (02, 06) | `game/src/shared/loot.ts`, `sim.pickup/applyItem/useConsumable` | `test/sim.test.ts` «recoger arma y consumibles», «núcleo de escudo» | ídem |
| Combate ficticio abstracto con rarezas (02, 06) | `game/src/shared/weapons.ts` (5 armas originales), balas en `sim.ts` | `test/sim.test.ts` «dispara, pega y mata», «escudos absorben» | ídem |
| Victoria y condición final (02) | `sim.checkVictory`, `placementOf`, `result` | `test/sim.test.ts` «victoria por último en pie» | ídem |
| Bucle: despliegue → saqueo → zona → final (02) | fases lobby/drop/play/over en `sim.ts` + `gameServer` | `test/sim.test.ts` «lobby a drop a play», «despliegue por tiempo» | ídem |
| Movimiento responsivo + colisiones (03) | `sim.movePlayer`, resolución círculo-rectángulo | `test/sim.test.ts` «colisiona con obstáculos» | ídem |
| Entrenamiento con bots (07) | `game/src/shared/bots.ts`, `NEXO_BOTS` | smoke test: 5 bots en partida real | log de humo |
| Controles remapeables, táctil, teclado/ratón (03, 13) | `client/settings.ts` (remapeo persistente), `client/index.html` (joystick + botones) | manual (UI); pendiente prueba E2E | ROADMAP |
| Alta resolución (petición explícita del propietario) | `client/render.ts` (canvas escalado por devicePixelRatio hasta 3×) | manual | — |
| Accesibilidad: texto, contraste, subtítulos, no solo color (01, 13) | `settings.ts` (textScale, highContrast, subtitles), rareza con etiqueta+forma | manual; pendiente prueba E2E | — |
| Español e inglés (13) | `shared/i18n.ts`, selector en ajustes | manual | — |
| Espectador (02) | cliente muestra partida al morir, subtítulo «Modo espectador» | manual | — |
| Monetización solo cosmética, sin pay-to-win (11) | `paypal/store.ts` (catálogo exclusivamente cosmético) | `test/paypal.test.ts` «solo cosméticos» | ídem |
| Pagos server-side, sin secretos en cliente/Git (11, 19) | `paypal/paypalClient.ts` (env-only), `storeRoutes.ts` (503 sin credenciales) | `test/paypal.test.ts` (secretos nunca en errores) | ídem |
| Mi dispositivo hace de servidor (petición del propietario) | `client/p2p.ts` (WebRTC+STUN), `GameServer` transport-agnóstico | diseño; prueba E2E P2P pendiente (requiere 2 navegadores) | ROADMAP |
| Salud/operaciones observables (19) | `/health` en `server/main.ts` | smoke test con `fetch` | log de humo |
| Builds nativos Android/iOS/Windows/Linux | **NO implementado** — bloqueado: no hay toolchain de export en este entorno | — | ADR-0001, ROADMAP fases 5–6 |

## Bloqueos registrados

1. **Builds nativos (APK/AAB, instaladores)**: sin toolchain Android/iOS/Electron en el
   entorno. Instrucción reproducible: migrar el dominio compartido a Godot 4 (ADR-0001)
   o empaquetar el cliente web con Capacitor/Tauri cuando haya toolchain.
2. **Prueba E2E P2P entre dispositivos**: requiere dos navegadores reales; el código
   WebRTC está implementado y tipado, pendiente de verificación manual con el procedimiento
   de OPERATIONS.md.
3. **Credenciales PayPal**: el propietario debe configurarlas como variables de entorno
   del servidor (nunca en el chat ni en Git); la tienda responde 503 con instrucciones
   hasta entonces.
