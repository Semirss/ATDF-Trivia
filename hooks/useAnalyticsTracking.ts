"use client";

import { useEffect } from "react";
import { installButtonTapAnalytics } from "@/lib/analytics";

export function useAnalyticsTracking() {
  useEffect(() => installButtonTapAnalytics(), []);
}
