/**
 * Financial domain helpers: bias polarity, 3-tier growth semantics,
 * client-side What-If valuation math (matching backend calculator.py),
 * and contextual glossary definitions.
 */

// Questions where "YES" (answer === true) is a POSITIVE / CLEAR outcome rather than a risk flag.
const POSITIVE_YES_PATTERNS = [
  /10-k\s*footnotes.*read/i,
  /footnotes\s*been\s*read/i,
  /within\s*(our|the)\s*circle\s*of\s*competence/i,
  /moat\s*(strong|intact|durable)/i,
];

/**
 * Evaluates a confirmation bias checklist item with proper semantic polarity.
 * Fixes the bug where "Have the 10-K footnotes been read? YES" was previously flagged red.
 */
export function evaluateBiasItem(item) {
  const question = item?.question || '';
  const answer = Boolean(item?.answer);
  const isPositiveYesQuestion = POSITIVE_YES_PATTERNS.some((rx) => rx.test(question));
  const isFlag = isPositiveYesQuestion ? !answer : answer;

  return {
    isFlag,
    isPositiveYesQuestion,
    answerText: answer ? 'YES' : 'NO',
    statusLabel: isFlag ? 'Risk Flag' : 'Clear',
  };
}

/**
 * 3-tier growth rate classification for Rule #1 Big 4 CAGR table.
 * Avoids painting healthy positive growth (e.g. +9.5%) bright red.
 */
export function getGrowthTier(rate) {
  if (rate === null || rate === undefined || Number.isNaN(rate)) {
    return {
      tier: 'unavailable',
      label: 'N/A',
      textClass: 'text-ink-muted',
      dotClass: 'bg-slate-400',
    };
  }
  if (rate >= 0.1) {
    return {
      tier: 'target',
      label: 'Meets ≥10% hurdle',
      textClass: 'text-emerald-600 dark:text-emerald-400',
      dotClass: 'bg-emerald-500',
    };
  }
  if (rate >= 0) {
    return {
      tier: 'moderate',
      label: 'Positive (<10%)',
      textClass: 'text-amber-600 dark:text-amber-400',
      dotClass: 'bg-amber-500',
    };
  }
  return {
    tier: 'negative',
    label: 'Contracting (<0%)',
    textClass: 'text-rose-600 dark:text-rose-400',
    dotClass: 'bg-rose-500',
  };
}

/**
 * Client-side deterministic valuation recalculation matching backend calculator.py
 * for the interactive What-If Sensitivity Workbench.
 */
export function computeWhatIfValuation({
  currentEps = 0,
  latestFcf = 0,
  marketCap = 0,
  sharesOutstanding = 0,
  growthRate = 0.12,
  exitPe = 20,
  marr = 0.15,
}) {
  const safeGr = Number(growthRate) || 0;
  const safePe = Math.max(1, Number(exitPe) || 1);
  const safeMarr = Math.max(0.01, Number(marr) || 0.15);

  // MOS / Sticker Price
  const compoundFactor = Math.pow(1 + safeGr, 10);
  const futureEps = currentEps * compoundFactor;
  const futurePrice = futureEps * safePe;
  const stickerPrice = futurePrice / Math.pow(1 + safeMarr, 10);
  const mosPrice = stickerPrice / 2;
  const impliedMarketCap =
    sharesOutstanding > 0 && futurePrice > 0 ? futurePrice * sharesOutstanding : 0;

  // Payback Time
  let paybackYears = 0;
  let runningFcf = latestFcf;
  let cumulativeFcf = 0;
  const projectedSeries = [];

  if (latestFcf > 0) {
    for (let yr = 1; yr <= 10; yr += 1) {
      runningFcf = runningFcf * (1 + safeGr);
      cumulativeFcf += runningFcf;
      let isPayback = false;
      if (marketCap > 0 && cumulativeFcf >= marketCap && paybackYears === 0) {
        paybackYears = yr;
        isPayback = true;
      }
      projectedSeries.push({
        year: yr,
        growth_rate: safeGr,
        fcf: runningFcf,
        cumulative_fcf: cumulativeFcf,
        is_payback_year: isPayback,
      });
    }
  }

  return {
    compoundFactor,
    futureEps,
    futurePrice,
    stickerPrice,
    mosPrice,
    impliedMarketCap,
    paybackYears,
    cumulativeFcf10Y: cumulativeFcf,
    projectedSeries,
  };
}

