"""Extract spoken, spine-ordered text from an EPUB without writing its contents to disk."""

import re
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass

import ebooklib
from ebooklib import epub
from ebooklib.utils import parse_html_string

MAX_ENTRIES = 5000
MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024
MAX_TEXT_CHARACTERS = 2_000_000
BLOCKS = {
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "li",
    "blockquote",
    "figcaption",
    "dt",
    "dd",
    "pre",
    "cite",
}
SKIP_ELEMENTS = {
    "head",
    "nav",
    "script",
    "style",
    "noscript",
    "template",
    "svg",
    "math",
    "audio",
    "video",
    "canvas",
    "iframe",
    "form",
}
SKIP_TYPES = {
    "toc",
    "landmarks",
    "page-list",
    "titlepage",
    "halftitlepage",
    "imprint",
    "colophon",
    "uncopyright",
    "dedication",
    "epigraph",
    "copyright-page",
    "cover",
    "frontmatter",
    "backmatter",
}
SKIP_ROLES = {
    "doc-toc",
    "doc-pagelist",
    "doc-landmarks",
    "doc-titlepage",
    "doc-dedication",
    "doc-epigraph",
    "doc-colophon",
    "doc-credits",
}
EPUB_TYPE = "{http://www.idpf.org/2007/ops}type"


class InvalidEpub(ValueError):
    pass


class EpubTooLarge(ValueError):
    pass


class NoReadableText(InvalidEpub):
    pass


@dataclass
class Chapter:
    source: str
    title: str
    paragraphs: list[str]


def tag_name(element) -> str:
    tag = element.tag
    return tag.rsplit("}", 1)[-1].lower() if isinstance(tag, str) else ""


def excluded(element) -> bool:
    tag = tag_name(element)
    types = (element.get(EPUB_TYPE) or element.get("epub:type") or "").split()
    return (
        tag in SKIP_ELEMENTS
        or bool(set(types) & SKIP_TYPES)
        or bool(set((element.get("role") or "").split()) & SKIP_ROLES)
        or element.get("aria-hidden") == "true"
        or "hidden" in element.attrib
        or bool(
            re.search(
                r"(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\b",
                element.get("style", ""),
                re.IGNORECASE,
            )
        )
    )


def inline_text(element) -> str:
    """Collect visible text, including tails of hidden inline elements."""
    parts = [element.text or ""]
    for child in element:
        if not excluded(child):
            parts.append(" " if tag_name(child) == "br" else inline_text(child))
        parts.append(child.tail or "")
    return "".join(parts)


def paragraph_text(element) -> str:
    return re.sub(r"\s+", " ", inline_text(element).replace("\ufeff", "")).strip()


def readable_blocks(element):
    if excluded(element):
        return
    tag = tag_name(element)
    children_have_blocks = any(
        tag_name(child) in BLOCKS
        or any(tag_name(desc) in BLOCKS for desc in child.iter())
        for child in element
        if not excluded(child)
    )
    if tag in BLOCKS and not children_have_blocks:
        text = paragraph_text(element)
        if text:
            yield text, tag
    else:
        # Most books wrap prose in block elements; for loose body/div text,
        # preserve direct text rather than silently dropping it.
        if (
            tag in {"body", "section", "article", "div"}
            and element.text
            and element.text.strip()
        ):
            yield re.sub(r"\s+", " ", element.text).strip(), tag
        for child in element:
            yield from readable_blocks(child)
            if (
                tag in {"body", "section", "article", "div"}
                and child.tail
                and child.tail.strip()
            ):
                yield re.sub(r"\s+", " ", child.tail).strip(), tag


def parse_body(content: bytes):
    try:
        root = ET.fromstring(content)
    except ET.ParseError:
        # EbookLib already depends on an HTML-tolerant parser for EPUBs that
        # claim to contain XHTML but do not actually contain well-formed XML.
        root = parse_html_string(content)
    return next(
        (element for element in root.iter() if tag_name(element) == "body"), None
    )


def extract(upload) -> list[Chapter]:
    """Read a seekable binary file; reject oversized archives before EbookLib loads them."""
    upload.seek(0)
    try:
        with zipfile.ZipFile(upload) as archive:
            entries = archive.infolist()
            if (
                len(entries) > MAX_ENTRIES
                or sum(entry.file_size for entry in entries) > MAX_UNCOMPRESSED_BYTES
            ):
                raise EpubTooLarge("EPUB archive exceeds the resource limit")
            if "META-INF/container.xml" not in archive.namelist():
                raise InvalidEpub("Missing EPUB container.xml")
    except (zipfile.BadZipFile, zipfile.LargeZipFile) as exc:
        raise InvalidEpub("Not a valid EPUB archive") from exc

    upload.seek(0)
    try:
        book = epub.read_epub(upload, options={"ignore_ncx": True})
    except Exception as exc:
        raise InvalidEpub("Unable to read EPUB package and spine") from exc

    chapters: list[Chapter] = []
    character_count = 0
    for item_id, linear in book.spine:
        if linear == "no":
            continue
        document = book.get_item_with_id(item_id)
        if document is None or document.get_type() != ebooklib.ITEM_DOCUMENT:
            continue
        try:
            body = parse_body(document.content)
        except Exception as exc:
            raise InvalidEpub(f"Unreadable XHTML in {document.get_name()}") from exc
        if body is None:
            continue
        blocks = list(readable_blocks(body))
        if not blocks:
            continue
        paragraphs = [text for text, _ in blocks]
        character_count += sum(len(text) for text in paragraphs)
        if character_count > MAX_TEXT_CHARACTERS:
            raise EpubTooLarge("Extracted text exceeds the resource limit")
        title = next(
            (text for text, tag in blocks if tag.startswith("h") and tag[1:].isdigit()),
            "",
        )
        chapters.append(
            Chapter(source=document.get_name(), title=title, paragraphs=paragraphs)
        )
    if not chapters:
        raise NoReadableText("EPUB has no readable spine content")
    return chapters
