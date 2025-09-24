// server/services/dailySalesAccess.ts
// Replace this with your real data access (DB query).
export async function getDailySalesByDate(dateLocal: string) {
  // Return null to skip reconciliation, or return the Daily Sales payload for that date:
  // {
  //   cashSales: number, qrSales: number, grabSales: number,
  //   aroiDeeSales: number, directSales: number, totalSales: number
  // }
  return null; // <- hook up later
}