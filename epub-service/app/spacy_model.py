"""Provide Misaki's English spaCy model without requiring pip at runtime."""

import hashlib
import os
import sys
import tempfile
import zipfile
from io import BytesIO
from pathlib import Path
from urllib.request import urlopen

MODEL_NAME = "en_core_web_sm"
MODEL_VERSION = "3.8.0"
MODEL_URL = (
    "https://github.com/explosion/spacy-models/releases/download/"
    f"{MODEL_NAME}-{MODEL_VERSION}/{MODEL_NAME}-{MODEL_VERSION}-py3-none-any.whl"
)
MODEL_SHA256 = "1932429db727d4bff3deed6b34cfc05df17794f4a52eeb26cf8928f7c1a0fb85"
MAX_WHEEL_BYTES = 32 * 1024 * 1024


def ensure_english_model() -> None:
    """Install a pinned, verified model in the model cache, never in site-packages.

    Misaki calls spacy.cli.download when the package is missing. That CLI
    requires pip, which need not be present (and cannot edit a Nix store).
    An unpacked wheel on sys.path is an installed spaCy model to spaCy.
    """
    from spacy.util import is_package

    if is_package(MODEL_NAME):
        return
    cache_base = Path(
        os.environ.get(
            "SPACY_MODEL_CACHE",
            os.environ.get("HF_HOME", Path.home() / ".cache" / "huggingface"),
        )
    )
    target = cache_base / "spacy" / f"{MODEL_NAME}-{MODEL_VERSION}"
    if not target.is_dir():
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            with urlopen(MODEL_URL, timeout=90) as response:
                wheel = response.read(MAX_WHEEL_BYTES + 1)
        except OSError as exc:
            raise RuntimeError(
                f"Could not download the spaCy English model from {MODEL_URL}. "
                "Provide network access or preinstall en_core_web_sm 3.8.0."
            ) from exc
        if (
            len(wheel) > MAX_WHEEL_BYTES
            or hashlib.sha256(wheel).hexdigest() != MODEL_SHA256
        ):
            raise RuntimeError(
                "Downloaded spaCy English model failed integrity verification"
            )
        with tempfile.TemporaryDirectory(
            dir=target.parent, prefix="spacy-model-"
        ) as temporary:
            with zipfile.ZipFile(BytesIO(wheel)) as archive:
                # The hash is pinned, but keep path extraction constrained as well.
                if any(
                    Path(entry.filename).is_absolute()
                    or ".." in Path(entry.filename).parts
                    for entry in archive.infolist()
                ):
                    raise RuntimeError("Invalid spaCy model archive paths")
                archive.extractall(temporary)
            try:
                Path(temporary).rename(target)
            except FileExistsError:
                # Another process finished downloading it first.
                pass
    sys.path.insert(0, str(target))
    if not is_package(MODEL_NAME):
        raise RuntimeError(f"spaCy English model not found in {target}")
