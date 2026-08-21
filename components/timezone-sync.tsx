"use client";

import { useEffect } from "react";
import { setTimezoneAction } from "@/app/actions";

export function TimezoneSync() {
  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone) void setTimezoneAction(timezone);
  }, []);
  return null;
}
