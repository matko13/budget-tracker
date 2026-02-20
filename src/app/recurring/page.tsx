"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AddRecurringModal from "@/components/AddRecurringModal";
import BottomSheet, { BottomSheetAction } from "@/components/BottomSheet";
import { useMonth } from "@/contexts/MonthContext";

interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

interface Override {
  id: string;
  override_amount: number | null;
  is_skipped: boolean;
  is_manually_confirmed: boolean;
  notes: string | null;
}

interface RecurringExpense {
  id: string;
  name: string;
  amount: number;
  currency: string;
  category_id: string | null;
  day_of_month: number | null;
  interval_months: number;
  match_keywords: string[];
  is_active: boolean;
  categories: Category | null;
  isDueThisMonth: boolean;
  isSkipped: boolean;
  isPaidThisMonth: boolean;
  isDueDatePassed: boolean;
  isDueToday: boolean;
  isOverdue: boolean;
  isManuallyConfirmed: boolean;
  hasLinkedTransaction: boolean;
  hasCompletedPayment: boolean;
  effectiveAmount: number;
  override: Override | null;
  matchedTransaction?: {
    id: string;
    transaction_date: string;
    amount: number;
    payment_status: string | null;
    is_recurring_generated: boolean;
  };
}

interface RecurringData {
  recurringExpenses: RecurringExpense[];
  totalDueThisMonth: number;
  totalMonthlyEquivalent: number;
  paidThisMonth: number;
  overdueThisMonth: number;
  pendingThisMonth: number;
  selectedMonth: string;
}

const intervalLabels: Record<number, string> = {
  1: "Co miesiąc",
  2: "Co 2 mies.",
  3: "Kwartalnie",
  6: "Półrocznie",
  12: "Rocznie",
};

// Helper to format month for display (for override modal)
function formatMonthDisplay(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  const date = new Date(year, month - 1);
  return date.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
}

