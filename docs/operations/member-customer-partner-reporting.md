# Member, Customer and Partner Reporting

This phase keeps `ordering_orders` as the canonical sales record and builds owner reporting from those records rather than maintaining separate counters.

## Member identity
- `ordering_members` remains the permanent membership identity.
- `ordering_orders.member_id` links purchases to a member.
- Member profiles calculate order count, lifetime spend, average order value, online orders, partner-attributed orders and recent order history from live order records.

## Customer directory
- Identifiable non-member customers are derived from order mobile numbers.
- Mobile numbers are normalized for grouping and matched to an existing member when possible.
- The customer directory reports first order, last order, order count, lifetime spend, average order value and online-order count.
- No duplicate customer sales table is introduced.

## Partner venue reporting
- Partner QR scan events remain the source for scan counts.
- Attributed orders remain linked by `partner_venue_id`.
- Venue reports calculate scans, attributed orders, conversion rate, sales, average order value, member count, known-customer count and recent attributed orders.

## Schema safety
Reporting ensures optional POS metadata columns used by the reports exist with additive `ADD COLUMN IF NOT EXISTS` statements. No destructive migration is required.
