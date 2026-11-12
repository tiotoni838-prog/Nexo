# NEXO: FRONTIER — Investigación de referentes del género

Investigación realizada para fundamentar las decisiones de diseño del vertical slice.
Fuentes consultadas: análisis públicos de tick rate y netcode (Battle(non)sense, deep dive
de Respawn sobre Apex Legends, bases de datos públicas de tick rate), guías de producción
de BR, y documentación pública de PayPal. Ningún asset, nombre, mapa ni mecánica
protegida de otros juegos fue copiado: solo patrones de ingeniería y de diseño de sistemas.

## 1. Netcode y tick rate (qué hacen los referentes)

| Juego | Tick rate aprox. | Jugadores | Lección para NEXO |
|---|---|---|---|
| Fortnite | ~30 Hz constante | 100 | Suficiente para BR casual si hay interpolación y predicción correctas. |
| Apex Legends | ~20 Hz | 60 | Tick bajo sin compensación genera desync percibido; el TTK alto amortigua. |
| PUBG | 30–60 Hz dinámico | 100 | Tick dinámico según carga: buena referencia para servidores modestos. |
| Warzone | 20–24 Hz | 150 | Criticado por hit reg; el problema suele ser la compensación, no solo el Hz. |
| Battlefield BR | ~30–45 Hz | 100–128 | 30 Hz es el umbral razonable para BR; 60 Hz es meta competitiva. |

**Decisión:** tick de simulación de **30 Hz** en el servidor autoritativo, snapshots a
**15 Hz** con interpolación en el cliente y predicción local del propio movimiento con
reconciliación suave. Es el punto de partida honesto para un vertical slice; la meta
competitiva (60 Hz con compensación de lag) queda registrada en la hoja de ruta.

## 2. Arquitectura de partida (patrón común del género)

- **Servidor autoritativo:** el cliente nunca decide daño, inventario, resultados ni
  transacciones. El cliente envía *intenciones* (input); el servidor valida y simula.
- **Predicción del cliente + reconciliación** para el movimiento propio.
- **Interés management:** en producción, envío por rejilla/cull distance para escalar a
  100 jugadores. En el vertical slice se envían snapshots completos (límite documentado:
  partidas pequeñas, 8–24 jugadores) y la optimización queda en la hoja de ruta.
- **Reconexión y versionado de protocolo:** verificar versión antes de unir; expulsar
  versiones incompatibles con mensaje claro.

## 3. Bucle de partida (patrones comunes del género)

1. **Despliegue** (salto/elección de aterrizaje) → 2. **saqueo temprano** →
3. **rotaciones forzadas por zona** → 4. **encuentros de riesgo/recompensa** →
5. **final en zona pequeña** con condición de victoria clara (último en pie).
- La **zona** debe ser legible: círculo visible en mundo y minimapa, temporizador en HUD,
  daño creciente por fase. Fases con espera + encogimiento (patrón estándar del género).
- **Loot con rareza** (común → legendario) que comunica poder con color **y forma/etiqueta**
  (accesibilidad: nunca solo color).
- **Espectador** al morir y pantalla de victoria con estadísticas de la partida.

## 4. Movimiento y controles

- Movimiento responsivo con aceleración corta; apuntado independiente del movimiento.
- Controles remapeables (teclado/ratón, mando, táctil con joystick virtual + botones),
  sensibilidad configurable. Todos los referentes serios tratan el remapeo como requisito,
  no como lujo.

## 5. Monetización responsable (obligación de la spec maestra)

- Solo **cosméticos**: sin pay-to-win, sin cajas de botín pagadas, sin presión artificial.
- Precio real visible antes de confirmar; moneda premium con tipo de cambio claro.
- **PayPal**: integración exclusivamente del lado servidor (OAuth client-credentials,
  create/capture order, idempotencia). El *client secret* nunca llega al cliente, al APK,
  ni al historial Git: solo variables de entorno (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`).
- Referencia: documentación de PayPal Checkout Server-side + normativas de cajas de
  botín (p. ej. divulgación de probabilidades en varios países). NEXO evita el problema
  por diseño: sin cajas aleatorias pagadas.

## 6. Host en el dispositivo del jugador (requisito del propietario del proyecto)

El propietario definió que **el dispositivo de un jugador actúa como servidor de partida**
para evitar servidores dedicados pagados. Investigación y decisión:

- Patrón **listen-server / host-authoritative P2P** (usado por juegos coop/competitivos
  pequeños): el anfitrión ejecuta la misma simulación autoritativa; los demás se conectan.
- Transporte: **WebRTC DataChannels** (no fiable+ordenado para estado, fiable para eventos)
  con **STUN** para atravesar NAT. No se necesita servidor de juego, solo un mecanismo de
  *señalización* (en el vertical slice: intercambio manual de oferta/respuesta; servidor de
  señalización pequeño incluido para LAN).
- **Límites documentados honestamente:** el anfitrión con mala conexión degrada la partida
  de todos; su IP es visible para los peers (mitigable con relay TURN de pago, fuera de
  alcance del slice); un host tramposo es un riesgo de integridad aceptado para partidas
  entre amigos, no para ranked. El modo ranked exigirá servidor dedicado (fase futura).
- Ventaja: el mismo módulo de simulación corre en Node (dedicado) y en el navegador
  (host), garantizando reglas idénticas.

## 7. Accesibilidad (requisito transversal de la spec)

- Escalado de texto, alto contraste, rareza comunicada por color + etiqueta + forma.
- Subtítulos de pistas de audio (pasos, disparos cercanos, zona).
- Remapeo de teclas persistente; joystick táctil con tamaño ajustable.
- Español e inglés desde el primer build (i18n con claves, no cadenas sueltas).
