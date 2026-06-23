/**
 * Stock universe to screen — vendored S&P 500 snapshot (all sectors).
 *
 * Why a static list: free, reproducible, zero network dependency. It is a
 * point-in-time snapshot (= survivorship bias; the honest limitation is noted in
 * the README/plan). Tickers that can't be fetched degrade gracefully — the
 * data-quality gate drops them with a "no price data" log, never silently.
 *
 * TODO: refresh constituents periodically (quarterly). Sourced from public
 * S&P 500 membership; a handful may drift between rebalances.
 */
export const UNIVERSE: string[] = [
  // --- Information Technology ---
  "AAPL", "MSFT", "NVDA", "AVGO", "ORCL", "CRM", "AMD", "ADBE", "CSCO", "ACN",
  "INTU", "TXN", "QCOM", "IBM", "AMAT", "NOW", "ADI", "LRCX", "KLAC", "MU",
  "PANW", "SNPS", "CDNS", "ANET", "ROP", "NXPI", "MCHP", "FTNT", "ADSK", "MSI",
  "IT", "GLW", "MPWR", "HPQ", "TEL", "KEYS", "HPE", "TER", "ON", "TYL",
  "CDW", "WDC", "STX", "NTAP", "ZBRA", "GEN", "JBL", "TRMB", "SWKS", "FFIV",
  "AKAM", "ENPH", "SMCI", "PTC", "QRVO",
  // --- Communication Services ---
  "GOOGL", "GOOG", "META", "NFLX", "DIS", "TMUS", "T", "VZ", "CMCSA", "CHTR",
  "EA", "TTWO", "OMC", "WBD", "FOXA", "FOX", "NWSA", "NWS", "MTCH",
  "LYV",
  // --- Consumer Discretionary ---
  "AMZN", "TSLA", "HD", "MCD", "BKNG", "LOW", "TJX", "SBUX", "NKE", "ORLY",
  "CMG", "MAR", "GM", "F", "HLT", "AZO", "ROST", "YUM", "DHI", "LEN",
  "APTV", "PHM", "ULTA", "EBAY", "DRI", "GRMN", "LVS", "EXPE", "WYNN", "NVR",
  "TSCO", "RCL", "CCL", "NCLH", "MGM", "KMX", "POOL", "DPZ", "BBY", "TPR",
  // --- Consumer Staples ---
  "WMT", "COST", "PG", "KO", "PEP", "PM", "MO", "MDLZ", "CL", "TGT",
  "KMB", "GIS", "SYY", "KVUE", "STZ", "KDP", "MNST", "KHC", "HSY", "KR",
  "ADM", "MKC", "CHD", "CLX", "TSN", "HRL", "CAG", "SJM", "CPB",
  // --- Health Care ---
  "LLY", "UNH", "JNJ", "ABBV", "MRK", "TMO", "ABT", "ISRG", "DHR", "AMGN",
  "PFE", "BSX", "SYK", "GILD", "VRTX", "MDT", "BMY", "CI", "ELV", "REGN",
  "CVS", "ZTS", "MCK", "BDX", "HCA", "EW", "A", "IDXX", "GEHC", "IQV",
  "CNC", "HUM", "BIIB", "MRNA", "DXCM", "RMD", "COR", "CAH", "WST", "MTD",
  // --- Financials ---
  "BRK-B", "JPM", "V", "MA", "BAC", "WFC", "GS", "MS", "AXP", "SPGI",
  "BLK", "C", "SCHW", "CB", "PGR", "BX", "ICE", "CME",
  "PNC", "USB", "AON", "TFC", "APO", "COF", "PYPL", "AJG", "MCO", "AFL",
  "TRV", "BK", "AIG", "MET", "PRU", "ALL", "MSCI", "AMP", "HOOD",
  "COIN", "FIS", "GPN", "NDAQ", "WTW", "ACGL", "HIG", "STT", "TROW", "FITB",
  // --- Industrials ---
  "GE", "CAT", "RTX", "HON", "UNP", "BA", "ETN", "DE", "LMT", "UPS",
  "ADP", "GD", "TT", "PH", "NOC", "ITW", "MMM", "EMR", "CSX", "FDX",
  "NSC", "GEV", "CARR", "PCAR", "WM", "JCI", "CMI", "PWR", "RSG", "URI",
  "PAYX", "AME", "OTIS", "CPRT", "FAST", "ODFL", "ROK", "DAL", "UAL", "VRSK",
  "EFX", "DOV", "XYL", "WAB", "FTV", "HWM", "LHX", "BR", "IR", "GWW",
  // --- Energy ---
  "XOM", "CVX", "COP", "WMB", "EOG", "SLB", "OKE", "KMI", "PSX", "MPC",
  "VLO", "OXY", "FANG", "BKR", "HAL", "DVN", "TRGP", "CTRA", "EQT",
  // --- Materials ---
  "LIN", "SHW", "APD", "ECL", "FCX", "NEM", "CTVA", "DOW", "NUE", "DD",
  "VMC", "MLM", "PPG", "IFF", "ALB", "LYB", "STLD", "BALL", "AMCR", "CF",
  // --- Utilities ---
  "NEE", "SO", "DUK", "CEG", "AEP", "SRE", "D", "EXC", "XEL", "PEG",
  "ED", "VST", "PCG", "WEC", "EIX", "AWK", "DTE", "ETR", "AEE", "PPL",
  // --- Real Estate ---
  "PLD", "AMT", "EQIX", "WELL", "SPG", "PSA", "O", "CCI", "DLR", "CBRE",
  "EXR", "VICI", "AVB", "EQR", "IRM", "SBAC", "VTR", "WY", "INVH", "ARE",
];

/** Benchmark for relative-strength comparison (full-market, matches S&P 500 universe). */
export const BENCHMARK = "SPY";

/** Tickers used to assess the market regime. */
export const REGIME_TICKERS = {
  spy: "SPY",
  qqq: "QQQ",
  vix: "^VIX",
  tnx: "^TNX", // 10Y treasury yield
} as const;
