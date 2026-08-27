import assert from "node:assert/strict";
import test from "node:test";
import { planNotifications, workOrderEventSchema } from "../src/field_service_fanout.js";

test("dispatch changes fan out only to subscribers of that event", () => {
  const event = workOrderEventSchema.parse({
    eventId: "evt-7",
    workOrderId: "WO-7",
    kind: "dispatch_changed",
    dispatchStatus: "en_route",
    photoUrls: ["https://assets.example.test/WO-7/arrival.jpg"],
    technicianFollowUp: "Call the tenant on arrival.",
    subscribers: [
      { subscriberId: "dispatcher", events: ["dispatch_changed"] },
      { subscriberId: "customer", events: ["dispatch_changed", "photo_added"] },
      { subscriberId: "photo-review", events: ["photo_added"] },
    ],
  });

  const notifications = planNotifications(event);

  assert.deepEqual(notifications.map((item) => item.subscriberId), ["dispatcher", "customer"]);
  assert.deepEqual(notifications.map((item) => item.notificationId), ["evt-7:dispatcher", "evt-7:customer"]);
  assert.equal(notifications[0]?.workOrder.dispatchStatus, "en_route");
  assert.equal(notifications[0]?.workOrder.technicianFollowUp, "Call the tenant on arrival.");
});
