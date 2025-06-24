export const getDate = function () {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

/**
 * Subtracts a given number of days from a Date object.
 * @param {Date} date - The original date.
 * @param {number} days - The number of days to subtract.
 * @returns {Date} A new Date object with the days subtracted.
 */
function subtractDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

/**
 * Return the unix timestamp for the beginning of yesterday (UTC)
 * */
export const getYesterday = function () {
  const yesterday = subtractDays(new Date(), 1);
  const utcYear = yesterday.getUTCFullYear();
  const utcMonth = yesterday.getUTCMonth();
  const utcDate = yesterday.getUTCDate();
  return Date.UTC(utcYear, utcMonth, utcDate) / 1000;
};
