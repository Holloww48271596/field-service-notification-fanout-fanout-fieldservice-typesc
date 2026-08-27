import { z } from "zod";

const subscriberSchema = z.object({
  subscriberId: z.string().min(1),
  events: z.array(z.enum(["dispatch_changed", "photo_added", "follow_up_required"])).min(1),
});

export const workOrderEventSchema = z.object({
  eventId: z.string().min(1),
  workOrderId: z.string().min(1),
  kind: z.enum(["dispatch_changed", "photo_added", "follow_up_required"]),
  dispatchStatus: z.enum(["unassigned", "dispatched", "en_route", "on_site", "completed"]),
  photoUrls: z.array(z.string().url()).max(20),
  technicianFollowUp: z.string().min(1).nullable(),
  subscribers: z.array(subscriberSchema).min(1),
});

export type WorkOrderEvent = z.infer<typeof workOrderEventSchema>;

export type NotificationPayload = {
  notificationId: string;
  subscriberId: string;
  workOrder: {
    id: string;
    event: WorkOrderEvent["kind"];
    dispatchStatus: WorkOrderEvent["dispatchStatus"];
    photoUrls: string[];
    technicianFollowUp: string | null;
  };
};

export function planNotifications(event: WorkOrderEvent): NotificationPayload[] {
  return event.subscribers
    .filter((subscriber) => subscriber.events.includes(event.kind))
    .map((subscriber) => ({
      notificationId: `${event.eventId}:${subscriber.subscriberId}`,
      subscriberId: subscriber.subscriberId,
      workOrder: {
        id: event.workOrderId,
        event: event.kind,
        dispatchStatus: event.dispatchStatus,
        photoUrls: event.photoUrls,
        technicianFollowUp: event.technicianFollowUp,
      },
    }));
}
