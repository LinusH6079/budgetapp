"use client";

import { useRef, useState } from "react";

import { formatCurrency } from "@/lib/money";
import {
  addCalendarDays,
  type CalendarDate,
} from "@/lib/pay-cycle";

type SpendingPaceProgressProps = {
  cycle: {
    startDate: CalendarDate;
    endDate: CalendarDate;
    totalDays: number;
    elapsedDays: number;
    expectedFraction: number;
    ticks: Array<{
      position: number;
      isWeekBoundary: boolean;
    }>;
    weeks: Array<{
      label: string;
      startDate: CalendarDate;
      start: number;
      end: number;
    }>;
  };
  monthlyLimit: number;
  spent: number;
  showDetails?: boolean;
};

function formatCalendarDate(date: CalendarDate) {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(date.year, date.month - 1, date.day, 12)));
}

function clampPercentage(value: number) {
  return Math.min(100, Math.max(0, value));
}

function markerTransform(percentage: number) {
  if (percentage < 18) {
    return "translateX(0)";
  }

  if (percentage > 82) {
    return "translateX(-100%)";
  }

  return "translateX(-50%)";
}

export function SpendingPaceProgress({
  cycle,
  monthlyLimit,
  spent,
  showDetails = false,
}: SpendingPaceProgressProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const actualPercentage = (spent / monthlyLimit) * 100;
  const expectedPercentage = cycle.expectedFraction * 100;
  const expectedAmount = Math.round(monthlyLimit * cycle.expectedFraction);
  const paceDifference = expectedAmount - spent;
  const isOverMonthlyLimit = spent > monthlyLimit;
  const selectedPercentage =
    selectedDay === null ? null : (selectedDay / cycle.totalDays) * 100;
  const selectedDate =
    selectedDay === null
      ? null
      : selectedDay === 0
        ? cycle.startDate
        : addCalendarDays(cycle.startDate, selectedDay - 1);
  const selectedAmount =
    selectedDay === null
      ? null
      : Math.round(monthlyLimit * (selectedDay / cycle.totalDays));
  const selectedRemaining =
    selectedAmount === null ? null : selectedAmount - spent;

  const selectFromClientX = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();

    if (!rect || rect.width === 0) {
      return;
    }

    const fraction = Math.min(
      1,
      Math.max(0, (clientX - rect.left) / rect.width),
    );
    setSelectedDay(Math.round(fraction * cycle.totalDays));
  };

  return (
    <div className="mt-4">
      {showDetails ? (
        <div className="mb-1 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[10px] font-semibold text-white">
            <i className="h-2 w-2 rounded-full bg-white shadow-[0_0_7px_rgba(255,255,255,0.35)]" />
            Lön {formatCalendarDate(cycle.startDate)}
          </span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[10px] font-semibold text-white">
            Nästa lön {formatCalendarDate(cycle.endDate)}
            <i className="h-2 w-2 rounded-full bg-white shadow-[0_0_7px_rgba(255,255,255,0.35)]" />
          </span>
        </div>
      ) : null}

      {showDetails ? (
        <div className="relative flex h-9 overflow-visible pt-4 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">
          {cycle.weeks.map((week) => (
            <span
              key={`${week.label}-${week.start}`}
              className="relative flex items-center justify-center border-l border-white/30 first:border-l-0"
              style={{ width: `${week.end - week.start}%` }}
            >
              {week.start > 0 ? (
                <span className="absolute -left-px -top-4 -translate-x-1/2 whitespace-nowrap rounded bg-[var(--color-surface)] px-1 text-[8px] font-medium normal-case tracking-normal text-white/75">
                  {formatCalendarDate(week.startDate)}
                </span>
              ) : null}
              {week.label}
            </span>
          ))}
        </div>
      ) : null}

      <div
        ref={trackRef}
        className={`relative touch-pan-y select-none outline-none ${
          showDetails ? "mt-1 h-[70px]" : "mt-2 h-[52px]"
        }`}
        tabIndex={0}
        role="slider"
        aria-label="Visa riktbelopp för ett datum"
        aria-valuemin={0}
        aria-valuemax={cycle.totalDays}
        aria-valuenow={selectedDay ?? cycle.elapsedDays}
        onFocus={() => setSelectedDay((current) => current ?? cycle.elapsedDays)}
        onBlur={() => setSelectedDay(null)}
        onPointerDown={(event) => {
          event.currentTarget.focus({ preventScroll: true });
          selectFromClientX(event.clientX);
        }}
        onPointerMove={(event) => {
          if (event.pointerType === "mouse" || event.buttons > 0) {
            selectFromClientX(event.clientX);
          }
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") {
            setSelectedDay(null);
          }
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
            return;
          }

          event.preventDefault();
          const current = selectedDay ?? cycle.elapsedDays;
          setSelectedDay(
            Math.min(
              cycle.totalDays,
              Math.max(0, current + (event.key === "ArrowRight" ? 1 : -1)),
            ),
          );
        }}
      >
        {showDetails ? <div
          className="absolute top-0 z-30"
          style={{
            left: `${clampPercentage(actualPercentage)}%`,
            transform: markerTransform(actualPercentage),
          }}
        >
          <span
            className={`block whitespace-nowrap rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${
              isOverMonthlyLimit
                ? "bg-[#ef4444] text-white"
                : "bg-[#6ee7b7] text-[#07120e]"
            }`}
          >
            Spenderat {formatCurrency(spent)}
          </span>
        </div> : null}
        <span
          className={`absolute z-20 w-0.5 ${showDetails ? "top-4 h-[45px]" : "top-4 h-[25px]"} ${
            isOverMonthlyLimit ? "bg-[#ef4444]" : "bg-[#6ee7b7]"
          }`}
          style={{ left: `${clampPercentage(actualPercentage)}%` }}
          aria-hidden="true"
        />

        {showDetails ? <div
          className="absolute top-7 z-30"
          style={{
            left: `${clampPercentage(expectedPercentage)}%`,
            transform: markerTransform(expectedPercentage),
          }}
        >
          <span className="block whitespace-nowrap rounded-md border border-white/15 bg-[#282828] px-1.5 py-0.5 text-[9px] font-semibold text-white">
            Idag {formatCurrency(expectedAmount)}
          </span>
        </div> : null}
        <span
          className={`absolute z-20 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.25)] ${
            showDetails ? "top-[42px] h-[17px]" : "top-4 h-[25px]"
          }`}
          style={{ left: `${clampPercentage(expectedPercentage)}%` }}
          aria-hidden="true"
        />

        {selectedPercentage !== null && selectedDate && selectedAmount !== null && selectedRemaining !== null ? (
          <>
            <div
              className="absolute -top-10 z-50"
              style={{
                left: `${clampPercentage(selectedPercentage)}%`,
                transform: markerTransform(selectedPercentage),
              }}
              role="status"
            >
              <span className="block whitespace-nowrap rounded-lg border border-white/20 bg-[#111214] px-2 py-1.5 text-[10px] font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.42)]">
                <span className="block">
                  {formatCalendarDate(selectedDate)} · riktbelopp {formatCurrency(selectedAmount)}
                </span>
                <span className={`mt-0.5 block text-[9px] ${selectedRemaining < 0 ? "text-[#fca5a5]" : "text-[#a7f3d0]"}`}>
                  Kvar att använda {formatCurrency(selectedRemaining)}
                </span>
              </span>
            </div>
            <span
              className="absolute -top-1 bottom-0 z-40 w-px bg-white/80"
              style={{ left: `${clampPercentage(selectedPercentage)}%` }}
              aria-hidden="true"
            />
          </>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 h-7 overflow-hidden rounded-full border border-[var(--color-line)] bg-[rgba(255,255,255,0.035)]">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ${
              isOverMonthlyLimit
                ? "bg-[rgba(239,68,68,0.52)]"
                : "bg-[rgba(167,243,208,0.42)]"
            }`}
            style={{ width: `${clampPercentage(actualPercentage)}%` }}
          />

          {cycle.ticks.map((tick) => (
            <span
              key={`${tick.position}-${tick.isWeekBoundary}`}
              className={`absolute bottom-0 top-0 z-10 w-px ${
                tick.isWeekBoundary
                  ? "w-0.5 bg-white/55"
                  : "!top-2 bg-white/20"
              }`}
              style={{ left: `${tick.position}%` }}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>

      {showDetails ? <div className="mt-2 flex items-center justify-between gap-3">
        <p
          className={`text-[12px] font-medium ${
            paceDifference < 0
              ? "text-[var(--color-danger)]"
              : "text-[#86efac]"
          }`}
        >
          {paceDifference >= 0
            ? `${formatCurrency(paceDifference)} under dagens takt`
            : `${formatCurrency(Math.abs(paceDifference))} över dagens takt`}
        </p>
        <p className="shrink-0 text-[9px] text-[var(--color-muted)]">
          Dra för datum
        </p>
      </div> : null}
    </div>
  );
}
