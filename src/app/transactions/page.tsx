"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import AddTransactionModal from "@/components/AddTransactionModal";
import { useMonth } from "@/contexts/MonthContext";

interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

interface Account {
  id: string;
  name: string;
  iban: string | null;
}

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  description: string;
  merchant_name: string | null;
  transaction_date: string;
  type: "income" | "expense" | "transfer";
  categories: Category | null;
  accounts: Account | null;
  is_excluded: boolean;
  is_recurring_generated: boolean;
  payment_status: "completed" | "planned" | "skipped" | null;
}

interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function TransactionsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [data, setData] = useState<TransactionsResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTransaction, setEditingTransaction] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Read filters from URL params
  const page = parseInt(searchParams.get("page") || "1");
  const search = searchParams.get("search") || "";
  const filterType = searchParams.get("type") || "";
  const filterCategory = searchParams.get("category") || "";
  const filterStatus = searchParams.get("status") || "";
  const hidePlanned = searchParams.get("hidePlanned") === "true";
  const showAllTime = searchParams.get("allTime") === "true";

  // Update URL with new params
  const updateUrlParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "" || value === "false") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    
    // Always reset to page 1 when filters change (unless page is being set directly)
    if (!("page" in updates) && Object.keys(updates).some(k => k !== "page")) {
      params.delete("page");
    }
    
    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  // Helper functions for filter updates
  const setPage = (newPage: number | ((p: number) => number)) => {
    const value = typeof newPage === "function" ? newPage(page) : newPage;
    updateUrlParams({ page: value > 1 ? value.toString() : null });
  };
  
  const setSearch = (value: string) => updateUrlParams({ search: value || null, page: null });
  const setFilterType = (value: string) => updateUrlParams({ type: value || null, page: null });
  const setFilterCategory = (value: string) => updateUrlParams({ category: value || null, page: null });
  const setFilterStatus = (value: string) => updateUrlParams({ status: value || null, page: null });
  const setHidePlanned = (value: boolean) => updateUrlParams({ hidePlanned: value ? "true" : null, page: null });
  const setShowAllTime = (value: boolean) => updateUrlParams({ allTime: value ? "true" : null, page: null });

  const {
    selectedMonth,
    selectedYear,
    goToPreviousMonth: contextGoToPreviousMonth,
    goToNextMonth: contextGoToNextMonth,
    goToCurrentMonth: contextGoToCurrentMonth,
    isCurrentMonth,
    monthLabel,
    getMonthUrl,
  } = useMonth();

  const goToPreviousMonth = () => {
    contextGoToPreviousMonth();
    updateUrlParams({ page: null });
  };

  const goToNextMonth = () => {
    contextGoToNextMonth();
    updateUrlParams({ page: null });
  };

  const goToCurrentMonth = () => {
    contextGoToCurrentMonth();
    setShowAllTime(false);
  };

  const toggleAllTime = () => {
    setShowAllTime(!showAllTime);
  };

  const getMonthDateRange = (month: number, year: number) => {
    const startDate = new Date(year, month, 1).toISOString().split("T")[0];
    const endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];
    return { startDate, endDate };
  };

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ 
        page: page.toString(), 
        limit: "20",
        _t: Date.now().toString() // Cache buster
      });
      if (search) params.append("search", search);
      if (filterType) params.append("type", filterType);
      if (filterCategory) params.append("category", filterCategory);
      if (filterStatus) params.append("status", filterStatus);
      if (hidePlanned) params.append("hidePlanned", "true");
      
      // Add date filters if not showing all time
      if (!showAllTime) {
        const { startDate, endDate } = getMonthDateRange(selectedMonth, selectedYear);
        params.append("startDate", startDate);
        params.append("endDate", endDate);
      }

      const response = await fetch(`/api/transactions?${params}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        }
      });
      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to fetch transactions");
      }
      const transactionsData = await response.json();
      setData(transactionsData);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterType, filterCategory, filterStatus, hidePlanned, selectedMonth, selectedYear, showAllTime, router]);

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/categories");
      if (response.ok) {
        const categoriesData = await response.json();
        setCategories(categoriesData);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleCategoryChange = async (transactionId: string, categoryId: string) => {
    try {
      const response = await fetch(`/api/transactions/${transactionId}/category`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: categoryId || null }),
      });

      if (response.ok) {
        setEditingTransaction(null);
        fetchTransactions();
      }
    } catch (error) {
      console.error("Error updating category:", error);
    }
  };

  const handleToggleExcluded = async (transactionId: string, currentValue: boolean) => {
    try {
      const response = await fetch(`/api/transactions/${transactionId}/exclude`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isExcluded: !currentValue }),
      });

      if (response.ok) {
        fetchTransactions();
      }
    } catch (error) {
      console.error("Error toggling excluded status:", error);
    }
  };

  const handleEditClick = (transaction: Transaction) => {
    setTransactionToEdit(transaction);
    setEditModalOpen(true);
  };

  const handleEditClose = () => {
    setEditModalOpen(false);
    setTransactionToEdit(null);
  };

  const handleEditSuccess = () => {
    fetchTransactions();
  };

  const handleCreateClick = () => {
    setCreateModalOpen(true);
  };

  const handleCreateClose = () => {
    setCreateModalOpen(false);
  };

  const handleCreateSuccess = () => {
    fetchTransactions();
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć tę transakcję?")) {
      return;
    }

    setDeletingTransaction(transactionId);
    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchTransactions();
      } else {
        const data = await response.json();
        alert(data.error || "Nie udało się usunąć transakcji");
      }
    } catch (error) {
      console.error("Error deleting transaction:", error);
      alert("Wystąpił błąd podczas usuwania transakcji");
    } finally {
      setDeletingTransaction(null);
    }
  };

  const handleTogglePaymentStatus = async (transactionId: string, currentStatus: string | null) => {
    try {
      const newStatus = currentStatus === "planned" ? "completed" : "planned";
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: newStatus }),
      });

      if (response.ok) {
        fetchTransactions();
      } else {
        const data = await response.json();
        alert(data.error || "Nie udało się zmienić statusu");
      }
    } catch (error) {
      console.error("Error toggling payment status:", error);
      alert("Wystąpił błąd podczas zmiany statusu");
    }
  };

  const formatCurrency = (amount: number, currency: string = "PLN") => {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pl-PL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href={getMonthUrl("/dashboard")}
              className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white">Transakcje</span>
            </div>
            <button
              onClick={handleCreateClick}
              className="ml-auto flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Dodaj transakcję
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Month Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            {!showAllTime && (
              <>
                <button
                  onClick={goToPreviousMonth}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                  aria-label="Previous month"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-lg font-semibold text-slate-900 dark:text-white min-w-[160px] text-center">
                  {monthLabel}
                </span>
                <button
                  onClick={goToNextMonth}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                  aria-label="Next month"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                {!isCurrentMonth && (
                  <button
                    onClick={goToCurrentMonth}
                    className="ml-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Dzisiaj
                  </button>
                )}
              </>
            )}
            {showAllTime && (
              <span className="text-lg font-semibold text-slate-900 dark:text-white">
                Wszystkie transakcje
              </span>
            )}
          </div>
          <button
            onClick={toggleAllTime}
            className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
              showAllTime
                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
          >
            {showAllTime ? "Filtruj według miesiąca" : "Pokaż wszystko"}
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Szukaj
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Szukaj transakcji..."
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Typ
              </label>
              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value);
                  setPage(1);
                }}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">Wszystkie typy</option>
                <option value="income">Przychód</option>
                <option value="expense">Wydatek</option>
                <option value="transfer">Przelew</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Kategoria
              </label>
              <select
                value={filterCategory}
                onChange={(e) => {
                  setFilterCategory(e.target.value);
                  setPage(1);
                }}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">Wszystkie kategorie</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setPage(1);
                }}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">Wszystkie statusy</option>
                <option value="actual">💵 Rzeczywiste</option>
                <option value="planned">📅 Zaplanowane</option>
                <option value="completed">✅ Cykliczne opłacone</option>
              </select>
            </div>
          </div>
          
          <div className="mt-4 flex items-center justify-between gap-4">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={hidePlanned}
                    onChange={(e) => setHidePlanned(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-amber-500 transition-colors"></div>
                  <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
                </div>
                <span className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                  Ukryj zaplanowane cykliczne
                </span>
              </label>
              <button
                onClick={() => {
                  updateUrlParams({
                    search: null,
                    type: null,
                    category: null,
                    status: null,
                    hidePlanned: null,
                    page: null,
                  });
                }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
              >
                Wyczyść filtry
              </button>
            </div>
        </div>

        {/* Summary */}
        {data?.transactions && data.transactions.length > 0 && !loading && (
          <div className="flex flex-wrap gap-3 mb-4">
            {(() => {
              const actualCount = data.transactions.filter(t => !t.is_recurring_generated).length;
              const plannedCount = data.transactions.filter(t => t.is_recurring_generated && t.payment_status === "planned").length;
              const recurringCompletedCount = data.transactions.filter(t => t.is_recurring_generated && t.payment_status === "completed").length;
              return (
                <>
                  {actualCount > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm">
                      <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                      <span className="text-slate-600 dark:text-slate-400">Rzeczywiste: <strong className="text-slate-900 dark:text-white">{actualCount}</strong></span>
                    </div>
                  )}
                  {plannedCount > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span className="text-amber-700 dark:text-amber-400">Zaplanowane: <strong>{plannedCount}</strong></span>
                    </div>
                  )}
                  {recurringCompletedCount > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-sm">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-emerald-700 dark:text-emerald-400">Cykliczne opłacone: <strong>{recurringCompletedCount}</strong></span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Transactions List */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-600 dark:text-slate-400">Ładowanie transakcji...</p>
            </div>
          ) : data?.transactions && data.transactions.length > 0 ? (
            <>
              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                {data.transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className={`p-4 transition-colors ${
                      transaction.is_excluded ? "opacity-60" : ""
                    } ${
                      transaction.is_recurring_generated && transaction.payment_status === "planned"
                        ? "bg-amber-50 dark:bg-amber-900/20 border-l-4 border-l-amber-400 dark:border-l-amber-500"
                        : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    }`}
                  >
                    {/* Mobile Layout */}
                    <div className="md:hidden space-y-2">
                      {/* Row 1: Icon + Name + Amount */}
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 relative ${
                            transaction.is_recurring_generated && transaction.payment_status === "planned"
                              ? "border-2 border-dashed border-amber-400 dark:border-amber-500"
                              : ""
                          }`}
                          style={{
                            backgroundColor: transaction.is_recurring_generated && transaction.payment_status === "planned"
                              ? "#fef3c7"
                              : transaction.categories?.color
                              ? `${transaction.categories.color}20`
                              : "#f1f5f9",
                          }}
                        >
                          {transaction.is_recurring_generated && transaction.payment_status === "planned" 
                            ? "📅" 
                            : transaction.categories?.icon || (transaction.type === "income" ? "💰" : "💸")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium truncate text-sm ${
                            transaction.is_recurring_generated && transaction.payment_status === "planned"
                              ? "text-amber-800 dark:text-amber-300"
                              : "text-slate-900 dark:text-white"
                          }`}>
                            {transaction.merchant_name || transaction.description}
                          </p>
                        </div>
                        <p
                          className={`font-semibold shrink-0 text-sm ${
                            transaction.is_excluded
                              ? "text-slate-400 dark:text-slate-500"
                              : transaction.is_recurring_generated && transaction.payment_status === "planned"
                              ? "text-amber-600 dark:text-amber-400"
                              : transaction.type === "income"
                              ? "text-emerald-600"
                              : "text-red-500 dark:text-red-400"
                          }`}
                        >
                          {transaction.type === "income" ? "+" : "-"}{formatCurrency(transaction.amount, transaction.currency)}
                        </p>
                      </div>
                      
                      {/* Row 2: Date + Category */}
                      <div className="flex items-center gap-2 pl-[52px] text-xs text-slate-500 dark:text-slate-400">
                        <span>{formatDate(transaction.transaction_date)}</span>
                        <span>•</span>
                        {editingTransaction === transaction.id ? (
                          <select
                            value={transaction.categories?.id || ""}
                            onChange={(e) => handleCategoryChange(transaction.id, e.target.value)}
                            onBlur={() => setEditingTransaction(null)}
                            autoFocus
                            className="px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs"
                          >
                            <option value="">Bez kategorii</option>
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.icon} {category.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => setEditingTransaction(transaction.id)}
                            className="text-slate-600 dark:text-slate-400"
                          >
                            {transaction.categories?.name || "Bez kategorii"}
                          </button>
                        )}
                      </div>
                      
                      {/* Row 3: Badges + Actions */}
                      <div className="flex items-center justify-between pl-[52px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {transaction.is_recurring_generated && transaction.payment_status === "planned" && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-800/50 text-amber-800 dark:text-amber-200 font-medium flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Zaplanowane
                            </span>
                          )}
                          {transaction.is_recurring_generated && transaction.payment_status === "completed" && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Cykliczny
                            </span>
                          )}
                          {!transaction.is_recurring_generated && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                              Rzeczywista
                            </span>
                          )}
                          {transaction.is_excluded && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                              Przelew
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {transaction.is_recurring_generated && (
                            <button
                              onClick={() => handleTogglePaymentStatus(transaction.id, transaction.payment_status)}
                              className={`p-1.5 rounded-lg ${
                                transaction.payment_status === "completed"
                                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                                  : "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                              }`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {transaction.payment_status === "completed" ? (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                ) : (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                )}
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => handleEditClick(transaction)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteTransaction(transaction.id)}
                            disabled={deletingTransaction === transaction.id}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400 disabled:opacity-50"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleToggleExcluded(transaction.id, transaction.is_excluded)}
                            className={`p-1.5 rounded-lg ${
                              transaction.is_excluded
                                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                                : "bg-slate-100 dark:bg-slate-700 text-slate-400"
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden md:flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
                          transaction.is_recurring_generated && transaction.payment_status === "planned"
                            ? "border-2 border-dashed border-amber-400 dark:border-amber-500"
                            : ""
                        }`}
                        style={{
                          backgroundColor: transaction.is_recurring_generated && transaction.payment_status === "planned"
                            ? "#fef3c7"
                            : transaction.categories?.color
                            ? `${transaction.categories.color}20`
                            : "#f1f5f9",
                        }}
                      >
                        {transaction.is_recurring_generated && transaction.payment_status === "planned" 
                          ? "📅" 
                          : transaction.categories?.icon || (transaction.type === "income" ? "💰" : "💸")}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-medium truncate ${
                            transaction.is_recurring_generated && transaction.payment_status === "planned"
                              ? "text-amber-800 dark:text-amber-300"
                              : "text-slate-900 dark:text-white"
                          }`}>
                            {transaction.merchant_name || transaction.description}
                          </p>
                          {transaction.is_recurring_generated && transaction.payment_status === "planned" && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-800/50 text-amber-800 dark:text-amber-200 font-medium flex-shrink-0 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Zaplanowane
                            </span>
                          )}
                          {transaction.is_recurring_generated && transaction.payment_status === "completed" && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex-shrink-0 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Cykliczny
                            </span>
                          )}
                          {!transaction.is_recurring_generated && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 flex-shrink-0">
                              Rzeczywista
                            </span>
                          )}
                          {transaction.is_excluded && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex-shrink-0">
                              Przelew
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                          {transaction.description}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                          {transaction.is_recurring_generated && transaction.payment_status === "planned" && (
                            <span className="text-amber-600 dark:text-amber-400">Planowana płatność • </span>
                          )}
                          {formatDate(transaction.transaction_date)}
                          {transaction.accounts?.name && ` • ${transaction.accounts.name}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {transaction.is_recurring_generated && (
                          <button
                            onClick={() => handleTogglePaymentStatus(transaction.id, transaction.payment_status)}
                            title={transaction.payment_status === "planned" ? "Oznacz jako opłacone" : "Oznacz jako zaplanowane"}
                            className={`p-1.5 rounded-lg transition-colors ${
                              transaction.payment_status === "completed"
                                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                                : "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400"
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              {transaction.payment_status === "completed" ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              )}
                            </svg>
                          </button>
                        )}

                        <button
                          onClick={() => handleEditClick(transaction)}
                          title="Edytuj transakcję"
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>

                        <button
                          onClick={() => handleDeleteTransaction(transaction.id)}
                          disabled={deletingTransaction === transaction.id}
                          title="Usuń transakcję"
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>

                        <button
                          onClick={() => handleToggleExcluded(transaction.id, transaction.is_excluded)}
                          title={transaction.is_excluded ? "Uwzględnij w sumach" : "Wyklucz z sum (przelew wewnętrzny)"}
                          className={`p-1.5 rounded-lg transition-colors ${
                            transaction.is_excluded
                              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                              : "bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-blue-600"
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                        </button>

                        {editingTransaction === transaction.id ? (
                          <select
                            value={transaction.categories?.id || ""}
                            onChange={(e) => handleCategoryChange(transaction.id, e.target.value)}
                            onBlur={() => setEditingTransaction(null)}
                            autoFocus
                            className="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white"
                          >
                            <option value="">Bez kategorii</option>
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.icon} {category.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => setEditingTransaction(transaction.id)}
                            className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-sm text-slate-600 dark:text-slate-400 transition-colors"
                          >
                            {transaction.categories?.name || "Bez kategorii"}
                          </button>
                        )}
                        
                        <p
                          className={`font-semibold text-right min-w-[100px] ${
                            transaction.is_excluded
                              ? "text-slate-400 dark:text-slate-500"
                              : transaction.is_recurring_generated && transaction.payment_status === "planned"
                              ? "text-amber-600 dark:text-amber-400 italic"
                              : transaction.type === "income"
                              ? "text-emerald-600"
                              : "text-slate-900 dark:text-white"
                          }`}
                        >
                          {transaction.type === "income" ? "+" : "-"}
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {data.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-4 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Wyświetlanie {((page - 1) * 20) + 1} - {Math.min(page * 20, data.total)} z {data.total}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Poprzednia
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                      disabled={page === data.totalPages}
                      className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Następna
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                Nie znaleziono transakcji
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                {search || filterType || filterCategory || filterStatus || hidePlanned
                  ? "Spróbuj zmienić filtry"
                  : "Zaimportuj transakcje z pliku CSV lub dodaj ręcznie"}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Edit Transaction Modal */}
      <AddTransactionModal
        isOpen={editModalOpen}
        onClose={handleEditClose}
        onSuccess={handleEditSuccess}
        transaction={transactionToEdit}
      />

      {/* Create Transaction Modal */}
      <AddTransactionModal
        isOpen={createModalOpen}
        onClose={handleCreateClose}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Ładowanie...</p>
        </div>
      </div>
    }>
      <TransactionsContent />
    </Suspense>
  );
}
