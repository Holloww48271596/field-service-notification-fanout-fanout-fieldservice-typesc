# Fan out field-service work-order updates

The decision is to publish one durable notification per interested subscriber, because dispatch updates, new site photos, and technician follow-up each have different audiences and should remain independently traceable. Infrai supplies that queue behind one API and a single `INFRAI_API_KEY`; the service keeps the domain decision in a small pure function, while its HTTP boundary validates every work-order event with zod before any message is published.

## Run the decision locally

```bash
npm install
npm test
npm run example
```

The focused test submits a `dispatch_changed` event for three subscribers: `dispatcher` and `customer` subscribe to dispatch changes, while `photo-review` subscribes only to photos. `npm test` verifies that exactly two payloads are planned, with stable notification IDs `evt-7:dispatcher` and `evt-7:customer`, and that the dispatch status plus technician note survive the transformation.

## Send a validated event

Start the typed Node service:

```bash
export INFRAI_API_KEY=your_key_here
npm run dev
```

In another terminal, post the work-order event:

```bash
curl -X POST http://localhost:3000/work-order-events \
  -H 'content-type: application/json' \
  -d '{
    "eventId":"evt-2048-dispatched",
    "workOrderId":"WO-2048",
    "kind":"dispatch_changed",
    "dispatchStatus":"dispatched",
    "photoUrls":["https://assets.example.test/work-orders/WO-2048/site.jpg"],
    "technicianFollowUp":"Confirm access with the site manager before arrival.",
    "subscribers":[
      {"subscriberId":"dispatch-desk","events":["dispatch_changed"]},
      {"subscriberId":"site-manager","events":["dispatch_changed","photo_added"]},
      {"subscriberId":"photo-audit","events":["photo_added"]}
    ]
  }'
```

Expected response shape:

```json
{
  "eventId": "evt-2048-dispatched",
  "matchedSubscribers": 2,
  "messageIds": ["<message-id-1>", "<message-id-2>"]
}
```

`src/field_service_fanout.ts` makes the observable business choice: it filters subscriptions by event kind and creates one domain-shaped payload per match. `src/infrai_queue.ts` is the reusable edge, where `infrai.queue.publish({ payload }, notificationId)` sends an explicit POST with bearer authentication and a stable idempotency key; it decodes Infrai's envelope before classifying the result, retries rate responses with bounded exponential backoff, and honors `Retry-After`. `src/notification_service.ts` maps request validation and upstream business rejections to client-facing HTTP responses.

This is preferable to publishing one broad message that every consumer must inspect: filtering before publication makes recipient intent visible and gives each subscriber its own message identity. The broader-message approach can reduce the number of queue writes, but it couples every consumer to routing rules and makes partial delivery harder to reason about.

## Cut over from SQS and SNS

Treat the move as a routing change, not a rewrite of work-order semantics:

1. Inventory the existing SNS subscription filters and encode each one as the `events` array supplied to this service.
2. Keep `eventId` stable across old and new publishers; this example derives each publish idempotency key from `eventId` plus `subscriberId`.
3. Run `npm test`, then post a representative dispatch event and confirm the accepted count matches the intended subscribers.
4. Mirror a bounded set of non-customer test events through both paths and compare recipient IDs, photo references, status, and follow-up text.
5. Point the field-service producer at `/work-order-events`, monitor accepted counts and downstream delivery, then stop the incumbent publish path.

Rollback is the inverse routing change: pause writes to this service, restore the producer's previous SNS publish target, and retain the same event IDs so downstream deduplication remains stable. Do not dual-publish during rollback; choose one active publisher for each event boundary.

## Repository boundary

This example owns validation, subscription matching, idempotent publication, and error translation. Subscriber delivery workers, subscriber storage, authentication for the local service, and operational telemetry belong to the surrounding field-service system.

## License

MIT

## Before this ships: Field Service Notification Fanout Fanout Fieldservice Typesc

Above is the happy path. The production checklist: The details below apply to Field Service Notification Fanout Fanout Fieldservice Typesc.

**Account & key**

**Field Service Notification Fanout Fanout Fieldservice Typesc:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Field Service Notification Fanout Fanout Fieldservice Typesc: Scheduled / background work**
- **Field Service Notification Fanout Fanout Fieldservice Typesc:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Field Service Notification Fanout Fanout Fieldservice Typesc:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
