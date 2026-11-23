"""Bot de Discord: pega un link y recibe clips verticales listos para TikTok/Reels/Shorts."""

import asyncio
import os
import uuid

import discord
from discord.ext import commands
from dotenv import load_dotenv

from clipper import process

load_dotenv()
TOKEN = os.environ.get("DISCORD_TOKEN", "")
MAX_CLIPS = int(os.environ.get("MAX_CLIPS", "5"))
MAX_UPLOAD_ZIP_MB = 24

intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents, help_command=None)

queue: asyncio.Queue = asyncio.Queue()


worker_task = None


@bot.event
async def on_ready():
    print(f"✅ Bot conectado como {bot.user}")
    if worker_task is None or worker_task.done():
        bot.loop.create_task(worker())


async def worker():
    while True:
        ctx, msg, url, num, dur = await queue.get()
        try:
            await handle_job(ctx, msg, url, num, dur)
        except Exception as e:
            await msg.edit(content=f"❌ Error: {e}")
        finally:
            queue.task_done()


async def handle_job(ctx, msg, url, num, dur):
    job_id = uuid.uuid4().hex[:8]
    loop = asyncio.get_running_loop()

    def progress(text):
        asyncio.run_coroutine_threadsafe(msg.edit(content=text), loop)

    def run_pipeline():
        return process(url, job_id, num, dur, progress)

    clips = await loop.run_in_executor(None, run_pipeline)

    await msg.edit(content=f"📤 Subiendo {len(clips)} clip(s)…")
    for clip in clips:
        size_mb = clip.stat().st_size / 1_000_000
        if size_mb > MAX_UPLOAD_ZIP_MB:
            await ctx.reply(f"⚠️ «{clip.name}» pesa {size_mb:.0f} MB y supera el límite de "
                            f"Discord. El archivo quedó guardado en el servidor: `{clip}`")
            continue
        await ctx.reply(
            content=f"🎬 **{clip.stem}** listo.",
            file=discord.File(str(clip), filename=clip.name))
    await msg.edit(content=f"✅ Listo — {len(clips)} clip(s) generados.")


@bot.command(name="clip")
async def clip_command(ctx, url: str, num: int = 3, dur: int = 45):
    if num < 1 or num > MAX_CLIPS:
        await ctx.reply(f"Elige entre 1 y {MAX_CLIPS} clips.")
        return
    if dur < 15 or dur > 90:
        await ctx.reply("La duración debe ser entre 15 y 90 segundos.")
        return
    if not url.startswith(("http://", "https://")):
        await ctx.reply("Pásame un enlace: `!clip <url> [nº de clips] [duración en segundos]`")
        return

    ahead = queue.qsize()
    msg = await ctx.reply(f"🗒️ En cola ({ahead} delante). "
                          "Recuerda: el primer clip tarda varios minutos.")
    await queue.put((ctx, msg, url, num, dur))


@bot.command(name="ping")
async def ping_command(ctx):
    await ctx.reply(f"🏓 En línea. Trabajos en cola: {queue.qsize()}")


def main():
    if not TOKEN:
        raise SystemExit("Falta DISCORD_TOKEN en el entorno o en el archivo .env")
    bot.run(TOKEN)


if __name__ == "__main__":
    main()
