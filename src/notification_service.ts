import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { planNotifications, workOrderEventSchema } from "./field_service_fanout.js";
import { infrai, InfraiError } from "./infrai_queue.js";

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("Request body is too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/work-order-events") {
    sendJson(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const event = workOrderEventSchema.parse(await readJson(request));
    const notifications = planNotifications(event);
    const published = await Promise.all(
      notifications.map((notification) =>
        infrai.queue.publish({
          queue: "field-service-notifications",
          payload: notification,
          idempotency_key: notification.notificationId,
        }),
      ),
    );
    sendJson(response, 202, {
      eventId: event.eventId,
      matchedSubscribers: notifications.length,
      messageIds: published.map((message) => message.message_id),
    });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      sendJson(response, 400, { error: "Invalid work-order event" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      sendJson(response, status, { error: error.code, message: error.message });
      return;
    }
    sendJson(response, 500, { error: "Unable to accept event" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`field-service notification service listening on ${port}`));
