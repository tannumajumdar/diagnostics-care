# Centre artwork

Two files are read straight off this folder by the printed bill
(`src/components/billing/BillPrint.tsx`), through `src/config/centre.ts`:

| File | Where it prints | Suggested size |
|---|---|---|
| `logo.png` | The letterhead box, top-left of the bill | ~180 x 180 px, transparent background |
| `upi-qr.png` | The "SCAN TO PAY" cell under the totals | ~300 x 300 px, the centre's own UPI QR |

Anything in this folder is served from the site root, so `logo.png` here is
`/logo.png` in the config. Neither file is required: a missing one is dropped
from the bill rather than printed as an empty box, and the "SCAN TO PAY"
caption disappears with the QR.
