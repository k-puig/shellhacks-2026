import asyncio
import importlib.util
import subprocess
import tempfile
import unittest
import zipfile
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

import numpy as np
from app.extractor import (
    Chapter,
    EpubTooLarge,
    InvalidEpub,
    extract,
    parse_body,
    readable_blocks,
)
from app.spacy_model import ensure_english_model
from app.synthesis import convert, passages
from fastapi import UploadFile

SAMPLE_EPUB = Path(__file__).resolve().parents[1] / "test.epub"


class ExtractionTests(unittest.TestCase):
    def test_real_epub_spine_and_inline_text(self):
        with SAMPLE_EPUB.open("rb") as file:
            chapters = extract(file)
        self.assertEqual(len(chapters), 9)
        self.assertEqual(chapters[0].title, "I")
        self.assertEqual(chapters[-1].title, "IX")
        self.assertTrue(chapters[0].paragraphs[1].startswith("In my younger"))
        self.assertTrue(
            any("Mr. Gatsby" in paragraph for paragraph in chapters[0].paragraphs)
        )
        self.assertFalse(
            any("Table of Contents" in p for c in chapters for p in c.paragraphs)
        )

    def test_hidden_markup_and_html_fallback(self):
        body = parse_body(
            b"<html><body><p>Say <em>hello</em><span hidden>secret</span> again.</p><nav><p>Skip</p></nav><p>Next"
        )
        blocks = list(readable_blocks(body))
        self.assertEqual(blocks, [("Say hello again.", "p"), ("Next", "p")])

    def test_reject_non_epub(self):
        with self.assertRaises(InvalidEpub):
            extract(BytesIO(b"not an epub"))

    def test_reject_oversized_archive_before_parsing(self):
        archive = BytesIO()
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as file:
            file.writestr("META-INF/container.xml", "a" * 100)
        with (
            patch("app.extractor.MAX_UNCOMPRESSED_BYTES", 10),
            self.assertRaises(EpubTooLarge),
        ):
            extract(archive)

    def test_long_sentence_split_preserves_words(self):
        text = "One long sentence " * 30
        chunks = list(passages(text.strip()))
        self.assertGreater(len(chunks), 1)
        self.assertEqual(" ".join(chunks), text.strip())
        self.assertTrue(all(len(chunk) <= 240 for chunk in chunks))


class ModelSetupTests(unittest.TestCase):
    def test_preinstalled_spacy_model_does_not_download(self):
        with (
            patch("spacy.util.is_package", return_value=True),
            patch("app.spacy_model.urlopen", side_effect=AssertionError("downloaded")),
        ):
            ensure_english_model()

    def test_unverified_model_is_rejected(self):
        with (
            tempfile.TemporaryDirectory() as folder,
            patch("spacy.util.is_package", return_value=False),
            patch("app.spacy_model.urlopen", return_value=BytesIO(b"invalid model")),
            patch.dict("os.environ", {"SPACY_MODEL_CACHE": folder}),
            self.assertRaisesRegex(RuntimeError, "integrity verification"),
        ):
            ensure_english_model()


class FakeAudio:
    def __init__(self, data):
        self.data = data

    def detach(self):
        return self

    def cpu(self):
        return self

    def numpy(self):
        return self.data


class FakePipeline:
    def __call__(self, text, voice):
        return [
            type("Result", (), {"audio": FakeAudio(np.zeros(2400, dtype=np.float32))})()
        ]


class SynthesisTests(unittest.TestCase):
    def test_timestamps_match_audio_samples(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "audio.ogg"
            with patch("app.synthesis.pipeline", return_value=FakePipeline()):
                manifest = convert(
                    [Chapter("chapter.xhtml", "I", ["Hello. World!", "Again."])],
                    str(path),
                )
            segments = manifest["chapters"][0]["paragraphs"][0]["segments"]
            self.assertEqual([s["text"] for s in segments], ["Hello.", "World!"])
            self.assertAlmostEqual(segments[0]["end_seconds"], 0.1)
            self.assertAlmostEqual(segments[1]["start_seconds"], 0.1)
            self.assertAlmostEqual(manifest["audio"]["duration_seconds"], 0.55)
            probe = subprocess.run(
                [
                    "ffprobe",
                    "-v",
                    "error",
                    "-show_entries",
                    "format=duration",
                    "-of",
                    "default=noprint_wrappers=1:nokey=1",
                    str(path),
                ],
                capture_output=True,
                text=True,
                check=True,
            )
            self.assertAlmostEqual(float(probe.stdout), 0.55, delta=0.05)


class ApiTests(unittest.TestCase):
    def test_single_upload_returns_exactly_two_parts_and_cleans_up(self):
        if importlib.util.find_spec("python_multipart") is None:
            self.skipTest("active Python environment lacks python-multipart")
        from app.main import convert_epub

        async def request():
            with SAMPLE_EPUB.open("rb") as file:
                upload = UploadFile(BytesIO(file.read()), filename="test.epub")

            created_paths = []

            def stub_convert(chapters, path):
                created_paths.append(Path(path))
                Path(path).write_bytes(b"fake audio")
                return {
                    "text": "Hello",
                    "chapters": [],
                    "audio": {"duration_seconds": 0.1},
                }

            with patch("app.main.convert", side_effect=stub_convert):
                response = await convert_epub(upload)
                pieces: list[bytes] = []
                async for part in response.body_iterator:
                    assert isinstance(part, bytes)
                    pieces.append(part)
                assert response.background is not None
                await response.background()
            return response, b"".join(pieces), created_paths[0]

        response, body, output_path = asyncio.run(request())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(body.count(b"Content-Disposition: attachment;"), 2)
        self.assertIn(b"audio/ogg", body)
        self.assertIn(b"application/json", body)
        self.assertIn(b"fake audio", body)
        self.assertIn(b'"text":"Hello"', body)
        self.assertFalse(output_path.exists())


if __name__ == "__main__":
    unittest.main()
