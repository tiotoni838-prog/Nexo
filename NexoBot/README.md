# NexoBot — el bot de Discord viviendo en tu teléfono

APK Android que convierte tu teléfono en el "servidor" del bot: mantiene una conexión
permanente con Discord y responde a los mensajes usando una API de IA.

## Cómo usarlo

1. Descarga el APK desde la pestaña **Actions** de este repositorio
   (flujo *APK · NexoBot* → artefacto `NexoBot-debug-apk`).
2. Instálalo en tu teléfono (activa "instalar apps de origen desconocido").
3. En el [Discord Developer Portal](https://discord.com/developers/applications):
   - Sección **Bot**: activa los intents **Message Content** (y Server Members si los pide).
   - Con el bot en tu servidor con permiso para **enviar mensajes** y **ver canales**.
4. Abre la app, pega el **token del bot**, la **URL de la API de IA**, el **modelo** y tu
   **API key**, escribe la personalidad y pulsa **GUARDAR**.
5. Pulsa **INICIAR BOT**. Acepta la notificación de presupuesto de batería.
6. En Ajustes del teléfono: batería → sin restricciones para Nexo Server (así dura 24/7),
   y desactiva la optimización de batería si el sistema lo ofrece.

## Seguridad

- El token y la API key **no** están en el código ni en GitHub: solo viven en tu teléfono.
- El APK es debug (instalable, no necesita firma de tienda).

## Notas técnicas

- Java puro + OkHttp (WebSocket del gateway de Discord + REST).
- Servicio en primer plano (`dataSync`) con reconexión y heartbeat automático.
- Reinicio automático al encender el teléfono (BootReceiver).
- Historia de conversación por canal (últimos 24 turnos) vía `SharedPreferences`.
