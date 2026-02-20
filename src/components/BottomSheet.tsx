"use client";

import { useEffect, useRef } from "react";

export interface BottomSheetAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "danger" | "success" | "warning";
  disabled?: boolean;
  active?: boolean;
  hidden?: boolean;
}

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  actions: BottomSheetAction[];
}

export default function BottomSheet({ isOpen, onClose, title, subtitle, actions }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const visibleActions = actions.filter((a) => !a.hidden);

  const variantStyles: Record<string, string> = {
    default: "text-slate-700 dark:text-slate-200",
    danger: "text-red-600 dark:text-red-400",
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
  };

  const activeStyles: Record<string, string> = {
    default: "bg-slate-100 dark:bg-slate-700",
    danger: "bg-red-50 dark:bg-red-900/20",
    success: "bg-emerald-50 dark:bg-emerald-900/20",
    warning: "bg-amber-50 dark:bg-amber-900/20",
  };

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div
        className="absolute inset-0 bg-black/40 transition-opacity"
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-800 rounded-t-2xl shadow-xl max-h-[80vh] overflow-y-auto animate-slide-up"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>

        {(title || subtitle) && (
          <div className="px-5 pt-2 pb-3 border-b border-slate-100 dark:border-slate-700">
            {title && (
              <p className="font-semibold text-slate-900 dark:text-white text-base truncate">
                {title}
              </p>
            )}
            {subtitle && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
        )}

        <div className="py-2">
          {visibleActions.map((action, idx) => {
            const variant = action.variant || "default";
            return (
              <button
                key={idx}
                onClick={() => {
                  if (!action.disabled) {
                    action.onClick();
                    onClose();
                  }
                }}
                disabled={action.disabled}
                className={`w-full flex items-center gap-4 px-5 py-3.5 text-left transition-colors active:bg-slate-100 dark:active:bg-slate-700 disabled:opacity-40 ${
                  variantStyles[variant]
                } ${action.active ? activeStyles[variant] : ""}`}
              >
                {action.icon && (
                  <span className="w-6 h-6 flex items-center justify-center shrink-0">
                    {action.icon}
                  </span>
                )}
                <span className="text-[15px] font-medium">{action.label}</span>
              </button>
            );
          })}
        </div>

        <div className="px-5 pb-5 pt-1">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-[15px] transition-colors active:bg-slate-200 dark:active:bg-slate-600"
          >
            Anuluj
          </button>
        </div>
      </div>
    </div>
  );
}
