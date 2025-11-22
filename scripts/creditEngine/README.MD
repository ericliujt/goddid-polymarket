# Polymarket Credit Engine (Flare-Proof Version)

This module computes a credit score, LTV, and max loan for a user based entirely on the Flare-proofed Polymarket JSON.  
It requires no additional Polymarket API calls and is designed to drop directly into your lending backend.

---

## 1. How It Works (High-Level)

You pass in the exact JSON returned by Flare for a user.  
The engine:

- Parses all closed and current positions
- Derives internal performance and risk metrics
- Runs them through a logistic risk model
- Outputs:
  - creditScore (300–850 style)
  - pd (probability of default, 0–1)
  - ltv (loan-to-value ratio, 0–1)
  - maxLoan (maximum approved loan amount, in the same units as the input values)

You do not need to configure or train anything; all parameters are pre-set to reasonable defaults.

---

## 2. Installation

Add the engine file to your project structure, for example:

    src/
      polymarketCreditFlare.ts

Import where you need it:

    import {
      computeCreditFromFlare,
      FlareScoreInput,
      CreditResult
    } from "./polymarketCreditFlare";

There are no external dependencies beyond TypeScript/Node.

---

## 3. Required Input Format (Matches Flare Proof)

The function expects a single object with this shape:

    interface FlareScoreInput {
      user: {
        name: string;   // user handle or label
        value: string;  // user id / wallet / internal id
      };
      closedPositions: {
        realizedPnl: string;
        totalBought: string;
        asset: string;
      }[];
      currentPositions: {
        size: string;
        avgPrice: string;
        initialValue: string;
        currentValue: string;
        cashPnl: string;
        percentPnl: string;
        totalBought: string;
        realizedPnl: string;
        percentRealizedPnl: string;
        curPrice: string;
      }[];
    }

Key points:

- All numeric values stay as strings, exactly as Flare outputs them; the engine parses them internally.
- closedPositions and currentPositions may both be empty; the engine will still return a valid result.
- All monetary values must be in the same denomination (e.g., USDC or micro-USDC). maxLoan is returned in that same unit.

---

## 4. Example Input (Flare JSON)

Example of what you pass directly into the engine:

    {
      "user": { "name": "PringlesMax", "value": "175337" },
      "closedPositions": [
        { "realizedPnl": "416736", "totalBought": "1190675", "asset": "3544..." },
        { "realizedPnl": "392857", "totalBought": "892858",  "asset": "1976..." }
      ],
      "currentPositions": [
        {
          "size": "1263999",
          "avgPrice": "0",
          "initialValue": "303359",
          "currentValue": "0",
          "cashPnl": "-303360",
          "percentPnl": "-100",
          "totalBought": "1263999",
          "realizedPnl": "0",
          "percentRealizedPnl": "-100",
          "curPrice": "0"
        }
      ]
    }

You do not need to reshape or rename any fields as long as they match this format.

---

## 5. Basic Usage

Minimal example of calling the engine:

    const input: FlareScoreInput = flareJson; // JSON from your Flare proof
    const result: CreditResult = computeCreditFromFlare(input);

    console.log("User:", result.userName, result.userId);
    console.log("Credit score:", result.creditScore);  // e.g. 712
    console.log("LTV:", result.ltv);                  // e.g. 0.63
    console.log("Max loan:", result.maxLoan);         // in your value units

This is all you need for a working lending flow.

---

## 6. Output Format

The engine returns an object of the form:

    interface CreditResult {
      userName: string;
      userId: string;

      pd: number;          // risk of bad outcome (0–1)
      creditScore: number; // 300–850 style score
      ltv: number;         // loan-to-value ratio (0–1)
      maxLoan: number;     // maximum loan size in same units as input

      features: {
        ROI_real: number;
        WinRate: number;
        Sharpe: number;
        ProfitFactorFeature: number;
        DD_open: number;
        HHI_open: number;
        DeadShare: number;
        V_open: number;
        V_realized_plus: number;
        V_eff: number;
      };

      subscores: {
        performance: number;
        risk: number;
      };
    }

For most integrations you only need:

- creditScore – to display user quality / tier
- ltv – to decide what fraction of effective collateral you will lend against
- maxLoan – to cap the user’s borrow size

The features and subscores fields are for analytics, debugging, and tuning; you can ignore them in production if you want.

---

## 7. Backend Integration

Typical backend usage pattern:

1. Verify and decode the Flare proof for a given user.
2. Build a FlareScoreInput from the proof JSON (or pass it through directly if it already matches the schema).
3. Call computeCreditFromFlare(input).
4. Persist the key outputs:
   - creditScore
   - ltv
   - maxLoan
   - (optionally) pd for internal risk monitoring
5. Enforce borrowing logic by comparing requested amounts to maxLoan.

Example:

    const result = computeCreditFromFlare(input);

    const requested = userRequestedAmount;  // same units as input
    const canBorrow = requested <= result.maxLoan;

    if (!canBorrow) {
      // reject or clamp the amount
    }

You can also feed creditScore or pd into your interest-rate curve if you price loans dynamically.

---

## 8. Frontend Integration

On the frontend you typically:

- Display the user’s creditScore (e.g., “Your Polymarket credit score: 721”).
- Use maxLoan to configure sliders / inputs (max value = result.maxLoan).
- Show ltv as a simple percentage; for example:

    displayLtvPercent = (result.ltv * 100).toFixed(1) + "%";

Example UI constraints:

- Disable “Confirm” or “Borrow” if user’s chosen amount exceeds result.maxLoan.
- Show a message like: “You can borrow up to X based on your Polymarket activity.”

The frontend does not need to know any internal engine details.

---

## 9. Edge Cases and Safety Considerations

The engine is designed to be robust to messy or sparse data. Key behaviours:

- No closed positions:
  - N_closed = 0
  - Performance metrics default to neutral values.
  - The user receives a middle-of-the-road score and LTV.
- No current positions:
  - Open risk is low; risk metrics are mild.
  - The engine mostly looks at historical performance.
- Many positions at -100% (percentPnl <= -100):
  - DeadShare increases sharply.
  - Risk rises, creditScore and LTV drop significantly.
- All zeros or nearly zero values:
  - Treated as a “no data” / thin history case.
  - Produces a neutral score and modest LTV rather than failing.
- Extremely large numbers:
  - Internally normalized and clamped; the function will not throw due to large magnitude.

Operational guidance:

- Always treat maxLoan as the final cap:
  
      effectiveLoan = Math.min(userRequestedAmount, result.maxLoan);

- Do not rescale or transform the Flare numeric strings before passing them in; pass them untouched.
- Do not rely on features or subscores for security-critical logic; they’re for analytics. Use maxLoan and/or pd for hard risk gates.

This single README contains all you need to implement, call, and safely consume the Polymarket credit engine based on Flare proofs.
