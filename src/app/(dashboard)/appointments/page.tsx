import { auth } from "@/lib/auth";
import { getOrCreateOrg } from "@/lib/org";
import { db } from "@/lib/db";
import { appointments } from "@/lib/db/schema";
import { eq, and, gte, lt } from "drizzle-orm";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

function formatRange(starts: Date | null, ends: Date | null, tz: string | null) {
  if (!starts) return "—";
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz || undefined,
  };
  const startStr = new Intl.DateTimeFormat(undefined, opts).format(starts);
  if (!ends) return startStr;
  const endStr = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz || undefined,
  }).format(ends);
  return `${startStr} – ${endStr}`;
}

function ProviderBadge({ provider }: { provider: string }) {
  const label = provider === "calendly" ? "Calendly" : provider === "google" ? "Google" : provider;
  const color =
    provider === "calendly"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : "bg-emerald-50 text-emerald-700 border-emerald-200";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const palette: Record<string, string> = {
    confirmed: "bg-green-50 text-green-700 border-green-200",
    canceled: "bg-gray-100 text-gray-600 border-gray-200",
    rescheduled: "bg-amber-50 text-amber-700 border-amber-200",
  };
  const cls = palette[status] || "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

export default async function AppointmentsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const org = await getOrCreateOrg(session.user.id, session.user.email!);
  const now = new Date();

  const [upcoming, past] = await Promise.all([
    db.query.appointments.findMany({
      where: and(eq(appointments.orgId, org.id), gte(appointments.startsAt, now)),
      orderBy: (a, { asc }) => [asc(a.startsAt)],
      limit: 50,
    }),
    db.query.appointments.findMany({
      where: and(eq(appointments.orgId, org.id), lt(appointments.startsAt, now)),
      orderBy: (a, { desc }) => [desc(a.startsAt)],
      limit: 50,
    }),
  ]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-black">Appointments</h1>
        <p className="mt-1 text-gray-500">
          Bookings synced from your connected scheduling tools.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Upcoming</CardTitle>
          <CardDescription>
            {upcoming.length === 0
              ? "Nothing on the calendar yet. Connect Calendly or Google Calendar from the Integrations page."
              : `${upcoming.length} upcoming booking${upcoming.length === 1 ? "" : "s"}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AppointmentList rows={upcoming} emptyHint="upcoming" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Past</CardTitle>
          <CardDescription>
            {past.length === 0 ? "No past appointments yet." : `${past.length} past booking${past.length === 1 ? "" : "s"}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AppointmentList rows={past} emptyHint="past" />
        </CardContent>
      </Card>
    </div>
  );
}

function AppointmentList({
  rows,
  emptyHint,
}: {
  rows: Array<{
    id: string;
    provider: string;
    status: string;
    title: string | null;
    startsAt: Date | null;
    endsAt: Date | null;
    timezone: string | null;
    attendeeName: string | null;
    attendeeEmail: string | null;
    attendeePhone: string | null;
    location: string | null;
    joinUrl: string | null;
    cancelUrl: string | null;
    rescheduleUrl: string | null;
    externalEventUri: string | null;
  }>;
  emptyHint: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">No {emptyHint} bookings.</p>;
  }
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wider text-gray-500">
            <th className="px-2 py-2 font-medium">When</th>
            <th className="px-2 py-2 font-medium">Title</th>
            <th className="px-2 py-2 font-medium">Attendee</th>
            <th className="px-2 py-2 font-medium">Source</th>
            <th className="px-2 py-2 font-medium">Status</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-gray-100">
              <td className="px-2 py-3 align-top">
                {formatRange(r.startsAt, r.endsAt, r.timezone)}
              </td>
              <td className="px-2 py-3 align-top">
                <div className="font-medium text-black">{r.title || "Appointment"}</div>
                {r.location ? (
                  <div className="text-xs text-gray-500">{r.location}</div>
                ) : null}
                {r.joinUrl ? (
                  <a
                    href={r.joinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 underline"
                  >
                    Join link
                  </a>
                ) : null}
              </td>
              <td className="px-2 py-3 align-top">
                <div>{r.attendeeName || "—"}</div>
                <div className="text-xs text-gray-500">
                  {r.attendeeEmail || r.attendeePhone || ""}
                </div>
              </td>
              <td className="px-2 py-3 align-top">
                <ProviderBadge provider={r.provider} />
              </td>
              <td className="px-2 py-3 align-top">
                <StatusBadge status={r.status} />
              </td>
              <td className="px-2 py-3 align-top text-xs">
                {r.externalEventUri ? (
                  <a
                    href={r.externalEventUri}
                    target="_blank"
                    rel="noreferrer"
                    className="text-gray-500 underline hover:text-black"
                  >
                    Open
                  </a>
                ) : null}
                {r.rescheduleUrl ? (
                  <>
                    {r.externalEventUri ? " · " : ""}
                    <a
                      href={r.rescheduleUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-gray-500 underline hover:text-black"
                    >
                      Reschedule
                    </a>
                  </>
                ) : null}
                {r.cancelUrl ? (
                  <>
                    {r.externalEventUri || r.rescheduleUrl ? " · " : ""}
                    <a
                      href={r.cancelUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-gray-500 underline hover:text-black"
                    >
                      Cancel
                    </a>
                  </>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
