/**
 * Signal Parser for Rai Fair Trader Telegram Channel
 */

const ASSET_MAP = {
  "AUD/NZD OTC": "AUDNZD_otc",
  "EUR/CHF OTC": "EURCHF_otc",
  "AED/CNY OTC": "AEDCNY_otc",
  "AUD/CHF OTC": "AUDCHF_otc",
  "EUR/NZD OTC": "EURNZD_otc",
  "CHF/NOK OTC": "CHFNOK_otc",
  "AUD/USD OTC": "AUDUSD_otc",
  "AUD/CAD OTC": "AUDCAD_otc",
  "AUD/CAD": "AUDCAD",
  "EUR/USD OTC": "EURUSD_otc",
  "GBP/USD OTC": "GBPUSD_otc",
  "NZD/USD OTC": "NZDUSD_otc"
};

/**
 * Normalizes unicode keycap emojis (e.g. 4️⃣ -> 4, 5️⃣ -> 5)
 */
function cleanNumber(str) {
  if (!str) return 4;
  const digits = str.replace(/[^0-9]/g, '');
  return digits ? parseInt(digits, 10) : 4;
}

/**
 * Parses raw Telegram message text into structured trade instructions
 */
function parseSignal(text, receivedDate = new Date()) {
  if (!text || typeof text !== 'string') return null;
  if (!text.includes("SIGNAL")) return null;

  try {
    // Strip telegram markdown symbols (*, _, ~, `) that might be in the raw text
    const cleanText = text.replace(/[*_~`]/g, '');

    // 1. Extract Asset (e.g. Asset: AED/CNY OTC)
    const assetMatch = cleanText.match(/Asset:\s*([A-Za-z0-9/ ]+?(?:OTC)?)(?:\r|\n|$)/i) 
                    || cleanText.match(/Asset:\s*([A-Za-z0-9/ ]+)/i);
    if (!assetMatch) return null;
    let rawAsset = assetMatch[1].trim();

    // Map to Pocket Option asset format
    const assetKey = Object.keys(ASSET_MAP).find(k => k.toLowerCase() === rawAsset.toLowerCase()) || rawAsset;
    let pocketAsset = ASSET_MAP[assetKey] || rawAsset.replace('/', '').replace(/\s+/g, '_');
    pocketAsset = pocketAsset.replace(/_OTC/i, '_otc');

    // 2. Extract Duration (e.g. 4️⃣ MIN, 5 MIN)
    const timeMatch = cleanText.match(/Trade Time:\s*([^\r\n]+)/i);
    const minutes = timeMatch ? cleanNumber(timeMatch[1]) : 4;
    const durationSeconds = minutes * 60;

    // 3. Extract Direction (UP 🟢 / DOWN 🔴 / HIGHER / LOWER)
    const signalMatch = cleanText.match(/Signal:\s*([A-Za-z]+)/i);
    if (!signalMatch) return null;
    const rawDir = signalMatch[1].toUpperCase();
    const action = (rawDir.includes("UP") || rawDir.includes("BUY") || rawDir.includes("CALL") || rawDir.includes("HIGH")) ? "call" : "put";

    return {
      rawAsset,
      pocketAsset,
      minutes,
      durationSeconds,
      action,
      parsedAt: new Date().toISOString()
    };
  } catch (err) {
    console.error("Error parsing signal:", err);
    return null;
  }
}

module.exports = {
  parseSignal,
  ASSET_MAP
};
