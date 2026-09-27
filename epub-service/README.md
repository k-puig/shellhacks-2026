# EPUB conversion service

A stateless conversion worker: one EPUB upload in, one response with Ogg Opus audio and timestamped readable text out. No database, job API, or persisted uploads/results. It is intended for calls from the backend, not directly from a browser.

## Run

From `epub-service/`, with `fastapi`, `python-multipart`, `uvicorn`, `ebooklib`, `kokoro`, and `ffmpeg` available:

```sh
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

Or run the `epub-service` service in the root `docker-compose.yml`. The Compose service is internal to the Docker network; the backend can call `http://epub-service:8001/v1/convert`.

The default English voice is `af_heart`; set `KOKORO_VOICE` in the environment to change it. Kokoro downloads its model and voice from Hugging Face on first use. Misaki (Kokoro's English phonemizer) also needs spaCy's `en_core_web_sm` model. In a Nix shell without `pip`, the service downloads the official, SHA-256-verified 3.8.0 model wheel directly from GitHub, unpacks it into `$HF_HOME/spacy` (or `~/.cache/huggingface/spacy`), and reuses it on future requests. Set `SPACY_MODEL_CACHE` to override that cache root. An existing installed `en_core_web_sm` is used without any download. The Docker image installs this model at build time. The first uncached local conversion needs access to both GitHub and Hugging Face; pre-provision both model caches for offline operation. Model assets are distinct from request data and may be cached across requests.

## Contract

```http
POST /v1/convert
Content-Type: multipart/form-data

field: epub (EPUB file)
```

The response has `Content-Type: multipart/mixed; boundary=...` and **exactly two parts**, in order:

1. `audio/ogg`, `audiobook.ogg` (Opus)
2. `application/json`, `timestamps.json`

Example manifest:

```json
{
  "audio": {
    "format": "ogg-opus",
    "sample_rate": 48000,
    "duration_seconds": 5.0
  },
  "text": "I\n\nIn my younger and more vulnerable years...",
  "chapters": [
    {
      "source": "text/chapter-1.xhtml",
      "title": "I",
      "start_seconds": 0.0,
      "end_seconds": 5.0,
      "paragraphs": [
        {
          "text": "In my younger and more vulnerable years...",
          "start_seconds": 1.0,
          "end_seconds": 5.0,
          "segments": [
            {
              "text": "In my younger and more vulnerable years...",
              "start_seconds": 1.0,
              "end_seconds": 5.0
            }
          ]
        }
      ]
    }
  ]
}
```

Timestamps are **passage-level** (normally sentences, shorter pieces for unusually long sentences), not word-level. They are computed from the exact number of PCM samples synthesized plus intentional paragraph/chapter pauses. Opus encoding can introduce a small decoder-dependent offset. The backend owns all persistence and lifecycle management; a long book keeps its POST open until completion, so the backend should use an appropriate timeout or call it from its own background job.

The service reads the EPUB spine in reading order and excludes navigation, hidden content, and obvious front/back matter (including colophon, title page, dedication and epigraph) by default. It preserves inline text, headings, paragraphs, list items, and captions. It rejects archives above the size/entry limits defined in `app/extractor.py`, uploads above 50 MiB, and processes only one conversion at a time per worker (`503` when busy). `GET /health` checks the HTTP process, **not** whether the Kokoro model has been downloaded.

FastAPI may spool uploads to `/tmp`; generated audio also lives in a request-specific temporary directory. Both are removed after the request/response ends. Compose mounts `/tmp` as `tmpfs`; ensure there is enough memory for both uploads and the encoded output. Set an appropriate `client_max_body_size` in any proxy placed in front of this endpoint.

## Test

```sh
python3 -m unittest discover -s tests -v
```

Tests mock Kokoro so they do not download model weights; the short audio test uses the installed `ffmpeg` encoder.
