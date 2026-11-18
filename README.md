# Automated Telegram Signal Copier for Pocket Option

A 100% autonomous, zero-cost trading bot that monitors the "RAI FAIR TRADER" Telegram channel and automatically executes trades on Pocket Option in real-time.

---

## Features
- **100% Free Hosting:** Deployable to Hugging Face Spaces (Docker) or Koyeb for 24/7 autonomous uptime with zero server costs.
- **Demo Mode Default:** Safely test and verify trades on a demo balance before risking live capital (`IS_DEMO=true`).
- **Precision Parser:** Automatically cleans unicode emojis and translates asset pairs (e.g. `AUD/NZD OTC` -> `AUDNZD_otc`).
- **Risk Protection:** Rejects stale signals (> 60s) and halts trading if the balance falls below the minimum safety floor.

---

## Quick Setup Guide

### 1. Configure `.env`
In `C:\Users\HP RYZEN\.gemini\antigravity\scratch\pocket-bot`:
Create a `.env` file (copied from `.env.example`) with:
```ini
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TARGET_CHANNEL_ID=2684722871
POCKET_SSID=your_pocket_option_ssid_here
IS_DEMO=true
TRADE_AMOUNT=10
MIN_BALANCE_FLOOR=30
```

### 2. Generate Telegram Session (One-Time)
Run the interactive authentication tool in your terminal:
```powershell
node auth_telegram.js
```
- Enter your phone number (e.g. `+1234567890`).
- Enter the login code Telegram sends to your app.
- The script automatically writes your `TELEGRAM_SESSION` into `.env`.

### 3. Run Locally (Testing)
```powershell
node index.js
```

### 4. Deploy 24/7 to the Cloud for Free (Hugging Face Spaces)
1. Go to [huggingface.co/new-space](https://huggingface.co/new-space).
2. Space Name: `signal-copier` (Set visibility to **Private**).
3. Space SDK: Select **Docker** (Blank).
4. Upload all files from `pocket-bot/` to the Space repository.
5. In Space **Settings** $\rightarrow$ **Variables and Secrets**, add your environment secrets (`TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION`, `POCKET_SSID`, `IS_DEMO=true`).
6. The Space will build and run continuously in the cloud for free.
