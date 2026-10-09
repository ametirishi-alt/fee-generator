# Fee Generator

## This GitHub source package

Extract this ZIP and upload the contents of the fee-generator folder to your GitHub repository, preserving the dist and tests folders. The app code is the same as the live Fee Generator. Site-specific metadata is excluded from this portable package.

To run locally, serve the dist folder with a static web server. With Python installed: python -m http.server 8000 --directory dist, then visit http://localhost:8000. Opening index.html directly from the filesystem will not run its JavaScript modules. If Node.js is installed, npm test runs the calculation checks.

A private browser calculator for financial statements and tax return estimates.

1. Select business work or individual returns.
2. Select the business pricing category and actual annual turnover, or the number of individual returns.
3. Select the items in the client's file. Set the quantity for each selected service.
4. For a ranged service, retain the fee range or select its lower or upper amount.
5. Select the GST treatment, then copy the estimate or print it to PDF.

Client and entity names are optional. Client inputs remain in the current page's memory. New quote or a page reload clears the inputs. No client data is uploaded by the calculator.

## Pricing source

All rates come from the **Price List** sheet of **Fee Quote Calculator - with uplift applied 2026-09-28 (1).xlsx**, dated 28 September 2026. The numeric rates are already uplifted. No second uplift is applied.

The **Quote Calculation** sheet has older sample rates and is not used as the rate authority. The price list describes a 0.15% turnover adjustment for applicable standalone business categories even where its example formulas are incomplete.

- Investment entity under $100,000: $1,800 flat fee.
- Investment entity under $2 million: $1,800 plus 0.15% of turnover.
- Micro business / contractor under $2 million: $3,000 plus 0.15% of turnover.
- Small business under $5 million: $3,600 with fewer than 5 employees, or $4,800 with more than 5, plus 0.15% of turnover.
- Medium group: 5–10 entities and combined turnover below $10 million. Payroll entity base $4,000, other entities at their selected base, plus 0.15% of combined turnover once.
- Large group: more than 10 entities and combined turnover above $10 million. Same group base method, plus 0.10% of combined turnover once.
- Individual return base: $420 per return. Schedules are charged on aggregate selected quantities across the returns.

The group payroll amount is copied from the price list's unchanged text, not uplifted by inference. The user must explicitly confirm that $4,000 amount before a group quote with payroll entities can be copied or printed.

The depreciation schedule source row has a $240 minimum and $180 maximum. The calculator requires an explicit choice between those amounts rather than correcting the workbook silently. Exactly $10 million of group turnover and exactly 5 employees have no separate source rule. Invalid group/category boundaries cannot produce a ready quote.

GST treatment is not stated in the source. The calculator requires a choice before preparing a shareable quote. When selected, 10% GST is added to listed fees, or the included component is calculated as 1/11 of listed fees. A no-added-GST choice is also available. Each fee line and the GST amount are rounded to cents. Displayed price ranges from the workbook are reference examples, not caps: the calculator applies the stated base and turnover rules.

## Implementation and checks

Static HTML, CSS and browser JavaScript modules, with no external dependencies. The hosting manifest serves `dist`.

`node --test tests/*.test.mjs` validates every numerical price-list rate against the source extraction and checks business/individual fees, quantity changes, turnover boundaries, groups, ranges, conflicting depreciation values, missing inputs and GST.

Optional WebMCP tools `read_fee_estimate` and `configure_fee_estimate` feature-detect browser support. They share the visible calculation state. Configuration validates inputs before committing changes and never sends a quote. Live browser WebMCP validation is unavailable in this static hosting environment.
