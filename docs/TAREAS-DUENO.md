# Tareas y credenciales del propietario (lista viva)

Todo lo que **solo tú** puedes hacer o proporcionar. Mientras avancemos, esta lista
se va actualizando: cuando falte algo, aquí estará anotado. **Ninguna credencial va
en Git** — se coloca en `game/.env` (gitignored) o se configura en la plataforma.

## 1. Ya configurado
- [x] **PayPal** (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` en `game/.env`) — tienda
  activa, panel de ganancias `/admin` con `ADMIN_TOKEN`.

## 2. Telegram — avisos al dueño (listo para activar, falta tu token)
El servidor ya envía por Telegram: **ventas PayPal, reportes de jugadores, canjes de
códigos y baneos**. Para activarlo:
1. Habla con **@BotFather** en Telegram → `/newbot` → elige nombre y usuario.
2. Copia el **token** del bot.
3. Escríbele `/start` a tu bot y obtén tu chat: abre
   `https://api.telegram.org/bot<TOKEN>/getUpdates` y copia `message.chat.id`.
4. Añade a `game/.env`:
   ```
   TELEGRAM_BOT_TOKEN=<token>
   TELEGRAM_CHAT_ID=<tu-chat-id>
   ```
5. Reinicia el servidor: verás `[nexo] avisos Telegram al propietario activos`.

**Pásame cuando quieras**: nada por ahora — con las dos variables de arriba funciona.
Si prefieres, el bot puede avisarte también a un grupo (mete el bot al grupo y usa
ese chat id).

## 3. Discord — servidor oficial (no puedo conectarme yo directamente)
En esta sesión **no existe un conector de Discord**, así que no puedo entrar a tu
servidor en tiempo real. Lo que sí queda hecho en el repo:
- **Blueprint completo** del servidor (canales, roles, bots, reglas): `discord/DISCORD.md`.
- **Anuncio listo** para publicar: `discord/embed.json` (webhook con embed).
- **Integración ya en el servidor del juego**: página `/download` enlazada, códigos de
  canje creados desde el servidor, y avisos Telegram que puedes duplicar a Discord
  con un webhook en `#alertas-de-la-ia`.

**Para conectarlo tú (10 minutos):**
1. Crea el servidor siguiendo `discord/DISCORD.md` §1–2.
2. Canal `#noticias` → Integraciones → Webhooks → copia URL → difunde con:
   `curl -X POST -H "Content-Type: application/json" -d @discord/embed.json TU_WEBHOOK_URL`
3. (Opcional, bot completo) https://discord.com/developers/applications → New
   Application → Bot → copia token → añade `DISCORD_BOT_TOKEN` y `DISCORD_GUILD_ID`
   a `game/.env` y avísame: implemento el bot de verificación/canje/perfil contra él.

**¿No sabes crear el servidor? Ruta desde cero (15 min):**
1. Abre Discord → botón **+** en la barra izquierda → **Crear mi servidor** →
   nombre "Nexo FPS" (sube `game/client/logo.svg` como icono).
2. Crea los canales copiando la lista de `discord/DISCORD.md` §2 (empieza solo
   con: `#reglas`, `#verificación`, `#noticias`, `#soporte`, `#chat-general`,
   `#buscar-equipo`; el resto puedes añadirlo después).
3. En `#noticias`: Integraciones → Webhooks → Nuevo webhook → copia la URL.
4. Publica el anuncio con el comando del paso 2 de arriba (`discord/embed.json`
   ya lleva los enlaces de descarga de Windows/Linux/macOS/web y servidor).
5. Invita a tus amigos/moderadores y asígnales roles (`discord/DISCORD.md` §4).

**Sobre los botones de descarga dentro de Discord:** los webhooks normales no
pueden enviar botones interactivos (Discord solo lo permite a bots de
aplicación). Hoy el embed lleva enlaces por plataforma; cuando me pases
`DISCORD_BOT_TOKEN`, el bot publicará el anuncio con **botones reales**
(Windows / macOS / Linux / APK-iOS / Servidor) y los comandos `/vincular`,
`/canjear`, `/perfil` y `/estado`.

### Flujo de aprobación del dueño (IA recomienda, humano decide)
- **Telegram** es TU canal de administración: el servidor del juego te avisa de
  ventas, reportes, canjes y baneos detectados por el anti-cheat. Tú respondes
  aprobando o denegando (hoy: confirmas en el panel `/admin`; cuando actives el
  bot de Discord también podrás decidir desde allí).
- **Discord** es el canal de los JUGADORES con IA de soporte: la IA responde
  dudas, clasifica tickets y recomienda sanciones, pero **nunca banea sola** —
  un humano (tú o un moderador) confirma.
- Todo queda registrado: tickets, sanciones y canjes tienen log en el servidor.

## 4. Tiendas (cuando pagues la suscripción, avísame)
- [x] **APK de Android publicada**: `releases/NexoFPS-1.6.0-android.apk` — APK
  nativa firmada, lista para instalar en cualquier Android 5.0+ (fue construida
  con JDK 17 + build-tools 34 en el entorno; se regenera con
  `sh game/scripts/build-android.sh`).
- [ ] **Google Play Store**: cuenta de desarrollador (25 USD, una vez). Al tenerla:
  subimos esta misma APK (o un AAB regenerado) y la página `/download/android`
  pasará a enlazar la tienda.
- [ ] **App Store**: cuenta Apple Developer (99 USD/año) + un Mac con Xcode para
  firmar. Al tenerla: TestFlight primero, luego App Store; `/download/ios` se actualiza.
- [ ] **Steam / itch.io (opcional PC)**: si quieres distribución de escritorio en
  tienda además de los zips.

## 5. Decisiones del dueño que faltan (dime y lo implemento)
- [ ] Número de jugadores por partida (hoy: configurable; sugerido 50).
- [ ] Idiomas de lanzamiento (hoy: español + inglés).
- [ ] Clasificación por edad objetivo y nivel de sangre/efectos.
- [ ] Nombre de las temporadas y calendario de contenido.
- [ ] Códigos de canje de lanzamiento (yo los creo en el servidor; tú decides los premios).

## 6. Lo que me pasarás cuando toque
| Dato | Para qué | Dónde va |
|---|---|---|
| Token de BotFather de Telegram | avisos de ventas/reportes/baneos | `game/.env` |
| Token de bot de Discord | bot de verificación, canjes y perfil | `game/.env` |
| Cuenta de Play Store | publicar la APK ya construida en la tienda | consola de Google Play |
| Cuenta Apple Developer | publicar iOS | App Store Connect |
| Códigos/promos que quieras regalar | `#códigos-activos` | los cargo en el servidor |
