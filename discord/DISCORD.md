# Nexo FPS en Discord — guía de publicación

Este repositorio no puede publicar directamente en Discord (no hay conector
autenticado en este entorno), pero aquí tienes **todo listo para pegar**.

## Opción A — Mensaje listo para copiar y pegar en tu servidor

```
🎮 NEXO FPS — Battle Royale — ¡YA DISPONIBLE! 🎮

⬇️ DESCARGA (elige tu plataforma):
🪟 Windows / 🍎 macOS / 🐧 Linux:
https://github.com/tiotoni838-prog/Nexo/raw/vibe/nexo-frontier-vertical-slice-951e24/releases/NexoFPS-1.0.0-web-standalone.zip

🖥️ Servidor online (crea tus partidas con amigos):
https://github.com/tiotoni838-prog/Nexo/raw/vibe/nexo-frontier-vertical-slice-951e24/releases/NexoFPS-1.0.0-servidor.zip

📱 ¿Teléfono? Juega YA desde el navegador: pantalla completa + controles táctiles.
(APK e iOS nativos: próximamente)

✨ 12 armas · 3 mapas · 6 personajes con habilidades · Pase de Batalla
🎡 Ruleta diaria gratis · Tienda · Armario · Evolutivas · Anti-hacker

Página de descargas: http://<IP-DE-TU-SERVIDOR>:8080/download
```

## Opción B — Webhook con embed (botones interactivos)

1. En tu servidor Discord: **Ajustes del canal → Integraciones → Webhooks → Nuevo webhook** y copia la URL.
2. Ejecuta (sustituye `TU_WEBHOOK_URL`):

```bash
curl -X POST -H "Content-Type: application/json" -d @discord/embed.json TU_WEBHOOK_URL
```

El archivo `discord/embed.json` de este repositorio ya incluye el anuncio con
enlaces por plataforma. Los botones clicable completos requieren un bot
(Discord limita los componentes en webhooks simples); los enlaces del embed
quedan igual de accesibles en el móvil.

## Actualizar los enlaces

Cuando el juego suba de versión, actualiza los enlaces del ZIP en:
- `discord/embed.json`
- `game/client/download.html`
- `README.md` (sección Descargar)

Y regenera los paquetes: `cd game && npm run bundle` + recrear los ZIP de `releases/`.
