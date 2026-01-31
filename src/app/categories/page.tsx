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
  type: "income" | "expense" | "both";
  is_system: boolean;
}

const EMOJI_OPTIONS = [
  "🛒", "🍔", "🚗", "🏠", "💡", "📱", "🎮", "👕", "💊", "🎬",
  "✈️", "🎁", "📚", "💪", "🐕", "👶", "💼", "🎵", "☕", "🍺",
  "💰", "💳", "📈", "🏦", "💵", "🎯", "⚡", "🔧", "🛠️", "📦",
];

const COLOR_OPTIONS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#64748b", "#78716c", "#71717a",
];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [formName, setFormName] = useState("");
  const [formIcon, setFormIcon] = useState("📊");
  const [formColor, setFormColor] = useState("#64748b");
  const [formType, setFormType] = useState<"income" | "expense" | "both">("expense");
  
  const router = useRouter();

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch("/api/categories");
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (err) {
      console.error("Error fetching categories:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const startEditing = (category: Category) => {
    setEditingId(category.id);
    setFormName(category.name);
    setFormIcon(category.icon || "📊");
    setFormColor(category.color || "#64748b");
    setFormType(category.type);
    setShowNewForm(false);
  };

  const startNew = () => {
    setShowNewForm(true);
    setEditingId(null);
    setFormName("");
    setFormIcon("📊");
    setFormColor("#64748b");
    setFormType("expense");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowNewForm(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      setError("Nazwa jest wymagana");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const url = "/api/categories";
      const method = editingId ? "PUT" : "POST";
      const body = {
        ...(editingId && { id: editingId }),
        name: formName.trim(),
        icon: formIcon,
        color: formColor,
        type: formType,
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save category");
      }

      cancelEdit();
      fetchCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Usunąć tę kategorię? Transakcje korzystające z niej staną się niekategoryzowane.")) {
      return;
    }

    try {
      const response = await fetch(`/api/categories?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete category");
      }

      fetchCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const systemCategories = categories.filter((c) => c.is_system);
  const customCategories = categories.filter((c) => !c.is_system);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const renderForm = () => (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm mb-6">
      <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
        {editingId ? "Edytuj kategorię" : "Nowa kategoria"}
      </h3>
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Nazwa
          </label>
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="np. Subskrypcje"
            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Typ
          </label>
          <div className="flex gap-2">
            {(["expense", "income", "both"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFormType(type)}
                className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
                  formType === type
                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-2 border-emerald-500"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-2 border-transparent"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Icon */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Ikona
          </label>
          <div className="flex flex-wrap gap-2">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setFormIcon(emoji)}
                className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-colors ${
                  formIcon === emoji
                    ? "bg-emerald-100 dark:bg-emerald-900/30 ring-2 ring-emerald-500"
                    : "bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Kolor
          </label>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setFormColor(color)}
                className={`w-8 h-8 rounded-lg transition-transform ${
                  formColor === color ? "ring-2 ring-offset-2 ring-slate-900 dark:ring-white scale-110" : ""
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        {/* Preview */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Podgląd
          </label>
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
              style={{ backgroundColor: `${formColor}20` }}
            >
              {formIcon}
            </div>
            <span className="font-medium text-slate-900 dark:text-white">
              {formName || "Nazwa kategorii"}
            </span>
            <span
              className="ml-auto text-xs px-2 py-1 rounded-full capitalize"
              style={{ backgroundColor: `${formColor}20`, color: formColor }}
            >
              {formType}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            {saving ? "Zapisywanie..." : "Zapisz"}
          </button>
          <button
            onClick={cancelEdit}
            className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Anuluj
          </button>
        </div>
      </div>
    </div>
  );

  const renderCategory = (category: Category) => (
    <div
      key={category.id}
      className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm"
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
        style={{ backgroundColor: `${category.color}20` }}
      >
        {category.icon || "📊"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 dark:text-white">{category.name}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">{category.type}</p>
      </div>
      {!category.is_system ? (
        <div className="flex gap-2">
          <button
            onClick={() => startEditing(category)}
            className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
            title="Edytuj"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => handleDelete(category.id)}
            className="p-2 text-slate-400 hover:text-red-600 transition-colors"
            title="Usuń"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ) : (
        <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
          Systemowa
        </span>
      )}
    </div>
  );

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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white">Kategorie</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Zarządzaj kategoriami</h1>
            <p className="text-slate-600 dark:text-slate-400">Organizuj swoje przychody i wydatki</p>
          </div>
          {!showNewForm && !editingId && (
            <button
              onClick={startNew}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Nowa kategoria
            </button>
          )}
        </div>

        {/* Form */}
        {(showNewForm || editingId) && renderForm()}

        {/* Custom Categories */}
        {customCategories.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
              Twoje kategorie ({customCategories.length})
            </h2>
            <div className="space-y-3">
              {customCategories.map(renderCategory)}
            </div>
          </div>
        )}

        {/* System Categories */}
        <div>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
            Domyślne kategorie ({systemCategories.length})
          </h2>
          <div className="space-y-3">
            {systemCategories.map(renderCategory)}
          </div>
        </div>
      </main>
    </div>
  );
}
