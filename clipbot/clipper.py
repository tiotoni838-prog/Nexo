"""Motor de clips: descarga -> transcripción -> IA -> corte vertical con subtítulos."""

import json
import os
import re
import subprocess
from pathlib import Path

WORK_PARENT = Path(os.environ.get("CLIPBOT_WORKDIR", Path.home() / ".clipbot" / "jobs"))


def _run(cmd, **kw):
    p = subprocess.run([str(c) for c in cmd], capture_output=True, text=True, **kw)
    if p.returncode != 0:
        raise RuntimeError(
            f"{' '.join(map(str, cmd[:3]))}… falló:\n{(p.stderr or p.stdout)[-800:]}")
    return p


def download(url: str, work: Path) -> Path:
    out = str(work / "source.%(ext)s")
    _run([
        "yt-dlp",
        "--no-playlist",
        "-f", "bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/b",
        "--merge-output-format", "mp4",
        "-o", out,
        "--no-progress", "-q",
        url,
    ])
    for f in sorted(work.glob("source.*")):
        if f.suffix.lower() in (".mp4", ".mov", ".mkv", ".webm"):
            return f
    raise RuntimeError("yt-dlp descargó algo pero no encontré el archivo de video.")


def transcribe(video: Path, work: Path, model_name: str) -> list:
    audio = work / "audio.wav"
    _run(["ffmpeg", "-y", "-i", video, "-ac", "1", "-ar", "16000", audio])

    from faster_whisper import WhisperModel

    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    raw, _info = model.transcribe(str(audio), language="es", word_timestamps=True,
                                  vad_filter=True)
    segments = []
    for s in raw:
        words = [{"start": w.start, "end": w.end, "word": w.word.strip()}
                 for w in (s.words or []) if w.word and w.word.strip()]
        if s.text.strip():
            segments.append({"start": s.start, "end": s.end,
                             "text": s.text.strip(), "words": words})
    return segments


PROMPT = """Eres un experto en contenido viral para TikTok, Reels y Shorts en ESPAÑOL.
Te doy la transcripción de un video con segmentos numerados: [i] inicio-fin segundos: texto.
Elige los {num} mejores momentos para clip vertical de unos {dur} segundos (15-90s).
Prioriza: frases con gancho, datos sorprendentes, historias con principio/fin, humor,
polémica, preguntas retóricas, tips accionables. Evita empezar a mitad de idea.
Si el texto no alcanza, devuelve menos segmentos. Responde SOLO con JSON:
[{{"indice": 3, "titulo": "título corto con gancho", "razon": "por qué funciona", "score": 87}}]
Transcripción:
{transcript}"""