export const GLOSSARY = {
  mos: {
    title: 'Margin of Safety (MOS) Buy Price',
    summary:
      'A 50% discount off the estimated Sticker Price (Fair Value) to protect against forecasting errors and unforeseen business risks.',
    formula: 'MOS Buy Price = Sticker Price ÷ 2',
    benchmark: 'Attractive when Current Price ≤ MOS Buy Price',
  },
  sticker: {
    title: 'Sticker Price (Fair Value)',
    summary:
      'Today’s intrinsic share price needed to earn your Minimum Acceptable Rate of Return (15% MARR) over 10 years, given projected Year-10 earnings and a conservative exit P/E multiple.',
    formula: 'Future EPS × Exit P/E ÷ (1 + 0.15)¹⁰',
    benchmark: '15% MARR hurdle rate',
  },
  windageGr: {
    title: 'Effective 10-Year Windage Growth Rate',
    summary:
      'A conservative growth rate anchored by the lowest valid signal among historical OCF CAGR, analyst forward consensus, revenue growth + 5%, and a 40% cap — then linearly faded toward 12% by Year 10 if starting above 12%.',
    formula: 'min(Hist. OCF CAGR, Fwd Est., Rev CAGR + 5%, 40%) → fade to 12%',
    benchmark: 'Applied identically to EPS (MOS) and FCF (Payback)',
  },
  exitPe: {
    title: 'Conservative Year-10 Exit P/E',
    summary:
      'Prevents applying peak hyper-growth multiples to mature Year-10 earnings by taking the lowest of three conservative ceilings.',
    formula: 'min(5Y Median P/E, 2 × Year-10 Terminal GR, 30x Cap)',
    benchmark: 'Capped at 30× for mature exit',
  },
  payback: {
    title: 'Payback Time (FCF)',
    summary:
      'The number of years it takes for cumulative projected Free Cash Flow to equal the company’s entire current Market Capitalization—treating the stock like buying a private business outright.',
    formula: 'First Year where Σ Projected FCF ≥ Market Cap',
    benchmark: 'Pass: ≤ 8 Years · Reasonable: ≤ 10 Years',
  },
  ownersValue: {
    title: "Owner's Value (10-Cap Method)",
    summary:
      'Warren Buffett’s zero-growth valuation benchmark: values the business at 10× annual Owner Earnings, requiring a 10% cash yield on day one without relying on future growth assumptions.',
    formula: 'Owner Earnings = Net Income + D&A − ΔWorking Capital − |CapEx|; 10-Cap = OE × 10',
    benchmark: 'Pass: Cap Rate ≥ 10% (≤ 10× Owner Earnings)',
  },
  deltaWc: {
    title: 'Change in Non-Cash Working Capital (ΔNCWC)',
    summary:
      'Year-over-year change in non-cash current assets minus non-debt current liabilities extracted from SEC XBRL filings. Positive ΔWC consumes cash; negative ΔWC releases cash.',
    formula: 'Δ(Current Assets − Cash) − Δ(Current Liabilities − Short-Term Debt)',
    benchmark: 'Negative or low ΔWC indicates capital-light efficiency',
  },
  ruleOf40: {
    title: 'Rule of 40',
    summary:
      'Balances top-line expansion against cash generation by adding latest-year Revenue Growth Rate (%) and Free Cash Flow Margin (%).',
    formula: 'Rule of 40 = 1Y Revenue Growth % + FCF Margin %',
    benchmark: 'Pass: ≥ 40 indicates strong growth-profitability balance',
  },
  evToRevenue: {
    title: 'EV / Revenue',
    summary:
      'Enterprise Value (Market Cap + Total Debt − Cash) divided by latest annual Revenue. Useful for comparing valuation across capital structures or early-profitability companies.',
    formula: '(Market Cap + Total Debt − Cash) ÷ Latest Revenue',
    benchmark: 'Evaluate relative to gross margins and growth rate',
  },
  big4: {
    title: 'The "Big 4" Growth Numbers',
    summary:
      'Phil Town / Rule #1 core compounding metrics tracking whether Sales, Net Income, Book Value (Equity), and Operating Cash Flow are consistently growing together over 1, 3, 5, and 10 years.',
    formula: 'CAGR = (Ending Value ÷ Beginning Value)^(1/n) − 1',
    benchmark: 'Target: ≥ 10% CAGR across all four metrics',
  },
  returns: {
    title: 'ROIC & ROE (Capital Efficiency)',
    summary:
      'Return on Invested Capital (ROIC) measures how profitably management deploys both debt and equity; Return on Equity (ROE) measures net return to shareholders.',
    formula: 'ROIC = NOPAT ÷ Invested Capital · ROE = Net Income ÷ Equity',
    benchmark: 'Target: Consistently ≥ 10% over 3Y, 5Y, and 10Y',
  },
};
