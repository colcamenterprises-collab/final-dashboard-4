# Ingredient Authority (Purchasing Canonical)

## Purpose
The `ingredient_authority` table is the single source of truth for ingredient purchasing and portioning data used for deterministic cost-per-portion calculations.

## Upstream Sources
* Manual entry via the Ingredient Purchasing UI (`/operations/ingredient-purchasing`).

## Rebuild Command
* Not applicable. This table is authoritative user input and is not derived from another dataset.

## Determinism Expectations
* Derived values (`portions_per_purchase`, `cost_per_portion`, `cost_per_base_unit`) are calculated at read time from stored fields using explicit unit conversions.
* No implicit parsing or unit guessing is performed.
* When purchase and portion units differ, a conversion factor is required to make the unit relationship explicit.
