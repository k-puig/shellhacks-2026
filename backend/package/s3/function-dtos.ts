export type UploadBookInput = {
  key: string;
  book: File;
};

export type DeleteBookInput = {
  key: string;
};

export type FetchBookInput = {
  key: string;
};

export type FetchProfilePictureInput = {
  key: string;
};

export type FetchS3ObjectOutput = {
  body: ReadableStream<Uint8Array>;
  contentLength?: number;
  contentType?: string;
};
export type UploadProfilePictureInput = {
  key: string;
  profilePicture: File;
};

export type DeleteProfilePictureInput = {
  key: string;
};
