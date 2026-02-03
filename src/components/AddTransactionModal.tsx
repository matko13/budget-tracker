"use client";

import { useState, useEffect } from "react";

interface Category {
  id: string;
  name: string;
  icon: string | null;
  type: "income" | "expense" | "both";
}

interface Account {
  id: string;
  name: string;
  currency: string;
  is_default?: boolean;
}

interface TransactionToEdit {
  id: string;
  amount: number;
  currency: string;
  description: string;
  merchant_name: string | null;
  transaction_date: string;
  type: "income" | "expense" | "transfer";
  categories: { id: string } | null;
  accounts: { id: string } | null;
  is_excluded: boolean;
}

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  transaction?: TransactionToEdit | null;
}

export default function AddTransactionModal({
  isOpen,
  onClose,
  onSuccess,
  transaction,
}: AddTransactionModalProps) {
  const isEditMode = !!transaction;
  
  const [type, setType] = useState<"expense" | "income" | "transfer">("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [isExcluded, setIsExcluded] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
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
    if (isOpen && transaction) {
      setType(transaction.is_excluded && transaction.type === "expense" ? "transfer" : transaction.type);
      setAmount(transaction.amount.toString());
      setCategoryId(transaction.categories?.id || "");
      setAccountId(transaction.accounts?.id || "");
      setDate(transaction.transaction_date);
      setDescription(transaction.description);
      setMerchantName(transaction.merchant_name || "");
      setIsExcluded(transaction.is_excluded);
    } else if (isOpen && !transaction) {
      // Reset form for new transaction
      setType("expense");
      setAmount("");
      setCategoryId("");
      setAccountId("");
      setDate(new Date().toISOString().split("T")[0]);
      setDescription("");
      setMerchantName("");
      setIsExcluded(false);
    }
  }, [isOpen, transaction]);

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      fetchAccounts();
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

  const fetchAccounts = async () => {
    try {
      const response = await fetch("/api/accounts");
      if (response.ok) {
        const data = await response.json();
        setAccounts(data);
        // Auto-select default account for new transactions
        if (!transaction) {
          const defaultAccount = data.find((a: Account) => a.is_default);
          if (defaultAccount) {
            setAccountId(defaultAccount.id);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching accounts:", err);
    }
  };

  const filteredCategories = categories.filter(
    (c) => c.type === type || c.type === "both" || type === "transfer"
  );

  const handleTypeChange = (newType: "expense" | "income" | "transfer") => {
    setType(newType);
    // Auto-enable excluded for transfers
    if (newType === "transfer") {
      setIsExcluded(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const transactionData = {
        type: type === "transfer" ? "expense" : type, // Transfers are stored as expenses
        amount: parseFloat(amount),
        categoryId: categoryId || null,
        date,
        description,
        merchantName: merchantName || null,
        isExcluded: isExcluded || type === "transfer",
      };

      let response: Response;

      if (isEditMode && transaction) {
        // Update existing transaction
        response = await fetch(`/api/transactions/${transaction.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(transactionData),
        });
      } else {
        // Create new transaction
        response = await fetch("/api/transactions/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...transactionData,
            accountId: accountId || null,
          }),
        });
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to ${isEditMode ? "update" : "create"} transaction`);
      }

      // Reset form
      setAmount("");
      setCategoryId("");
      setAccountId("");
      setDescription("");
      setMerchantName("");
      setIsExcluded(false);
      setDate(new Date().toISOString().split("T")[0]);
      
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
            {isEditMode ? "Edytuj transakcję" : "Dodaj transakcję"}
          </h2>
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
        <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Type Toggle */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Typ
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleTypeChange("expense")}
                className={`flex-1 py-2.5 px-3 rounded-lg font-medium text-sm transition-colors ${
                  type === "expense"
                    ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-2 border-red-500"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-2 border-transparent"
                }`}
              >
                Wydatek
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange("income")}
                className={`flex-1 py-2.5 px-3 rounded-lg font-medium text-sm transition-colors ${
                  type === "income"
                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-2 border-emerald-500"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-2 border-transparent"
                }`}
              >
                Przychód
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange("transfer")}
                className={`flex-1 py-2.5 px-3 rounded-lg font-medium text-sm transition-colors ${
                  type === "transfer"
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-2 border-blue-500"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-2 border-transparent"
                }`}
              >
                Przelew
              </button>
            </div>
          </div>

          {/* Account Selection */}
          {accounts.length > 0 && (
            <div>
              <label htmlFor="account" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Konto <span className="text-slate-400">(opcjonalne)</span>
              </label>
              <select
                id="account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">Wybierz konto...</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.currency}){account.is_default ? " ★" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Amount */}
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
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
            <label htmlFor="category" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Kategoria
            </label>
            <select
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="">Wybierz kategorię...</option>
              {filteredCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Data
            </label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Opis
            </label>
            <input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder="np. Zakupy spożywcze"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Merchant (Optional) */}
          <div>
            <label htmlFor="merchant" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Sprzedawca <span className="text-slate-400">(opcjonalne)</span>
            </label>
            <input
              id="merchant"
              type="text"
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              placeholder="np. Biedronka"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Exclude from totals */}
          {type !== "transfer" && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <input
                type="checkbox"
                id="isExcluded"
                checked={isExcluded}
                onChange={(e) => setIsExcluded(e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="isExcluded" className="flex-1">
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Wyklucz z sum
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  Przelewy wewnętrzne między kontami nie będą wpływać na statystyki przychodów/wydatków
                </span>
              </label>
            </div>
          )}

          {type === "transfer" && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Przelewy są automatycznie wykluczane z sum przychodów/wydatków
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
              type === "expense"
                ? "bg-red-600 hover:bg-red-700 disabled:bg-red-400"
                : "bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400"
            } text-white`}
          >
            {loading 
              ? (isEditMode ? "Zapisywanie..." : "Dodawanie...") 
              : (isEditMode 
                  ? "Zapisz zmiany" 
                  : `Dodaj ${type === "expense" ? "wydatek" : "przychód"}`
                )
            }
          </button>
        </form>
      </div>
    </div>
  );
}
