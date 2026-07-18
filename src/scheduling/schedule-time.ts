import { WeekdaySchema, type StudyPlan } from "../domain/study-plan.js";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

function localParts(date: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: (typeof WEEKDAYS)[number];
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const weekday = WeekdaySchema.parse(
    parts.find((part) => part.type === "weekday")?.value.toUpperCase(),
  );
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
    weekday,
  };
}

function zonedLocalToUtc(options: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  timeZone: string;
}): Date {
  const desired = Date.UTC(
    options.year,
    options.month - 1,
    options.day,
    options.hour,
    options.minute,
  );
  let guess = new Date(desired);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = localParts(guess, options.timeZone);
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
    );
    guess = new Date(guess.getTime() + desired - observedAsUtc);
  }
  return guess;
}

export function nextScheduledCall(options: {
  now: Date;
  weekdays: StudyPlan["preferredWeekdays"];
  localStartTime: string;
  timeZone: string;
}): string {
  const [hour, minute] = options.localStartTime.split(":").map(Number) as [
    number,
    number,
  ];
  const localNow = localParts(options.now, options.timeZone);
  const localMidday = Date.UTC(
    localNow.year,
    localNow.month - 1,
    localNow.day,
    12,
  );
  for (let offset = 0; offset <= 7; offset += 1) {
    const date = new Date(localMidday + offset * 24 * 60 * 60_000);
    const weekday = WEEKDAYS[date.getUTCDay()]!;
    if (!options.weekdays.includes(weekday as StudyPlan["preferredWeekdays"][number])) {
      continue;
    }
    const candidate = zonedLocalToUtc({
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour,
      minute,
      timeZone: options.timeZone,
    });
    if (candidate.getTime() > options.now.getTime()) return candidate.toISOString();
  }
  throw new Error("Could not calculate the next scheduled call.");
}
