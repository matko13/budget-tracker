// CSV Parser for Polish Banks (mBank, ING)

export interface ParsedTransaction {
  date: string;
  amount: number;
  description: string;
  merchantName: string | null;
  type: "income" | "expense";
  currency: string;
  rawData: Record<string, string>;
}

export interface ParseResult {
  success: boolean;
  bank: "mbank" | "ing" | "unknown";
  transactions: ParsedTransaction[];
  errors: string[];
}

// Detect bank from CSV content
function detectBank(headers: string[], firstRow: string[]): "mbank" | "ing" | "unknown" {
  const headerStr = headers.join(";").toLowerCase();
  
  // mBank typically has: Data operacji, Opis operacji, Rachunek, etc.
  if (headerStr.includes("data operacji") || headerStr.includes("opis operacji")) {
    return "mbank";
  }
  
  // ING typically has: Data transakcji, Data księgowania, Dane kontrahenta, etc.
  if (headerStr.includes("data transakcji") || headerStr.includes("dane kontrahenta") || headerStr.includes("data księgowania")) {
    return "ing";
  }
  
  // Try to detect from data format
  if (firstRow.length >= 5) {
    // mBank usually has date in DD.MM.YYYY format
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(firstRow[0]?.trim())) {
      return "mbank";
    }
    // ING uses YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(firstRow[0]?.trim())) {
      return "ing";
    }
  }
  
  return "unknown";
}

// Parse mBank CSV format
function parseMbankRow(row: string[], headers: string[]): ParsedTransaction | null {
  try {
    // mBank format (semicolon separated):
    // Data operacji;Opis operacji;Rachunek;Kategoria;Kwota;Saldo po operacji
    // or
    // Data operacji;Data księgowania;Opis operacji;Tytuł;Nadawca/Odbiorca;Numer konta;Kwota;Saldo po operacji
    
    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      headerMap[h.toLowerCase().trim()] = i;
    });
    
    // Find date column
    const dateIdx = headerMap["data operacji"] ?? headerMap["data księgowania"] ?? 0;
    const descIdx = headerMap["opis operacji"] ?? headerMap["tytuł"] ?? 2;
    const recipientIdx = headerMap["nadawca/odbiorca"] ?? headerMap["odbiorca"] ?? -1;
    const amountIdx = headerMap["kwota"] ?? headers.length - 2;
    
    const dateStr = row[dateIdx]?.trim();
    const description = row[descIdx]?.trim() || "";
    const recipient = recipientIdx >= 0 ? row[recipientIdx]?.trim() : null;
    let amountStr = row[amountIdx]?.trim() || "0";
    
    // Parse date (DD.MM.YYYY -> YYYY-MM-DD)
    let date = dateStr;
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split(".");
      date = `${year}-${month}-${day}`;
    }
    
    // Parse amount (Polish format: "1 234,56" or "-1 234,56")
    amountStr = amountStr.replace(/\s/g, "").replace(",", ".");
    const amount = parseFloat(amountStr);
    
    if (isNaN(amount) || !date) {
      return null;
    }
    
    return {
      date,
      amount: Math.abs(amount),
      description,
      merchantName: recipient || null,
      type: amount >= 0 ? "income" : "expense",
      currency: "PLN",
      rawData: Object.fromEntries(headers.map((h, i) => [h, row[i] || ""])),
    };
  } catch {
    return null;
  }
}

// Parse ING CSV format
function parseIngRow(row: string[], headers: string[]): ParsedTransaction | null {
  try {
    // ING format (semicolon separated):
    // Data transakcji;Data księgowania;Dane kontrahenta;Tytuł;Nr rachunku kontrahenta;Kwota transakcji;Saldo po transakcji
    // or
    // Data księgowania;Kwota;Nazwa i adres kontrahenta;Rachunek kontrahenta;Szczegóły płatności;Szczegóły płatności cd.;Szczegóły płatności cd.;Szczegóły płatności cd.;Waluta
    
    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      headerMap[h.toLowerCase().trim()] = i;
    });
    
    const dateIdx = headerMap["data księgowania"] ?? headerMap["data transakcji"] ?? 0;
    const amountIdx = headerMap["kwota"] ?? headerMap["kwota transakcji"] ?? 1;
    const recipientIdx = headerMap["dane kontrahenta"] ?? headerMap["nazwa i adres kontrahenta"] ?? 2;
    const titleIdx = headerMap["tytuł"] ?? headerMap["szczegóły płatności"] ?? 3;
    const currencyIdx = headerMap["waluta"] ?? -1;
    
    const dateStr = row[dateIdx]?.trim();
    const recipient = row[recipientIdx]?.trim() || "";
    const title = row[titleIdx]?.trim() || "";
    let amountStr = row[amountIdx]?.trim() || "0";
    const currency = currencyIdx >= 0 ? row[currencyIdx]?.trim() || "PLN" : "PLN";
    
    // ING date is usually YYYY-MM-DD
    let date = dateStr;
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split(".");
      date = `${year}-${month}-${day}`;
    }
    
    // Parse amount
    amountStr = amountStr.replace(/\s/g, "").replace(",", ".");
    const amount = parseFloat(amountStr);
    
    if (isNaN(amount) || !date) {
      return null;
    }
    
    const description = title || recipient || "Transaction";
    
    return {
      date,
      amount: Math.abs(amount),
      description,
      merchantName: recipient || null,
      type: amount >= 0 ? "income" : "expense",
      currency,
      rawData: Object.fromEntries(headers.map((h, i) => [h, row[i] || ""])),
    };
  } catch {
    return null;
  }
}

// Parse CSV string
function parseCSVString(content: string): string[][] {
  const lines = content.split(/\r?\n/);
  const result: string[][] = [];
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    // Handle quoted fields with semicolons
    const row: string[] = [];
    let current = "";
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ";" && !inQuotes) {
        row.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    
    if (row.some(cell => cell.length > 0)) {
      result.push(row);
    }
  }
  
  return result;
}

// Main parse function
export function parseCSV(content: string): ParseResult {
  const errors: string[] = [];
  const transactions: ParsedTransaction[] = [];
  
  try {
    const rows = parseCSVString(content);
    
    if (rows.length < 2) {
      return {
        success: false,
        bank: "unknown",
        transactions: [],
        errors: ["CSV file is empty or has no data rows"],
      };
    }
    
    const headers = rows[0];
    const dataRows = rows.slice(1);
    
    // Detect bank
    const bank = detectBank(headers, dataRows[0] || []);
    
    if (bank === "unknown") {
      return {
        success: false,
        bank: "unknown",
        transactions: [],
        errors: ["Could not detect bank format. Please ensure the CSV is from mBank or ING."],
      };
    }
    
    // Parse each row
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      
      let parsed: ParsedTransaction | null = null;
      
      if (bank === "mbank") {
        parsed = parseMbankRow(row, headers);
      } else if (bank === "ing") {
        parsed = parseIngRow(row, headers);
      }
      
      if (parsed) {
        transactions.push(parsed);
      } else {
        errors.push(`Row ${i + 2}: Could not parse transaction`);
      }
    }
    
    return {
      success: transactions.length > 0,
      bank,
      transactions,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      bank: "unknown",
      transactions: [],
      errors: [`Failed to parse CSV: ${error instanceof Error ? error.message : "Unknown error"}`],
    };
  }
}
