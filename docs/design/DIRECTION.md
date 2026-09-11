# EXIT design decision

Design skill: Anthropic `frontend-design`, revision `34040c9c568585f6929bedeaad110ad08f079624`. Read before implementation; original file and Apache-2.0 license preserved in references. No third-party scripts executed. Browser workflow uses the installed Playwright skill and isolated Chromium.

References inspected 2026-09-11: https://app.morpho.org/vaults offers useful browse-before-connect and explicit exposure/liquidity columns; https://app.aave.com was reachable but text extraction returned no screen content, so no claimed visual lesson. We borrow the former's task prioritization, not identity or layout.

Three compositions use identical fixture data, explicitly labeled:
- Receipt exchange: horizontal claim rows, a selected claim's divided cash/rights receipt, right-side executable offer ticket. White #FFFFFF, cloud #F4F6FA, ink #182630, cobalt #2456EB, mint #DBF0E6, coral #DC5C3C. Arial/Helvetica body and tightly set heavy sans display. The perforated transfer receipt conveys separable remaining rights; quiet tabular text supports comparison. Align labels left and financial quantities right.
- Collection map: full-width timeline aligned by remaining collection window, with trade and ownership inspector below. Same palette/data but genuinely different time-first organization. Risk: timing estimates may seem guaranteed and seller payment is farther from action.
- Dealer desk: compact three-column bid book, source dossier and settlement ticket. Plum #382C50, muted lilac #F0ECF6, white; strong compact hierarchy. Risk: bid-side jargon and density impede newcomers.

Review before building: a generic top row of KPI cards was rejected. Markets begin with the exchange itself and a visible sample receipt; no invented volume, APY or activity. The receipt is the only decorative structural motif. No price chart can imply a nonexistent market. Monospaced text is limited to addresses; no uppercase eyebrow system. Product risk remains close to financial actions. Preview, local chain, Fuji, unavailable services and fixtures are never conflated.

Selection and browser evidence will be appended after rendering and independent critique.

## Independent selection and correction

Integrator/root inspected all three rendered Markets, trade and detail screenshots and selected Receipt. Exact 9,960 payment pairs clearly with 10,000 remaining rights; perforation is memorable and ownership trail helps. Calendar overweights timing and makes exchange taller; dealer desk sacrifices receipt focus for density. Initial market rows began around y=815. The selected layout now uses a 44px headline and tighter instructional panel at desktop. Mobile places the actionable net offer before the receipt and removes redundant steps.

Corrected screenshots: `evidence/receipt-markets-desktop.png` (1440×900 viewport), `receipt-markets-1024.png`, `receipt-markets-390.png`, trade equivalents, partial detail, private-key missing, sale review and Portfolio. Initial concepts remain top-level PNGs for comparison.

## Actual verification

`node docs/design/check-browser.cjs` with Vite on 127.0.0.1:5174: PASS. Explicit fixture preview only. Browse without wallet, filter, residual inspection, stale-offer messaging, missing key, sale consent, preview settlement rejection, Portfolio labels, 1024/390 overflow, unavailable adapter without fixture fallback, keyboard skip link, zero page errors. Direct TypeScript check with Vite client types and Vite production build pass. These checks do not prove real transactions, cryptographic privacy or sponsor integration. Root owns live adapter and integrated browser evaluation.

Found and fixed: screen-reader-only table header caused overflow outside horizontal scroller; scroller now establishes positioning context. Sale review freezes displayed terms rather than silently switching quote at expiry.

`src/model.ts` contains display data/actions. Decimal strings are adapter-formatted; financial math, signatures and chain state belong to adapter. `?preview=1` is the only fixture entry; `&role=seller` is explicit owner preview. Custom maker offer supports public/private choice. Team maker known-formula disclosure says to test confidentiality with a custom private price.

Accounting semantics: expected includes all still-owned value (including cash currently held); collected is current recognized cash; withdrawn is globally removed cash; walletWithdrawn belongs to the viewer. Receipt compares globally withdrawn cash with total remaining entitlement. Portfolio can retain sold positions with realized results.