def pick_moments(segments: list, num: int, dur: int) -> list:
    if not segments:
        raise RuntimeError("La transcripción quedó vacía (¿el video tiene audio hablado?).")
    lines = [f"[{i}] {s['start']:.1f}-{s['end']:.1f} seg: {s['text'][:400]}"
             for i, s in enumerate(segments)]

    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    picked = None
    if api_key:
        try:
            from openai import OpenAI

            client = OpenAI(
                api_key=api_key,
                base_url=os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1"),
            )
            model = os.environ.get("MODEL", "gpt-4o-mini")
            resp = client.chat.completions.create(
                model=model,
                temperature=0.3,
                messages=[
                    {"role": "system", "content": "Responde únicamente con JSON válido."},
                    {"role": "user", "content": PROMPT.format(num=num, dur=dur,
                                                              transcript="\n".join(lines))},
                ],
            )
            txt = resp.choices[0].message.content or ""
            m = re.search(r"\[.*\]", txt, re.S)
            if m:
                picked = json.loads(m.group(0))
        except Exception:
            picked = None

    if not picked:
        mid = len(segments) // 2
        spread = max(1, len(segments) // (num + 1))
        idxs = sorted(set(min(max(0, mid - num // 2 * spread + k * spread),
                              len(segments) - 1) for k in range(num)))[:num]
        picked = [{"indice": i, "titulo": f"Clip {j + 1}",
                   "razon": "heurística sin IA", "score": 50}
                  for j, i in enumerate(idxs)]

    out, used = [], []
    for p in picked:
        try:
            i = int(p.get("indice", -1))
        except (TypeError, ValueError):
            continue
        if i < 0 or i >= len(segments) or i in used:
            continue
        used.append(i)
        out.append({
            "start": max(0.0, segments[i]["start"] - 1.0),
            "end": segments[i]["end"],
            "titulo": str(p.get("titulo", "clip"))[:80],
            "score": p.get("score", 0),
            "razon": p.get("razon", ""),
        })
    if not out:
        raise RuntimeError("La IA no devolvió segmentos válidos. Intenta de nuevo.")
    return out


def _fmt(t: float) -> str:
    ms_total = max(0, int(round(t * 1000)))
    h, rem = divmod(ms_total, 3600000)
    m, rem = divmod(rem, 60000)
    s, ms = divmod(rem, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def build_srt(seg: dict, start: float, dur: float, path: Path) -> None:
    end = start + dur
    words = [w for w in seg.get("words", []) if start <= w["start"] < end]
    if not words:
        path.write_text(f"1\n{_fmt(0)} --> {_fmt(dur)}\n{seg['text']}\n", encoding="utf-8")
        return

    GROUP_WORDS = 7
    GROUP_DUR = 2.5
    groups, cur = [], [words[0]]
    for w in words[1:]:
        if len(cur) >= GROUP_WORDS or w["start"] - cur[0]["start"] >= GROUP_DUR:
            groups.append(cur)
            cur = [w]
        else:
            cur.append(w)
    groups.append(cur)

    out = []
    for n, g in enumerate(groups, 1):
        t0 = max(0.0, g[0]["start"] - start)
        t1 = g[-1]["end"] - start
        body = " ".join(w["word"] for w in g)
        out.append(f"{n}\n{_fmt(t0)} --> {_fmt(t1)}\n{body.upper()}\n")
    path.write_text("\n".join(out), encoding="utf-8")


def cut_clip(video: Path, seg: dict, work: Path, index: int, subtitle_style: str) -> Path:
    start = max(0.0, seg["start"])
    dur = max(15.0, min(90.0, seg["end"] - start))
    clip = work / f"clip_{index + 1}_score{int(seg['score'])}.mp4"
    srt = work / f"clip_{index + 1}.srt"
    build_srt(seg, start, dur, srt)

    base_vf = "crop='min(iw,ih*9/16)':ih,scale=720:1280"
    vf = f"{base_vf},subtitles={srt.name}:force_style='{subtitle_style}'"
    common = ["ffmpeg", "-y", "-ss", f"{start:.2f}", "-i", str(video), "-t", f"{dur:.2f}"]
    full = common + ["-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
                     "-c:a", "aac", "-b:a", "128k", str(clip)]
    fallback = common + ["-vf", base_vf, "-c:v", "libx264", "-preset", "veryfast",
                         "-crf", "23", "-c:a", "aac", str(clip)]

    try:
        _run(full, cwd=work)
    except RuntimeError:
        _run(fallback, cwd=work)
    return clip


def process(url: str, job_id: str, num: int, dur: int, on_progress) -> list:
    work = WORK_PARENT / re.sub(r"[^a-zA-Z0-9_-]", "_", job_id)[:40]
    work.mkdir(parents=True, exist_ok=True)

    on_progress("📥 Descargando video (máx 720p)…")
    video = download(url, work)

    on_progress("🎤 Transcribiendo audio con Whisper…")
    segments = transcribe(video, work, os.environ.get("WHISPER_MODEL", "small"))

    on_progress("🧠 Buscando los mejores momentos con IA…")
    moments = pick_moments(segments, num, dur)

    style = os.environ.get(
        "SUB_STYLE",
        "FontName=Arial,Bold=1,FontSize=18,PrimaryColour=&H00FFFFFF,"
        "OutlineColour=&H00000000,Outline=3,MarginV=90,Alignment=2")

    paths = []
    for i, seg in enumerate(moments):
        on_progress(f"✂️ Cortando clip {i + 1}/{len(moments)}: «{seg['titulo']}»")
        paths.append(cut_clip(video, seg, work, i, style))
    return paths
