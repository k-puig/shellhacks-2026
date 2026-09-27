"""One-request EPUB -> audio and timestamped text conversion."""

import json
import logging
import os
import secrets
import tempfile
from pathlib import Path
from threading import BoundedSemaphore
from typing import Annotated

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask

from .extractor import EpubTooLarge, InvalidEpub, NoReadableText, extract
from .synthesis import convert

MAX_UPLOAD_BYTES = 50 * 1024 * 1024
CONVERSIONS = BoundedSemaphore(1)  # Model inference is memory-intensive.
logger = logging.getLogger(__name__)
app = FastAPI(title="EPUB conversion service")


@app.get("/health")
def health():
    return {"status": "ok"}


def process(upload, output_path: str) -> dict:
    upload.seek(0, os.SEEK_END)
    if upload.tell() > MAX_UPLOAD_BYTES:
        raise EpubTooLarge("EPUB upload exceeds the 50 MiB limit")
    upload.seek(0)
    return convert(extract(upload), output_path)


def response_parts(path: Path, manifest: bytes, boundary: str, cleanup):
    try:
        yield (
            f"--{boundary}\r\nContent-Type: audio/ogg\r\n"
            'Content-Disposition: attachment; filename="audiobook.ogg"\r\n\r\n'
        ).encode("ascii")
        with path.open("rb") as audio:
            while chunk := audio.read(64 * 1024):
                yield chunk
        yield (
            f"\r\n--{boundary}\r\nContent-Type: application/json\r\n"
            'Content-Disposition: attachment; filename="timestamps.json"\r\n\r\n'
        ).encode("ascii")
        yield manifest
        yield f"\r\n--{boundary}--\r\n".encode("ascii")
    finally:
        cleanup()


@app.post("/v1/convert")
async def convert_epub(epub: Annotated[UploadFile, File()]):
    if not CONVERSIONS.acquire(blocking=False):
        raise HTTPException(status_code=503, detail="Conversion service is busy")
    workspace = None
    released = False

    def cleanup():
        nonlocal released
        if released:
            return
        released = True
        try:
            if workspace is not None:
                workspace.cleanup()
        finally:
            CONVERSIONS.release()

    try:
        workspace = tempfile.TemporaryDirectory(prefix="epub-convert-")
        output_path = Path(workspace.name) / "audiobook.ogg"
        manifest = await run_in_threadpool(process, epub.file, str(output_path))
        data = json.dumps(manifest, ensure_ascii=False, separators=(",", ":")).encode(
            "utf-8"
        )
        boundary = "epub-" + secrets.token_hex(16)

        return StreamingResponse(
            response_parts(output_path, data, boundary, cleanup),
            media_type=f"multipart/mixed; boundary={boundary}",
            background=BackgroundTask(cleanup),
        )
    except (InvalidEpub, EpubTooLarge, ValueError) as exc:
        cleanup()
        if isinstance(exc, EpubTooLarge):
            status = 413
        elif isinstance(exc, NoReadableText) or not isinstance(exc, InvalidEpub):
            status = 422
        else:
            status = 400
        raise HTTPException(status_code=status, detail=str(exc)) from exc
    except Exception as exc:
        cleanup()
        logger.exception("EPUB conversion failed")
        raise HTTPException(status_code=500, detail="EPUB conversion failed") from exc
    except BaseException:
        cleanup()
        raise
    finally:
        await epub.close()
