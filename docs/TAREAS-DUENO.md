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

## 4. Tiendas (cuando pagues la suscripción, avísame)
- [ ] **Google Play Store**: cuenta de desarrollador (25 USD, una vez). Al tenerla:
  subimos el APK generado desde `game/android/` (guía en `docs/OPERATIONS.md`) y
  la página `/download/android` pasará a enlazar la tienda.
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
| Cuenta de Play Store | publicar APK | consola de Google Play |
| Cuenta Apple Developer | publicar iOS | App Store Connect |
| Códigos/promos que quieras regalar | `#códigos-activos` | los cargo en el servidor |
