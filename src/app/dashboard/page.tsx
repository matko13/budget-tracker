"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AddTransactionModal from "@/components/AddTransactionModal";
import { useMonth } from "@/contexts/MonthContext";

interface Account {
  id: string;
  name: string;
  iban: string | null;
  currency: string;
  balance: number;
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
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
  payment_status: "completed" | "planned" | "skipped" | null;
  is_recurring_generated: boolean;
}

interface DashboardData {
  accounts: Account[];
  monthlyBalance: number;
  realBalance: number;
  savingsRate: number;
  realSavingsRate: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  realExpenses: number;
  plannedExpenses: number;
  categoryBreakdown: Array<{ name: string; amount: number; color: string }>;
  recentTransactions: Transaction[];
  currentMonth: string;
  month: number;
  year: number;
  isCurrentMonth: boolean;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [hidePlanned, setHidePlanned] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Load hidePlanned preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("hidePlanned");
    if (stored === "true") {
      setHidePlanned(true);
    }
  }, []);

  // Save hidePlanned preference to localStorage
  const toggleHidePlanned = () => {
    const newValue = !hidePlanned;
    setHidePlanned(newValue);
    localStorage.setItem("hidePlanned", newValue ? "true" : "false");
  };
  
  const {
    selectedMonth,
    selectedYear,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
    isCurrentMonth,
    getMonthUrl,
  } = useMonth();

  const fetchDashboard = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        month: selectedMonth.toString(),
        year: selectedYear.toString(),
      });
      if (hidePlanned) {
        params.append("hidePlanned", "true");
      }
      const response = await fetch(`/api/dashboard?${params}`);
      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to fetch dashboard");
      }
      const dashboardData = await response.json();
      setData(dashboardData);
    } catch (error) {
      console.error("Error fetching dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, [router, selectedMonth, selectedYear, hidePlanned]);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser({ email: user.email || "" });
      }
    };
    getUser();
  }, [supabase.auth]);

  useEffect(() => {
    setLoading(true);
    fetchDashboard();
  }, [fetchDashboard]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
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
      month: "short",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Ładowanie panelu...</p>
        </div>
      </div>
    );
  }

  const maxCategoryAmount = data?.categoryBreakdown[0]?.amount || 1;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white">BudgetTracker</span>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600 dark:text-slate-400 hidden sm:block">
                {user?.email}
              </span>
              <button
                onClick={handleLogout}
                className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-medium text-sm"
              >
                Wyloguj się
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Page Title & Month Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Panel główny</h1>
            {/* Month Navigation */}
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={goToPreviousMonth}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                aria-label="Previous month"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-slate-600 dark:text-slate-400 font-medium min-w-[140px] text-center">
                {data?.currentMonth}
              </span>
              <button
                onClick={goToNextMonth}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                aria-label="Next month"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {!isCurrentMonth && (
                <button
                  onClick={goToCurrentMonth}
                  className="ml-2 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  Dzisiaj
                </button>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Dodaj transakcję
            </button>

            <Link
              href={getMonthUrl("/recurring")}
              className="flex items-center gap-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium py-2 px-4 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Wydatki cykliczne
            </Link>

            <Link
              href="/import"
              className="flex items-center gap-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium py-2 px-4 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Importuj CSV
            </Link>
          </div>
        </div>

        {/* Empty State - No Transactions */}
        {(!data?.recentTransactions || data.recentTransactions.length === 0) && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center mb-8">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Zacznij śledzić swój budżet
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
              Dodaj pierwszą transakcję ręcznie lub zaimportuj z eksportu CSV swojego banku.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Dodaj transakcję
              </button>
              <Link
                href="/import"
                className="inline-flex items-center justify-center gap-2 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold py-3 px-6 rounded-xl transition-colors border border-slate-200 dark:border-slate-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Importuj CSV
              </Link>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                (data?.realBalance || 0) >= 0 
                  ? "bg-blue-100 dark:bg-blue-900/30" 
                  : "bg-orange-100 dark:bg-orange-900/30"
              }`}>
                <svg className={`w-6 h-6 ${
                  (data?.realBalance || 0) >= 0 ? "text-blue-600" : "text-orange-600"
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="text-slate-600 dark:text-slate-400">Bilans miesięczny</span>
            </div>
            <p className={`text-3xl font-bold ${
              (data?.realBalance || 0) >= 0 
                ? "text-blue-600" 
                : "text-orange-600"
            }`}>
              {(data?.realBalance || 0) >= 0 ? "+" : ""}{formatCurrency(data?.realBalance || 0)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
              {(data?.realSavingsRate || 0) >= 0 
                ? `${data?.realSavingsRate || 0}% oszczędności`
                : `${Math.abs(data?.realSavingsRate || 0)}% ponad przychody`
              }
            </p>
            {(data?.plannedExpenses || 0) > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Po zaplanowanych: {(data?.monthlyBalance || 0) >= 0 ? "+" : ""}{formatCurrency(data?.monthlyBalance || 0)}
              </p>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                </svg>
              </div>
              <span className="text-slate-600 dark:text-slate-400">Przychody</span>
            </div>
            <p className="text-3xl font-bold text-emerald-600">
              +{formatCurrency(data?.monthlyIncome || 0)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">Ten miesiąc</p>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                </svg>
              </div>
              <span className="text-slate-600 dark:text-slate-400">Wydatki</span>
            </div>
            <p className="text-3xl font-bold text-red-600">
              -{formatCurrency(data?.realExpenses || 0)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">Rzeczywiste wydatki</p>
            {(data?.plannedExpenses || 0) > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Zaplanowane: -{formatCurrency(data?.plannedExpenses || 0)}
              </p>
            )}
          </div>
        </div>

        {/* Spending by Category */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Wydatki według kategorii
            </h2>
            <Link
              href={getMonthUrl("/trends")}
              className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
            >
              Zobacz trendy
            </Link>
          </div>
          
          {data?.categoryBreakdown && data.categoryBreakdown.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              {data.categoryBreakdown.map((category) => (
                <div key={category.name}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {category.name}
                    </span>
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {formatCurrency(category.amount)}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(category.amount / maxCategoryAmount) * 100}%`,
                        backgroundColor: category.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-500 dark:text-slate-400">
                Brak danych o wydatkach
              </p>
            </div>
          )}
        </div>

        {/* Recent Transactions - at the bottom */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Ostatnie transakcje
            </h2>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={hidePlanned}
                    onChange={toggleHidePlanned}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-amber-500 transition-colors"></div>
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform"></div>
                </div>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  Ukryj zaplanowane
                </span>
              </label>
              <Link
                href={`${getMonthUrl("/transactions")}${hidePlanned ? "?hidePlanned=true" : ""}`}
                className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
              >
                Zobacz wszystkie
              </Link>
            </div>
          </div>
          
          {data?.recentTransactions && data.recentTransactions.length > 0 ? (
            <div className="space-y-3">
              {data.recentTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg relative"
                    style={{
                      backgroundColor: transaction.categories?.color
                        ? `${transaction.categories.color}20`
                        : "#f1f5f9",
                    }}
                  >
                    {transaction.categories?.icon || (transaction.type === "income" ? "💰" : "💸")}
                    {/* Status indicator for recurring generated transactions */}
                    {transaction.is_recurring_generated && (
                      <div
                        className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 ${
                          transaction.payment_status === "planned"
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        title={transaction.payment_status === "planned" ? "Zaplanowane" : "Opłacone"}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white truncate">
                      {transaction.merchant_name || transaction.description}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                      <span>{transaction.categories?.name || "Bez kategorii"} • {formatDate(transaction.transaction_date)}</span>
                      {transaction.is_recurring_generated && transaction.payment_status === "planned" && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                          Zaplanowane
                        </span>
                      )}
                    </div>
                  </div>
                  <p
                    className={`font-semibold ${
                      transaction.type === "income"
                        ? "text-emerald-600"
                        : transaction.payment_status === "planned"
                        ? "text-slate-400 dark:text-slate-500"
                        : "text-slate-900 dark:text-white"
                    }`}
                  >
                    {transaction.type === "income" ? "+" : "-"}
                    {formatCurrency(transaction.amount, transaction.currency)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-500 dark:text-slate-400">
                Brak transakcji
              </p>
            </div>
          )}
        </div>

      </main>

      {/* Add Transaction Modal */}
      <AddTransactionModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchDashboard}
      />
    </div>
  );
}
