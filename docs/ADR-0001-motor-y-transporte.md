# ADR-0001 — Motor y transporte para el vertical slice

**Estado:** aceptado
**Fecha:** 2025-11-12

## Contexto

La spec maestra exige evaluar motor (Godot 4, Unreal u otra) mediante prueba técnica
comparativa, soportar Android/iOS/Windows/Linux, y exige que el propietario definió que
el dispositivo de un jugador hará de servidor de partida (sin servidores dedicados pagados
en esta etapa).

## Decisión

**Vertical slice en TypeScript multiplataforma (web), sin motor pesado:**

1. **Dominio compartido en TypeScript puro** (`game/src/shared/`): simulación
   determinista con semilla, sin I/O. Corre en Node y en navegadores sin cambios.
2. **Cliente web** con Canvas 2D de alta resolución (DPR hasta 3×). Corre en Android,
   iOS, Windows y Linux vía navegador/PWA — las 4 plataformas objetivo de la spec — con
   un solo código de presentación. Controles táctiles + teclado/ratón remapeables.
3. **Transporte dual**: WebSocket (Node `ws`) para servidor dedicado y LAN; WebRTC
   DataChannels con STUN para el modo "el dispositivo del anfitrión es el servidor".
4. **PayPal exclusivamente server-side**, credenciales por variables de entorno.

## Alternativas consideradas

- **Godot 4**: excelente para builds nativos (Android/iOS/Windows/Linux) y es el
  candidato principal para las fases 3–6. Descartado para el slice porque el sandbox de
  desarrollo no puede compilar/exportar Godot ni ejecutar sus pruebas, y la spec prohíbe
  "declarar compatibilidad sin build y pruebas reales". La simulación compartida en
  TypeScript es portable a GDScript/C# con esfuerzo moderado si se migra.
- **Unreal**: potencia gráfica máxima, pero equipo/licencias/tamaño inviables para un
  equipo de una persona y builds no verificables aquí.
- **Unity**: buen fit móvil, pero licencias y dependencias de servicios propietarios;
  mismo problema de verificación de builds en este entorno.

## Consecuencias

- Positivas: todo el slice es compilable, testeable (30 pruebas) y ejecutable hoy;
  reglas idénticas en dedicado y P2P; sin coste de servidores en el modo anfitrión.
- Negativas / riesgos: el cliente web no es un APK/AAB firmable todavía; el render 2D
  top-down es provisional hasta validar un motor 3D; el modo anfitrión hereda los límites
  de NAT/rendimiento del dispositivo anfitrión (documentados en OPERATIONS.md).
- Revisión: reevaluar motor antes de la fase 3 (progresión/persistencia), cuando haya
  acceso a herramientas de build nativas.
