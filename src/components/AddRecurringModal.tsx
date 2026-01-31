"use client";

import { useState, useEffect } from "react";

interface Category {
  id: string;
  name: string;
  icon: string | null;
  type: "income" | "expense" | "both";
}

interface RecurringExpenseToEdit {
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
}

interface AddRecurringModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  recurringExpense?: RecurringExpenseToEdit | null;
}

export default function AddRecurringModal({
  isOpen,
  onClose,
  onSuccess,
  recurringExpense,
}: AddRecurringModalProps) {
  const isEditMode = !!recurringExpense;

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("");
  const [intervalMonths, setIntervalMonths] = useState("1");
  const [matchKeywords, setMatchKeywords] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Populate form when editing
  useEffect(() => {
    if (isOpen && recurringExpense) {
      setName(recurringExpense.name);
      setAmount(recurringExpense.amount.toString());
      setCategoryId(recurringExpense.category_id || "");
      setDayOfMonth(recurringExpense.day_of_month?.toString() || "");
      setIntervalMonths(recurringExpense.interval_months?.toString() || "1");
      setMatchKeywords(recurringExpense.match_keywords?.join(", ") || "");
    } else if (isOpen && !recurringExpense) {
      // Reset form for new recurring expense
      setName("");
      setAmount("");
      setCategoryId("");
      setDayOfMonth("");
      setIntervalMonths("1");
      setMatchKeywords("");
    }
  }, [isOpen, recurringExpense]);

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/categories");
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  };

  // Filter to expense-type categories
  const expenseCategories = categories.filter(
    (c) => c.type === "expense" || c.type === "both"
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Parse keywords from comma-separated string
      const keywords = matchKeywords
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter((k) => k.length > 0);

      const data = {
        name,
        amount: parseFloat(amount),
        categoryId: categoryId || null,
        dayOfMonth: dayOfMonth ? parseInt(dayOfMonth) : null,
        intervalMonths: parseInt(intervalMonths),
        matchKeywords: keywords,
      };

      let response: Response;

      if (isEditMode && recurringExpense) {
        response = await fetch("/api/recurring", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: recurringExpense.id, ...data }),
        });
      } else {
        response = await fetch("/api/recurring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      }

      if (!response.ok) {
        const responseData = await response.json();
        throw new Error(
          responseData.error ||
            `Failed to ${isEditMode ? "update" : "create"} recurring expense`
        );
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">
            {isEditMode ? "Edytuj wydatek cykliczny" : "Dodaj wydatek cykliczny"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Nazwa
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="np. Netflix, Czynsz, Spotify"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Amount */}
          <div>
            <label
              htmlFor="amount"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Kwota (PLN)
            </label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="0.00"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-lg font-semibold focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Category */}
          <div>
            <label
              htmlFor="category"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Kategoria
            </label>
            <select
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="">Wybierz kategorię...</option>
              {expenseCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Interval */}
          <div>
            <label
              htmlFor="intervalMonths"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Co ile miesięcy
            </label>
            <select
              id="intervalMonths"
              value={intervalMonths}
              onChange={(e) => setIntervalMonths(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="1">Co miesiąc</option>
              <option value="2">Co 2 miesiące</option>
              <option value="3">Co 3 miesiące (kwartalnie)</option>
              <option value="6">Co 6 miesięcy (półrocznie)</option>
              <option value="12">Co 12 miesięcy (rocznie)</option>
            </select>
          </div>

          {/* Day of Month */}
          <div>
            <label
              htmlFor="dayOfMonth"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Dzień miesiąca{" "}
              <span className="text-slate-400">(opcjonalne)</span>
            </label>
            <input
              id="dayOfMonth"
              type="number"
              min="1"
              max="31"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
              placeholder="np. 15"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Dzień, w którym zwykle następuje płatność
            </p>
          </div>

          {/* Match Keywords */}
          <div>
            <label
              htmlFor="matchKeywords"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Słowa kluczowe do dopasowania
            </label>
            <input
              id="matchKeywords"
              type="text"
              value={matchKeywords}
              onChange={(e) => setMatchKeywords(e.target.value)}
              placeholder="netflix, nflx"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Rozdziel przecinkami. Transakcje bankowe zawierające te słowa zostaną automatycznie dopasowane.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-lg font-semibold transition-colors bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white"
          >
            {loading
              ? isEditMode
                ? "Zapisywanie..."
                : "Dodawanie..."
              : isEditMode
              ? "Zapisz zmiany"
              : "Dodaj wydatek cykliczny"}
          </button>
        </form>
      </div>
    </div>
  );
}
