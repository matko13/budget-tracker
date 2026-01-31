"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

interface MonthContextType {
  // Shared state
  selectedMonth: number; // 0-indexed (0 = January)
  selectedYear: number;
  
  // Navigation functions
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  goToCurrentMonth: () => void;
  setMonth: (month: number, year: number) => void;
  
  // Helper values
  isCurrentMonth: boolean;
  monthLabel: string;
  monthParam: string; // YYYY-MM format for API calls
  
  // URL helper - generates path with month param preserved
  getMonthUrl: (path: string) => string;
}

const MonthContext = createContext<MonthContextType | null>(null);

// Parse month param from URL (YYYY-MM format)
function parseMonthParam(param: string | null): { month: number; year: number } | null {
  if (!param || !/^\d{4}-\d{2}$/.test(param)) {
    return null;
  }
  const [year, month] = param.split("-").map(Number);
  // Validate month is 1-12
  if (month < 1 || month > 12) {
    return null;
  }
  return { month: month - 1, year }; // Convert to 0-indexed month
}

export function MonthProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  // Initialize from URL or current date
  const now = new Date();
  const urlMonth = parseMonthParam(searchParams.get("month"));
  
  const [selectedMonth, setSelectedMonth] = useState(urlMonth?.month ?? now.getMonth());
  const [selectedYear, setSelectedYear] = useState(urlMonth?.year ?? now.getFullYear());

  // Update URL when month changes
  const updateUrl = useCallback((month: number, year: number) => {
    const monthParam = `${year}-${String(month + 1).padStart(2, "0")}`;
    const now = new Date();
    const isCurrentMonth = month === now.getMonth() && year === now.getFullYear();
    
    // Create new URLSearchParams
    const params = new URLSearchParams(searchParams.toString());
    
    if (isCurrentMonth) {
      // Remove month param if it's the current month (cleaner URLs)
      params.delete("month");
    } else {
      params.set("month", monthParam);
    }
    
    const queryString = params.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
    
    // Use replace to avoid cluttering browser history with every month change
    router.replace(newUrl, { scroll: false });
  }, [searchParams, pathname, router]);

  // Sync state from URL on mount and when URL changes
  useEffect(() => {
    const urlMonth = parseMonthParam(searchParams.get("month"));
    if (urlMonth) {
      setSelectedMonth(urlMonth.month);
      setSelectedYear(urlMonth.year);
    } else {
      // No month param means current month
      const now = new Date();
      setSelectedMonth(now.getMonth());
      setSelectedYear(now.getFullYear());
    }
  }, [searchParams]);

  const goToPreviousMonth = useCallback(() => {
    setSelectedMonth((prevMonth) => {
      let newMonth = prevMonth - 1;
      let newYear = selectedYear;
      if (newMonth < 0) {
        newMonth = 11;
        newYear -= 1;
        setSelectedYear(newYear);
      }
      updateUrl(newMonth, newYear);
      return newMonth;
    });
  }, [selectedYear, updateUrl]);

  const goToNextMonth = useCallback(() => {
    setSelectedMonth((prevMonth) => {
      let newMonth = prevMonth + 1;
      let newYear = selectedYear;
      if (newMonth > 11) {
        newMonth = 0;
        newYear += 1;
        setSelectedYear(newYear);
      }
      updateUrl(newMonth, newYear);
      return newMonth;
    });
  }, [selectedYear, updateUrl]);

  const goToCurrentMonth = useCallback(() => {
    const now = new Date();
    setSelectedMonth(now.getMonth());
    setSelectedYear(now.getFullYear());
    updateUrl(now.getMonth(), now.getFullYear());
  }, [updateUrl]);

  const setMonth = useCallback((month: number, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
    updateUrl(month, year);
  }, [updateUrl]);

  const currentNow = new Date();
  const isCurrentMonth = selectedMonth === currentNow.getMonth() && selectedYear === currentNow.getFullYear();

  const monthLabel = new Date(selectedYear, selectedMonth).toLocaleDateString("pl-PL", {
    month: "long",
    year: "numeric",
  });

  // YYYY-MM format for API calls
  const monthParam = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;

  // Generate URL with month param preserved
  const getMonthUrl = useCallback((path: string) => {
    if (isCurrentMonth) {
      return path;
    }
    return `${path}?month=${monthParam}`;
  }, [isCurrentMonth, monthParam]);

  return (
    <MonthContext.Provider
      value={{
        selectedMonth,
        selectedYear,
        goToPreviousMonth,
        goToNextMonth,
        goToCurrentMonth,
        setMonth,
        isCurrentMonth,
        monthLabel,
        monthParam,
        getMonthUrl,
      }}
    >
      {children}
    </MonthContext.Provider>
  );
}

export function useMonth() {
  const context = useContext(MonthContext);
  if (!context) {
    throw new Error("useMonth must be used within a MonthProvider");
  }
  return context;
}
