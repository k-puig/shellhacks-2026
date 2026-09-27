import { strFromU8, unzipSync } from 'fflate';
import { Parser } from 'htmlparser2';

import type { Book, Chapter } from './mockBooks';

// Turns an EPUB (the file stored in S3) into the reader's Book: chapters of
// paragraphs of words, with word `idx` counting across the whole book.
// TypeScript port of scripts/epub_to_book.py, generalized for any EPUB.

// Its message is safe to show to the user as is.
export class EpubError extends Error {}

type Block = { heading: number | null; text: string };

const BLOCKS: Record<string, number | null> = { p: null, li: null, h1: 1, h2: 2, h3: 3, h4: 4 };
// Can't be read aloud: code, tables, images, captions, footnote markers.
const SKIP_TAGS = new Set(['pre', 'table', 'img', 'svg', 'script', 'style', 'figcaption', 'nav', 'sup']);
const SKIP_CLASSES = new Set(['fm-code-annotation', 'figure1', 'annotation']);
// Pages that aren't the story.
const FRONT_OR_BACK_MATTER =
  /^(contents|table of contents|copyright|dedication|acknowledg|index|about the author|about this|title page|cover|also by|colophon|imprint)\b/i;
// Distributor boilerplate (Project Gutenberg's header and license pages).
const BOILERPLATE = /project gutenberg/i;
const MIN_CHAPTER_WORDS = 30;
const COVER_COLORS = ['#2B4B6F', '#5B3A6E', '#2F5D50', '#7A4A2A', '#3E4A7A', '#6B2F3A'];

const clean = (text: string) => text.split(/\s+/).filter(Boolean).join(' ');
const wordCount = (blocks: Block[]) => blocks.reduce((n, b) => n + b.text.split(' ').length, 0);

// The readable blocks of one XHTML document, in order.
function readBlocks(xhtml: string): Block[] {
  const blocks: Block[] = [];
  let skipDepth = 0;
  let current: { heading: number | null; parts: string[] } | null = null;

  const flush = () => {
    const text = current ? clean(current.parts.join('')) : '';
    if (current && text) blocks.push({ heading: current.heading, text });
    current = null;
  };

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        // htmlparser2 closes every tag it opens (void and implied ones too),
        // so counting opens and closes keeps the depth balanced.
        if (skipDepth > 0) {
          skipDepth++;
          return;
        }
        const classes = (attribs.class ?? '').split(/\s+/);
        if (SKIP_TAGS.has(name) || classes.some((c) => SKIP_CLASSES.has(c))) {
          skipDepth = 1;
          return;
        }
        if (name in BLOCKS) {
          flush();
          current = { heading: BLOCKS[name], parts: [] };
        } else if (name === 'br' && current) {
          current.parts.push(' ');
        }
      },
      onclosetag(name) {
        if (skipDepth > 0) {
          skipDepth--;
          return;
        }
        if (name in BLOCKS) flush();
      },
      ontext(text) {
        if (skipDepth === 0 && current) current.parts.push(text);
      },
    },
    { decodeEntities: true, lowerCaseTags: true, recognizeSelfClosing: true },
  );
  parser.write(xhtml);
  parser.end();
  flush();
  return blocks;
}

type Section = { title: string; blocks: Block[] };

// One section per document: titled by its first h1 (or first heading), with
// the remaining headings kept as paragraphs.
function sectionsByDocument(documents: Block[][]): Section[] {
  return documents.map((blocks) => {
    const h1 = blocks.findIndex((b) => b.heading === 1);
    const at = h1 >= 0 ? h1 : blocks.findIndex((b) => b.heading !== null);
    return {
      title: at >= 0 ? blocks[at].text : '',
      blocks: blocks.filter((_, i) => i !== at),
    };
  });
}

// For books that put many chapters in one file: split wherever the top
// repeating heading level (h1, else h2) starts a new chapter.
function sectionsByHeading(documents: Block[][]): Section[] {
  const all = documents.flat();
  const level = [1, 2].find((l) => all.filter((b) => b.heading === l).length >= 2);
  if (!level) return [];
  const sections: Section[] = [{ title: '', blocks: [] }];
  for (const block of all) {
    if (block.heading === level) sections.push({ title: block.text, blocks: [] });
    else sections[sections.length - 1].blocks.push(block);
  }
  return sections;
}

const isStory = (s: Section) =>
  !FRONT_OR_BACK_MATTER.test(s.title) &&
  !BOILERPLATE.test(s.title) &&
  !BOILERPLATE.test(s.blocks[0]?.text ?? '') &&
  wordCount(s.blocks) >= MIN_CHAPTER_WORDS;

