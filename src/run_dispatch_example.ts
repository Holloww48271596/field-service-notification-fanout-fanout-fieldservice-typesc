import { planNotifications, workOrderEventSchema } from "./field_service_fanout.js";

const event = workOrderEventSchema.parse({
  eventId: "evt-2048-dispatched",
  workOrderId: "WO-2048",
  kind: "dispatch_changed",
  dispatchStatus: "dispatched",
  photoUrls: ["https://assets.example.test/work-orders/WO-2048/site.jpg"],
  technicianFollowUp: "Confirm access with the site manager before arrival.",
  subscribers: [
    { subscriberId: "dispatch-desk", events: ["dispatch_changed"] },
    { subscriberId: "site-manager", events: ["dispatch_changed", "photo_added"] },
    { subscriberId: "photo-audit", events: ["photo_added"] },
  ],
});

console.log(JSON.stringify(planNotifications(event), null, 2));
