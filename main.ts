// cbBTC minute-bar bot for make.fun btc-race-24h-20261117-0603 (bars-replay/v1).
//
// Strategy: long only, one open position, all-in entries, three independent
// entry arms plus a momentum arm, exits on take-profit or trailing stop.
//   Arm A (deep washout): close >= 1.50% below the 90-bar high.
//   Arm B (dip):         close >= 1.20% below the 60-bar high.
//   Arm C (momentum):    10-bar close return above +0.50%.
//   Exit: sell all when the close rises 0.80% above the entry close, or
//   falls 0.30% below the trailing peak since entry.
// All comparisons are exact bigint cross-multiplications on the bars'
// close values, so the run is deterministic: no clock, no environment,
// no unseeded randomness. One asset (CBBTC), at most one order per reply.
//
// Uses the kit's TypeScript shim (vendor/makefun-bars.ts, byte-identical
// copy) for the bars-replay/v1 wire protocol: hello, one batch per minute,
// one reply.

import { BPS, runBars, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const MOM_LOOKBACK = 10; // bars for the momentum return
const MOM_ENTRY_BPS = 50n; // momentum: 10-bar return > +0.50% (50 bps)
const DIP60_BARS = 60; // bars for the dip reference high
const DIP60_BPS = 120n; // dip: close > 1.20% (120 bps) below the 60-bar high
const DIP90_BARS = 90; // bars for the deep-dip reference high
const DIP90_BPS = 150n; // deep dip: close > 1.50% (150 bps) below the 90-bar high
const TAKE_PROFIT_BPS = 80n; // exit: close >= entry * (1 + 0.80%)
const STOP_BPS = 30n; // exit: close < peak * (1 - 0.30%)
const MAX_SLIPPAGE_BPS = 200; // 2%: wide enough for 1-minute gaps, caps bad fills

/** CBBTC closes, bigints, in batch order. */
const closes: bigint[] = [];
/** Trailing peak close while holding. */
let peak: bigint | null = null;
/** Entry close of the current position. */
let entry: bigint | null = null;

/** The highest close of the `n` bars before the latest one, or null. */
function highBefore(n: number): bigint | null {
  if (closes.length <= n) return null;
  let hi = closes[closes.length - 1 - n];
  for (let i = closes.length - n; i < closes.length - 1; i++) {
    if (closes[i] > hi) hi = closes[i];
  }
  return hi;
}

await runBars({
  onBatch(state: BarsState) {
    const close = state.close(SYMBOL);
    if (close === null) return [];
    closes.push(close);

    const held = state.positions.get(SYMBOL);
    const holding = held !== undefined && held.qty > 0n;
    if (holding && peak === null) {
      // Position appeared (a fill) without our entry record: seed from here.
      peak = close;
      entry = close;
    }
    if (!holding) {
      peak = null;
      entry = null;
    }

    if (state.warmingUp) return [];

    if (!holding) {
      let enter = false;
      // Arm C: momentum entry, 10-bar return above +0.50%.
      if (closes.length > MOM_LOOKBACK) {
        const now = closes[closes.length - 1];
        const then = closes[closes.length - 1 - MOM_LOOKBACK];
        if (now * BPS > then * (BPS + MOM_ENTRY_BPS)) enter = true;
      }
      // Arm B: dip entry, close more than 1.20% below the 60-bar high.
      if (!enter) {
        const hi = highBefore(DIP60_BARS);
        if (hi !== null && close * BPS < hi * (BPS - DIP60_BPS)) enter = true;
      }
      // Arm A: deep-dip entry, close more than 1.50% below the 90-bar high.
      if (!enter) {
        const hi = highBefore(DIP90_BARS);
        if (hi !== null && close * BPS < hi * (BPS - DIP90_BPS)) enter = true;
      }
      if (enter) {
        const cash = state.cash;
        if (cash >= BigInt(state.hello.fees.min_notional_quote_units)) {
          peak = close;
          entry = close;
          const buy: BuyInput = { side: 'buy', symbol: SYMBOL, notional_quote_units: cash, max_slippage_bps: MAX_SLIPPAGE_BPS };
          return [buy];
        }
      }
      return [];
    }

    // Holding: update the trailing peak, then check the exits.
    if (close > peak!) peak = close;
    // Trailing stop: close < peak * (1 - STOP_BPS/BPS).
    if (close * BPS < peak! * (BPS - STOP_BPS)) {
      const sell: SellInput = { side: 'sell', symbol: SYMBOL, qty: held!.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
      return [sell];
    }
    // Take-profit: close >= entry * (1 + TAKE_PROFIT_BPS/BPS).
    if (close * BPS >= entry! * (BPS + TAKE_PROFIT_BPS)) {
      const sell: SellInput = { side: 'sell', symbol: SYMBOL, qty: held!.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
      return [sell];
    }
    return [];
  },
});
