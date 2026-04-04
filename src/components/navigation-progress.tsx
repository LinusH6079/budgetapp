"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = useMemo(() => `${pathname}?${searchParams.toString()}`, [pathname, searchParams]);
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    const start = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      setIsVisible(true);
      setProgress(16);

      intervalRef.current = setInterval(() => {
        setProgress((current) => Math.min(current + Math.random() * 12, 88));
      }, 180);
    };

    window.addEventListener("app:navigation-start", start);
    return () => {
      window.removeEventListener("app:navigation-start", start);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    if (!isVisible) {
      return;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    const frame = window.requestAnimationFrame(() => {
      setProgress(100);
    });
    const timeout = window.setTimeout(() => {
      setIsVisible(false);
      setProgress(0);
    }, 220);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [routeKey, isVisible]);

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px] transition-opacity duration-200 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden="true"
    >
      <div
        className="h-full rounded-full bg-[linear-gradient(90deg,rgba(74,222,128,0.12)_0%,rgba(74,222,128,0.92)_38%,rgba(34,197,94,1)_100%)] shadow-[0_0_16px_rgba(34,197,94,0.45)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
