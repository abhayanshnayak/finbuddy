export const formatLargeNumber = (num) => {
  if (num === null || num === undefined || Number.isNaN(num)) return '0';
  if (num === 0) return '0';
  const absNum = Math.abs(num);
  if (absNum >= 1e12) return (num / 1e12).toFixed(1).replace(/\.0$/, '') + 'T';
  if (absNum >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (absNum >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (absNum >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return Number(num).toFixed(2).replace(/\.00$/, '');
};

export const formatSignedCurrency = (num) => {
  if (num === null || num === undefined || Number.isNaN(num)) return '—';
  if (num === 0) return '$0';
  const absNum = Math.abs(num);
  const formatted =
    absNum < 1e3
      ? absNum.toFixed(2).replace(/\.00$/, '')
      : formatLargeNumber(absNum);
  return num < 0 ? `−$${formatted}` : `$${formatted}`;
};

export const formatPrice = (num) => {
  if (num === null || num === undefined || Number.isNaN(num)) return '—';
  return `$${Number(num).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const formatPercent = (ratio, decimals = 1) => {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return '—';
  return `${(ratio * 100).toFixed(decimals)}%`;
};

/**
 * Compares an intrinsic valuation price against the current stock price.
 * Positive pct means intrinsic value is above current price (undervalued / upside).
 * Negative pct means current price is above intrinsic value (overvalued / premium).
 */
export const computeValuationDelta = (intrinsicPrice, currentPrice) => {
  if (
    !intrinsicPrice ||
    !currentPrice ||
    intrinsicPrice <= 0 ||
    currentPrice <= 0
  ) {
    return null;
  }
  const diffRatio = (currentPrice - intrinsicPrice) / intrinsicPrice;
  const discountToIntrinsic = (intrinsicPrice - currentPrice) / currentPrice;
  const isAtOrBelowTarget = currentPrice <= intrinsicPrice;

  return {
    diffRatio,
    discountToIntrinsic,
    isAtOrBelowTarget,
    shortBadge: isAtOrBelowTarget
      ? `${Math.abs(discountToIntrinsic * 100).toFixed(0)}% upside to target`
      : `${Math.abs(diffRatio * 100).toFixed(0)}% above target`,
    detailedLabel: isAtOrBelowTarget
      ? `Trading ${Math.abs(((intrinsicPrice - currentPrice) / intrinsicPrice) * 100).toFixed(1)}% below target`
      : `Trading ${Math.abs(diffRatio * 100).toFixed(1)}% above target`,
  };
};

export const generateReportMarkdown = (report, growthAnalysis, businessModelArg) => {
  if (!report) return '';
  const vals = report.financials?.valuations || {};
  const dm = report.financials?.derived_metrics || {};
  const bm = businessModelArg || report.qualitative?.business_model;
  const mos = vals.margin_of_safety_price;
  const sticker = mos ? mos * 2 : null;
  const lines = [
    `# ${report.name} (${report.ticker}) — Equity Research Report`,
    '',
    `- **Price at Analysis:** ${formatPrice(report.price_at_storage)}`,
    `- **Market Cap:** ${vals.market_cap ? `$${formatLargeNumber(vals.market_cap)}` : '—'}`,
    `- **Classification:** ${[report.sector, report.subsector, report.industry_group].filter(Boolean).join(' › ')}`,
    `- **Last Updated (PST):** ${report.last_updated_pst || '—'}`,
    '',
    '## Valuation Summary',
    `| Model | Value | Status |`,
    `| :--- | ---: | :--- |`,
    `| MOS Buy Price (50% Margin) | ${formatPrice(mos)} | Sticker: ${formatPrice(sticker)} |`,
    `| Payback Time (FCF) | ${vals.payback_time_years > 0 ? `${vals.payback_time_years} yrs` : '10+ yrs'} | ${vals.payback_time_years > 0 && vals.payback_time_years <= 8 ? 'Pass (≤ 8 yrs)' : 'Fail (> 8 yrs)'} |`,
    `| Owner's Value (10-Cap) | ${vals.owners_value_per_share > 0 ? formatPrice(vals.owners_value_per_share) : 'N/A'} | Cap Rate: ${vals.cap_rate ? formatPercent(vals.cap_rate, 2) : 'N/A'} |`,
    `| Rule of 40 | ${dm.rule_of_40 !== undefined ? dm.rule_of_40.toFixed(1) : '—'} | ${dm.rule_of_40 >= 40 ? 'Pass (≥ 40)' : 'Below 40'} |`,
    `| EV / Revenue | ${dm.ev_to_revenue !== undefined ? `${dm.ev_to_revenue.toFixed(2)}x` : '—'} | — |`,
    '',
    '## Business Overview',
    report.overview || 'No overview available.',
    '',
  ];

  if (bm && (bm.executive_summary || bm.earnings_divisions?.length)) {
    lines.push('## Business Model, Unit Economics & Earnings Divisions');
    if (bm.revenue_model_archetype) {
      lines.push(`- **Model Archetype:** ${bm.revenue_model_archetype}`);
    }
    if (bm.company_unit_economics?.core_economic_unit) {
      lines.push(`- **Core Economic Unit:** ${bm.company_unit_economics.core_economic_unit}`);
    }
    if (bm.executive_summary) {
      lines.push('', bm.executive_summary);
    }
    if (bm.how_it_makes_money?.core_mechanics) {
      lines.push('', `**How It Makes Money:** ${bm.how_it_makes_money.core_mechanics}`);
    }
    if (bm.company_unit_economics?.unit_economics_summary) {
      lines.push('', `**Unit Economics:** ${bm.company_unit_economics.unit_economics_summary}`);
    }
    if (Array.isArray(bm.earnings_divisions) && bm.earnings_divisions.length > 0) {
      lines.push('', '### Earnings Reporting Divisions');
      lines.push('| Division | Share | Revenue | YoY Growth | Margin | Monetization |');
      lines.push('| :--- | ---: | ---: | ---: | ---: | :--- |');
      bm.earnings_divisions.forEach((div) => {
        const share =
          div.revenue_share_pct !== null && div.revenue_share_pct !== undefined
            ? `${div.revenue_share_pct}%`
            : '—';
        const margin =
          div.margin_pct !== null && div.margin_pct !== undefined
            ? `${div.margin_pct}%`
            : '—';
        lines.push(
          `| ${div.name || '—'} | ${share} | ${div.latest_revenue || '—'} | ${div.yoy_growth || '—'} | ${margin} | ${div.revenue_model || '—'} |`
        );
      });
    }
    lines.push('');
  }

  if (dm.growth_rates_1_3_5_10_yr) {
    lines.push('## Big 4 Growth Rates (CAGR)');
    lines.push('| Metric | 1Y | 3Y | 5Y | 10Y |');
    lines.push('| :--- | ---: | ---: | ---: | ---: |');
    Object.entries(dm.growth_rates_1_3_5_10_yr).forEach(([k, arr]) => {
      const label = k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const cells = (arr || []).map((r) => formatPercent(r, 1)).join(' | ');
      lines.push(`| ${label} | ${cells} |`);
    });
    lines.push('');
  }

  if (report.qualitative?.moats?.moat_types?.length) {
    lines.push('## Moat Analysis');
    report.qualitative.moats.moat_types.forEach((m) => {
      lines.push(`- **${m.type} (${m.strength}):** ${m.rationale}`);
    });
    lines.push('');
  }

  if (growthAnalysis) {
    lines.push('## AI Growth Company Analysis');
    [
      ['Cash Burn Strategy', growthAnalysis.cash_burn],
      ['Margin Trajectory', growthAnalysis.gross_margin],
      ['Path to Profitability', growthAnalysis.profitability_path],
      ['Runway Analysis', growthAnalysis.runway],
    ].forEach(([title, item]) => {
      if (item) {
        lines.push(`- **${title} [${item.verdict || 'N/A'}]:** ${item.justification || ''}`);
      }
    });
    lines.push('');
  }

  lines.push('---');
  lines.push('*Generated by StockClue. Informational purposes only — not financial advice.*');
  return lines.join('\n');
};
