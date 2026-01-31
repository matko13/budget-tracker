export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string;
          user_id: string;
          external_id: string | null;
          iban: string | null;
          name: string;
          currency: string;
          balance: number;
          balance_updated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          external_id?: string | null;
          iban?: string | null;
          name: string;
          currency: string;
          balance?: number;
          balance_updated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          external_id?: string | null;
          iban?: string | null;
          name?: string;
          currency?: string;
          balance?: number;
          balance_updated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          external_id: string | null;
          amount: number;
          currency: string;
          description: string;
          merchant_name: string | null;
          category_id: string | null;
          transaction_date: string;
          booking_date: string | null;
          type: "income" | "expense" | "transfer";
          recurring_expense_id: string | null;
          is_recurring_generated: boolean;
          payment_status: "completed" | "planned" | "skipped" | null;
          is_excluded: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_id: string;
          external_id?: string | null;
          amount: number;
          currency: string;
          description: string;
          merchant_name?: string | null;
          category_id?: string | null;
          transaction_date: string;
          booking_date?: string | null;
          type: "income" | "expense" | "transfer";
          recurring_expense_id?: string | null;
          is_recurring_generated?: boolean;
          payment_status?: "completed" | "planned" | "skipped" | null;
          is_excluded?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string;
          external_id?: string | null;
          amount?: number;
          currency?: string;
          description?: string;
          merchant_name?: string | null;
          category_id?: string | null;
          transaction_date?: string;
          booking_date?: string | null;
          type?: "income" | "expense" | "transfer";
          recurring_expense_id?: string | null;
          is_recurring_generated?: boolean;
          payment_status?: "completed" | "planned" | "skipped" | null;
          is_excluded?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          icon: string | null;
          color: string | null;
          type: "income" | "expense" | "both";
          is_system: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          icon?: string | null;
          color?: string | null;
          type?: "income" | "expense" | "both";
          is_system?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          name?: string;
          icon?: string | null;
          color?: string | null;
          type?: "income" | "expense" | "both";
          is_system?: boolean;
          created_at?: string;
        };
      };
      categorization_rules: {
        Row: {
          id: string;
          user_id: string | null;
          category_id: string;
          keyword: string;
          is_system: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          category_id: string;
          keyword: string;
          is_system?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          category_id?: string;
          keyword?: string;
          is_system?: boolean;
          created_at?: string;
        };
      };
      budgets: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          amount: number;
          period: "monthly" | "weekly" | "yearly";
          budget_month: string;
          start_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id: string;
          amount: number;
          period?: "monthly" | "weekly" | "yearly";
          budget_month: string;
          start_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string;
          amount?: number;
          period?: "monthly" | "weekly" | "yearly";
          budget_month?: string;
          start_date?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      recurring_expenses: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          amount: number;
          currency: string;
          category_id: string | null;
          day_of_month: number | null;
          interval_months: number;
          last_occurrence_date: string | null;
          start_date: string;
          end_date: string | null;
          match_keywords: string[];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          amount: number;
          currency?: string;
          category_id?: string | null;
          day_of_month?: number | null;
          interval_months?: number;
          last_occurrence_date?: string | null;
          start_date?: string;
          end_date?: string | null;
          match_keywords?: string[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          amount?: number;
          currency?: string;
          category_id?: string | null;
          day_of_month?: number | null;
          interval_months?: number;
          last_occurrence_date?: string | null;
          start_date?: string;
          end_date?: string | null;
          match_keywords?: string[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      transaction_type: "income" | "expense" | "transfer";
      category_type: "income" | "expense" | "both";
      budget_period: "monthly" | "weekly" | "yearly";
      payment_status: "completed" | "planned" | "skipped";
    };
  };
}

// Convenience types
export type Account = Database["public"]["Tables"]["accounts"]["Row"];
export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type CategorizationRule = Database["public"]["Tables"]["categorization_rules"]["Row"];
export type Budget = Database["public"]["Tables"]["budgets"]["Row"];
export type RecurringExpense = Database["public"]["Tables"]["recurring_expenses"]["Row"];
