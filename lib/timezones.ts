export type TZ = "PT" | "CT" | "ET" | "BST";

export const TZ_LABELS: Record<TZ, string> = {
  PT: "PT",
  CT: "CT",
  ET: "ET",
  BST: "BST",
};

const TZ_IANA: Record<TZ, string> = {
  PT: "America/Los_Angeles",
  CT: "America/Chicago",
  ET: "America/New_York",
  BST: "Europe/London",
};

export function formatKickoff(utc: string, tz: TZ): string {
  const date = new Date(utc);
  return date.toLocaleString("en-US", {
    timeZone: TZ_IANA[tz],
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
