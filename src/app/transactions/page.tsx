"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AddTransactionModal from "@/components/AddTransactionModal";

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

export default function TransactionsPage() {
  const now = new Date();
  const [data, setData] = useState<TransactionsResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [editingTransaction, setEditingTransaction] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [showAllTime, setShowAllTime] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const router = useRouter();

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
  }, [page, search, filterType, filterCategory, selectedMonth, selectedYear, showAllTime, router]);

  const goToPreviousMonth = () => {
    let newMonth = selectedMonth - 1;
    let newYear = selectedYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    }
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
    setPage(1);
  };

  const goToNextMonth = () => {
    let newMonth = selectedMonth + 1;
    let newYear = selectedYear;
    if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
    setPage(1);
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    setSelectedMonth(now.getMonth());
    setSelectedYear(now.getFullYear());
    setShowAllTime(false);
    setPage(1);
  };

  const toggleAllTime = () => {
    setShowAllTime(!showAllTime);
    setPage(1);
  };

  const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
  const monthLabel = new Date(selectedYear, selectedMonth).toLocaleDateString("pl-PL", { month: "long", year: "numeric" });

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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearch("");
                  setFilterType("");
                  setFilterCategory("");
                  setPage(1);
                }}
                className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
              >
                Wyczyść filtry
              </button>
            </div>
          </div>
        </div>

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
                    className={`flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                      transaction.is_excluded ? "opacity-60" : ""
                    } ${
                      transaction.is_recurring_generated && transaction.payment_status === "planned"
                        ? "bg-amber-50/50 dark:bg-amber-900/10"
                        : ""
                    }`}
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{
                        backgroundColor: transaction.categories?.color
                          ? `${transaction.categories.color}20`
                          : "#f1f5f9",
                      }}
                    >
                      {transaction.categories?.icon || (transaction.type === "income" ? "💰" : "💸")}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900 dark:text-white truncate">
                          {transaction.merchant_name || transaction.description}
                        </p>
                        {transaction.is_recurring_generated && transaction.payment_status === "planned" && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex-shrink-0">
                            Zaplanowane
                          </span>
                        )}
                        {transaction.is_recurring_generated && transaction.payment_status === "completed" && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex-shrink-0">
                            Cykliczny
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
                        {formatDate(transaction.transaction_date)}
                        {transaction.accounts?.name && ` • ${transaction.accounts.name}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Edit Button */}
                      <button
                        onClick={() => handleEditClick(transaction)}
                        title="Edytuj transakcję"
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>

                      {/* Delete Button */}
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

                      {/* Exclude Toggle */}
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

                      {/* Category */}
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
                {search || filterType || filterCategory
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
