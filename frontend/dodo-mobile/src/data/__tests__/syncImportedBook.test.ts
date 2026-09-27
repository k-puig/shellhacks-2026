import type { Book } from '../mockBooks';
import { loadRemoteBookIds, saveRemoteBookId } from '../remoteBookIds';
import { syncImportedBook } from '../syncImportedBook';

jest.mock('../remoteBookIds', () => ({
  loadRemoteBookIds: jest.fn(),
  saveRemoteBookId: jest.fn(),
}));

const book = { id: 'local-id', title: 'Frankenstein', author: 'Mary Shelley', chapters: [] } as Book;
const load = loadRemoteBookIds as jest.MockedFunction<typeof loadRemoteBookIds>;
const save = saveRemoteBookId as jest.MockedFunction<typeof saveRemoteBookId>;

beforeEach(() => {
  jest.clearAllMocks();
  save.mockResolvedValue(undefined);
});

it('uses the freshly picked EPUB to upload an already-local book that has no mapping', async () => {
  load.mockResolvedValue({});
  const remote = { id: 'server-id' };
  const api = jest.fn(async () => remote);
  await expect(syncImportedBook(api as never, 'auth0|one', book, 'file:///cache/new.epub'))
    .resolves.toEqual({ status: 'uploaded', remote });
  expect(load).toHaveBeenCalledWith('auth0|one');
  expect(save).toHaveBeenCalledWith('auth0|one', 'local-id', 'server-id');
  const [path, init] = api.mock.calls[0] as unknown as [string, { body: FormData }];
  expect(path).toBe('/book');
  expect(init.body.has('id')).toBe(false);
  expect(init.body.has('book')).toBe(true);
});

it('never duplicates an upload for a book already mapped to this account', async () => {
  load.mockResolvedValue({ 'local-id': 'server-id' });
  const api = jest.fn();
  await expect(syncImportedBook(api as never, 'auth0|one', book, 'file:///cache/new.epub'))
    .resolves.toEqual({ status: 'already-synced' });
  expect(api).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
});

it('does not treat a different account mapping as proof of upload', async () => {
  load.mockResolvedValue({});
  const api = jest.fn(async () => ({ id: 'other-account-id' }));
  await syncImportedBook(api as never, 'auth0|two', book, 'file:///cache/new.epub');
  expect(save).toHaveBeenCalledWith('auth0|two', 'local-id', 'other-account-id');
});

it('does not record an ID when the upload fails, so reimport can retry', async () => {
  load.mockResolvedValue({});
  const api = jest.fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ id: 'server-id' });
  await expect(syncImportedBook(api as never, 'auth0|one', book, 'file:///cache/first.epub'))
    .rejects.toThrow('offline');
  expect(save).not.toHaveBeenCalled();
  await expect(syncImportedBook(api as never, 'auth0|one', book, 'file:///cache/reimport.epub'))
    .resolves.toMatchObject({ status: 'uploaded' });
  expect(api).toHaveBeenCalledTimes(2);
  expect(save).toHaveBeenCalledWith('auth0|one', 'local-id', 'server-id');
});
