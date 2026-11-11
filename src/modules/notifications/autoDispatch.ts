/**
 * Automatic notification dispatch, honouring the "Automated Trigger Rules"
 * toggles on the Notifications page (they previously did nothing).
 *
 * Runs in the browser of the OCC user who made the change: there are no
 * background servers on the free plan, so nothing is sent while nobody has
 * the app open (scheduled reminders would need Power Automate / Apps Script).
 */
import type { Assignment, CrewMember, Flight } from '../../types';
import type { NotificationItem, NotificationSystemSettings } from '../../types/notifications';
import {
  buildNotificationForRosterChange,
  buildNotificationItemsForRosterPublish,
  loadNotificationSettings,
  processNotificationWithRetryAndFallback,
} from '../../utils/notificationEngine';
import { getNotificationQueue, saveNotificationQueue } from './notificationQueue';
import { createNotificationLog } from './notificationLogs';
import type { NotificationQueueItem } from './types';

export type AutoTrigger = keyof NotificationSystemSettings['autoTriggers'];

export interface AutoDispatchResult {
  skipped: boolean;
  sent: number;
  failed: number;
}

async function dispatchItems(
  items: NotificationItem[],
  trigger: AutoTrigger,
  actor: string
): Promise<AutoDispatchResult> {
  const settings = loadNotificationSettings();
  if (!settings.autoTriggers?.[trigger] || items.length === 0) {
    return { skipped: true, sent: 0, failed: 0 };
  }
  let sent = 0;
  let failed = 0;
  const done: NotificationQueueItem[] = [];
  for (const item of items) {
    const result = await processNotificationWithRetryAndFallback(item, settings);
    const ok = result.status === 'SENT' || result.status === 'DELIVERED' || result.status === 'READ';
    if (ok) sent++;
    else failed++;
    const queueItem = {
      ...result,
      statusTimeline: [
        {
          status: result.status,
          timestamp: new Date().toISOString(),
          actorOrProvider: result.provider || actor,
          note: `Automatic (${trigger})${result.errorMessage ? `: ${result.errorMessage}` : ''}`,
        },
      ],
      retryHistory: result.retryHistory || [],
    } as unknown as NotificationQueueItem;
    done.push(queueItem);
    try {
      await createNotificationLog(queueItem, { status: queueItem.status });
    } catch (err) {
      console.warn('[autoDispatch] could not write notification log', err);
    }
  }
  // Show them on this computer's Notifications page as well.
  saveNotificationQueue([...done, ...getNotificationQueue()].slice(0, 500));
  return { skipped: false, sent, failed };
}

export function autoNotifyRosterPublished(
  assignments: Assignment[],
  crew: CrewMember[],
  flights: Flight[],
  actor: string
): Promise<AutoDispatchResult> {
  const items = buildNotificationItemsForRosterPublish(assignments, crew, flights, actor);
  return dispatchItems(items, 'onRosterPublished', actor);
}

const crewIdsOf = (a?: Assignment) =>
  new Set([a?.captainId, a?.firstOfficerId, ...(a?.cabinCrewIds || [])].filter(Boolean) as string[]);

/**
 * Notifies crew added to or removed from a flight whose roster was already
 * published. Draft (unpublished) changes don't notify anyone.
 */
export function autoNotifyRosterChange(
  previous: Assignment | undefined,
  updated: Assignment,
  crew: CrewMember[],
  flights: Flight[],
  actor: string
): Promise<AutoDispatchResult> {
  if (!previous?.published && !updated.published) {
    return Promise.resolve({ skipped: true, sent: 0, failed: 0 });
  }
  const flight = flights.find((f) => f.id === updated.flightId);
  if (!flight) return Promise.resolve({ skipped: true, sent: 0, failed: 0 });
  const before = crewIdsOf(previous);
  const after = crewIdsOf(updated);
  const items: NotificationItem[] = [];
  const label = `${flight.flightNumber} ${flight.departure}-${flight.arrival} on ${flight.date}`;
  after.forEach((id) => {
    if (before.has(id)) return;
    const member = crew.find((c) => c.id === id);
    if (member) {
      items.push(
        ...buildNotificationForRosterChange('Not assigned', `Assigned to ${label}`, flight, member, updated.reportTime || '', 'Roster amendment', actor)
      );
    }
  });
  before.forEach((id) => {
    if (after.has(id)) return;
    const member = crew.find((c) => c.id === id);
    if (member) {
      items.push(
        ...buildNotificationForRosterChange(`Assigned to ${label}`, 'Removed from this flight', flight, member, updated.reportTime || '', 'Roster amendment', actor)
      );
    }
  });
  return dispatchItems(items, 'onRosterChange', actor);
}
