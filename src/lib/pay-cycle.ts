const STOCKHOLM_TIME_ZONE = "Europe/Stockholm";

export type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

function calendarDateFromUtc(date: Date): CalendarDate {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export function calendarDateKey(date: CalendarDate) {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

export function addCalendarDays(date: CalendarDate, days: number) {
  return calendarDateFromUtc(
    new Date(Date.UTC(date.year, date.month - 1, date.day + days)),
  );
}

export function calendarDaysBetween(start: CalendarDate, end: CalendarDate) {
  return Math.round(
    (Date.UTC(end.year, end.month - 1, end.day) -
      Date.UTC(start.year, start.month - 1, start.day)) /
      86_400_000,
  );
}

function compareCalendarDates(left: CalendarDate, right: CalendarDate) {
  return calendarDateKey(left).localeCompare(calendarDateKey(right));
}

export function getStockholmCalendarDate(date: Date): CalendarDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: STOCKHOLM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
  };
}

export function stockholmStartOfDay(date: CalendarDate) {
  const initialGuess = Date.UTC(date.year, date.month - 1, date.day);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: STOCKHOLM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const zonedParts = formatter.formatToParts(new Date(initialGuess));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(zonedParts.find((entry) => entry.type === type)?.value);
  const representedAsUtc = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
  );

  return new Date(initialGuess - (representedAsUtc - initialGuess));
}

export function adjustedPayday(year: number, month: number): CalendarDate {
  const payday = new Date(Date.UTC(year, month - 1, 25));
  const weekday = payday.getUTCDay();
  const adjustment = weekday === 6 ? -1 : weekday === 0 ? -2 : 0;

  return addCalendarDays({ year, month, day: 25 }, adjustment);
}

function adjacentMonth(
  date: Pick<CalendarDate, "year" | "month">,
  offset: number,
) {
  const shifted = new Date(Date.UTC(date.year, date.month - 1 + offset, 1));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
  };
}

export function getPayCycle(now = new Date()) {
  const today = getStockholmCalendarDate(now);
  const thisMonthPayday = adjustedPayday(today.year, today.month);
  const startsThisMonth = compareCalendarDates(today, thisMonthPayday) >= 0;
  const startMonth = startsThisMonth
    ? today
    : adjacentMonth(today, -1);
  const endMonth = startsThisMonth
    ? adjacentMonth(today, 1)
    : today;
  const startDate = adjustedPayday(startMonth.year, startMonth.month);
  const endDate = adjustedPayday(endMonth.year, endMonth.month);
  const totalDays = calendarDaysBetween(startDate, endDate);
  const elapsedDays = Math.min(
    totalDays,
    Math.max(1, calendarDaysBetween(startDate, today) + 1),
  );
  const weekday = new Date(
    Date.UTC(today.year, today.month - 1, today.day),
  ).getUTCDay();
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  const weekStartDate = addCalendarDays(today, -daysSinceMonday);
  const weekEndDate = addCalendarDays(weekStartDate, 7);
  const ticks = Array.from({ length: Math.max(0, totalDays - 1) }, (_, index) => {
    const dayNumber = index + 1;
    const boundaryDate = addCalendarDays(startDate, dayNumber);
    const boundaryWeekday = new Date(
      Date.UTC(boundaryDate.year, boundaryDate.month - 1, boundaryDate.day),
    ).getUTCDay();

    return {
      position: (dayNumber / totalDays) * 100,
      isWeekBoundary: boundaryWeekday === 1,
    };
  });
  const weekBoundaries = [
    { dayNumber: 0, date: startDate },
    ...ticks
      .map((tick, index) => ({
        tick,
        dayNumber: index + 1,
        date: addCalendarDays(startDate, index + 1),
      }))
      .filter((entry) => entry.tick.isWeekBoundary)
      .map(({ dayNumber, date }) => ({ dayNumber, date })),
    { dayNumber: totalDays, date: endDate },
  ];
  const weeks = weekBoundaries.slice(0, -1).map((boundary, index) => {
    const nextBoundary = weekBoundaries[index + 1];
    const date = new Date(
      Date.UTC(boundary.date.year, boundary.date.month - 1, boundary.date.day),
    );
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNumber = Math.ceil(
      ((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
    );

    return {
      label: `v. ${weekNumber}`,
      start: (boundary.dayNumber / totalDays) * 100,
      end: ((nextBoundary?.dayNumber ?? totalDays) / totalDays) * 100,
    };
  });

  return {
    today,
    startDate,
    endDate,
    startAt: stockholmStartOfDay(startDate),
    endAt: stockholmStartOfDay(endDate),
    weekStartAt: stockholmStartOfDay(weekStartDate),
    weekEndAt: stockholmStartOfDay(weekEndDate),
    weekStartDate,
    weekEndDate,
    totalDays,
    elapsedDays,
    expectedFraction: elapsedDays / totalDays,
    ticks,
    weeks,
  };
}
