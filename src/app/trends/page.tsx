"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMonth } from "@/contexts/MonthContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";

interface MonthlyData {
  name: string;
  income: number;
  expenses: number;
  net: number;
}

interface CategoryComparison {
  name: string;
  color: string;
  current: number;
  previous: number;
  change: number;
}

interface TrendsData {
  monthlyData: MonthlyData[];
  dailyData: { day: number; amount: number }[];
  categoryComparison: CategoryComparison[];
  currentMonth: string;
}

export default function TrendsPage() {
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { getMonthUrl } = useMonth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/trends");
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        if (response.ok) {
          const trendsData = await response.json();
          setData(trendsData);
        }
      } catch (error) {
        console.error("Error fetching trends:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency: "PLN",
      maximumFractionDigits: 0,
    }).format(amount);
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white">Trendy wydatków</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Trendy wydatków
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8">
          Śledź swoje przychody i wydatki w czasie
        </p>

        {/* Monthly Overview Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm mb-8">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">
            Przegląd miesięczny (ostatnie 6 miesięcy)
          </h2>
          {data?.monthlyData && data.monthlyData.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 12 }} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "none",
                      borderRadius: "8px",
                      color: "#f8fafc",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="income" name="Przychody" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Wydatki" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-80 flex items-center justify-center text-slate-500">
              Brak dostępnych danych
            </div>
          )}
        </div>

        {/* Daily Spending Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm mb-8">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">
            Dzienne wydatki - {data?.currentMonth}
          </h2>
          {data?.dailyData && data.dailyData.some(d => d.amount > 0) ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.dailyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 12 }} tickFormatter={(v) => `${v}`} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => `Dzień ${label}`}
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "none",
                      borderRadius: "8px",
                      color: "#f8fafc",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    name="Wydatki"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ fill: "#8b5cf6", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-500">
              Brak danych o wydatkach za ten miesiąc
            </div>
          )}
        </div>

        {/* Category Comparison */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">
            Porównanie kategorii (ten miesiąc vs poprzedni)
          </h2>
          {data?.categoryComparison && data.categoryComparison.length > 0 ? (
            <div className="space-y-4">
              {data.categoryComparison.map((category) => (
                <div key={category.name} className="flex items-center gap-4">
                  <div className="w-32 text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                    {category.name}
                  </div>
                  <div className="flex-1">
                    <div className="flex gap-2 mb-1">
                      <div
                        className="h-6 rounded"
                        style={{
                          width: `${Math.max((category.current / (Math.max(category.current, category.previous) || 1)) * 100, 5)}%`,
                          backgroundColor: category.color,
                        }}
                      />
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {formatCurrency(category.current)}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <div
                        className="h-6 rounded opacity-40"
                        style={{
                          width: `${Math.max((category.previous / (Math.max(category.current, category.previous) || 1)) * 100, 5)}%`,
                          backgroundColor: category.color,
                        }}
                      />
                      <span className="text-sm text-slate-400">
                        {formatCurrency(category.previous)} (poprz.)
                      </span>
                    </div>
                  </div>
                  <div className={`text-sm font-medium w-16 text-right ${
                    category.change > 0 ? "text-red-500" : category.change < 0 ? "text-emerald-500" : "text-slate-400"
                  }`}>
                    {category.change > 0 ? "+" : ""}{category.change}%
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              Brak danych kategorii do porównania
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
