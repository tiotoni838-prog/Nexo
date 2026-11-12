# Hoja de ruta — fases según la spec maestra

## Fase 0–2 (hecho en este vertical slice) ✓

- Inspección del repo, índice de la spec, investigación de referentes.
- Prototipo jugable: movimiento, cámara, mapa pequeño, partida local con bots.
- Slice online: servidor autoritativo, matchmaking básico (sala única), P2P anfitrión.
- Tienda cosmética server-side (PayPal) preparada para credenciales por entorno.

## Fase 3 — progresión, social y persistencia

- Cuentas y sesiones (auth server-side), perfiles, inventario persistente.
- Matchmaking con colas y regiones; reconexión; salas privadas y dúos/escuadras.
- Señalización WebRTC automática (servidor de señalización pequeño) para el modo anfitrión.
- Espectador con cambio de objetivo.

## Fase 4 — economía, comunidad y herramientas

- Pase de temporada cosmético, monetización con controles de gasto y reembolsos.
- Moderación: reportes, bloqueos, filtros, apelaciones; herramientas de administración.
- Chat seguro con filtro; voz opcional (por defecto apagada).

## Fase 5 — optimización y plataformas

- Delta snapshots + interest management por rejilla; canales WebRTC no fiables para estado.
- Pruebas de carga con cifras medidas; dimensionar límites reales por modo.
- Builds nativos: Godot 4 (dominio compartido migrado) o Capacitor/Tauri sobre el cliente
  web; APK/AAB, instalador Windows, paquetes Linux — solo cuando compilen de verdad.

## Fase 6 — beta y operación

- Beta cerrada, telemetría optativa mínima, despliegue gradual, rollback, alertas.

## Criterios de salida de cada fase

Los define la spec maestra: compilar desde limpio, ciclo de partida completo, resultados
validados por servidor, builds reproducibles por plataforma declarada, sin secretos en
Git, sin ventajas comprables, accesibilidad y privacidad con pruebas.
