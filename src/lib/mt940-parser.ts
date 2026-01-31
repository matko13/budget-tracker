// MT940 Parser for Bank Statements
// MT940 is a SWIFT standard for electronic bank account statements

export interface ParsedTransaction {
  date: string;
  amount: number;
  description: string;
  merchantName: string | null;
  type: "income" | "expense";
  currency: string;
  reference?: string;
}

export interface MT940ParseResult {
  success: boolean;
  accountNumber: string | null;
  currency: string;
  transactions: ParsedTransaction[];
  errors: string[];
  statementDate: string | null;
}

interface MT940Statement {
  accountNumber: string | null;
  statementNumber: string | null;
  openingBalance: { date: string; currency: string; amount: number } | null;
  closingBalance: { date: string; currency: string; amount: number } | null;
  transactions: MT940Transaction[];
}

interface MT940Transaction {
  valueDate: string;
  bookingDate: string | null;
  amount: number;
  type: "C" | "D" | "RC" | "RD"; // Credit, Debit, Reversal Credit, Reversal Debit
  reference: string;
  description: string[];
}

// Parse MT940 date format (YYMMDD or YYYYMMDD)
function parseDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split("T")[0];
  
  dateStr = dateStr.trim();
  
  if (dateStr.length === 6) {
    // YYMMDD format
    const year = parseInt(dateStr.substring(0, 2));
    const month = dateStr.substring(2, 4);
    const day = dateStr.substring(4, 6);
    // Assume 20xx for years 00-50, 19xx for 51-99
    const fullYear = year <= 50 ? 2000 + year : 1900 + year;
    return `${fullYear}-${month}-${day}`;
  } else if (dateStr.length === 8) {
    // YYYYMMDD format
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${year}-${month}-${day}`;
  }
  
  return new Date().toISOString().split("T")[0];
}

// Parse amount from MT940 format (e.g., "1234,56" or "1234.56")
function parseAmount(amountStr: string): number {
  if (!amountStr) return 0;
  
  // Remove any spaces
  amountStr = amountStr.trim().replace(/\s/g, "");
  
  // Handle European format (comma as decimal separator)
  if (amountStr.includes(",") && !amountStr.includes(".")) {
    amountStr = amountStr.replace(",", ".");
  }
  
  // If both comma and dot exist, comma is thousands separator
  if (amountStr.includes(",") && amountStr.includes(".")) {
    amountStr = amountStr.replace(",", "");
  }
  
  return parseFloat(amountStr) || 0;
}

// Parse a single MT940 statement block
function parseStatement(block: string): MT940Statement {
  const statement: MT940Statement = {
    accountNumber: null,
    statementNumber: null,
    openingBalance: null,
    closingBalance: null,
    transactions: [],
  };
  
  const lines = block.split("\n");
  let currentTransaction: MT940Transaction | null = null;
  let inTransactionDetails = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // :25: Account number
    if (line.startsWith(":25:")) {
      statement.accountNumber = line.substring(4).trim();
    }
    
    // :28C: Statement number
    else if (line.startsWith(":28C:") || line.startsWith(":28:")) {
      statement.statementNumber = line.substring(line.indexOf(":") + 1).trim();
    }
    
    // :60F: or :60M: Opening balance
    else if (line.startsWith(":60F:") || line.startsWith(":60M:")) {
      const balanceStr = line.substring(5);
      // Format: C/D YYMMDD CURRENCY AMOUNT
      const match = balanceStr.match(/^([CD])(\d{6})([A-Z]{3})([0-9,\.]+)/);
      if (match) {
        statement.openingBalance = {
          date: parseDate(match[2]),
          currency: match[3],
          amount: parseAmount(match[4]) * (match[1] === "D" ? -1 : 1),
        };
      }
    }
    
    // :62F: or :62M: Closing balance
    else if (line.startsWith(":62F:") || line.startsWith(":62M:")) {
      const balanceStr = line.substring(5);
      const match = balanceStr.match(/^([CD])(\d{6})([A-Z]{3})([0-9,\.]+)/);
      if (match) {
        statement.closingBalance = {
          date: parseDate(match[2]),
          currency: match[3],
          amount: parseAmount(match[4]) * (match[1] === "D" ? -1 : 1),
        };
      }
    }
    
    // :61: Transaction line
    else if (line.startsWith(":61:")) {
      // Save previous transaction if exists
      if (currentTransaction) {
        statement.transactions.push(currentTransaction);
      }
      
      const txLine = line.substring(4);
      // Format: YYMMDD[MMDD]C/D[R]AMOUNT[N]REFERENCE
      // Example: 2301150115C1234,56NTRFPAYMENT REF
      
      // Extract value date (first 6 digits)
      const valueDate = txLine.substring(0, 6);
      
      // Check if booking date exists (next 4 digits might be MMDD)
      let bookingDate: string | null = null;
      let restOfLine = txLine.substring(6);
      
      if (/^\d{4}/.test(restOfLine)) {
        const mmdd = restOfLine.substring(0, 4);
        bookingDate = valueDate.substring(0, 2) + mmdd; // Use year from value date
        restOfLine = restOfLine.substring(4);
      }
      
      // Extract credit/debit indicator and reversal flag
      const typeMatch = restOfLine.match(/^(R?[CD])/);
      let type: "C" | "D" | "RC" | "RD" = "D";
      if (typeMatch) {
        type = typeMatch[1] as "C" | "D" | "RC" | "RD";
        restOfLine = restOfLine.substring(typeMatch[1].length);
      }
      
      // Extract amount (digits and comma/dot until a letter)
      const amountMatch = restOfLine.match(/^([0-9,\.]+)/);
      let amount = 0;
      if (amountMatch) {
        amount = parseAmount(amountMatch[1]);
        restOfLine = restOfLine.substring(amountMatch[1].length);
      }
      
      // Rest is transaction type code and reference
      // Skip 'N' + 3 letter code if present
      if (restOfLine.startsWith("N")) {
        restOfLine = restOfLine.substring(4);
      }
      
      const reference = restOfLine.trim();
      
      currentTransaction = {
        valueDate: parseDate(valueDate),
        bookingDate: bookingDate ? parseDate(bookingDate) : null,
        amount,
        type,
        reference,
        description: [],
      };
      
      inTransactionDetails = true;
    }
    
    // :86: Transaction details
    else if (line.startsWith(":86:") && currentTransaction) {
      currentTransaction.description.push(line.substring(4).trim());
    }
    
    // Continuation of :86: (lines not starting with :)
    else if (inTransactionDetails && currentTransaction && !line.startsWith(":")) {
      currentTransaction.description.push(line);
    }
    
    // End of transaction details
    else if (line.startsWith(":")) {
      inTransactionDetails = false;
    }
  }
  
  // Don't forget the last transaction
  if (currentTransaction) {
    statement.transactions.push(currentTransaction);
  }
  
  return statement;
}

// Main parse function
export function parseMT940(content: string): MT940ParseResult {
  const errors: string[] = [];
  const transactions: ParsedTransaction[] = [];
  let accountNumber: string | null = null;
  let currency = "PLN";
  let statementDate: string | null = null;
  
  try {
    // Normalize line endings
    content = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    
    // Check if this looks like MT940
    if (!content.includes(":20:") && !content.includes(":25:") && !content.includes(":61:")) {
      return {
        success: false,
        accountNumber: null,
        currency: "PLN",
        transactions: [],
        errors: ["File does not appear to be in MT940 format"],
        statementDate: null,
      };
    }
    
    // Split into statement blocks (each starts with :20:)
    const blocks = content.split(/(?=:20:)/);
    
    for (const block of blocks) {
      if (!block.trim()) continue;
      
      const statement = parseStatement(block);
      
      // Get account number from first statement
      if (!accountNumber && statement.accountNumber) {
        accountNumber = statement.accountNumber;
      }
      
      // Get currency from opening balance
      if (statement.openingBalance?.currency) {
        currency = statement.openingBalance.currency;
      }
      
      // Get statement date from closing balance
      if (statement.closingBalance?.date) {
        statementDate = statement.closingBalance.date;
      }
      
      // Convert MT940 transactions to our format
      for (const tx of statement.transactions) {
        const isCredit = tx.type === "C" || tx.type === "RC";
        const isReversal = tx.type === "RC" || tx.type === "RD";
        
        // Join description lines
        let description = tx.description.join(" ").trim();
        
        // Try to extract merchant name from description
        let merchantName: string | null = null;
        
        // Common patterns in Polish bank statements
        const merchantPatterns = [
          /(?:DO|OD|NA RZECZ|ODBIORCA|ZLECENIODAWCA)[:\s]+([^\/\n]+)/i,
          /(?:PRZELEW|PAYMENT|TRANSFER)[:\s]+([^\/\n]+)/i,
        ];
        
        for (const pattern of merchantPatterns) {
          const match = description.match(pattern);
          if (match) {
            merchantName = match[1].trim();
            break;
          }
        }
        
        // Clean up description
        description = description
          .replace(/\s+/g, " ")
          .trim() || tx.reference || "Transaction";
        
        // Add reversal indicator to description
        if (isReversal) {
          description = `[REVERSAL] ${description}`;
        }
        
        transactions.push({
          date: tx.valueDate,
          amount: tx.amount,
          description,
          merchantName,
          type: isCredit ? "income" : "expense",
          currency,
          reference: tx.reference,
        });
      }
    }
    
    if (transactions.length === 0) {
      errors.push("No transactions found in MT940 file");
    }
    
    return {
      success: transactions.length > 0,
      accountNumber,
      currency,
      transactions,
      errors,
      statementDate,
    };
  } catch (error) {
    return {
      success: false,
      accountNumber: null,
      currency: "PLN",
      transactions: [],
      errors: [`Failed to parse MT940: ${error instanceof Error ? error.message : "Unknown error"}`],
      statementDate: null,
    };
  }
}
