# Home Assistant → WhatsApp Notifications

Powiadomienia z Home Assistant na WhatsApp przez CallMeBot (darmowe, bez limitu wiadomości).

## Szybki start (5 minut)

### 1. Zarejestruj numer w CallMeBot

1. Dodaj numer **+34 644 71 81 45** do kontaktów (np. "CallMeBot")
2. Wyślij WhatsApp: `I allow callmebot to send me messages`
3. Otrzymasz odpowiedź z Twoim **API key** - zapisz go

### 2. Dodaj secrets do Home Assistant

W `secrets.yaml`:

```yaml
whatsapp_phone: "48XXXXXXXXX"  # Twój numer (bez +)
whatsapp_apikey: "XXXXXX"       # API key z CallMeBot
```

### 3. Dodaj konfigurację do HA

W `configuration.yaml` dodaj:

```yaml
rest_command:
  whatsapp_message:
    url: "https://api.callmebot.com/whatsapp.php?phone={{ phone }}&text={{ message | urlencode }}&apikey={{ apikey }}"
    method: GET

script:
  whatsapp_notify:
    alias: "WhatsApp - wyślij wiadomość"
    fields:
      message:
        description: "Treść wiadomości"
    sequence:
      - action: rest_command.whatsapp_message
        data:
          phone: !secret whatsapp_phone
          apikey: !secret whatsapp_apikey
          message: "{{ message }}"
    mode: queued
    max: 10
```

### 4. Zrestartuj HA i przetestuj

1. Restart: Settings → System → Restart
2. Test: Developer Tools → Services → `script.whatsapp_notify`

```yaml
message: "Test z Home Assistant! 🏠"
```

### 5. Dodaj automatyzacje

Skopiuj wybrane pliki YAML do HA (Automations → ⋮ → Edit in YAML lub dodaj do `automations.yaml`).

## Dostępne automatyzacje

| Plik | Opis |
|------|------|
| `pv-raport-dzienny.yaml` | Codzienny raport PV o 7:00 (produkcja, oszczędności, COP) |
| `pv-alerty.yaml` | Alerty: bateria pełna/niska, nadprodukcja, falownik offline |
| `pompa-ciepla.yaml` | Pompa: zmiana taryfy, CWU gotowe, niski COP, override, offline |
| `robot.yaml` | Robot: start/stop/błąd/pojemnik pełny/przegląd części |
| `system-alerts.yaml` | System: restart HA, aktualizacje, wysoki import, raport tygodniowy |

## Dostosowanie encji

Nazwy encji w YAML-ach odpowiadają typowej konfiguracji. Dostosuj do swoich:

| Kategoria | Przykładowe encje |
|-----------|-------------------|
| **PV/Bateria** | `sensor.inverter_battery`, `sensor.pv_power`, `sensor.grid_export_power` |
| **Pompa** | `climate.pompa_zone_1`, `sensor.cwu_temperature`, `sensor.pompa_cop` |
| **Robot** | `vacuum.robot`, `sensor.robot_cleaning_area`, `binary_sensor.robot_dustbin_full` |
| **System** | `sensor.grid_import_power`, `update.home_assistant_core_update` |

Aby znaleźć swoje encje: Developer Tools → States → szukaj po nazwie urządzenia.

## Ograniczenia CallMeBot

- **Rate limit**: max 1 wiadomość co 5 sekund
- **Długość**: do 1000 znaków na wiadomość
- **Formatowanie**: `*bold*`, `_italic_`, `~strikethrough~`
- **Dostępność**: darmowy, ale bez SLA - może być chwilowo niedostępny

## Alternatywa: Webhook przez aplikację (zaawansowane)

Możesz też wysyłać powiadomienia przez endpoint `/api/home-assistant/webhook` tej aplikacji. Zalety:

- Centralne zarządzanie i logowanie
- Automatyczna kolejka (brak problemów z rate limitem)
- Łatwa zmiana dostawcy (Twilio, Meta WhatsApp Business API)

### Setup webhook:

1. Dodaj env vars do Vercel:
   ```
   HA_WEBHOOK_SECRET=losowy-secret-32-znaki
   WHATSAPP_PHONE=48XXXXXXXXX
   WHATSAPP_APIKEY=klucz-callmebot
   ```

2. W HA `configuration.yaml`:
   ```yaml
   rest_command:
     whatsapp_via_webhook:
       url: "https://twoja-app.vercel.app/api/home-assistant/webhook"
       method: POST
       headers:
         Authorization: "Bearer TWÓJ_HA_WEBHOOK_SECRET"
         Content-Type: "application/json"
       payload: '{"title":"{{ title }}","message":"{{ message }}"}'
   ```

3. Użyj w automatyzacjach:
   ```yaml
   - action: rest_command.whatsapp_via_webhook
     data:
       title: "☀️ Raport PV"
       message: "Produkcja: 15 kWh, oszczędność: 12 PLN"
   ```

## Struktura plików

```
home-assistant/whatsapp/
├── README.md                  # Ten plik
├── configuration.yaml         # Konfiguracja HA (rest_command, script)
├── secrets.yaml.example       # Przykład secrets
├── pv-raport-dzienny.yaml     # Codzienny raport PV
├── pv-alerty.yaml             # Alerty PV (bateria, nadprodukcja, offline)
├── pompa-ciepla.yaml          # Pompa ciepła (taryfa, CWU, COP, override)
├── robot.yaml                 # Robot sprzątający
├── system-alerts.yaml         # Alerty systemowe
└── webhook-proxy.yaml         # Konfiguracja webhook proxy (opcjonalne)
```

## Rozwiązywanie problemów

### Nie przychodzą wiadomości
1. Sprawdź czy CallMeBot jest w kontaktach i czy wysłałeś "I allow callmebot..."
2. Sprawdź logi HA: Settings → System → Logs → szukaj "callmebot"
3. Przetestuj URL w przeglądarce: `https://api.callmebot.com/whatsapp.php?phone=48XXX&text=test&apikey=XXX`

### Wiadomości się nie formatują
- CallMeBot obsługuje WhatsApp formatting: `*bold*`, `_italic_`
- Znaki specjalne w URL: automatycznie kodowane przez `| urlencode`

### Rate limit (429)
- Dodaj `delay: seconds: 5` między kolejnymi wiadomościami
- Użyj `script.whatsapp_notify_with_delay` zamiast bezpośredniego wywołania
- Lub przejdź na webhook proxy (automatyczna kolejka)
