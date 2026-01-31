"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Institution {
  id: string;
  name: string;
  logo: string;
  countries: string[];
}

export default function BanksPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchInstitutions();
  }, []);

  const fetchInstitutions = async () => {
    try {
      const response = await fetch("/api/banks/institutions");
      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to fetch institutions");
      }
      const data = await response.json();
      setInstitutions(data);
    } catch {
      setError("Nie udało się załadować banków. Spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (institutionId: string) => {
    setConnecting(institutionId);
    setError(null);

    try {
      const response = await fetch("/api/banks/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ institutionId }),
      });

      if (!response.ok) {
        throw new Error("Failed to initiate connection");
      }

      const { link } = await response.json();
      
      // Redirect to bank authorization page
      window.location.href = link;
    } catch {
      setError("Nie udało się połączyć z bankiem. Spróbuj ponownie.");
      setConnecting(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Ładowanie banków...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg            >
              Powrót do panelu
            </Link>
        </div>

        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Połącz swój bank
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            Wybierz swój bank, aby bezpiecznie połączyć konto. Zostaniesz
            przekierowany do swojego banku, aby autoryzować dostęp.
          </p>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {institutions.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl p-8 text-center">
                <p className="text-slate-600 dark:text-slate-400">
                  Brak dostępnych banków. Sprawdź konfigurację GoCardless.
                </p>
              </div>
            ) : (
              institutions.map((institution) => (
                <button
                  key={institution.id}
                  onClick={() => handleConnect(institution.id)}
                  disabled={connecting !== null}
                  className="w-full bg-white dark:bg-slate-800 rounded-xl p-6 flex items-center gap-4 hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200 dark:border-slate-700"
                >
                  {institution.logo ? (
                    <img
                      src={institution.logo}
                      alt={institution.name}
                      className="w-12 h-12 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      {institution.name}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {institution.countries.join(", ")}
                    </p>
                  </div>
                  {connecting === institution.id ? (
                    <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg
                      className="w-6 h-6 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>

          <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Bezpieczne połączenie
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Używamy GoCardless Open Banking do połączenia z Twoim bankiem. Twoje
              dane logowania nigdy nie są nam udostępniane. Autoryzujesz dostęp
              bezpośrednio w swoim banku.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
