export const safeParse = (str) => {
  if (!str) return null;
  try {
    return typeof str === 'string' ? JSON.parse(str) : str;
  } catch (e) {
    return null; // Or return original string depending on requirement
  }
};
