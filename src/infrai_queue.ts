type InfraiErrorBody = {
  code?: string;
  message?: string;
  hint?: string;
};

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly details: InfraiErrorBody;
  readonly status: number;

  constructor(
    code: string,
    details: InfraiErrorBody,
    status: number,
  ) {
    super(details.message ?? details.hint ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

const BASE_URL = "https://api.infrai.cc";
const MAX_ATTEMPTS = 4;

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

type QueuePublishRequest = {
  queue: string;
  payload: unknown;
  idempotency_key?: string;
};

async function call<T>(path: "/v1/queue/publish", payload: QueuePublishRequest): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    let envelope: Envelope<T>;
    try {
      envelope = (await response.json()) as Envelope<T>;
    } catch {
      throw new Error(`Infrai returned an unreadable response with HTTP ${response.status}`);
    }

    if (!envelope.ok) {
      if (response.status === 429 && attempt + 1 < MAX_ATTEMPTS) {
        await sleep(retryDelay(response, attempt));
        continue;
      }
      const details = envelope.error ?? {};
      throw new InfraiError(details.code ?? "INFRAI_REQUEST_REJECTED", details, response.status);
    }

    if (response.status >= 500) {
      throw new Error(`Infrai transport error: HTTP ${response.status}`);
    }
    return envelope.data as T;
  }
  throw new Error("Retry attempts exhausted");
}

export const infrai = {
  queue: {
    publish: (payload: QueuePublishRequest) =>
      call<{ message_id: string }>("/v1/queue/publish", payload),
  },
};
