# Arquitectura — NEXO: FRONTIER (vertical slice)

## Principios (de la spec maestra)

1. **Servidor autoritativo**: toda lógica competitiva y económica se valida en servidor.
   El cliente solo envía intenciones (input) y acciones declarativas.
2. **Un solo dominio, varios transportes**: la simulación (`shared/sim.ts`) es agnóstica
   del entorno y corre idéntica en Node (servidor dedicado) y en el navegador (host P2P).
3. **Sin secretos en cliente**: PayPal vive solo en el proceso servidor.
4. **Accesibilidad y claridad**: estados, errores y recuperación comunicados; nada depende
   solo de color o sonido.

## Capas

```
┌────────────────────────────────────────────────────────┐
│ CLIENTE (navegador / PWA futura)                        │
│  client/main.ts    menús, HUD, ciclo de partida         │
│  client/render.ts  canvas 2D alta resolución (DPR ≤ 3)  │
│  client/net.ts     transporte WS + reloj de snapshots   │
│  client/p2p.ts     WebRTC host/guest (STUN)             │
│  client/settings.ts ajustes persistentes + remapeo      │
└───────────────▲────────────────────────────────────────┘
                │ ClientMsg / ServerMsg (protocol.ts, versionado)
┌───────────────┴────────────────────────────────────────┐
│ SERVIDOR DE PARTIDA (gameServer.ts)                     │
│ · acepta Connection genérica (WS de Node o DataChannel) │
│ · rate limiting + validación de mensajes (validation.ts)│
│ · tick fijo 30 Hz → MatchSim.tick()                     │
│ · snapshots 15 Hz por cliente (estado "you" personalizado)│
│ · bots de entrenamiento (bots.ts, mismos inputs que humanos)│
└───────────────▲────────────────────────────────────────┘
                │
┌───────────────┴────────────────────────────────────────┐
│ DOMINIO COMPARTIDO (shared/) — sin I/O, determinista    │
│  sim.ts     jugadores, balas, daño, fases, victoria     │
│  zone.ts    zona dinámica en 5 fases (espera/cierre)    │
│  map.ts     mapa procedural por semilla (POIs, loot)    │
│  weapons.ts / loot.ts   armas, rarezas, consumibles     │
│  validation.ts  saneo + límites anti-abuso              │
│  rng.ts     PRNG xorshift con semilla (determinismo)    │
└────────────────────────────────────────────────────────┘

PROCESO SERVIDOR (main.ts): WS + /health + rutas de tienda
TIENDA (paypal/): catálogo cosmético + PayPal server-side
```

## Protocolo (v1)

- `hello → welcome` (verificación de versión; si difiere, error `version-mismatch`).
- `input` (intención, 30 Hz máx., valores saturados) / `action` (pickup, reload, use,
  swap, dropWeapon) / `drop` (elección de aterrizaje) / `ping → pong`.
- Servidor: `snapshot` (estado completo, 15 Hz), `phase`, `event` (kill/shot/hit/pickup),
  `result`, `error`.
- Cambios de protocolo incrementan `PROTOCOL_VERSION`; clientes viejos son rechazados
  con mensaje claro (requisito de compatibilidad de la spec).

## Modo "el dispositivo del anfitrión es el servidor"

- El anfitrión ejecuta `GameServer` en su navegador y juega por transporte local.
- Los invitados conectan por WebRTC DataChannel (fiable+ordenado en el slice; el paso a
  canales no fiables para estado está en la hoja de ruta).
- Señalización: intercambio manual de oferta/respuesta (código copiable). Para LAN existe
  la opción WebSocket directa. Un servidor de señalización automático es fase siguiente.
- Límites documentados: la calidad depende de la conexión del anfitrión; su dirección es
  visible para los peers; para ranked se requiere servidor dedicado (fase futura).

## Rendimiento (medido, no inventado)

- Tick 30 Hz con acumulador fijo (máx. 10 pasos por frame para evitar espiral de muerte).
- Snapshots 15 Hz; el cliente interpola/renderiza a su tasa nativa.
- Presupuesto de snapshot medido en pruebas de humo: 6 jugadores ≈ estado completo de
  69 objetos + 6 jugadores por paquete JSON. Optimizar (delta/d interest management)
  cuando el número de jugadores crezca (ROADMAP fase 5).
