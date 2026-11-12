# Matriz de trazabilidad — vertical slice v0.1

Conexión requisitos de la spec maestra (y dominios de las fichas) ↔ código ↔ pruebas ↔ evidencia.

| Requisito (spec maestra / dominio) | Código | Pruebas | Evidencia |
|---|---|---|---|
| Servidor autoritativo; el cliente nunca decide resultados (08/09) | `game/src/shared/sim.ts` (todo el daño/loot/fases en servidor), `game/src/server/gameServer.ts` | `test/gameServer.test.ts` (input fuera de rango se satura; resultado autoritativo) | `npm test` 46/46 ✓ (antes 30/30; suite ampliada) |
| Validación de entradas y límites anti-abuso (09) | `game/src/shared/validation.ts`, rate limiter en `gameServer.ts` | `test/validation.test.ts` | ídem |
| Versionado de protocolo / compatibilidad (08) | `PROTOCOL_VERSION`, rechazo en `gameServer.handleMessage` | `test/gameServer.test.ts` «versiones incompatibles» | ídem |
| Zona dinámica y legible (02) | `game/src/shared/zone.ts` (5 fases, DPS creciente), render de círculo + objetivo punteado + temporizador HUD | `test/sim.test.ts` «zona se encoge», «daño de zona» | ídem |
| Recolección / inventario (02, 06) | `game/src/shared/loot.ts`, `sim.pickup/applyItem/useConsumable` | `test/sim.test.ts` «recoger arma y consumibles», «núcleo de escudo» | ídem |
| Combate ficticio abstracto con rarezas (02, 06) | `game/src/shared/weapons.ts` (6 armas originales), balas y granadas AoE en `sim.ts` | `test/sim.test.ts` «dispara, pega y mata», «escudos absorben» | ídem |
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

| Granadas de utilidad (06) | `sim.throwGrenade/stepGrenades/explodeGrenade` (AoE con caída de daño, auto-daño) | `test/sim.test.ts` «granadas explotan», «fuera del radio» | ídem |
| Eventos ambientales (04) | airdrops legendarios cada 45 s dentro de la zona (`sim.spawnAirdrop`) | `test/sim.test.ts` «airdrops aparecen» | ídem |
| Audio accesible con subtítulos (14, 13) | `client/audio.ts` (SFX sintetizados WebAudio, sin assets), cada cue tiene subtítulo | manual | — |
| Presentación de alto nivel (petición del propietario) | `client/effects.ts` (partículas, anillos de explosión), sombras, viñeta, screen shake, tracers con glow, nombres de POI (`client/render.ts`) | manual | — |
| Espectador con cambio de objetivo (02) | clic para ciclar jugadores vivos (`client/main.ts`) | manual | — |

| Personajes con habilidades activas + pasivas (petición: "personajes bien hechos") | `shared/characters.ts` (6 personajes), `sim.useAbility`, bots usan habilidades | `test/abilities.test.ts` (12 tests) | `npm test` 46/46 ✓ |
| Cobertura desplegable que bloquea balas/granadas (original, estilo Gloo Wall) | `sim.deployCoverWall` (Muro de Cuarzo), colisión de balas/jugadores/granadas con muros | `test/abilities.test.ts` «Muro de Cuarzo bloquea y expira» | ídem |
| Movimiento avanzado: slide y prone (estilo Free Fire, original) | `sim.movePlayer` (SLIDE_BOOST, PRONE_SPEED), `effectiveRadius` | `test/abilities.test.ts` «slide», «prone» | ídem |
| Personajes con cuerpo, no "pastillas" (petición explícita) | `client/render.ts` `drawHumanoid` (torso, cabeza, brazos, piernas, arma, ciclo de caminata) + alas cosméticas | manual (visual) | — |
| Motor Godot 4 (fase 3-6 de ROADMAP) | `godot/` proyecto completo 4.3: lógica pura GDScript + escena 3D con humanoides | `godot/tests/logic_tests.gd` 29/29 ✓ headless (Godot 4.3 stable `77dcf97d8`) | `godot/README.md` |

| Arsenal extendido de 12 armas con daño inspirado en balística real (petición: "todas las armas") | `shared/weapons.ts` (revólver, SMG compacto, fusil de batalla, escopeta doble, precisión, lanzacohetes explosivo) | `test/content.test.ts` (12 armas, explosivo único) | `npm test` 66/66 ✓ |
| Balas explosivas con daño por área (lanzacohetes) | `sim.explodeAt` (reutiliza explosión de granadas, daña muros) | `test/content.test.ts` + `test/sim.test.ts` | ídem |
| 3 mapas con POI y paleta propias (petición: "muchos mapas") | `shared/map.ts` MAP_PRESETS (Nexo Urbano, Desierto Solar, Volcán Ceniza), `NEXO_MAP` en servidor, paleta en cliente | `test/content.test.ts` (determinismo y diferencia entre presets) | ídem |
| Anti-hacker potente server-side (petición explícita) | `shared/antiCheat.ts` (speedhack, teleport, out-of-world, strikes con decaimiento), `gameServer.runAntiCheat` por tick | `test/antiCheat.test.ts` (8 tests) | ídem |
| Doble moneda: NX ganada jugando + USD de pago | `paypal/store.ts` (catálogo USD+NX, `computeMatchNxEarned`), saldo NX en cliente (localStorage) | `test/paypal.test.ts` (doble moneda, recompensas) | ídem |
| Panel de ganancias del propietario | `paypal/earnings.ts` (API transacciones PayPal), `paypal/adminRoutes.ts` (`/admin`, `/api/admin/earnings`, token ADMIN_TOKEN) | `test/earnings.test.ts` (3 tests) + smoke live (saldo real) | ídem |
| Sistema de actualizaciones en el cliente | `shared/version.ts`, `/api/version`, banner "Actualizar" en menú | `test/content.test.ts` (versión semántica) | ídem |
| Logo y branding Nexo FPS | `client/logo.svg` (SVG original), favicon, menú con fondo animado | manual (visual) | — |

