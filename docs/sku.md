# SKU Standard (v1.0)

**Purpose:** One unique, human-readable ID per physical card that travels through photos, listings, orders, and accounting.

## Format

POK/<LANG>-<SETCODE>-<NUMBER>-<COND>-<YYMM>-<SEQ>


**Example:** `POK/EN-BS-4-NM-2508-001`

### Fields

- **POK** — constant prefix for Pokémon cards.

- **LANG** — 2-letter language code:
  - EN (English), JA (Japanese), ZH (Chinese), KO (Korean), DE (German), FR (French), ES (Spanish), IT (Italian), PT (Portuguese)

- **SETCODE** — upper-case short code for the set (use your set index/lookup). Examples:
  - BS (Base Set), JU (Jungle), FO (Fossil), TR (Team Rocket), B2 (Base Set 2), N1 (Neo Genesis), ES (Evolving Skies), BSRS (Brilliant Stars), PGO (Pokémon Go)

- **NUMBER** — printed collector number **before the slash**, e.g.:
  - `4/102` → `4`
  - `215/203` → `215`
  - If the number includes a letter (e.g., `10a`), keep it: `10a`

- **COND** — grade bucket: `NM`, `LP`, `MP`, `HP`, `DMG`

- **YYMM** — year+month you **created the SKU** (not the card’s release), e.g. August 2025 → `2508`

- **SEQ** — three-digit sequence (`001`, `002`, …) **unique within the same YYMM** (reset monthly)

> The SKU is **immutable** once created. If condition changes, create a **new SKU**.

## File Naming Convention

Each card lives in a folder named with its SKU and contains two images:

staged/<SKU>/<SKU>_front.jpg
staged/<SKU>/<SKU>_back.jpg


**Examples**
- `staged/POK/EN-BS-4-NM-2508-001/POK-EN-BS-4-NM-2508-001_front.jpg`
- `staged/POK/JA-ES-215-LP-2509-007/POK-JA-ES-215-LP-2509-007_back.jpg`

## Where the SKU is used

- **Filesystem:** folder names and image filenames
- **Database:** primary key in `cards`, `custom_label` in `listings`
- **eBay:** `Custom Label` field
- **Accounting:** joins `sales` ↔ `cards` for P&L

## Rules & Guardrails

- Allowed characters: `A–Z 0–9 - /` (slashes only inside the `POK/` prefix and path, **not** inside fields)
- `sku` must be **globally unique**
- One **active** listing per SKU across platforms
- Never recycle SKUs; archive old ones instead

## Optional Qualifiers (future)

If you later want to encode special attributes (e.g., Reverse Holo, 1st Edition, Shadowless), add an **Item Specific** in listings rather than expanding SKU. Keep SKU stable and short.
