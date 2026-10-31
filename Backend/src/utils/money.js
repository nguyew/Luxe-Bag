// LuxeBag prices are whole Vietnamese dong (VND). VND has no minor unit, so every
// money amount (price, discount, shipping, total) must be a plain integer.
// Floating point decimals only appear in percentages, never in money.

const CURRENCY = 'VND';

// Round any money calculation to a whole dong.
const roundMoney = (value) => Math.round(Number(value));

const isWholeMoney = (value) => Number.isSafeInteger(Number(value)) && Number(value) >= 0;

// Legacy data mixed three scales. This guesses the intended VND amount so old
// records can be migrated; always review a --dry-run before applying it.
//   < 20        written in millions of dong (2.5  -> 2,500,000)
//   20 .. 9999  written in US dollars        (45   -> 1,130,000 at 25,000/USD, rounded to 10,000)
//   >= 10,000   already whole dong           (left unchanged)
const USD_TO_VND = 25000;
const legacyPriceToVnd = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return n;
  if (n >= 10000) return Math.round(n);
  if (n < 20) return Math.round(n * 1000000);
  return Math.round((n * USD_TO_VND) / 10000) * 10000;
};

module.exports = { CURRENCY, isWholeMoney, legacyPriceToVnd, roundMoney };
