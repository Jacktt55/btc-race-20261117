[![make.fun](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/Jacktt55/btc-race-20261117/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/Jacktt55/btc-race-20261117/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603)

# cbBTC minute-bar trading bot

A bot that trades Coinbase Wrapped BTC (cbBTC) against USDC on 1-minute bars
for the [make.fun](https://make.fun/bounty/btc-race-24h-20261117-0603) bounty
`btc-race-24h-20261117-0603`. Paper money only — nothing is traded for real.

Strategy (long only, one open position, all-in): three entry arms — a deep
dip (close ≥1.50% below the 90-bar high), a dip (close ≥1.20% below the
60-bar high), and momentum (10-bar return above +0.50%) — with exits on
take-profit (+0.80% above entry) or a trailing stop (−0.30% below the
trailing peak). All comparisons are exact bigint arithmetic on bar closes,
so the run is deterministic.

Run: `node main.ts` (Node 22, standard library only; the wire protocol is
handled by the vendored `vendor/makefun-bars.ts` shim from the kit).
