import { NextResponse } from "next/server";
import { createUntypedClient } from "@/lib/supabase/server-untyped";
import { GoogleGenerativeAI } from "@google/generative-ai";

const PROMPT = `Przeanalizuj ten screenshot transakcji bankowej i wydobądź dane transakcji.

Zwróć dane w formacie JSON z następującymi polami:
- "amount": kwota transakcji jako liczba (zawsze wartość bezwzględna, bez znaku minus)
- "description": tytuł/opis transakcji
- "merchantName": nazwa odbiorcy/sprzedawcy (jeśli dostępna, bez adresu)
- "date": data transakcji w formacie YYYY-MM-DD
- "type": "expense" jeśli to wydatek/płatność/blokada, "income" jeśli to przychód/wpływ
- "currency": waluta (domyślnie "PLN")

Zasady:
- Jeśli widzisz kwotę z minusem lub słowa "blokada", "płatność kartą", "przelew wychodzący" - to wydatek
- Jeśli widzisz kwotę z plusem lub słowa "wpływ", "przelew przychodzący", "wynagrodzenie" - to przychód
- Wyciągnij datę transakcji (nie datę księgowania)
- Jako merchantName podaj nazwę odbiorcy/nadawcy (krótką, bez adresu)
- Jako description podaj tytuł operacji

Odpowiedz TYLKO obiektem JSON, bez żadnego dodatkowego tekstu ani formatowania markdown.`;

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
    const clientApiKey = formData.get("apiKey") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "Nie przesłano pliku" },
        { status: 400 }
      );
    }

    const validTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
    ];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            "Nieobsługiwany format pliku. Prześlij obraz JPG, PNG lub WebP.",
        },
        { status: 400 }
      );
    }

    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Plik jest za duży. Maksymalny rozmiar to 20MB." },
        { status: 400 }
      );
    }

    const apiKey = clientApiKey || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "NO_API_KEY",
          message:
            "Brak klucza API. Ustaw klucz Google Gemini w ustawieniach skanowania.",
        },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent([
      PROMPT,
      {
        inlineData: {
          mimeType: file.type,
          data: base64,
        },
      },
    ]);

    const content = result.response.text();
    if (!content) {
      return NextResponse.json(
        { error: "Nie udało się przeanalizować obrazu" },
        { status: 500 }
      );
    }

    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json(
        {
          error:
            "Nie udało się odczytać danych ze screenshota. Spróbuj ponownie z wyraźniejszym zdjęciem.",
          rawResponse: content,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      transaction: {
        amount:
          typeof parsed.amount === "number"
            ? Math.abs(parsed.amount)
            : parseFloat(parsed.amount) || 0,
        description: parsed.description || "",
        merchantName: parsed.merchantName || null,
        date: parsed.date || new Date().toISOString().split("T")[0],
        type: parsed.type === "income" ? "income" : "expense",
        currency: parsed.currency || "PLN",
      },
    });
  } catch (error) {
    console.error("Error processing screenshot:", error);

    const message =
      error instanceof Error ? error.message : "Unknown error";

    if (message.includes("API_KEY_INVALID") || message.includes("API key not valid")) {
      return NextResponse.json(
        {
          error: "INVALID_API_KEY",
          message: "Klucz API jest nieprawidłowy. Sprawdź go w ustawieniach.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Wystąpił błąd podczas przetwarzania screenshota" },
      { status: 500 }
    );
  }
}
