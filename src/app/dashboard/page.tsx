"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import AddTransactionModal from "@/components/AddTransactionModal";

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
}

interface Budget {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  budgetAmount: number;
  spent: number;
  percentUsed: number;
}

interface DashboardData {
  accounts: Account[];
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  categoryBreakdown: Array<{ name: string; amount: number; color: string }>;
  recentTransactions: Transaction[];
  budgets: Budget[];
  currentMonth: string;
  month: number;
  year: number;
  isCurrentMonth: boolean;
}

export default function DashboardPage() {
  const now = new Date();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const router = useRouter();
  const supabase = createClient();

  const fetchDashboard = useCallback(async (month?: number, year?: number) => {
    const m = month ?? selectedMonth;
    const y = year ?? selectedYear;
    try {
      const response = await fetch(`/api/dashboard?month=${m}&year=${y}`);
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
  }, [router, selectedMonth, selectedYear]);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser({ email: user.email || "" });
      }
    };
    getUser();
    fetchDashboard();
  }, [fetchDashboard, supabase.auth]);

  const goToPreviousMonth = () => {
    let newMonth = selectedMonth - 1;
    let newYear = selectedYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    }
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
    fetchDashboard(newMonth, newYear);
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
    fetchDashboard(newMonth, newYear);
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    setSelectedMonth(now.getMonth());
    setSelectedYear(now.getFullYear());
    fetchDashboard(now.getMonth(), now.getFullYear());
  };

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
              {!data?.isCurrentMonth && (
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
              href="/budgets"
              className="flex items-center gap-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium py-2 px-4 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Budżety
            </Link>

            <Link
              href="/recurring"
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <span className="text-slate-600 dark:text-slate-400">Całkowite saldo</span>
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(data?.totalBalance || 0)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
              Na {data?.accounts.length || 0} koncie(ach)
            </p>
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
              -{formatCurrency(data?.monthlyExpenses || 0)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">Ten miesiąc</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Spending by Category */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Wydatki według kategorii
              </h2>
              <Link
                href="/trends"
                className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
              >
                Zobacz trendy
              </Link>
            </div>
            
            {data?.categoryBreakdown && data.categoryBreakdown.length > 0 ? (
              <div className="space-y-4">
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

          {/* Recent Transactions */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Ostatnie transakcje
              </h2>
              <Link
                href="/transactions"
                className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
              >
                Zobacz wszystkie
              </Link>
            </div>
            
            {data?.recentTransactions && data.recentTransactions.length > 0 ? (
              <div className="space-y-3">
                {data.recentTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                      style={{
                        backgroundColor: transaction.categories?.color
                          ? `${transaction.categories.color}20`
                          : "#f1f5f9",
                      }}
                    >
                      {transaction.categories?.icon || (transaction.type === "income" ? "💰" : "💸")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white truncate">
                        {transaction.merchant_name || transaction.description}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {transaction.categories?.name || "Bez kategorii"} • {formatDate(transaction.transaction_date)}
                      </p>
                    </div>
                    <p
                      className={`font-semibold ${
                        transaction.type === "income"
                          ? "text-emerald-600"
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
        </div>

        {/* Budget Progress */}
        {data?.budgets && data.budgets.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Postęp budżetu
              </h2>
              <Link
                href="/budgets"
                className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
              >
                Zarządzaj budżetami
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.budgets.slice(0, 6).map((budget) => (
                <div
                  key={budget.id}
                  className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                      style={{ backgroundColor: `${budget.categoryColor}20` }}
                    >
                      {budget.categoryIcon || "📊"}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {budget.categoryName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatCurrency(budget.spent)} / {formatCurrency(budget.budgetAmount)}
                      </p>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
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
                  <p className={`text-xs mt-2 font-medium ${
                    budget.percentUsed >= 100
                      ? "text-red-600"
                      : budget.percentUsed >= 80
                      ? "text-amber-600"
                      : "text-emerald-600"
                  }`}>
                    {budget.percentUsed}% wykorzystane
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

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
