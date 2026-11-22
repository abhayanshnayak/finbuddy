export const formatLargeNumber = (num) => {
  if (!num) return '0';
  const absNum = Math.abs(num);
  if (absNum >= 1e12) return (num / 1e12).toFixed(1).replace(/\.0$/, '') + 'T';
  if (absNum >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (absNum >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (absNum >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toString();
};

export const formatSignedCurrency = (num) => {
  if (num === null || num === undefined || Number.isNaN(num)) return '-';
  if (num === 0) return '$0';
  const absNum = Math.abs(num);
  const formatted = absNum < 1e3
    ? absNum.toFixed(2).replace(/\.00$/, '')
    : formatLargeNumber(absNum);
  return num < 0 ? `-$${formatted}` : `$${formatted}`;
};
