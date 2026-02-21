"use client";

import { useState, useEffect } from "react";

interface Category {
  id: string;
  name: string;
  icon: string | null;
  type: "income" | "expense" | "both";
}

interface TransactionToConvert {
  id: string;
  amount: number;
  currency: string;
  description: string;
  merchant_name: string | null;
  transaction_date: string;
  type: "income" | "expense" | "transfer";
  categories: { id: string; name: string; icon: string | null } | null;
}

interface ConvertToRecurringModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  transaction: TransactionToConvert | null;
}

export default function ConvertToRecurringModal({
  isOpen,
  onClose,
  onSuccess,
  transaction,
}: ConvertToRecurringModalProps) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("");
  const [intervalMonths, setIntervalMonths] = useState("1");
  const [matchKeywords, setMatchKeywords] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && transaction) {
      const txName = transaction.merchant_name || transaction.description;
      setName(txName);
      setAmount(transaction.amount.toString());
      setCategoryId(transaction.categories?.id || "");
      const txDate = new Date(transaction.transaction_date);
      setDayOfMonth(txDate.getDate().toString());
      setIntervalMonths("1");
      const keyword = txName.toLowerCase().split(/\s+/).filter((w) => w.length > 3).slice(0, 2).join(", ");
      setMatchKeywords(keyword);
      setError(null);
    }
  }, [isOpen, transaction]);

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

  const expenseCategories = categories.filter(
    (c) => c.type === "expense" || c.type === "both"
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction) return;

    setError(null);
    setLoading(true);

    try {
      const keywords = matchKeywords
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter((k) => k.length > 0);

      const response = await fetch(
        `/api/transactions/${transaction.id}/convert-to-recurring`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            amount: parseFloat(amount),
            categoryId: categoryId || null,
            dayOfMonth: dayOfMonth ? parseInt(dayOfMonth) : null,
            intervalMonths: parseInt(intervalMonths),
            matchKeywords: keywords,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Nie udało się przekształcić transakcji");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wystąpił błąd");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !transaction) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">
              Przekształć w cykliczny
            </h2>
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

        {/* Source transaction info */}
        <div className="px-4 md:px-6 pt-4 pb-2">
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
            <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm">
              {transaction.categories?.icon || "💸"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                {transaction.merchant_name || transaction.description}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {new Date(transaction.transaction_date).toLocaleDateString("pl-PL", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <p className="text-sm font-semibold text-red-500 dark:text-red-400 shrink-0">
              -{new Intl.NumberFormat("pl-PL", { style: "currency", currency: transaction.currency }).format(transaction.amount)}
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 md:p-6 pt-2 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Name */}
          <div>
            <label htmlFor="conv-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Nazwa wydatku cyklicznego
            </label>
            <input
              id="conv-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="np. Netflix, Czynsz, Spotify"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="conv-amount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Kwota (PLN)
            </label>
            <input
              id="conv-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="0.00"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-lg font-semibold focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="conv-category" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Kategoria
            </label>
            <select
              id="conv-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
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
            <label htmlFor="conv-interval" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Co ile miesięcy
            </label>
            <select
              id="conv-interval"
              value={intervalMonths}
              onChange={(e) => setIntervalMonths(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
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
            <label htmlFor="conv-day" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Dzień miesiąca
            </label>
            <input
              id="conv-day"
              type="number"
              min="1"
              max="31"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
              placeholder="np. 15"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Dzień, w którym zwykle następuje płatność
            </p>
          </div>

          {/* Match Keywords */}
          <div>
            <label htmlFor="conv-keywords" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Słowa kluczowe do dopasowania
            </label>
            <input
              id="conv-keywords"
              type="text"
              value={matchKeywords}
              onChange={(e) => setMatchKeywords(e.target.value)}
              placeholder="netflix, nflx"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Rozdziel przecinkami. Przyszłe transakcje bankowe zawierające te słowa zostaną automatycznie dopasowane.
            </p>
          </div>

          {/* Info box */}
          <div className="p-3 bg-violet-50 dark:bg-violet-900/20 rounded-lg border border-violet-200 dark:border-violet-800">
            <p className="text-sm text-violet-700 dark:text-violet-300">
              Oryginalna transakcja zostanie powiązana z nowym wydatkiem cyklicznym i oznaczona jako opłacona.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-lg font-semibold transition-colors bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white"
          >
            {loading ? "Tworzenie..." : "Utwórz wydatek cykliczny"}
          </button>
        </form>
      </div>
    </div>
  );
}
