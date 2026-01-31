"use client";

import { MonthProvider } from "@/contexts/MonthContext";
import { ReactNode, Suspense } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <MonthProvider>{children}</MonthProvider>
    </Suspense>
  );
}
