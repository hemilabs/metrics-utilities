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
export function subtractDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}
