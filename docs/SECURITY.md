# Seguridad y privacidad — NEXO: FRONTIER

## Secretos (regla inquebrantable)

- **Nunca** escribas `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` (ni ninguna credencial)
  en el chat, en el código, en el cliente web, en el APK ni en commits.
- Solo variables de entorno del **proceso servidor**: `PAYPAL_CLIENT_ID`,
  `PAYPAL_CLIENT_SECRET`, opcional `PAYPAL_API_BASE`.
- El módulo `game/src/paypal/` **no debe importarse nunca** desde `src/client/`.
- Si alguna credencial llegó a filtrarse: revocarla inmediatamente en el panel de
  PayPal y generar una nueva.

## Validación en servidor

- Todo mensaje del cliente pasa por `validateClientMsg`: tipos, rangos y acciones
  permitidas; lo desconocido se rechaza con `error`.
- Rate limiting por conexión (90 msg/s por defecto); abusadores reiterados son
  desconectados (`strikes > 20`).
- El movimiento es recalculado por el servidor desde inputs saturados: un cliente no
  puede teleportarse ni alterar su velocidad.
- Daño, loot, inventario, zona y victoria se calculan solo en `MatchSim`.

## Privacidad

- No se recogen datos personales: el nombre de jugador es un alias sanitizado
  (`sanitizeName`, máx. 16 caracteres, sin símbolos).
- Sin cuentas, sin ubicación, sin micrófono, sin contactos en el slice.
- El modo P2P expone la dirección IP del anfitrión a los invitados (inherente a WebRTC);
  documentado en OPERATIONS.md con mitigaciones.
- Telemetría: ninguna en el slice (minimización por defecto, según la spec).

## Modo anfitrión e integridad

- El anfitrión ejecuta la simulación: un anfitrión malicioso podría alterar su partida
  local. Aceptado para partidas entre amigos; **el modo competitivo/ranked exigirá
  servidor dedicado** (fase futura). No se promete integridad anti-trampas en P2P.

## Pagos

- Solo cosméticos; sin loot boxes pagadas; precio visible antes de confirmar; captura
  server-side con idempotencia (`PayPal-Request-Id`).
- La tienda responde 503 con instrucciones si faltan credenciales; el juego funciona
  completo sin tienda.

## Pendientes (registrados, no simulados)

- Cifrado en tránsito: el WS dedicado debería ir detrás de TLS (wss) en producción;
  WebRTC ya viaja cifrado (DTLS).
- Autenticación de jugadores y sesiones (fase 3 de la spec).
- Moderación, reportes y bloqueos (fase 4).
