# ClipBot — bot de Discord que corta clips virales (MVP)

Manda un link de YouTube/Twitch y recibe clips verticales 9:16 con subtítulos, listos
para TikTok/Reels/Shorts. Pipeline: `yt-dlp` → Whisper (faster-whisper) → IA puntúa los
mejores momentos → FFmpeg corta en vertical 720x1280 con subtítulos quemados.

**Corre en una PC o VPS (no en el teléfono): transcribir y renderizar video es pesado.**

## Requisitos

- Python 3.10+
- FFmpeg instalado (`sudo apt install ffmpeg` — que incluya libass, la versión estándar lo trae)

## Instalación

```bash
cd clipbot
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # edita .env con tus tokens (nunca lo subas a GitHub)
python bot.py
```

## Uso en Discord

```
!clip <url>              # 3 clips de 45s (por defecto)
!clip <url> 5 30         # 5 clips de 30 segundos
!ping                    # ¿está vivo?
```

El primer `!clip` tarda varios minutos (descarga + transcripción + render); el bot avisa
el progreso en el mensaje. La IA detecta ganchos en **español** y responde con título,
razón y score de viralidad por clip.

## Configuración de la IA (en `.env`)

Cualquier API compatible con OpenAI funciona:

| Servicio | OPENAI_BASE_URL | MODEL |
|---|---|---|
| OpenAI | https://api.openai.com/v1 | gpt-4o-mini |
| Mistral | https://api.mistral.ai/v1 | mistral-large-latest |
| DeepSeek | https://api.deepseek.com/v1 | deepseek-chat |
| Groq | https://api.groq.com/openai/v1 | llama-3.1-70b-versatile |

Whisper corre en local (`WHISPER_MODEL=small` por defecto; `base` es más rápido y
impuntible con menos calidad). Sin API key de IA, usa una heurística simple.

## Límites actuales (sé honesto)

- Reencuadre por **recorte central** a 9:16: no sigue al hablante (eso requiere modelos
  de detección facial; se puede añadir después).
- Los clips >25 MB no se pueden subir a Discord; quedan guardados en el servidor.
- Descargar videos puede violar los términos de algunos servicios; úsalo con contenido
  propio o con permiso.
