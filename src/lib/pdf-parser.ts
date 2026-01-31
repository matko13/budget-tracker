// PDF Parser for Bank Statements and Receipts
// pdf-parse is loaded lazily to avoid build-time canvas dependency issues

export interface ParsedTransaction {
  date: string;
  amount: number;
  description: string;
  merchantName: string | null;
  type: "income" | "expense";
  currency: string;
  confidence: "high" | "medium" | "low";
  rawText: string;
}

export interface PDFParseResult {
  success: boolean;
  documentType: "bank_statement" | "receipt" | "unknown";
  transactions: ParsedTransaction[];
  errors: string[];
  rawText: string;
}

// Date patterns commonly used in Polish bank statements
const DATE_PATTERNS = [
  /(\d{2})\.(\d{2})\.(\d{4})/g, // DD.MM.YYYY
  /(\d{4})-(\d{2})-(\d{2})/g,   // YYYY-MM-DD
  /(\d{2})\/(\d{2})\/(\d{4})/g, // DD/MM/YYYY
  /(\d{2})-(\d{2})-(\d{4})/g,   // DD-MM-YYYY
];

// Amount patterns for Polish currency format
const AMOUNT_PATTERNS = [
  // Polish format: "1 234,56" or "-1 234,56" or "+1 234,56"
  /([+-]?\d{1,3}(?:\s?\d{3})*,\d{2})\s*(?:PLN|zł|EUR|USD|GBP)?/gi,
  // Standard format: "1234.56" or "-1234.56"
  /([+-]?\d+(?:\.\d{2})?)\s*(?:PLN|zł|EUR|USD|GBP)?/gi,
];

// Parse date string to YYYY-MM-DD format
function parseDate(dateStr: string): string | null {
  // DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
  let match = dateStr.match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  
  // YYYY-MM-DD
  match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return dateStr;
  }
  
  return null;
}

// Parse amount string to number
function parseAmount(amountStr: string): number | null {
  // Remove currency symbols and whitespace
  let cleaned = amountStr.replace(/[PLNzłEURUSDGBP\s]/gi, "").trim();
  
  // Handle Polish format (comma as decimal separator)
  if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/\s/g, "").replace(",", ".");
  }
  
  const amount = parseFloat(cleaned);
  return isNaN(amount) ? null : amount;
}

// Extract transactions from mBank PDF statement
function parseMBankStatement(text: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  
  // mBank statements typically have transactions in format:
  // Date | Description | Amount
  // Look for lines that start with a date
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if line starts with a date
    const dateMatch = line.match(/^(\d{2}\.\d{2}\.\d{4})/);
    if (!dateMatch) continue;
    
    const date = parseDate(dateMatch[1]);
    if (!date) continue;
    
    // Look for amount in this line or next few lines
    let amount: number | null = null;
    let description = "";
    let searchText = line;
    
    // Combine with next 2 lines for context
    for (let j = 0; j < 3 && i + j < lines.length; j++) {
      searchText += " " + lines[i + j];
    }
    
    // Find amounts in the search text
    const amounts: number[] = [];
    for (const pattern of AMOUNT_PATTERNS) {
      const matches = searchText.matchAll(pattern);
      for (const match of matches) {
        const parsed = parseAmount(match[1]);
        if (parsed !== null && Math.abs(parsed) > 0.01) {
          amounts.push(parsed);
        }
      }
    }
    
    if (amounts.length > 0) {
      // Take the last amount (usually the transaction amount, not balance)
      amount = amounts[amounts.length - 1];
      
      // Extract description (text between date and amount)
      description = line.replace(dateMatch[0], "").trim();
      // Remove amount from description
      description = description.replace(/[+-]?\d{1,3}(?:\s?\d{3})*[,.]?\d*\s*(?:PLN|zł|EUR|USD|GBP)?/gi, "").trim();
      
      if (description.length < 3 && i + 1 < lines.length) {
        description = lines[i + 1].trim();
      }
      
      transactions.push({
        date,
        amount: Math.abs(amount),
        description: description || "Transaction",
        merchantName: null,
        type: amount < 0 ? "expense" : "income",
        currency: "PLN",
        confidence: amounts.length === 1 ? "high" : "medium",
        rawText: searchText.substring(0, 200),
      });
    }
  }
  
  return transactions;
}

// Extract transactions from ING PDF statement
function parseINGStatement(text: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // ING uses YYYY-MM-DD format or DD.MM.YYYY
    const dateMatch = line.match(/(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4})/);
    if (!dateMatch) continue;
    
    const date = parseDate(dateMatch[1]);
    if (!date) continue;
    
    // Combine with next lines for full transaction info
    let searchText = line;
    for (let j = 1; j < 4 && i + j < lines.length; j++) {
      searchText += " " + lines[i + j];
    }
    
    // Find amounts
    const amounts: number[] = [];
    for (const pattern of AMOUNT_PATTERNS) {
      const matches = searchText.matchAll(pattern);
      for (const match of matches) {
        const parsed = parseAmount(match[1]);
        if (parsed !== null && Math.abs(parsed) > 0.01) {
          amounts.push(parsed);
        }
      }
    }
    
    if (amounts.length > 0) {
      const amount = amounts[amounts.length - 1];
      let description = line.replace(dateMatch[0], "").trim();
      description = description.replace(/[+-]?\d{1,3}(?:\s?\d{3})*[,.]?\d*\s*(?:PLN|zł|EUR|USD|GBP)?/gi, "").trim();
      
      if (description.length < 3 && i + 1 < lines.length) {
        description = lines[i + 1].trim();
      }
      
      transactions.push({
        date,
        amount: Math.abs(amount),
        description: description || "Transaction",
        merchantName: null,
        type: amount < 0 ? "expense" : "income",
        currency: "PLN",
        confidence: amounts.length === 1 ? "high" : "medium",
        rawText: searchText.substring(0, 200),
      });
    }
  }
  
  return transactions;
}

