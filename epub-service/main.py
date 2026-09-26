import os

import ebooklib
from ebooklib import epub

book = epub.read_epub("test.epub")

# Export all xhtmls from the Book
xmax = 0
bookdict: dict[str, tuple[int, str]] = dict[str, tuple[int, str]]()
for x, document in enumerate(book.get_items_of_type(ebooklib.ITEM_DOCUMENT)):
    xmax = max(xmax, x)

    booksuffix = f"-{document.get_name()}".replace("/", "_")
    bookname = f"{x}{booksuffix}"

    bookdict[bookname] = (x, booksuffix)

    with open(os.path.basename(bookname), "wb") as f:
        f.write(document.get_content())

if len(str(xmax)) > 1:
    for origname, (idx, suffix) in bookdict.items():
        if len(str(idx)) == len(str(xmax)):
            continue

        prepad = len(str(xmax)) - len(str(idx))
        newname = f"{''.join(['0' for x in range(prepad)])}{idx}{suffix}"

        os.rename(os.path.basename(origname), os.path.basename(newname))
