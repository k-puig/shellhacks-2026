// Coalesce frequent reader updates and serialize requests so an older PATCH
// cannot finish after a newer one. flush() sends the last spot on reader exit.
export function createProgressSync(send: (position: number) => Promise<unknown>, delayMs = 1500) {
  let pending: number | null = null;
  let lastSent: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let sending = false;
  let stopped = false;

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const schedule = () => {
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      void run();
    }, delayMs);
  };

  async function run() {
    if (sending || pending === null) return;
    const position = pending;
    pending = null;
    sending = true;
    try {
      await send(position);
      lastSent = position;
    } catch (error) {
      // Local positions remain authoritative while offline. A later position
      // event can try again; never interrupt the reader for a sync failure.
      console.warn('[dodo] Could not sync reading position:', String(error));
    } finally {
      sending = false;
      if (pending !== null) {
        if (stopped) void run();
        else schedule();
      }
    }
  }

  return {
    queue(position: number) {
      if (stopped || !Number.isInteger(position) || position < 0) return;
      if (position === lastSent && !sending) {
        pending = null;
        clearTimer();
        return;
      }
      pending = position;
      schedule();
    },
    flush() {
      stopped = true;
      clearTimer();
      void run();
    },
    cancel() {
      stopped = true;
      pending = null;
      clearTimer();
    },
  };
}
