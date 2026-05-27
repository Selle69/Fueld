# Fueld

Fitness & Ernährungs-Tracker als Progressive Web App (PWA).

## Features

- Mahlzeiten erfassen per Suche (OpenFoodFacts) oder KI-Foto-Analyse
- Makro-Tracking mit individuellen Zielen (TDEE-basiert)
- Training: Pläne, Vorlagen und Session-Tracking
- Lokale SQLite-Datenbank im Browser (kein Server nötig)
- PWA — installierbar auf iOS und Android

## Setup

```bash
npm install
npm run dev
```

Im Netzwerk erreichbar (z.B. vom Handy):

```bash
npm run dev -- -H 0.0.0.0
```

## KI-Analyse

Kompatibel mit jedem OpenAI-kompatiblen Endpunkt. Für lokale Modelle `.env.local` anlegen:

```
NEXT_PUBLIC_AI_URL=http://<IP>:11434/v1/chat/completions
NEXT_PUBLIC_AI_MODEL=llava
NEXT_PUBLIC_AI_KEY=
```