## v1.2.0 — expansión de meta-juego, cuentas y social

| Función | Implementación | Verificación | Evidencia |
|---|---|---|---|
| Cuentas: registro/login, scrypt, sesiones 30 días | `server/accounts.ts` (AccountStore, persistencia JSON atómica) | `test/accounts.test.ts` (24 tests) | `npm test` 104/104 ✓ |
| Verificación en dos pasos TOTP (RFC 6238) | `server/accounts.ts` enableTotp/confirmTotp, endpoints `/api/profile/totp[/confirm]` | `test/accounts.test.ts` flujo TOTP | ídem |
| Baneos y reportes | `server/accounts.ts` ban/unban/fileReport, `/api/reports` | `test/accounts.test.ts` | ídem |
| Amigos, clanes con moneda de clan | `server/accounts.ts` addFriend/createClan/addClanCoins, `/api/social/*` | `test/accounts.test.ts` | ídem |
| Tabla de clasificación por campo | `server/accounts.ts` leaderboard, `/api/leaderboard?field=` | `test/accounts.test.ts` | ídem |
| Códigos de canje con cooldown + usos únicos | `server/accounts.ts` addRedeemCode/redeem, `meta/economy.ts` validateRedeemCode | `test/accounts.test.ts` | ídem |
| Misiones diarias rotativas + semanales + reclamo | `meta/progression.ts` (dailyMissionsFor, recordMatchInMissions, claimMissionReward) | `test/accounts.test.ts` | ídem |
| Logros con progreso acumulado | `meta/progression.ts` ACHIEVEMENTS/achievementProgress | `test/accounts.test.ts` | ídem |
| Login diario con ciclo de 7 días (premio día 7) | `meta/progression.ts` DAILY_LOGIN_CYCLE, `server/accounts.ts` claimDailyLogin | `test/accounts.test.ts` | ídem |
| Rangos clasificatorios (Bronce→Nexo) + puntos RR | `meta/progression.ts` RANK_TIERS/rankedPointsDelta | `test/accounts.test.ts` | ídem |
| VIP (bonus NX + Dalos diarios) | `meta/economy.ts` (VIP_*, vipIsActive/vipNxBonus) | `test/accounts.test.ts` | ídem |
| Fragmentos por partida + fabricación por rareza | `meta/economy.ts` FRAGMENTS_TO_CRAFT_RARITY/craftItem | `test/accounts.test.ts` | ídem |
| 10 modos de juego; implementados cambian la sim real | `shared/gameModes.ts`, `sim.ts` (zoneSpeedMult, lista blanca de armas), `gameServer.ts` (modeId) | `test/accounts.test.ts` (zona rápida, lista blanca) | ídem |
| Pantalla de login/registro + TOTP en cliente | `client/auth.ts`, sección `#auth` en `client/index.html` | manual | — |
| Pestañas Misiones/Logros/Social/Códigos + login diario | `client/meta.ts` (renderMisiones/renderLogros/renderSocial/renderCodigos), `client/index.html` | manual | — |
| Ajustes: gráficos/sonido/juego/red | `client/settings.ts` (calidad→DPR+partículas, FPS, sombras, brillo, volúmenes, daltónico, región, ahorro de datos), wiring en `client/main.ts` | `npm run build` ✓ | — |
| Cosméticos: sprays, paracaídas, marcos, insignias, mascotas | `shared/locker.ts` (9 slots), `paypal/store.ts` (10 artículos nuevos en NX/Dalos) | `test/paypal.test.ts` + `test/meta.test.ts` (catálogo) | ídem |
| Volumen general/música/efectos aplicado a SFX | `client/audio.ts` setVolumes/scaled | manual | — |

## Bloqueos registrados

1. **Builds nativos (APK/AAB, instaladores)**: sin toolchain Android/iOS/Electron en el
   entorno. Instrucción reproducible: migrar el dominio compartido a Godot 4 (ADR-0001)
   o empaquetar el cliente web con Capacitor/Tauri cuando haya toolchain.
2. **Prueba E2E P2P entre dispositivos**: requiere dos navegadores reales; el código
   WebRTC está implementado y tipado, pendiente de verificación manual con el procedimiento
   de OPERATIONS.md.
3. **Credenciales PayPal**: configuradas por el propietario en `game/.env` (gitignored,
   fuera de Git). Verificadas contra la API live: OAuth y transacciones responden
   correctamente (ver smoke de TRACEABILITY).
