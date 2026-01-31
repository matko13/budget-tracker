import { NextResponse } from "next/server";
import { createUntypedClient } from "@/lib/supabase/server-untyped";
import JSZip from "jszip";
import { parseMT940, ParsedTransaction } from "@/lib/mt940-parser";

interface FileResult {
  filename: string;
  type: "csv" | "pdf" | "mt940";
  success: boolean;
  transactions: ParsedTransaction[];
  error?: string;
}

interface ZipPreviewResult {
  success: boolean;
  files: FileResult[];
  totalTransactions: number;
  errors: string[];
}

export async function POST(request: Request) {
  try {
    const supabase = await createUntypedClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const action = formData.get("action") as string;
    const transactionsJson = formData.get("transactions") as string | null;

    if (!file && action !== "import") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // If importing with edited transactions
    if (action === "import" && transactionsJson) {
      const transactions: ParsedTransaction[] = JSON.parse(transactionsJson);
      return await importTransactions(supabase, user.id, transactions);
    }

    // Read and extract ZIP
    const arrayBuffer = await file!.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    const result: ZipPreviewResult = {
      success: true,
      files: [],
      totalTransactions: 0,
      errors: [],
    };

    // Process each file in the ZIP
    const filePromises: Promise<FileResult | null>[] = [];

    zip.forEach((relativePath, zipEntry) => {
      if (zipEntry.dir) return;

      const fileName = relativePath.toLowerCase();
      const baseName = relativePath.split("/").pop() || relativePath;

      // Skip hidden files and __MACOSX folder
      if (baseName.startsWith(".") || relativePath.includes("__MACOSX")) {
        return;
      }

      const isCSV = fileName.endsWith(".csv");
      const isPDF = fileName.endsWith(".pdf");
      const isMT940 =
        fileName.endsWith(".sta") ||
        fileName.endsWith(".mt940") ||
        fileName.endsWith(".940") ||
        fileName.endsWith(".mt9");

      if (!isCSV && !isPDF && !isMT940) {
        return;
      }

      const fileType: "csv" | "pdf" | "mt940" = isPDF
        ? "pdf"
        : isMT940
        ? "mt940"
        : "csv";

      filePromises.push(
        processZipFile(zipEntry, baseName, fileType, user.id)
      );
    });

    const fileResults = await Promise.all(filePromises);

    for (const fileResult of fileResults) {
      if (fileResult) {
        result.files.push(fileResult);
        if (fileResult.success) {
          result.totalTransactions += fileResult.transactions.length;
        } else if (fileResult.error) {
          result.errors.push(`${fileResult.filename}: ${fileResult.error}`);
        }
      }
    }

    if (result.files.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No supported files found in ZIP (CSV, PDF, MT940)",
        },
        { status: 400 }
      );
    }

    // Combine all transactions
    const allTransactions: ParsedTransaction[] = [];
    for (const f of result.files) {
      if (f.success) {
        allTransactions.push(...f.transactions);
      }
    }

    return NextResponse.json({
      success: true,
      format: "zip",
      files: result.files.map((f) => ({
        filename: f.filename,
        type: f.type,
        success: f.success,
        count: f.transactions.length,
        error: f.error,
      })),
      transactions: allTransactions,
      count: allTransactions.length,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Error processing ZIP:", error);
    return NextResponse.json(
      { error: "Failed to process ZIP file" },
      { status: 500 }
    );
  }
}

async function processZipFile(
  zipEntry: JSZip.JSZipObject,
  filename: string,
  type: "csv" | "pdf" | "mt940",
  userId: string
): Promise<FileResult> {
  try {
    if (type === "mt940") {
      const content = await zipEntry.async("text");
      const parseResult = parseMT940(content);

      return {
        filename,
        type,
        success: parseResult.success,
        transactions: parseResult.transactions,
        error: parseResult.errors[0],
      };
    }

    if (type === "csv") {
      const content = await zipEntry.async("text");
      const transactions = parseCSV(content);

      return {
        filename,
        type,
        success: transactions.length > 0,
        transactions,
        error: transactions.length === 0 ? "No transactions found" : undefined,
      };
    }

    if (type === "pdf") {
      // For PDFs, we need to call the PDF API
      const content = await zipEntry.async("blob");
      const transactions = await parsePDFFromBlob(content, filename, userId);

      return {
        filename,
        type,
        success: transactions.length > 0,
        transactions,
        error: transactions.length === 0 ? "No transactions extracted" : undefined,
      };
    }

    return {
      filename,
      type,
      success: false,
      transactions: [],
      error: "Unsupported file type",
    };
  } catch (error) {
    return {
      filename,
      type,
      success: false,
      transactions: [],
      error: error instanceof Error ? error.message : "Failed to process file",
    };
  }
}