export default function RecurringExpensesPage() {
  const [data, setData] = useState<RecurringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RecurringExpense | null>(
    null
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideExpense, setOverrideExpense] = useState<RecurringExpense | null>(null);
  const [rematching, setRematching] = useState(false);
  const [rematchResult, setRematchResult] = useState<string | null>(null);
  const [bottomSheetExpense, setBottomSheetExpense] = useState<RecurringExpense | null>(null);
  const router = useRouter();

  const {
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
    isCurrentMonth,
    monthLabel,
    monthParam,
    getMonthUrl,
  } = useMonth();

  // Use the context's monthParam (YYYY-MM format) for API calls
  const selectedMonth = monthParam;
  const displayMonth = monthLabel;

  const fetchRecurringExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/recurring?month=${monthParam}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
        },
      });
      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to fetch recurring expenses");
      }
      const recurringData = await response.json();
      setData(recurringData);
    } catch (error) {
      console.error("Error fetching recurring expenses:", error);
    } finally {
      setLoading(false);
    }
  }, [router, monthParam]);

  useEffect(() => {
    fetchRecurringExpenses();
  }, [fetchRecurringExpenses]);

  const handlePrevMonth = () => {
    goToPreviousMonth();
  };

  const handleNextMonth = () => {
    goToNextMonth();
  };

  const handleGoToCurrentMonth = () => {
    goToCurrentMonth();
  };

  const handleOpenOverride = (expense: RecurringExpense) => {
    setOverrideExpense(expense);
    setShowOverrideModal(true);
  };

  const handleToggleSkip = async (expense: RecurringExpense) => {
    try {
      const response = await fetch("/api/recurring/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recurringExpenseId: expense.id,
          month: selectedMonth,
          isSkipped: !expense.isSkipped,
          overrideAmount: expense.override?.override_amount,
          isManuallyConfirmed: expense.override?.is_manually_confirmed,
        }),
      });

      if (response.ok) {
        fetchRecurringExpenses();
      }
    } catch (error) {
      console.error("Error toggling skip:", error);
    }
  };

  const handleMarkAsPaid = async (expense: RecurringExpense) => {
    try {
      const response = await fetch("/api/recurring/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recurringExpenseId: expense.id,
          month: selectedMonth,
          isManuallyConfirmed: !expense.isManuallyConfirmed,
          isSkipped: expense.override?.is_skipped,
          overrideAmount: expense.override?.override_amount,
        }),
      });

      if (response.ok) {
        fetchRecurringExpenses();
      }
    } catch (error) {
      console.error("Error marking as paid:", error);
    }
  };

  const handleEdit = (expense: RecurringExpense) => {
    setEditingExpense(expense);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć ten wydatek cykliczny?")) {
      return;
    }

    setDeletingId(id);
    try {
      const response = await fetch(`/api/recurring?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchRecurringExpenses();
      } else {
        const responseData = await response.json();
        alert(responseData.error || "Nie udało się usunąć wydatku cyklicznego");
      }
    } catch (error) {
      console.error("Error deleting recurring expense:", error);
      alert("Wystąpił błąd podczas usuwania");
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (expense: RecurringExpense) => {
    try {
      const response = await fetch("/api/recurring", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: expense.id,
          isActive: !expense.is_active,
        }),
      });

      if (response.ok) {
        fetchRecurringExpenses();
      }
    } catch (error) {
      console.error("Error toggling active status:", error);
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingExpense(null);
  };

  const handleModalSuccess = () => {
    fetchRecurringExpenses();
  };

  const handleOverrideModalClose = () => {
    setShowOverrideModal(false);
    setOverrideExpense(null);
  };

  const handleOverrideSuccess = () => {
    fetchRecurringExpenses();
  };

  const handleRematch = async () => {
    setRematching(true);
    setRematchResult(null);
    try {
      const response = await fetch("/api/recurring/rematch", {
        method: "POST",
      });
      const result = await response.json();
      if (response.ok) {
        setRematchResult(result.message);
        fetchRecurringExpenses();
      } else {
        setRematchResult(result.error || "Błąd podczas dopasowywania");
      }
    } catch (error) {
      console.error("Error rematching:", error);
      setRematchResult("Wystąpił błąd");
    } finally {
      setRematching(false);
      // Clear result after 5 seconds
      setTimeout(() => setRematchResult(null), 5000);
    }
  };

  const formatCurrency = (amount: number, currency: string = "PLN") => {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const buildRecurringMobileActions = (expense: RecurringExpense): BottomSheetAction[] => {
    const actions: BottomSheetAction[] = [];

    if (expense.is_active && expense.isDueThisMonth && !expense.isSkipped && !expense.hasCompletedPayment) {
      actions.push({
        label: expense.isManuallyConfirmed ? "Cofnij potwierdzenie" : "Oznacz jako opłacone",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        variant: "success",
        active: expense.isManuallyConfirmed,
        onClick: () => handleMarkAsPaid(expense),
      });
    }

    if (expense.is_active && expense.isDueThisMonth) {
      actions.push({
        label: expense.isSkipped ? "Przywróć w tym miesiącu" : "Pomiń w tym miesiącu",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        ),
        variant: "warning",
        active: expense.isSkipped,
        onClick: () => handleToggleSkip(expense),
      });
    }

    if (expense.is_active && expense.isDueThisMonth && !expense.isSkipped) {
      actions.push({
        label: expense.override?.override_amount !== null && expense.override?.override_amount !== undefined
          ? "Zmień kwotę na ten miesiąc (zmieniona)"
          : "Zmień kwotę na ten miesiąc",
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        active: expense.override?.override_amount !== null && expense.override?.override_amount !== undefined,
        onClick: () => handleOpenOverride(expense),
      });
    }

    actions.push({
      label: expense.is_active ? "Dezaktywuj" : "Aktywuj",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {expense.is_active ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          )}
        </svg>
      ),
      variant: expense.is_active ? "warning" : "success",
      onClick: () => handleToggleActive(expense),
    });

    actions.push({
      label: "Edytuj",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      onClick: () => handleEdit(expense),
    });

    actions.push({
      label: "Usuń na stałe",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
      variant: "danger",
      disabled: deletingId === expense.id,
      onClick: () => handleDelete(expense.id),
    });

    return actions;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={getMonthUrl("/dashboard")}
                className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </div>
                <span className="text-xl font-bold text-slate-900 dark:text-white">
                  Wydatki cykliczne
                </span>
              </div>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
                title="Poprzedni miesiąc"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={handleGoToCurrentMonth}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  isCurrentMonth
                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                }`}
              >
                {displayMonth}
              </button>
              <button
                onClick={handleNextMonth}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
                title="Następny miesiąc"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Summary Cards */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                Do zapłaty ({displayMonth})
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(data.totalDueThisMonth)}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                Opłacone
              </p>
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(data.paidThisMonth)}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border-l-4 border-red-500">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                Zaległe
              </p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(data.overdueThisMonth)}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                Oczekujące
              </p>
              <p className="text-2xl font-bold text-amber-600">
                {formatCurrency(data.pendingThisMonth)}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                Średnio miesięcznie
              </p>
              <p className="text-2xl font-bold text-slate-600 dark:text-slate-300">
                {formatCurrency(data.totalMonthlyEquivalent)}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between mb-6">
          {/* Rematch result message */}
          <div className="flex-1">
            {rematchResult && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-lg">
                {rematchResult}
              </p>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {/* Rematch Button */}
            <button
              onClick={handleRematch}
              disabled={rematching}
              className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
              title="Dopasuj istniejące transakcje do wydatków cyklicznych"
            >
              {rematching ? (
                <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {rematching ? "Dopasowywanie..." : "Dopasuj transakcje"}
            </button>

            {/* Add Button */}
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Dodaj wydatek cykliczny
            </button>
          </div>
        </div>

        {/* Recurring Expenses List */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-600 dark:text-slate-400">
                Ładowanie wydatków cyklicznych...
              </p>
            </div>
          ) : data?.recurringExpenses && data.recurringExpenses.length > 0 ? (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {data.recurringExpenses.map((expense) => (
                <div
                  key={expense.id}
                  className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                    !expense.is_active ? "opacity-50" : ""
                  }`}
                >
                  {/* Mobile Layout */}
                  <div className="md:hidden space-y-2">
                    {/* Row 1: Icon + Name + Amount */}
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
                        style={{
                          backgroundColor: expense.categories?.color
                            ? `${expense.categories.color}20`
                            : "#f1f5f9",
                        }}
                      >
                        {expense.categories?.icon || "📅"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 dark:text-white truncate text-sm">
                          {expense.name}
                        </p>
                      </div>
                      <p className={`font-semibold shrink-0 text-sm ${expense.isSkipped ? "line-through text-slate-400" : "text-red-500 dark:text-red-400"}`}>
                        -{formatCurrency(expense.effectiveAmount, expense.currency)}
                      </p>
                    </div>
                    
                    {/* Row 2: Interval + Category */}
                    <div className="flex items-center gap-2 pl-[52px] text-xs text-slate-500 dark:text-slate-400">
                      <span>{intervalLabels[expense.interval_months] || "Co miesiąc"}</span>
                      {expense.day_of_month && (
                        <>
                          <span>•</span>
                          <span>Dzień {expense.day_of_month}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{expense.categories?.name || "Bez kategorii"}</span>
                    </div>
                    
                    {/* Row 3: Status badges + 3-dot menu */}
                    <div className="flex items-center justify-between pl-[52px]">
                      <div className="flex items-center gap-1.5">
                        {!expense.is_active && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300">
                            Nieaktywny
                          </span>
                        )}
                        {expense.isSkipped ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300">
                            Pominięto
                          </span>
                        ) : expense.isPaidThisMonth ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                            {expense.hasCompletedPayment ? "Opłacone" : "Potwierdzone"}
                          </span>
                        ) : expense.isOverdue ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                            Zaległe
                          </span>
                        ) : expense.is_active && expense.isDueThisMonth && expense.isDueToday ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                            Termin dzisiaj
                          </span>
                        ) : expense.is_active && expense.isDueThisMonth ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                            Oczekuje
                          </span>
                        ) : expense.is_active ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                            Nie w tym miesiącu
                          </span>
                        ) : null}
                      </div>
                      <button
                        onClick={() => setBottomSheetExpense(expense)}
                        className="p-2 -mr-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        aria-label="Więcej akcji"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="5" r="2" />
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="12" cy="19" r="2" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Desktop Layout */}
                  <div className="hidden md:flex items-center gap-4">
                    {/* Category Icon */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{
                        backgroundColor: expense.categories?.color
                          ? `${expense.categories.color}20`
                          : "#f1f5f9",
                      }}
                    >
                      {expense.categories?.icon || "📅"}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900 dark:text-white truncate">
                          {expense.name}
                        </p>
                        {!expense.is_active && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 flex-shrink-0">
                            Nieaktywny
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {expense.categories?.name || "Bez kategorii"}
                        {" • "}
                        {intervalLabels[expense.interval_months] || "Co miesiąc"}
                        {expense.day_of_month && ` • Dzień ${expense.day_of_month}`}
                      </p>
                      {expense.match_keywords?.length > 0 && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                          Słowa kluczowe: {expense.match_keywords.join(", ")}
                        </p>
                      )}
                    </div>

                    {/* Status */}
                    <div className="flex-shrink-0 text-right">
                    {expense.isSkipped ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                        Pominięto
                      </span>
                    ) : expense.isPaidThisMonth ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                        {expense.hasCompletedPayment ? (
                          // Checkmark icon for completed payment (bank or manually marked on transaction)
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        ) : (
                          // Circle-check icon for manually confirmed via recurring page
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        )}
                        {expense.hasCompletedPayment ? "Opłacone" : "Potwierdzone"}
                      </span>
                    ) : expense.isOverdue ? (
                      // Overdue - red warning
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                        Zaległe
                      </span>
                    ) : expense.is_active && expense.isDueThisMonth && expense.isDueToday ? (
                      // Due today - blue
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        Termin dzisiaj
                      </span>
                    ) : expense.is_active && expense.isDueThisMonth ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Oczekuje
                      </span>
                    ) : expense.is_active ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                        Nie w tym miesiącu
                      </span>
                    ) : null}
                    {/* Show if there's a custom amount for this month */}
                    {expense.override?.override_amount !== null && expense.override?.override_amount !== undefined && !expense.isSkipped && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        Zmieniona kwota
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Mark as Paid button - show for overdue/due-today/upcoming expenses that aren't paid via bank or skipped */}
                    {expense.is_active && expense.isDueThisMonth && !expense.isSkipped && !expense.hasCompletedPayment && (
                      <button
                        onClick={() => handleMarkAsPaid(expense)}
                        title={expense.isManuallyConfirmed ? "Cofnij potwierdzenie" : "Oznacz jako opłacone"}
                        className={`p-1.5 rounded-lg transition-colors ${
                          expense.isManuallyConfirmed
                            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                            : expense.isOverdue
                              ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400"
                              : "bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    )}

                    {/* Skip/Unskip for this month */}
                    {expense.is_active && expense.isDueThisMonth && (
                      <button
                        onClick={() => handleToggleSkip(expense)}
                        title={expense.isSkipped ? "Przywróć w tym miesiącu" : "Pomiń w tym miesiącu"}
                        className={`p-1.5 rounded-lg transition-colors ${
                          expense.isSkipped
                            ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                            : "bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400"
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      </button>
                    )}

                    {/* Override amount for this month */}
                    {expense.is_active && expense.isDueThisMonth && !expense.isSkipped && (
                      <button
                        onClick={() => handleOpenOverride(expense)}
                        title="Zmień kwotę na ten miesiąc"
                        className={`p-1.5 rounded-lg transition-colors ${
                          expense.override?.override_amount !== null && expense.override?.override_amount !== undefined
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                            : "bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    )}

                    {/* Toggle Active */}
                    <button
                      onClick={() => handleToggleActive(expense)}
                      title={expense.is_active ? "Dezaktywuj" : "Aktywuj"}
                      className={`p-1.5 rounded-lg transition-colors ${
                        expense.is_active
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-400"
                      }`}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        {expense.is_active ? (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        ) : (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                          />
                        )}
                      </svg>
                    </button>

                    {/* Edit Button */}
                    <button
                      onClick={() => handleEdit(expense)}
                      title="Edytuj"
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDelete(expense.id)}
                      disabled={deletingId === expense.id}
                      title="Usuń"
                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>

                    {/* Amount */}
                    <div className="text-right min-w-[100px]">
                      <p className={`font-semibold ${expense.isSkipped ? "line-through text-slate-400" : "text-slate-900 dark:text-white"}`}>
                        {formatCurrency(expense.effectiveAmount, expense.currency)}
                      </p>
                      {expense.override?.override_amount !== null && expense.override?.override_amount !== undefined && expense.effectiveAmount !== expense.amount && (
                        <p className="text-xs text-slate-400 line-through">
                          {formatCurrency(expense.amount, expense.currency)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                Brak wydatków cyklicznych
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-4">
                Dodaj swoje stałe miesięczne wydatki, jak subskrypcje czy czynsz
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Dodaj pierwszy wydatek
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      <AddRecurringModal
        isOpen={showModal}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recurringExpense={editingExpense as any}
      />

      {/* Override Modal */}
      {showOverrideModal && overrideExpense && (
        <OverrideModal
          expense={overrideExpense}
          month={selectedMonth}
          onClose={handleOverrideModalClose}
          onSuccess={handleOverrideSuccess}
        />
      )}

      {/* Mobile Bottom Sheet */}
      <BottomSheet
        isOpen={bottomSheetExpense !== null}
        onClose={() => setBottomSheetExpense(null)}
        title={bottomSheetExpense?.name}
        subtitle={bottomSheetExpense ? `-${formatCurrency(bottomSheetExpense.effectiveAmount, bottomSheetExpense.currency)}` : undefined}
        actions={bottomSheetExpense ? buildRecurringMobileActions(bottomSheetExpense) : []}
      />
    </div>
  );
}

// Override Modal Component
function OverrideModal({
  expense,
  month,
  onClose,
  onSuccess,
}: {
  expense: RecurringExpense;
  month: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState(
    expense.override?.override_amount?.toString() || expense.amount.toString()
  );
  const [notes, setNotes] = useState(expense.override?.notes || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/recurring/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recurringExpenseId: expense.id,
          month,
          overrideAmount: parseFloat(amount),
          notes: notes || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save override");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wystąpił błąd");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!expense.override) {
      onClose();
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/recurring/override?recurringExpenseId=${expense.id}&month=${month}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        onSuccess();
        onClose();
      }
    } catch (err) {
      console.error("Error resetting override:", err);
    } finally {
      setLoading(false);
    }
  };

  const displayMonth = formatMonthDisplay(month);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Zmień kwotę
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {expense.name} - {displayMonth}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
              Standardowa kwota
            </p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              {new Intl.NumberFormat("pl-PL", {
                style: "currency",
                currency: expense.currency,
              }).format(expense.amount)}
            </p>
          </div>

          {/* Amount */}
          <div>
            <label
              htmlFor="override-amount"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Kwota na {displayMonth}
            </label>
            <input
              id="override-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="override-notes"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Notatka <span className="text-slate-400">(opcjonalnie)</span>
            </label>
            <input
              id="override-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="np. Wzrost ceny, promocja..."
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            {expense.override && (
              <button
                type="button"
                onClick={handleReset}
                disabled={loading}
                className="flex-1 py-3 px-4 rounded-lg font-semibold transition-colors bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 disabled:opacity-50"
              >
                Przywróć standardową
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 px-4 rounded-lg font-semibold transition-colors bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white"
            >
              {loading ? "Zapisywanie..." : "Zapisz"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
