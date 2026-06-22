/**
 * Stock universe to screen. v1: ~100 well-known US tech names across
 * semiconductors, software, internet, hardware, and fintech.
 * TODO: expand to full S&P 500 (vendored list + SPY benchmark) once speed and
 * the scoring screener are validated on this set.
 */
export const UNIVERSE: string[] = [
  // Mega-cap / platforms
  "MSFT", "AAPL", "GOOGL", "AMZN", "META", "NVDA", "TSLA", "NFLX",
  // Semiconductors
  "AVGO", "AMD", "QCOM", "TXN", "AMAT", "LRCX", "KLAC", "MU", "ADI",
  "NXPI", "MRVL", "MCHP", "ON", "MPWR", "SWKS", "TER", "ENTG", "QRVO",
  "ARM", "SMCI", "ASML", "TSM", "STM",
  // Software — infra / security / data
  "ORCL", "CRM", "ADBE", "NOW", "INTU", "PANW", "CRWD", "FTNT", "ZS",
  "SNOW", "DDOG", "NET", "MDB", "PLTR", "TEAM", "WDAY", "ADSK",
  "CDNS", "SNPS", "ROP", "PTC", "SSNC", "DT",
  "GEN", "OKTA", "S", "TENB", "ESTC", "GTLB", "PATH",
  // Internet / consumer tech
  "UBER", "ABNB", "DASH", "SHOP", "MELI", "PYPL", "BKNG", "SPOT",
  "PINS", "SNAP", "RBLX", "DUOL", "TTD", "ROKU", "ZM", "DOCU", "TWLO",
  // Hardware / networking / devices
  "CSCO", "ANET", "DELL", "HPQ", "HPE", "WDC", "STX", "NTAP", "JBL",
  "GLW", "KEYS", "ZBRA", "FFIV",
  // Fintech / payments (XYZ = ex-Block)
  "V", "MA", "GPN", "FIS", "AFRM", "XYZ", "COIN", "HOOD",
];

/** Benchmark for relative-strength comparison in the screener. */
export const BENCHMARK = "QQQ";

/** Tickers used to assess the market regime. */
export const REGIME_TICKERS = {
  spy: "SPY",
  qqq: "QQQ",
  vix: "^VIX",
  tnx: "^TNX", // 10Y treasury yield
} as const;
