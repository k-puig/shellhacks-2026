// Gemini generateContent with structured JSON output, shared by the command
// interpreter and Ask DODO.
//
// The key is read from EXPO_PUBLIC_GEMINI_API_KEY (.env.local). EXPO_PUBLIC_ vars
// are bundled into the app: fine for the hackathon demo, but move this call to
// the backend before shipping.

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL ?? 'gemini-3.5-flash-lite';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export const isGeminiConfigured = () => Boolean(API_KEY);

export async function generateJson<T>(req: {
  system: string;
  user: string;
  // Gemini structured-output schema (OpenAPI subset).
  schema: object;
  timeoutMs: number;
}): Promise<T> {
  if (!API_KEY) throw new Error('EXPO_PUBLIC_GEMINI_API_KEY is not set');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), req.timeoutMs);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: 'user', parts: [{ text: req.user }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: req.schema,
        },
      }),
    });
    if (!res.ok) {
      throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = await res.json();
    const text: unknown = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') {
      throw new Error(`Gemini returned no text (finishReason: ${data?.candidates?.[0]?.finishReason})`);
    }
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timeout);
  }
}
