export class BaseError extends Error {
  public code: number;

  constructor(code: number, message: string | null) {
    super(message ?? "Something went wrong");
    this.code = code;
  }
}