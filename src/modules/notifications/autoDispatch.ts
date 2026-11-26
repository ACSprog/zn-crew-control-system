/**
 * Automatic notification dispatch, honouring the "Automated Trigger Rules"
 * toggles on the Notifications page (they previously did nothing).
 *
 * Runs in the browser of the OCC user who made the change: there are no
 * background servers on the free plan, so nothing is sent while nobody has
 * the app open (scheduled reminders would need Power Automate / Apps Script).
 */
import type { Assignment, CrewMember, Flight, LeaveTrainingRecord } from '../../types';
import type { NotificationItem, NotificationSystemSettings } from '../../types/notifications';
import {
  buildNotificationForDisruption,
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
  /** Emails that could not be sent (the crew member still got the in-app message). */
  emailFailed?: number;
  /** Reason of the first email failure, e.g. "gateway not configured". */
  emailError?: string;
}

/** One line for a toast: what went out and what didn't. */
export function describeSendResult(label: string, r: AutoDispatchResult): string {
  if (r.skipped) return `${label}: nothing to send.`;
  const parts = [`${r.sent} sent`];
  if (r.emailFailed) parts.push(`${r.emailFailed} email(s) NOT sent${r.emailError ? ` (${r.emailError.slice(0, 120)})` : ''}; in-app messages were delivered`);
  if (r.failed) parts.push(`${r.failed} failed (see the log)`);
  return `${label}: ${parts.join(', ')}.`;
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
  return sendNotificationsNow(items, actor, `Automatic (${trigger})`);
}

/**
 * Sends messages straight away (Power Automate email / in-app), records each
 * in the shared notification log, and returns how many went out. Used by the
 * automatic triggers and by the manual actions on the Notifications screen.
 */
export async function sendNotificationsNow(items: NotificationItem[], actor: string, note: string): Promise<AutoDispatchResult> {
  const settings = loadNotificationSettings();
  if (items.length === 0) return { skipped: true, sent: 0, failed: 0 };
  let sent = 0;
  let failed = 0;
  let emailFailed = 0;
  let emailError: string | undefined;
  // If the batch already sends this person an in-app message, a failed email
  // must not fall back to a second, identical in-app message.
  const hasInApp = new Set(items.filter((i) => i.channel === 'IN_APP').map((i) => `${i.recipientId}|${i.subject}`));
  const noFallback = { ...settings, retrySettings: { ...settings.retrySettings, enableFallbackChannel: false } };
  const done: NotificationQueueItem[] = [];
  for (const item of items) {
    const dup = item.channel === 'EMAIL' && hasInApp.has(`${item.recipientId}|${item.subject}`);
    const result = await processNotificationWithRetryAndFallback(item, dup ? noFallback : settings);
    const ok = result.status === 'SENT' || result.status === 'DELIVERED' || result.status === 'READ';
    if (item.channel === 'EMAIL' && (!ok || result.fallbackAttempted)) {
      emailFailed++;
      emailError = emailError || (result.errorMessage || '').replace(/^Final Delivery Failure after \d+ attempts: /, '');
      if (ok) sent++; // reached them in-app instead
    } else if (ok) sent++;
    else failed++;
    const queueItem = {
      ...result,
      statusTimeline: [
        {
          status: result.status,
          timestamp: new Date().toISOString(),
          actorOrProvider: result.provider || actor,
          note: `${note}${result.errorMessage ? `: ${result.errorMessage}` : ''}`,
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
  return { skipped: false, sent, failed, emailFailed, emailError };
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

const FLIGHT_FIELDS: Array<[keyof Flight, string]> = [
  ['date', 'Date'],
  ['std', 'Departure time'],
  ['sta', 'Arrival time'],
  ['departure', 'From'],
  ['arrival', 'To'],
  ['aircraft', 'Aircraft type'],
  ['registration', 'Aircraft'],
  ['status', 'Status'],
];

/**
 * A published flight (today or later) changed date, times, route, aircraft
 * or status: tell the crew assigned to it.
 */
export function autoNotifyFlightChange(
  previous: Flight | undefined,
  updated: Flight,
  assignments: Assignment[],
  crew: CrewMember[],
  actor: string
): Promise<AutoDispatchResult> {
  const none = Promise.resolve({ skipped: true, sent: 0, failed: 0 });
  if (!previous) return none;
  const today = new Date().toISOString().slice(0, 10);
  if ((updated.date || '') < today && (previous.date || '') < today) return none;
  const changes = FLIGHT_FIELDS.filter(([k]) => String(previous[k] ?? '') !== String(updated[k] ?? '')).map(
    ([k, label]) => `${label}: ${previous[k] ?? '-'} → ${updated[k] ?? '-'}`
  );
  if (changes.length === 0) return none;
  const published = assignments.filter((a) => a.flightId === updated.id && a.published);
  const ids = new Set<string>();
  published.forEach((a) => crewIdsOf(a).forEach((id) => ids.add(id)));
  const affected = crew.filter((c) => ids.has(c.id));
  if (affected.length === 0) return none;
  const items = buildNotificationForDisruption('Flight change', updated, affected, changes.join('; '), actor).map((n) => ({
    ...n,
    notificationType: 'FLIGHT_CHANGE' as const,
    priority: 'HIGH' as const,
  }));
  return dispatchItems(items, 'onFlightChange', actor);
}

/** Leave or training added or removed: tell the crew member concerned. */
export function autoNotifyLeaveUpdate(
  record: LeaveTrainingRecord,
  change: 'added' | 'removed',
  crew: CrewMember[],
  actor: string
): Promise<AutoDispatchResult> {
  const member = crew.find((c) => c.id === record.crewId);
  if (!member?.email) return Promise.resolve({ skipped: true, sent: 0, failed: 0 });
  const period = record.startDate === record.endDate ? record.startDate : `${record.startDate} to ${record.endDate}`;
  const subject = `${record.type} ${change === 'added' ? 'scheduled' : 'cancelled'}: ${period}`;
  const message =
    change === 'added'
      ? `Dear ${member.name},\n\n${record.type} has been recorded for you for ${period}. You will not be rostered for flying duties in this period.${record.description ? `\n\nDetails: ${record.description}` : ''}\n\nZambia Airways Crew Control`
      : `Dear ${member.name},\n\nYour ${record.type} for ${period} has been cancelled. You may now be rostered for duties in this period.\n\nZambia Airways Crew Control`;
  const now = new Date().toISOString();
  const items: NotificationItem[] = (['EMAIL', 'IN_APP'] as const).map((channel) => ({
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${channel}`,
    recipientId: member.id,
    recipientName: member.name,
    recipientRole: member.role,
    recipientStaffNumber: member.staffNumber,
    recipientEmail: member.email,
    channel,
    notificationType: 'LEAVE_MODIFICATION',
    priority: 'NORMAL',
    subject,
    message,
    createdAt: now,
    status: 'QUEUED',
    retryCount: 0,
    maxRetries: 3,
    retryHistory: [],
    initiatedBy: actor,
    provider: channel === 'EMAIL' ? 'POWER_AUTOMATE' : 'IN_APP_DISPATCH',
  }));
  return dispatchItems(items, 'onLeaveUpdate', actor);
}
