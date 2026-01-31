"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  type: string;
}

interface Budget {
  id: string;
  category_id: string;
  amount: number;
  period: string;
  budget_month: string;
  categories: Category;
  spent: number;
  remaining: number;
  percentUsed: number;
}

interface BudgetsResponse {
  budgets: Budget[];
  month: string;
  hasPreviousMonthBudgets: boolean;
}

// Helper to format month for API (YYYY-MM)
function formatMonthForAPI(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

// Helper to format month for display
function formatMonthDisplay(date: Date): string {
  return date.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [hasPreviousMonthBudgets, setHasPreviousMonthBudgets] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      const monthParam = formatMonthForAPI(currentMonth);
      const [budgetsRes, categoriesRes] = await Promise.all([
        fetch(`/api/budgets?month=${monthParam}`),
        fetch("/api/categories"),
      ]);

      if (budgetsRes.status === 401 || categoriesRes.status === 401) {
        router.push("/login");
        return;
      }

      if (budgetsRes.ok) {
        const data: BudgetsResponse = await budgetsRes.json();
        setBudgets(data.budgets);
        setHasPreviousMonthBudgets(data.hasPreviousMonthBudgets);
      }

      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        // Filter to expense categories only
        setCategories(categoriesData.filter((c: Category) => c.type === "expense" || c.type === "both"));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [router, currentMonth]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory || !budgetAmount) return;

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: selectedCategory,
          amount: parseFloat(budgetAmount),
          month: formatMonthForAPI(currentMonth),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setShowForm(false);
        setSelectedCategory("");
        setBudgetAmount("");
        fetchData();
      } else {
          setError(data.error || "Nie udało się zapisać budżetu. Upewnij się, że migracja bazy danych została uruchomiona.");
        console.error("Error saving budget:", data);
      }
    } catch (err) {
      setError("Nie udało się zapisać budżetu. Spróbuj ponownie.");
      console.error("Error saving budget:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleEditBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBudget || !editAmount) return;

    setSaving(true);
    try {
      const response = await fetch("/api/budgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingBudget.id,
          amount: parseFloat(editAmount),
        }),
      });

      if (response.ok) {
        setEditingBudget(null);
        setEditAmount("");
        fetchData();
      }
    } catch (error) {
      console.error("Error updating budget:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBudget = async (budgetId: string) => {
    try {
      const response = await fetch(`/api/budgets?id=${budgetId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Error deleting budget:", error);
    }
  };

  const handleCopyFromPreviousMonth = async () => {
    setCopying(true);
    try {
      const response = await fetch("/api/budgets/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: formatMonthForAPI(currentMonth),
        }),
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Error copying budgets:", error);
    } finally {
      setCopying(false);
    }
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToCurrentMonth = () => {
    setCurrentMonth(new Date());
  };

  const isCurrentMonth = () => {
    const now = new Date();
    return currentMonth.getFullYear() === now.getFullYear() && currentMonth.getMonth() === now.getMonth();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: "PLN",
    }).format(amount);
  };

  // Get categories that don't have a budget yet for the current month
  const availableCategories = categories.filter(
    (c) => !budgets.some((b) => b.category_id === c.id)
  );

  const startEditing = (budget: Budget) => {
    setEditingBudget(budget);
    setEditAmount(budget.amount.toString());
  };

  const cancelEditing = () => {
    setEditingBudget(null);
    setEditAmount("");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white">Budżety</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Month Selector */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm mb-6">
          <div className="flex items-center justify-between">
            <button
              onClick={goToPreviousMonth}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Previous month"
            >
              <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <div className="text-center">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {formatMonthDisplay(currentMonth)}
              </h2>
              {!isCurrentMonth() && (
                <button
                  onClick={goToCurrentMonth}
                  className="text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  Przejdź do bieżącego miesiąca
                </button>
              )}
            </div>
            
            <button
              onClick={goToNextMonth}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Next month"
            >
              <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Header with Add Budget button */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Miesięczne budżety</h1>
            <p className="text-slate-600 dark:text-slate-400">Ustaw limity wydatków dla każdej kategorii</p>
          </div>
          <div className="flex gap-2">
            {hasPreviousMonthBudgets && budgets.length === 0 && (
              <button
                onClick={handleCopyFromPreviousMonth}
                disabled={copying}
                className="flex items-center gap-2 bg-slate-600 hover:bg-slate-700 disabled:bg-slate-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {copying ? "Kopiowanie..." : "Skopiuj z poprzedniego miesiąca"}
              </button>
            )}
            {availableCategories.length > 0 && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Dodaj budżet
              </button>
            )}
          </div>
        </div>

        {/* Copy from Previous Month Banner */}
        {hasPreviousMonthBudgets && budgets.length > 0 && availableCategories.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-blue-800 dark:text-blue-200">
                  Masz budżety z poprzedniego miesiąca, które nie zostały jeszcze skopiowane.
                </span>
              </div>
              <button
                onClick={handleCopyFromPreviousMonth}
                disabled={copying}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {copying ? "Kopiowanie..." : "Skopiuj pozostałe"}
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-red-800 dark:text-red-200">{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Add Budget Form */}
        {showForm && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm mb-8">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Nowy budżet</h2>
            <form onSubmit={handleSaveBudget} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Kategoria
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="">Wybierz kategorię...</option>
                  {availableCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Miesięczny budżet (PLN)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  required
                  placeholder="np. 500"
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                >
                  {saving ? "Zapisywanie..." : "Zapisz budżet"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium py-2 px-6 rounded-lg transition-colors"
                >
                  Anuluj
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Edit Budget Modal */}
        {editingBudget && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl max-w-md w-full">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                Edytuj budżet: {editingBudget.categories?.icon} {editingBudget.categories?.name}
              </h2>
              <form onSubmit={handleEditBudget} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Miesięczny budżet (PLN)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    required
                    placeholder="np. 500"
                    autoFocus
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                  >
                    {saving ? "Zapisywanie..." : "Zaktualizuj budżet"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium py-2 px-6 rounded-lg transition-colors"
                  >
                    Anuluj
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Budgets List */}
        {budgets.length > 0 ? (
          <div className="space-y-4">
            {budgets.map((budget) => (
              <div
                key={budget.id}
                className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
                      style={{ backgroundColor: `${budget.categories?.color}20` }}
                    >
                      {budget.categories?.icon || "📊"}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {budget.categories?.name}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {formatCurrency(budget.spent)} of {formatCurrency(budget.amount)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEditing(budget)}
                      className="text-slate-400 hover:text-emerald-500 transition-colors p-1"
                      title="Edytuj budżet"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteBudget(budget.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1"
                      title="Usuń budżet"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="relative">
                  <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        budget.percentUsed >= 100
                          ? "bg-red-500"
                          : budget.percentUsed >= 80
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(budget.percentUsed, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-sm">
                    <span className={`font-medium ${
                      budget.percentUsed >= 100
                        ? "text-red-600"
                        : budget.percentUsed >= 80
                        ? "text-amber-600"
                        : "text-emerald-600"
                    }`}>
                      {budget.percentUsed}% wykorzystane
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {budget.remaining >= 0
                        ? `${formatCurrency(budget.remaining)} pozostało`
                        : `${formatCurrency(Math.abs(budget.remaining))} przekroczono`}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              Brak budżetów na {formatMonthDisplay(currentMonth)}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              {hasPreviousMonthBudgets 
                ? "Skopiuj budżety z poprzedniego miesiąca lub utwórz nowe"
                : "Utwórz budżety, aby śledzić limity wydatków"
              }
            </p>
            <div className="flex gap-3 justify-center">
              {hasPreviousMonthBudgets && (
                <button
                  onClick={handleCopyFromPreviousMonth}
                  disabled={copying}
                  className="bg-slate-600 hover:bg-slate-700 disabled:bg-slate-400 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                >
                  {copying ? "Kopiowanie..." : "Skopiuj z poprzedniego miesiąca"}
                </button>
              )}
              <button
                onClick={() => setShowForm(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
              >
                Utwórz nowy budżet
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