// Simple CSV parser (handles mBank and ING formats)
function parseCSV(content: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const lines = content.split("\n");

  // Detect format by looking for headers
  let format: "mbank" | "ing" | "unknown" = "unknown";
  let headerIndex = -1;

  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i].toLowerCase();
    if (line.includes("#data operacji") || line.includes("data operacji")) {
      format = "mbank";
      headerIndex = i;
      break;
    }
    if (line.includes("data transakcji") && line.includes("dane kontrahenta")) {
      format = "ing";
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    return transactions;
  }

  // Parse based on format
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      if (format === "mbank") {
        const parsed = parseMBankLine(line);
        if (parsed) transactions.push(parsed);
      } else if (format === "ing") {
        const parsed = parseINGLine(line);
        if (parsed) transactions.push(parsed);
      }
    } catch {
      // Skip malformed lines
    }
  }

  return transactions;
}

function parseMBankLine(line: string): ParsedTransaction | null {
  // mBank CSV format: semicolon separated
  const parts = parseCSVLine(line, ";");
  if (parts.length < 5) return null;

  const dateStr = parts[0].replace(/"/g, "").trim();
  const description = parts[1].replace(/"/g, "").trim();
  const amountStr = parts[4]?.replace(/"/g, "").replace(/\s/g, "").replace(",", ".").trim();

  if (!dateStr || !amountStr) return null;

  const amount = parseFloat(amountStr);
  if (isNaN(amount)) return null;

  // Parse date (DD.MM.YYYY or YYYY-MM-DD)
  let date = dateStr;
  if (dateStr.includes(".")) {
    const [d, m, y] = dateStr.split(".");
    date = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return {
    date,
    amount: Math.abs(amount),
    description,
    merchantName: extractMerchant(description),
    type: amount < 0 ? "expense" : "income",
    currency: "PLN",
  };
}

function parseINGLine(line: string): ParsedTransaction | null {
  const parts = parseCSVLine(line, ";");
  if (parts.length < 9) return null;

  const dateStr = parts[0].replace(/"/g, "").trim();
  const merchant = parts[2].replace(/"/g, "").trim();
  const title = parts[3].replace(/"/g, "").trim();
  const amountStr = parts[8]?.replace(/"/g, "").replace(/\s/g, "").replace(",", ".").trim();

  if (!dateStr || !amountStr) return null;

  const amount = parseFloat(amountStr);
  if (isNaN(amount)) return null;

  // Parse date
  let date = dateStr;
  if (dateStr.includes(".")) {
    const [d, m, y] = dateStr.split(".");
    date = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return {
    date,
    amount: Math.abs(amount),
    description: title || merchant,
    merchantName: merchant || null,
    type: amount < 0 ? "expense" : "income",
    currency: "PLN",
  };
}

function parseCSVLine(line: string, separator: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === separator && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

function extractMerchant(description: string): string | null {
  // Try to extract merchant from common patterns
  const patterns = [
    /(?:PRZELEW|ZAKUP|PŁATNOŚĆ)\s+(?:DO|W|NA)\s+(.+?)(?:\s+DATA|\s+NR|$)/i,
    /(?:SKLEP|MARKET|RESTAURACJA)\s+(.+?)(?:\s+DATA|\s+NR|$)/i,
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match) return match[1].trim();
  }

  return null;
}

async function parsePDFFromBlob(
  blob: Blob,
  filename: string,
  userId: string
): Promise<ParsedTransaction[]> {
  try {
    // Convert blob to buffer
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Use pdf-parse for extraction (require for CommonJS compatibility)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;

    // Try to extract transactions from PDF text
    return extractTransactionsFromPDFText(text);
  } catch (error) {
    console.error(`Error parsing PDF ${filename}:`, error);
    return [];
  }
}

function extractTransactionsFromPDFText(text: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const lines = text.split("\n");

  // Look for transaction patterns
  const datePattern = /(\d{2}[.\/-]\d{2}[.\/-]\d{4})/;
  const amountPattern = /(-?\d[\d\s]*[,\.]\d{2})\s*(PLN|EUR|USD|GBP)?/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const dateMatch = line.match(datePattern);
    const amountMatch = line.match(amountPattern);

    if (dateMatch && amountMatch) {
      const dateStr = dateMatch[1];
      let date = dateStr;
      
      // Convert date format
      if (dateStr.includes(".")) {
        const [d, m, y] = dateStr.split(".");
        date = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      } else if (dateStr.includes("/")) {
        const [d, m, y] = dateStr.split("/");
        date = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }

      const amountStr = amountMatch[1].replace(/\s/g, "").replace(",", ".");
      const amount = parseFloat(amountStr);
      const currency = amountMatch[2] || "PLN";

      if (!isNaN(amount) && amount !== 0) {
        // Get description from surrounding context
        const description = line.replace(datePattern, "").replace(amountPattern, "").trim() ||
          lines[i + 1]?.trim() || "Transaction";

        transactions.push({
          date,
          amount: Math.abs(amount),
          description: description.substring(0, 200),
          merchantName: null,
          type: amount < 0 ? "expense" : "income",
          currency: currency.toUpperCase(),
        });
      }
    }
  }

  return transactions;
}

async function importTransactions(
  supabase: ReturnType<typeof createUntypedClient> extends Promise<infer T> ? T : never,
  userId: string,
  transactions: ParsedTransaction[]
) {
  // Get or create ZIP import account
  let account;
  const { data: existingAccount } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("external_id", "zip-import")
    .single();

  if (existingAccount) {
    account = existingAccount;
  } else {
    const { data: newAccount, error: accountError } = await supabase
      .from("accounts")
      .insert({
        user_id: userId,
        external_id: "zip-import",
        name: "ZIP Import",
        currency: "PLN",
        balance: 0,
      })
      .select()
      .single();

    if (accountError) {
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
    }

    account = newAccount;
  }

  // Get categorization rules - query both system rules and user rules
  const { data: systemRules } = await supabase
    .from("categorization_rules")
    .select("keyword, category_id")
    .eq("is_system", true);

  const { data: userRules } = await supabase
    .from("categorization_rules")
    .select("keyword, category_id")
    .eq("user_id", userId);

  const rules = [...(systemRules || []), ...(userRules || [])];

  // Function to find category - improved matching
  const findCategory = (merchant: string | null, description: string) => {
    const normalizeText = (text: string) => 
      text.toLowerCase()
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    
    const searchText = normalizeText(`${merchant || ""} ${description}`);
    
    for (const rule of rules) {
      const keyword = normalizeText(rule.keyword);
      if (searchText.includes(keyword)) {
        return rule.category_id;
      }
    }
    return null;
  };

  const { data: existingTx } = await supabase
    .from("transactions")
    .select("external_id")
    .eq("user_id", userId);

  const existingIds = new Set((existingTx || []).map((t: { external_id: string }) => t.external_id));

  let imported = 0;
  let skipped = 0;

  for (const tx of transactions) {
    const ref = tx.description.substring(0, 30);
    const externalId = `zip-${tx.date}-${tx.amount}-${ref}`.replace(/[^a-zA-Z0-9-]/g, "_");

    if (existingIds.has(externalId)) {
      skipped++;
      continue;
    }

    const categoryId = findCategory(tx.merchantName, tx.description);

    const { error: insertError } = await supabase.from("transactions").insert({
      user_id: userId,
      account_id: account.id,
      external_id: externalId,
      amount: tx.amount,
      currency: tx.currency || "PLN",
      description: tx.description,
      merchant_name: tx.merchantName,
      category_id: categoryId,
      transaction_date: tx.date,
      booking_date: tx.date,
      type: tx.type,
    });

    if (!insertError) {
      imported++;
      existingIds.add(externalId);
    }
  }

  return NextResponse.json({
    success: true,
    imported,
    skipped,
    total: transactions.length,
  });
}
