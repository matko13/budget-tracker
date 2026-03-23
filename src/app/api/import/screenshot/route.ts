import { NextResponse } from "next/server";
import { createUntypedClient } from "@/lib/supabase/server-untyped";
import OpenAI from "openai";

const SYSTEM_PROMPT = `Jesteś asystentem do analizy screenshotów transakcji bankowych. Użytkownik prześle screenshot z aplikacji bankowej (np. ING, mBank, PKO, Santander, itp.) i Twoim zadaniem jest wydobyć dane transakcji.

Zwróć dane w formacie JSON z następującymi polami:
- "amount": kwota transakcji jako liczba (zawsze wartość bezwzględna, bez znaku minus)
- "description": tytuł/opis transakcji
- "merchantName": nazwa odbiorcy/sprzedawcy (jeśli dostępna)
- "date": data transakcji w formacie YYYY-MM-DD
- "type": "expense" jeśli to wydatek/płatność, "income" jeśli to przychód/wpływ
- "currency": waluta (domyślnie "PLN")

Zasady:
- Jeśli widzisz kwotę z minusem lub słowa "blokada", "płatność kartą", "przelew wychodzący" - to wydatek
- Jeśli widzisz kwotę z plusem lub słowa "wpływ", "przelew przychodzący", "wynagrodzenie" - to przychód
- Wyciągnij datę transakcji (nie datę księgowania)
- Jako merchantName podaj nazwę odbiorcy/nadawcy, nie pełny adres
- Jako description podaj tytuł operacji

Odpowiedz TYLKO obiektem JSON, bez żadnego dodatkowego tekstu.`;

export async function POST(request: Request) {
  try {
    const supabase = await createUntypedClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Brak klucza API OpenAI. Dodaj OPENAI_API_KEY w ustawieniach aplikacji.",
        },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

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

    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Plik jest za duży. Maksymalny rozmiar to 20MB." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Przeanalizuj ten screenshot transakcji bankowej i wydobądź dane transakcji.",
            },
            {
              type: "image_url",
              image_url: { url: dataUrl, detail: "high" },
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content;
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
          error: "Nie udało się odczytać danych ze screenshota. Spróbuj ponownie z wyraźniejszym zdjęciem.",
          rawResponse: content,
        },
        { status: 422 }
      );
    }

    const result = {
      success: true,
      transaction: {
        amount: typeof parsed.amount === "number" ? Math.abs(parsed.amount) : parseFloat(parsed.amount) || 0,
        description: parsed.description || "",
        merchantName: parsed.merchantName || null,
        date: parsed.date || new Date().toISOString().split("T")[0],
        type: parsed.type === "income" ? "income" : "expense",
        currency: parsed.currency || "PLN",
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error processing screenshot:", error);
    return NextResponse.json(
      { error: "Wystąpił błąd podczas przetwarzania screenshota" },
      { status: 500 }
    );
  }
}
