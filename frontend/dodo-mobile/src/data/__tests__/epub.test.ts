import { strToU8, zipSync } from 'fflate';

import { convertEpub, EpubError } from '../epub';

const convert = (bytes: Uint8Array, id: string) => convertEpub(bytes, id).book;

const words = (n: number, word = 'word') => Array.from({ length: n }, () => word).join(' ');

const xhtml = (body: string) =>
  `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>x</title></head><body>${body}</body></html>`;

// A minimal EPUB: container → package (with a subfolder, like most EPUBs) → documents.
function makeEpub(
  docs: string[],
  meta = '<dc:title>Frankenstein</dc:title><dc:creator>Mary Shelley</dc:creator>',
  extra: { items?: string; files?: Record<string, Uint8Array> } = {},
) {
  const items = docs.map((_, i) => `<item id="d${i}" href="text/doc${i}.xhtml" media-type="application/xhtml+xml"/>`);
  if (extra.items) items.push(extra.items);
  const spine = docs.map((_, i) => `<itemref idref="d${i}"/>`);
  const files: Record<string, Uint8Array> = {
    mimetype: strToU8('application/epub+zip'),
    'META-INF/container.xml': strToU8(
      '<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>',
    ),
    'OEBPS/content.opf': strToU8(
      `<?xml version="1.0"?><package xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata>${meta}</metadata>` +
        `<manifest>${items.join('')}</manifest><spine>${spine.join('')}</spine></package>`,
    ),
  };
  docs.forEach((doc, i) => (files[`OEBPS/text/doc${i}.xhtml`] = strToU8(doc)));
  return zipSync({ ...files, ...extra.files });
}

const chapter = xhtml(`<h1>Letter 1</h1><p>${words(40)}</p>`);
// The first bytes of a JPEG and a PNG: enough to tell their type.
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

describe('convertEpub cover', () => {
  it('finds an EPUB 3 cover image', () => {
    const { cover } = convertEpub(
      makeEpub([chapter], undefined, {
        items: '<item id="c" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>',
        files: { 'OEBPS/images/cover.jpg': jpeg },
      }),
      'b',
    );
    expect(cover).toEqual({ data: jpeg, ext: 'jpg' });
  });

  it('finds an EPUB 2 cover named in a meta tag, by its real file type', () => {
    const { cover } = convertEpub(
      makeEpub([chapter], '<dc:title>F</dc:title><meta name="cover" content="img"/>', {
        items: '<item id="img" href="../cover.jpeg" media-type="image/jpeg"/>',
        files: { 'cover.jpeg': png },
      }),
      'b',
    );
    expect(cover?.ext).toBe('png');
  });

  it('has no cover when the EPUB has none', () => {
    expect(convertEpub(makeEpub([chapter]), 'b').cover).toBeNull();
  });
});

describe('convertEpub', () => {
  it('reads the title, author and one chapter per document', () => {
    const book = convert(
      makeEpub([
        xhtml(`<h1>Letter 1</h1><p>${words(20, 'alpha')}</p><p>${words(20, 'beta')}</p>`),
        xhtml(`<h1>Letter 2</h1><p>${words(40, 'gamma')}</p>`),
      ]),
      'book-1',
    );

    expect(book).toMatchObject({ id: 'book-1', title: 'Frankenstein', author: 'Mary Shelley', progress: 0 });
    expect(book.chapters.map((c) => c.title)).toEqual(['Letter 1', 'Letter 2']);
    expect(book.chapters[0].paragraphs).toHaveLength(2);
  });

  it('numbers words and paragraphs across the whole book', () => {
    const book = convert(
      makeEpub([xhtml(`<h1>One</h1><p>${words(30)}</p>`), xhtml(`<h1>Two</h1><p>${words(30)}</p>`)]),
      'b',
    );

    const second = book.chapters[1].paragraphs[0];
    expect(second.paragraphIdx).toBe(1);
    expect(second.words[0].idx).toBe(30);
    expect(second.words[29].idx).toBe(59);
  });

  it("drops what can't be read aloud and decodes entities", () => {
    const book = convert(
      makeEpub([
        xhtml(
          `<h1>Chapter</h1><p>Tom &amp; Jerry said&#8212;hello<sup>12</sup>.</p>` +
            `<pre>const code = 1;</pre><table><tr><td>cell</td></tr></table>` +
            `<p class="annotation">skip me</p><p>${words(30)}</p>`,
        ),
      ]),
      'b',
    );

    const texts = book.chapters[0].paragraphs.map((p) => p.words.map((w) => w.text).join(' '));
    expect(texts[0]).toBe('Tom & Jerry said—hello.');
    expect(texts.join(' ')).not.toMatch(/code|cell|skip me/);
  });

  it('skips front matter and pages too short to be chapters', () => {
    const book = convert(
      makeEpub([
        xhtml(`<h1>Contents</h1><p>${words(40)}</p>`),
        xhtml(`<h1>Epigraph</h1><p>Short.</p>`),
        xhtml(`<h1>Chapter 1</h1><p>${words(40)}</p>`),
      ]),
      'b',
    );

    expect(book.chapters.map((c) => c.title)).toEqual(['Chapter 1']);
    expect(book.chapters[0].chapterIdx).toBe(0);
  });

  it("skips a distributor's header and license pages", () => {
    const book = convert(
      makeEpub([
        xhtml(`<h1>Frankenstein</h1><p>The Project Gutenberg eBook of Frankenstein</p><p>${words(40)}</p>`),
        xhtml(`<h1>Letter 1</h1><p>${words(40)}</p>`),
        xhtml(`<h1>THE FULL PROJECT GUTENBERG LICENSE</h1><p>${words(40)}</p>`),
      ]),
      'b',
    );

    expect(book.chapters.map((c) => c.title)).toEqual(['Letter 1']);
  });

  it('splits a single-file book on its repeating chapter headings', () => {
    const book = convert(
      makeEpub([
        xhtml(
          `<h1>Alice's Adventures</h1>` +
            `<h2>CHAPTER I.</h2><p>${words(40)}</p><h3>A scene</h3><p>${words(10)}</p>` +
            `<h2>CHAPTER II.</h2><p>${words(40)}</p>` +
            `<h2>CHAPTER III.</h2><p>${words(40)}</p>`,
        ),
      ]),
      'b',
    );

    expect(book.chapters.map((c) => c.title)).toEqual(['CHAPTER I.', 'CHAPTER II.', 'CHAPTER III.']);
    // Smaller headings stay in the text.
    expect(book.chapters[0].paragraphs[1].words.map((w) => w.text).join(' ')).toBe('A scene');
  });

  it('names untitled chapters and fills in missing metadata', () => {
    const book = convert(makeEpub([xhtml(`<p>${words(40)}</p>`)], ''), 'b');

    expect(book.chapters[0].title).toBe('Chapter 1');
    expect(book).toMatchObject({ title: 'Untitled', author: 'Unknown author' });
  });

  it('rejects files that are not EPUBs', () => {
    expect(() => convert(strToU8('not a zip'), 'b')).toThrow(EpubError);
    expect(() => convert(zipSync({ 'a.txt': strToU8('x') }), 'b')).toThrow(EpubError);
    expect(() => convert(makeEpub([xhtml('<h1>Contents</h1>')]), 'b')).toThrow(/readable chapters/);
  });
});
