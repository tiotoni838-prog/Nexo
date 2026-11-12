# Nexo FPS — Servidor oficial de Discord

Este repositorio no puede conectarse a Discord en tiempo real desde este entorno
(no hay conector autenticado), así que aquí vive **todo lo necesario para montar y
operar el servidor oficial**. El propietario crea el servidor y pega lo que hay aquí;
el juego se integra con Discord vía **webhook de anuncios** (ya implementado en el
servidor) y opcionalmente con un **bot** (instrucciones abajo).

---

## 1. Creación del servidor (guía para el propietario)

1. Discord → **Servidor → Crear servidor → El mío**. Nombre: `Nexo FPS`.
2. Sube `game/client/logo.svg` exportado a PNG como **icono** y usa la paleta
   (fondo `#070b14`, acento `#38e1c8`) para el banner.
3. Crea los canales en el orden de la sección 2 (copia los nombres exactos).
4. Crea los **roles** de la sección 12 y asigna permisos por categoría.
5. En `#verificación`, pega el mensaje de vinculación (sección 3).

## 2. Estructura de canales

### Bienvenida y verificación
- `#reglas` — normas de conducta (plantilla abajo).
- `#verificación` — el jugador vincula su ID del juego con `/vincular` (rol "Jugador verificado").
- `#elige-tus-roles` — idioma, región, plataforma (Android / iOS / PC / consola) y creador.
- `#guía-del-servidor` — cómo usar tickets, códigos y bots.
- `#idiomas` — salas por idioma (español, inglés, portugués…).

### Anuncios
- `#noticias` — temporadas, colaboraciones, novedades.
- `#parches-y-actualizaciones` — un mensaje por versión (v1.0.0, v1.1.0, …).
- `#mantenimiento` — caídas, horarios y compensaciones.
- `#eventos` — eventos del juego y del servidor.
- `#estado-del-juego` — estado de servidores y fallos conocidos.
- `#ofertas-y-tienda` — paquetes y ofertas temporales.

### Canje de códigos (bot)
- `#canjear-códigos` — `/canjear CODIGO` (el bot valida contra el servidor).
- `#códigos-activos` — códigos vigentes con fecha de vencimiento.
- `#historial-de-canjes` — consulta por jugador.
- Reglas del bot: un código por cuenta; límite de usos totales; cuenta vinculada y
  no baneada; bloqueo por fuerza bruta; el premio llega al buzón del juego.

### Soporte (IA + humanos)
- `#preguntas-frecuentes`, `#asistente-ia`, `#tickets`.
- Categorías de ticket: Cuenta · Cuenta hackeada · Compras · Bugs · Baneos · Reportes · Otros.
- Flujo: la IA pide datos (ID, dispositivo, fecha, capturas), resuelve lo simple,
  escala lo sensible a un humano con resumen, cierra con encuesta y guarda transcripción.
- Prioridades: **alta** pagos/cuentas robadas, **media** baneos, **baja** dudas.
- Aviso fijo: *el soporte nunca pide contraseñas ni datos de pago*.

### Baneos y sanciones
- `#normas-del-juego`, `#tabla-de-sanciones`, `#apelaciones`,
  `#consulta-de-estado` (`/estado ID`), `#reportes-de-jugadores`, `#reportes-de-trampas`.
- Flujo de apelación: la IA junta pruebas → **un humano decide el baneo final** →
  respuesta al jugador → máximo de apelaciones por sanción.

### Cuenta y perfil
- `#vincular-cuenta` (`/vincular` con código generado en el juego),
  `#recuperar-cuenta`, `#consultar-perfil` (`/perfil ID`), `#cambio-de-nombre`,
  `#privacidad-y-datos`.

### Compras y economía
- `#ayuda-de-compras`, `#reembolsos`, `#compras-no-recibidas`,
  `#pase-y-ruleta`, `#probabilidades-oficiales` (transparencia total),
  `#alertas-de-estafas`.

### Bugs y feedback
- `#reportar-bug` (formulario), `#bugs-conocidos` (recibido / en revisión / corregido),
  `#sugerencias` (votación con reacciones), `#balance-y-armas`, `#beta-testers`.

### Comunidad
- `#chat-general`, chats por idioma, `#buscar-equipo`, `#clips-y-jugadas`,
  `#capturas`, `#arte-de-fans`, `#memes`, `#clanes`, `#presenta-tu-clan`,
  `#creadores-de-contenido`, `#off-topic`.

### Competitivo
- `#torneos-oficiales`, `#inscripciones`, `#resultados`, `#clasificaciones`,
  `#scrims`, `#soporte-de-torneos`, `#hall-de-la-fama`.

### Voz
- Salas de escuadrón (solo/dúo/escuadrón), sala de torneos, sala de eventos,
  salas por idioma, sala de soporte por voz.

### Equipo interno (privado)
- `#moderadores`, `#registro-de-sanciones` (log automático), `#cola-de-apelaciones`,
  `#alertas-de-la-ia`, `#reportes-de-seguridad`, `#datos-y-métricas`, `#desarrolladores`.