function toChapters(sections: Section[]): Chapter[] {
  let idx = 0;
  let paragraphIdx = 0;
  return sections.map((section, chapterIdx) => ({
    chapterIdx,
    title: section.title || `Chapter ${chapterIdx + 1}`,
    paragraphs: section.blocks.map((block) => {
      const words = block.text.split(' ').map((text) => ({ text, idx: idx++ }));
      return { paragraphIdx: paragraphIdx++, words };
    }),
  }));
}

// The package file (.opf): metadata, every file by id, the reading order, and
// the cover image (EPUB 3 marks it "cover-image"; EPUB 2 names it in a meta tag).
function readPackage(opf: string) {
  const files = new Map<string, string>();
  const spine: string[] = [];
  const meta: Record<string, string> = {};
  let inMeta: string | null = null;
  let coverId: string | null = null;
  let coverHref: string | null = null;

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        if (name === 'item' && attribs.id && attribs.href) {
          files.set(attribs.id, attribs.href);
          if ((attribs.properties ?? '').split(/\s+/).includes('cover-image')) coverHref = attribs.href;
        } else if (name === 'itemref' && attribs.idref && attribs.linear !== 'no') spine.push(attribs.idref);
        else if (name === 'meta' && attribs.name === 'cover' && attribs.content) coverId = attribs.content;
        else if ((name === 'dc:title' || name === 'dc:creator') && !(name in meta)) inMeta = name;
      },
      ontext(text) {
        if (inMeta) meta[inMeta] = (meta[inMeta] ?? '') + text;
      },
      onclosetag(name) {
        if (name === inMeta) inMeta = null;
      },
    },
    { xmlMode: true, decodeEntities: true },
  );
  parser.write(opf);
  parser.end();
  return {
    files,
    spine,
    coverHref: coverHref ?? (coverId ? (files.get(coverId) ?? null) : null),
    title: clean(meta['dc:title'] ?? ''),
    author: clean(meta['dc:creator'] ?? ''),
  };
}

export type EpubCover = { data: Uint8Array; ext: 'jpg' | 'png' | 'gif' | 'webp' };

// The cover's file type from its first bytes, so a mislabeled cover still works.
function coverExt(data: Uint8Array): EpubCover['ext'] | null {
  if (data[0] === 0xff && data[1] === 0xd8) return 'jpg';
  if (data[0] === 0x89 && data[1] === 0x50) return 'png';
  if (data[0] === 0x47 && data[1] === 0x49) return 'gif';
  if (data[8] === 0x57 && data[9] === 0x45) return 'webp';
  return null;
}

// Resolves an href relative to the package file's folder ("OEBPS/../x" → "x").
function resolvePath(base: string, href: string): string {
  const parts = [...(base ? base.split('/') : []), ...decodeURIComponent(href.split('#')[0]).split('/')];
  const out: string[] = [];
  for (const part of parts) {
    if (part === '..') out.pop();
    else if (part && part !== '.') out.push(part);
  }
  return out.join('/');
}

// The book, plus its cover image when the EPUB has one (saved next to the book).
export function convertEpub(bytes: Uint8Array, id: string): { book: Book; cover: EpubCover | null } {
  let zip: Record<string, Uint8Array>;
  try {
    zip = unzipSync(bytes);
  } catch {
    throw new EpubError("This file isn't a readable EPUB.");
  }
  const text = (path: string) => (zip[path] ? strFromU8(zip[path]) : null);

  const container = text('META-INF/container.xml');
  const opfPath = container?.match(/full-path\s*=\s*["']([^"']+)["']/)?.[1];
  const opf = opfPath ? text(opfPath) : null;
  if (!opfPath || !opf) throw new EpubError("This EPUB is missing its table of contents file.");

  const pkg = readPackage(opf);
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : '';
  const documents = pkg.spine
    .map((idref) => pkg.files.get(idref))
    .map((href) => (href ? text(resolvePath(base, href)) : null))
    .filter((doc): doc is string => doc !== null)
    .map(readBlocks);

  const byDocument = sectionsByDocument(documents).filter(isStory);
  const byHeading = sectionsByHeading(documents).filter(isStory);
  const sections = byDocument.length < 3 && byHeading.length > byDocument.length ? byHeading : byDocument;
  if (sections.length === 0) throw new EpubError("Couldn't find any readable chapters in this EPUB.");

  const coverData = pkg.coverHref ? zip[resolvePath(base, pkg.coverHref)] : undefined;
  const ext = coverData ? coverExt(coverData) : null;

  const hash = [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return {
    book: {
      id,
      title: pkg.title || 'Untitled',
      author: pkg.author || 'Unknown author',
      coverColor: COVER_COLORS[hash % COVER_COLORS.length],
      progress: 0,
      chapters: toChapters(sections),
    },
    cover: coverData && ext ? { data: coverData, ext } : null,
  };
}
