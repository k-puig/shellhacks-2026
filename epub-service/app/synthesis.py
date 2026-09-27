"""Kokoro synthesis and sample-count-based passage timestamps."""

import os
import re
import subprocess
from functools import lru_cache

import numpy as np

from .extractor import Chapter
from .spacy_model import ensure_english_model

SAMPLE_RATE = 24_000  # Kokoro's output sample rate
VOICE = os.environ.get("KOKORO_VOICE", "af_heart")
MAX_PASSAGE_CHARS = 240
MAX_SEGMENTS = 30_000
PARAGRAPH_SILENCE = int(0.25 * SAMPLE_RATE)
CHAPTER_SILENCE = int(0.7 * SAMPLE_RATE)


@lru_cache(maxsize=1)
def pipeline():
    ensure_english_model()
    from kokoro import KPipeline

    return KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")


def passages(text: str):
    """Use sentence boundaries when possible, splitting unusually long sentences."""
    sentences = re.split(r"(?<=[.!?])\s+(?=[\"'“‘(\[]?[A-Z0-9])", text)
    for sentence in sentences:
        while len(sentence) > MAX_PASSAGE_CHARS:
            boundary = sentence.rfind(" ", 0, MAX_PASSAGE_CHARS + 1)
            if boundary < 1:
                raise ValueError("An unbroken word exceeds the synthesis limit")
            yield sentence[:boundary]
            sentence = sentence[boundary + 1 :]
        if sentence:
            yield sentence


def convert(chapters: list[Chapter], output_path: str) -> dict:
    """Encode incrementally: only one model result is held in memory at a time."""
    model = pipeline()
    command = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-y",
        "-f",
        "f32le",
        "-ar",
        str(SAMPLE_RATE),
        "-ac",
        "1",
        "-i",
        "pipe:0",
        "-c:a",
        "libopus",
        "-b:a",
        "48k",
        "-application",
        "audio",
        output_path,
    ]
    encoder = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    assert encoder.stdin is not None and encoder.stderr is not None
    position = 0
    segment_count = 0
    output_chapters = []
    try:
        for chapter in chapters:
            if output_chapters:
                encoder.stdin.write(
                    np.zeros(CHAPTER_SILENCE, dtype=np.float32).tobytes()
                )
                position += CHAPTER_SILENCE
            chapter_start = position
            output_paragraphs = []
            for text in chapter.paragraphs:
                if output_paragraphs:
                    encoder.stdin.write(
                        np.zeros(PARAGRAPH_SILENCE, dtype=np.float32).tobytes()
                    )
                    position += PARAGRAPH_SILENCE
                paragraph_start = position
                output_segments = []
                for passage in passages(text):
                    segment_count += 1
                    if segment_count > MAX_SEGMENTS:
                        raise ValueError("EPUB exceeds the synthesis segment limit")
                    start = position
                    produced = False
                    for result in model(passage, voice=VOICE):
                        if result.audio is None:
                            continue
                        samples = np.asarray(
                            result.audio.detach().cpu().numpy(), dtype=np.float32
                        ).reshape(-1)
                        if not len(samples):
                            continue
                        encoder.stdin.write(samples.tobytes())
                        position += len(samples)
                        produced = True
                    if not produced:
                        raise ValueError(f"Kokoro could not synthesize: {passage[:80]}")
                    output_segments.append(
                        {
                            "text": passage,
                            "start_seconds": start / SAMPLE_RATE,
                            "end_seconds": position / SAMPLE_RATE,
                        }
                    )
                output_paragraphs.append(
                    {
                        "text": text,
                        "start_seconds": paragraph_start / SAMPLE_RATE,
                        "end_seconds": position / SAMPLE_RATE,
                        "segments": output_segments,
                    }
                )
            output_chapters.append(
                {
                    "source": chapter.source,
                    "title": chapter.title,
                    "start_seconds": chapter_start / SAMPLE_RATE,
                    "end_seconds": position / SAMPLE_RATE,
                    "paragraphs": output_paragraphs,
                }
            )
        encoder.stdin.close()
        error = encoder.stderr.read().decode("utf-8", errors="replace")
        if encoder.wait() != 0:
            raise RuntimeError(f"Audio encoding failed: {error[:500]}")
    except BaseException:
        encoder.kill()
        encoder.wait()
        raise
    finally:
        encoder.stderr.close()

    return {
        "audio": {
            "format": "ogg-opus",
            "sample_rate": 48_000,  # Opus decoding rate; timestamps use the 24 kHz source samples.
            "duration_seconds": position / SAMPLE_RATE,
        },
        "text": "\n\n".join("\n\n".join(chapter.paragraphs) for chapter in chapters),
        "chapters": output_chapters,
    }