## 3. Integración juego ↔ Discord

### Ya implementada en el servidor del juego
- **Anuncios**: crea un webhook en `#noticias` y difunde parches con
  `discord/embed.json` (ver Opción B más abajo).
- **Códigos de canje de Discord**: crea códigos en el servidor con
  `AccountStore.addRedeemCode(...)` o su endpoint y repártelos en `#códigos-activos`.
- **Avisos al propietario**: el servidor del juego también envía baneos, reportes,
  ventas y canjes por **Telegram** (ver `docs/TAREAS-DUENO.md`); puedes duplicarlos a
  Discord con un webhook en `#alertas-de-la-ia`.

### Verificación (vincular cuenta)
Comando `/vincular` del bot:
1. El jugador genera un código en el juego (menú Social → «Vincular Discord»).
2. En Discord escribe `/vincular CODIGO`.
3. El bot valida contra el servidor (`GET /api/profile` con el token de servicio) y
   asigna el rol **Jugador verificado**.

### Bot recomendado
Crea una aplicación en https://discord.com/developers/applications, copia el token y
define `DISCORD_BOT_TOKEN` + `DISCORD_GUILD_ID` en el `.env` del servidor. El bot
atiende: verificación, `/canjear`, `/perfil`, `/estado`, tickets y alertas de la IA.
(Este paso requiere que el propietario ejecute el bot; el token nunca va en Git.)

## 4. Roles

Propietario/Administrador · Moderador · Moderador júnior · Agente de soporte ·
Desarrollador/Equipo oficial · Creador de contenido · Jugador verificado ·
Rangos competitivos (Bronce → Plata → Oro → Platino → Diamante → Maestro → Leyenda) ·
Campeón de torneo · VIP · Beta tester · Sancionado.

## 5. Reglas del servidor (plantilla para `#reglas`)

1. Respeta a los demás: sin insultos, acoso ni discurso de odio.
2. No hagas trampas ni compartas hacks; los reportes van con pruebas.
3. No vendas ni compres cuentas, monedas o Diamantes fuera del juego.
4. Sin spam, publicidad ni enlaces sospechosos (generadores falsos incluidos).
5. No compartas datos personales tuyos ni de otros.
6. Usa cada canal para su tema; los tickets son para soporte.
7. Las decisiones de moderación se apelan solo en `#apelaciones`.

**Reglas de operación (equipo):** la IA nunca decide un baneo permanente sola;
nunca pedir contraseñas ni datos de pago por Discord; verificar identidad antes de
entregar/recuperar cuentas; guardar registro de todo ticket, sanción y canje;
limitar comandos contra abuso; moderadores en varias zonas horarias; respaldo humano
siempre; datos privados solo para el equipo autorizado; publicar tiempos de respuesta.

## 6. Anuncio del juego (copiar y pegar)

```
🎮 NEXO FPS — Battle Royale — ¡YA DISPONIBLE! 🎮

⬇️ DESCARGA (elige tu plataforma):
🪟 Windows nativo: releases/NexoFPS-1.4.0-windows-x64.zip
🐧 Linux nativo:   releases/NexoFPS-1.4.0-linux-x64.zip
🍎 macOS: se genera con `npm run desktop` (ver releases/LEEME.md)
🤖 APK Android y 📱 iOS: vía tiendas oficiales (proyecto listo; ver /download/android y /download/ios)
🎮 Un solo archivo:  releases/NexoFPS-1.4.0-web-standalone.zip

✨ 12 armas · 3 mapas · 6 personajes con habilidades · Pase de Batalla
🎡 Ruleta diaria gratis · Tienda · Armario · Evolutivas · Anti-hacker
🌗 Ciclo día-noche · Zona roja · Brújula y cuadrícula C4

Página de descargas: http://<IP-DE-TU-SERVIDOR>:8080/download
```

### Webhook con embed

1. Canal `#noticias` → **Integraciones → Webhooks → Nuevo webhook** y copia la URL.
2. Ejecuta (sustituye `TU_WEBHOOK_URL`; nunca pegues la URL en Git):

```bash
curl -X POST -H "Content-Type: application/json" -d @discord/embed.json TU_WEBHOOK_URL
```

## 7. Bots de IA del servidor (mapa de responsabilidades)

| Bot | Función |
|---|---|
| Soporte | responde con la base de conocimiento oficial |
| Tickets | abre, clasifica, prioriza y resume casos |
| Códigos | valida, entrega y registra canjes |
| Verificación | une cuenta del juego y Discord |
| Moderación | borra insultos/spam/enlaces y silencia automáticamente |
| Antiestafas | bloquea enlaces falsos y vendedores |
| Torneos | inscripciones, cruces y tablas |
| Perfil | `/perfil`, estadísticas y logros |
| Traducción | traduce entre idiomas |
| Encuestas/niveles | sorteos, niveles y encuestas |
| Estado | avisa automáticamente de caídas |