// Extract data from a receipt
function parseReceipt(text: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  
  // Find date
  let date: string | null = null;
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      date = parseDate(match[0]);
      if (date) break;
    }
  }
  
  if (!date) {
    date = new Date().toISOString().split("T")[0]; // Default to today
  }
  
  // Look for total amount (common keywords)
  const totalPatterns = [
    /(?:SUMA|TOTAL|RAZEM|DO ZAPŁATY|NALEŻNOŚĆ)[:\s]*([+-]?\d{1,3}(?:\s?\d{3})*[,.]?\d{2})/gi,
    /(?:KWOTA|AMOUNT)[:\s]*([+-]?\d{1,3}(?:\s?\d{3})*[,.]?\d{2})/gi,
  ];
  
  let amount: number | null = null;
  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match) {
      amount = parseAmount(match[1]);
      if (amount) break;
    }
  }
  
  // If no total found, look for the largest amount
  if (!amount) {
    const amounts: number[] = [];
    for (const pattern of AMOUNT_PATTERNS) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const parsed = parseAmount(match[1]);
        if (parsed !== null && parsed > 0) {
          amounts.push(parsed);
        }
      }
    }
    if (amounts.length > 0) {
      amount = Math.max(...amounts);
    }
  }
  
  if (!amount) {
    return transactions;
  }
  
  // Extract merchant name (usually at the top of receipt)
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 2);
  let merchantName = lines[0] || "Unknown Merchant";
  
  // Clean up merchant name
  merchantName = merchantName.replace(/[0-9]/g, "").trim();
  if (merchantName.length < 2) {
    merchantName = lines[1] || "Receipt";
  }
  
  transactions.push({
    date,
    amount,
    description: `Receipt from ${merchantName}`,
    merchantName,
    type: "expense",
    currency: "PLN",
    confidence: "medium",
    rawText: text.substring(0, 500),
  });
  
  return transactions;
}

// Detect document type
function detectDocumentType(text: string): "bank_statement" | "receipt" | "unknown" {
  const lowerText = text.toLowerCase();
  
  // Bank statement indicators
  const bankIndicators = [
    "mbank", "ing bank", "wyciąg", "rachunek", "saldo", "historia operacji",
    "account statement", "bank statement", "transactions", "debit", "credit",
    "nr rachunku", "numer konta"
  ];
  
  // Receipt indicators
  const receiptIndicators = [
    "paragon", "faktura", "rachunek fiskalny", "nip", "kasjer",
    "receipt", "invoice", "total", "suma", "do zapłaty", "razem"
  ];
  
  const bankScore = bankIndicators.filter(ind => lowerText.includes(ind)).length;
  const receiptScore = receiptIndicators.filter(ind => lowerText.includes(ind)).length;
  
  if (bankScore > receiptScore && bankScore >= 2) {
    return "bank_statement";
  } else if (receiptScore > 0) {
    return "receipt";
  }
  
  return "unknown";
}

// Detect bank from text
function detectBank(text: string): "mbank" | "ing" | "unknown" {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes("mbank") || lowerText.includes("m bank")) {
    return "mbank";
  }
  if (lowerText.includes("ing bank") || lowerText.includes("ing ") || lowerText.includes("ingbank")) {
    return "ing";
  }
  
  return "unknown";
}

// Main parse function
export async function parsePDF(buffer: Buffer): Promise<PDFParseResult> {
  const errors: string[] = [];
  
  try {
    // Lazy load pdf-parse to avoid build-time canvas dependency
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    
    // Extract text from PDF
    const data = await pdfParse(buffer);
    const text = data.text;
    
    if (!text || text.trim().length < 10) {
      return {
        success: false,
        documentType: "unknown",
        transactions: [],
        errors: ["Could not extract text from PDF. The document may be scanned/image-based."],
        rawText: "",
      };
    }
    
    // Detect document type
    const documentType = detectDocumentType(text);
    
    let transactions: ParsedTransaction[] = [];
    
    if (documentType === "bank_statement") {
      const bank = detectBank(text);
      
      if (bank === "mbank") {
        transactions = parseMBankStatement(text);
      } else if (bank === "ing") {
        transactions = parseINGStatement(text);
      } else {
        // Generic parsing - try both
        transactions = parseMBankStatement(text);
        if (transactions.length === 0) {
          transactions = parseINGStatement(text);
        }
      }
      
      if (transactions.length === 0) {
        errors.push("Could not find transactions in bank statement. Please check the document format.");
      }
    } else if (documentType === "receipt") {
      transactions = parseReceipt(text);
      
      if (transactions.length === 0) {
        errors.push("Could not extract transaction from receipt.");
      }
    } else {
      // Try generic parsing
      transactions = parseMBankStatement(text);
      if (transactions.length === 0) {
        transactions = parseReceipt(text);
      }
      
      if (transactions.length === 0) {
        errors.push("Could not determine document type or extract transactions.");
      }
    }
    
    // Remove duplicates (same date and amount)
    const seen = new Set<string>();
    transactions = transactions.filter(t => {
      const key = `${t.date}-${t.amount}-${t.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    return {
      success: transactions.length > 0,
      documentType,
      transactions,
      errors,
      rawText: text.substring(0, 2000), // Include some raw text for debugging
    };
  } catch (error) {
    return {
      success: false,
      documentType: "unknown",
      transactions: [],
      errors: [`Failed to parse PDF: ${error instanceof Error ? error.message : "Unknown error"}`],
      rawText: "",
    };
  }
}
