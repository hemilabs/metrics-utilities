export const getDate = function () {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};
