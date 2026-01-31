"use client";

export const dynamic = "force-dynamic";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ParsedTransaction {
  date: string;
  amount: number;
  description: string;
  merchantName: string | null;
  type: "income" | "expense";
  currency: string;
  confidence?: "high" | "medium" | "low";
}

interface PreviewResult {
  success: boolean;
  bank?: "mbank" | "ing";
  documentType?: "bank_statement" | "receipt" | "unknown";
  transactions: ParsedTransaction[];
  count: number;
  errors: string[];
  rawText?: string;
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<"csv" | "pdf" | "mt940" | "zip" | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [zipFiles, setZipFiles] = useState<Array<{ filename: string; type: string; count: number; success: boolean; error?: string }>>([]);
  const [editedTransactions, setEditedTransactions] = useState<ParsedTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const router = useRouter();

  const handleFile = useCallback(async (selectedFile: File) => {
    const fileName = selectedFile.name.toLowerCase();
    const isPDF = fileName.endsWith(".pdf");
    const isCSV = fileName.endsWith(".csv");
    const isMT940 = fileName.endsWith(".sta") || fileName.endsWith(".mt940") || fileName.endsWith(".940") || fileName.endsWith(".mt9");
    const isZIP = fileName.endsWith(".zip");

    if (!isPDF && !isCSV && !isMT940 && !isZIP) {
      setError("Proszę przesłać plik CSV, PDF, MT940 lub ZIP");
      return;
    }

    let detectedType: "csv" | "pdf" | "mt940" | "zip" = "csv";
    if (isPDF) detectedType = "pdf";
    else if (isMT940) detectedType = "mt940";
    else if (isZIP) detectedType = "zip";

    setFile(selectedFile);
    setFileType(detectedType);
    setError(null);
    setPreview(null);
    setEditedTransactions([]);
    setZipFiles([]);
    setResult(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("action", "preview");

      let endpoint = "/api/import/csv";
      if (isPDF) endpoint = "/api/import/pdf";
      else if (isMT940) endpoint = "/api/import/mt940";
      else if (isZIP) endpoint = "/api/import/zip";

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || `Failed to parse file`);
        return;
      }

      setPreview(data);
      setEditedTransactions(data.transactions);
      if (isZIP && data.files) {
        setZipFiles(data.files);
      }
    } catch {
      setError("Nie udało się przetworzyć pliku");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const fileName = droppedFile.name.toLowerCase();
      const isValidFile = fileName.endsWith(".csv") || fileName.endsWith(".pdf") || 
        fileName.endsWith(".sta") || fileName.endsWith(".mt940") || 
        fileName.endsWith(".940") || fileName.endsWith(".mt9") ||
        fileName.endsWith(".zip");
      
      if (isValidFile) {
        handleFile(droppedFile);
      } else {
        setError("Proszę upuścić plik CSV, PDF, MT940 lub ZIP");
      }
    }
  }, [handleFile]);

  const handleImport = async () => {
    if (!file && editedTransactions.length === 0) return;
    
    setImporting(true);
    setError(null);

    try {
      const formData = new FormData();
      
      if (fileType === "pdf" || fileType === "mt940" || fileType === "zip") {
        // For PDF, MT940, and ZIP, send the edited transactions
        formData.append("action", "import");
        formData.append("transactions", JSON.stringify(editedTransactions));
        
        let endpoint = "/api/import/pdf";
        if (fileType === "mt940") endpoint = "/api/import/mt940";
        else if (fileType === "zip") endpoint = "/api/import/zip";
        
        const response = await fetch(endpoint, {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          setError(data.error || "Failed to import transactions");
          return;
        }

        setResult({ imported: data.imported, skipped: data.skipped });
      } else {
        // For CSV, use the original flow
        formData.append("file", file!);
        formData.append("action", "import");

        const response = await fetch("/api/import/csv", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          setError(data.error || "Failed to import transactions");
          return;
        }

        setResult({ imported: data.imported, skipped: data.skipped });
      }
    } catch {
      setError("Nie udało się zaimportować transakcji");
    } finally {
      setImporting(false);
    }
  };

  const updateTransaction = (index: number, field: keyof ParsedTransaction, value: string | number) => {
    setEditedTransactions(prev => {
      const updated = [...prev];
      if (field === "amount") {
        updated[index] = { ...updated[index], [field]: parseFloat(value as string) || 0 };
      } else if (field === "type") {
        updated[index] = { ...updated[index], [field]: value as "income" | "expense" };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  const removeTransaction = (index: number) => {
    setEditedTransactions(prev => prev.filter((_, i) => i !== index));
  };

  const formatCurrency = (amount: number, currency: string = "PLN") => {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const getSourceLabel = () => {
    if (fileType === "zip") {
      return `Archiwum ZIP (${zipFiles.length} plików)`;
    }
    if (fileType === "mt940") {
      return "Wyciąg bankowy MT940";
    }
    if (fileType === "pdf") {
      if (preview?.documentType === "bank_statement") return "Wyciąg bankowy (PDF)";
      if (preview?.documentType === "receipt") return "Paragon (PDF)";
      return "Dokument PDF";
    }
    if (preview?.bank === "mbank") return "mBank (CSV)";
    if (preview?.bank === "ing") return "ING (CSV)";
    return "Plik CSV";
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-white">Importuj transakcje</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Success Result */}
        {result && (
          <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">Import zakończony!</h3>
                <p className="text-emerald-700 dark:text-emerald-300">
                  {result.imported} transakcji zaimportowanych, {result.skipped} pominiętych (duplikaty)
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Link
                href="/dashboard"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Zobacz panel
              </Link>
              <button
                onClick={() => {
                  setFile(null);
                  setFileType(null);
                  setPreview(null);
                  setEditedTransactions([]);
                  setZipFiles([]);
                  setResult(null);
                }}
                className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium py-2 px-4 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
              >
                Importuj kolejny plik
              </button>
            </div>
          </div>
        )}

        {/* Upload Area */}
        {!result && (
          <>
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-sm mb-8">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Importuj transakcje
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Prześlij plik, aby zaimportować transakcje. Obsługiwane: CSV, PDF, MT940 i archiwa ZIP.
              </p>

              {/* Drop Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                  dragActive
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
                    : "border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500"
                }`}
              >
                {loading ? (
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-slate-600 dark:text-slate-400">Przetwarzanie pliku...</p>
                  </div>
                ) : (
                  <>
                    <svg className="w-12 h-12 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-slate-600 dark:text-slate-400 mb-2">
                      Przeciągnij i upuść plik tutaj, lub
                    </p>
                    <label className="inline-block">
                      <input
                        type="file"
                        accept=".csv,.pdf,.sta,.mt940,.940,.mt9,.zip"
                        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                        className="hidden"
                      />
                      <span className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-6 rounded-lg cursor-pointer transition-colors">
                        Przeglądaj pliki
                      </span>
                    </label>
                    <p className="text-sm text-slate-400 mt-4">
                      Obsługiwane: CSV, PDF, MT940, ZIP
                    </p>
                  </>
                )}
              </div>

              {error && (
                <div className="mt-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 mb-8">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
                Obsługiwane typy plików:
              </h3>
              <div className="grid md:grid-cols-4 gap-4 text-sm text-blue-800 dark:text-blue-200">
                <div>
                  <p className="font-medium mb-1">Pliki CSV:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300">
                    <li>Eksporty z mBank</li>
                    <li>Eksporty z ING</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium mb-1">Pliki PDF:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300">
                    <li>Wyciągi bankowe</li>
                    <li>Paragony/faktury</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium mb-1">Pliki MT940:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300">
                    <li>.sta, .mt940, .940</li>
                    <li>Standard SWIFT</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium mb-1">Archiwa ZIP:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300">
                    <li>Wiele plików</li>
                    <li>CSV/PDF/MT940</li>
                  </ul>
                </div>
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-4">
                Uwaga: Ekstrakcja z PDF może nie być w 100% dokładna. Przejrzyj przed importem.
              </p>
            </div>

            {/* ZIP Files Summary */}
            {fileType === "zip" && zipFiles.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 mb-4">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-3">
                  Pliki w archiwum ZIP
                </h3>
                <div className="space-y-2">
                  {zipFiles.map((f, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        f.success
                          ? "bg-emerald-50 dark:bg-emerald-900/20"
                          : "bg-red-50 dark:bg-red-900/20"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded ${
                            f.type === "csv"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                              : f.type === "pdf"
                              ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                              : "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                          }`}
                        >
                          {f.type.toUpperCase()}
                        </span>
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {f.filename}
                        </span>
                      </div>
                      <span
                        className={`text-sm font-medium ${
                          f.success
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {f.success ? `${f.count} transakcji` : f.error || "Błąd"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview */}
            {preview && editedTransactions.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        Przegląd transakcji ({editedTransactions.length})
                      </h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Źródło: <span className="font-medium">{getSourceLabel()}</span>
                        {(fileType === "pdf" || fileType === "zip") && (
                          <span className="ml-2 text-amber-600 dark:text-amber-400">
                            - Kliknij, aby edytować dowolne pole
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={handleImport}
                      disabled={importing || editedTransactions.length === 0}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                    >
                      {importing ? "Importowanie..." : `Importuj ${editedTransactions.length} transakcji`}
                    </button>
                  </div>
                </div>

                <div className="max-h-[500px] overflow-y-auto">
                  <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {editedTransactions.map((tx, index) => (
                      <div key={index} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        {editingIndex === index ? (
                          // Edit Mode
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div>
                                <label className="block text-xs text-slate-500 mb-1">Data</label>
                                <input
                                  type="date"
                                  value={tx.date}
                                  onChange={(e) => updateTransaction(index, "date", e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-500 mb-1">Kwota</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={tx.amount}
                                  onChange={(e) => updateTransaction(index, "amount", e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-500 mb-1">Typ</label>
                                <select
                                  value={tx.type}
                                  onChange={(e) => updateTransaction(index, "type", e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                                >
                                  <option value="expense">Wydatek</option>
                                  <option value="income">Przychód</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs text-slate-500 mb-1">Waluta</label>
                                <select
                                  value={tx.currency}
                                  onChange={(e) => updateTransaction(index, "currency", e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                                >
                                  <option value="PLN">PLN</option>
                                  <option value="EUR">EUR</option>
                                  <option value="USD">USD</option>
                                  <option value="GBP">GBP</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Opis</label>
                              <input
                                type="text"
                                value={tx.description}
                                onChange={(e) => updateTransaction(index, "description", e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setEditingIndex(null)}
                                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg"
                              >
                                Gotowe
                              </button>
                              <button
                                onClick={() => removeTransaction(index)}
                                className="px-4 py-1.5 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 text-sm rounded-lg"
                              >
                                Usuń
                              </button>
                            </div>
                          </div>
                        ) : (
                          // View Mode
                          <div 
                            className="flex items-center gap-4 cursor-pointer"
                            onClick={() => setEditingIndex(index)}
                          >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              tx.type === "income"
                                ? "bg-emerald-100 dark:bg-emerald-900/30"
                                : "bg-red-100 dark:bg-red-900/30"
                            }`}>
                              <span className="text-lg">
                                {tx.type === "income" ? "💰" : "💸"}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-slate-900 dark:text-white truncate">
                                  {tx.merchantName || tx.description}
                                </p>
                                {tx.confidence && tx.confidence !== "high" && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                                    tx.confidence === "medium" 
                                      ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                                      : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                  }`}>
                                    {tx.confidence === "medium" ? "Do przeglądu" : "Niska pewność"}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                {tx.date}
                              </p>
                            </div>
                            <p className={`font-semibold ${
                              tx.type === "income" ? "text-emerald-600" : "text-slate-900 dark:text-white"
                            }`}>
                              {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount, tx.currency)}
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeTransaction(index);
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                              title="Usuń"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {preview.errors && preview.errors.length > 0 && (
                  <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-amber-50 dark:bg-amber-900/20">
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      <span className="font-medium">Ostrzeżenia:</span> {preview.errors.join(", ")}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Empty Preview State */}
            {preview && editedTransactions.length === 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center">
                <p className="text-slate-500 dark:text-slate-400">
                  Nie znaleziono transakcji. Wszystkie transakcje zostały usunięte.
                </p>
                <button
                  onClick={() => {
                    setPreview(null);
                    setFile(null);
                    setFileType(null);
                  }}
                  className="mt-4 text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  Prześlij inny plik
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
