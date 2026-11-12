# Operación — NEXO: FRONTIER (vertical slice)

## Arranque

```bash
cd game
npm install && npm run build
npm start                       # WS 7777 + HTTP 8080 (/health, /api/store/*)
NEXO_BOTS=11 NEXO_PORT=9000 NEXO_HTTP_PORT=9001 npm start
```

Variables de entorno:

| Variable | Por defecto | Descripción |
|---|---|---|
| `NEXO_PORT` | 7777 | Puerto WebSocket del servidor de partida |
| `NEXO_HTTP_PORT` | 8080 | HTTP: `/health` + tienda |
| `NEXO_BOTS` | 7 | Bots de entrenamiento por partida |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | — | Credenciales PayPal (SOLO entorno del servidor) |
| `PAYPAL_API_BASE` | sandbox | `https://api-m.paypal.com` en producción |

## Salud

- `GET /health` → `{"status":"ok","phase":...,"alive":...,"uptimeSec":...}`.

## Modo "mi dispositivo es el servidor" (P2P)

1. Anfitrión: menú → **Crear partida** → **Generar invitación** → copia el código y
   pásaselo al invitado por cualquier canal.
2. Invitado: menú → **Unirse** → pega el código → **Unirse P2P** → copia el **código de
   respuesta** y devuélveselo al anfitrión.
3. Anfitrión: **Aceptar respuesta**. La partida corre en el dispositivo del anfitrión.

**Limitaciones honestas:**

- La calidad de la partida depende de la conexión del anfitrión (subida especialmente).
- La IP del anfitrión es visible para los invitados (WebRTC). Mitigación futura: relay
  TURN propio (coste) o servidor dedicado.
- NATs restrictivos pueden requerir TURN; STUN solo resuelve la mayoría de casos.
- Señalización manual: no hay lobby automático todavía.
- Un anfitrión puede hacer trampas en su propia partida: no usar para ranked.

## Pruebas

```bash
cd game && npm test          # 30 pruebas de dominio, servidor, validación y tienda
```

Prueba de humo ejecutada (evidencia): servidor en `:7792`, cliente WS:
`WELCOME id=6, pois=8, tickHz=30 → PHASE → SNAPSHOT players=6 items=69 zoneR=1104 → PONG ok`.

## Rollback / versión

- El protocolo está versionado (`PROTOCOL_VERSION`); clientes antiguos son rechazados
  con mensaje claro. Desplegar servidor y cliente de la misma versión.
