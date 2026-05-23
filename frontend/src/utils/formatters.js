export const formatLargeNumber = (num) => {
  if (!num) return '0';
  const absNum = Math.abs(num);
  if (absNum >= 1e12) return (num / 1e12).toFixed(1).replace(/\.0$/, '') + 'T';
  if (absNum >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (absNum >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (absNum >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toString();
};
