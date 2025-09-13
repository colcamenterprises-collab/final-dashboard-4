import nodemailer from "nodemailer";

export async function sendDailySalesEmail(submission: any) {
  const {
    shiftDate, completedBy, cashStart,
    cashSales, qrSales, grabSales, otherSales, directSales, totalSales, // Updated from aroiDeeSales to otherSales
    shopping = [], wages = [], otherMoneyOut = [],
    totalExpenses, endingCash, cashBanked, qrTransferred
  } = submission;

  // TRANSPORT (using existing Gmail configuration)
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { 
      user: process.env.GMAIL_USER!, 
      pass: process.env.GMAIL_APP_PASSWORD! 
    }
  });

  // Build HTML (compact, readable)
  const money = (n:number)=> new Intl.NumberFormat("th-TH",{style:"currency",currency:"THB",maximumFractionDigits:0}).format(n||0);
  const tr = (cells:string[]) => `<tr>${cells.map(c=>`<td style="padding:6px 10px;border-bottom:1px solid #eee;">${c}</td>`).join("")}</tr>`;
  const shoppingRows = shopping.length
    ? shopping.map((r:any)=> tr([r.item, r.shopName, money(r.amount)])).join("")
    : tr(['<em>No items</em>','','']);

  const wagesRows = wages.length
    ? wages.map((r:any)=> tr([r.staffName, r.type, money(r.amount)])).join("")
    : tr(['<em>No rows</em>','','']);

  const otherRows = otherMoneyOut.length
    ? otherMoneyOut.map((r:any)=> tr([r.type, r.notes||'', money(r.amount)])).join("")
    : tr(['<em>No rows</em>','','']);

  const html = `
  <div style="font-family:Poppins,system-ui,Segoe UI,Arial,sans-serif;color:#0f172a">
    <h2 style="margin:0 0 8px">Daily Sales — ${shiftDate}</h2>
    <div style="color:#6b7280;margin-bottom:16px">Submitted by ${completedBy}</div>

    <h3 style="margin:16px 0 8px">Shift Info</h3>
    <table cellspacing="0" cellpadding="0">
      ${tr(['Cash Start', money(cashStart)])}
    </table>

    <h3 style="margin:16px 0 8px">Sales</h3>
    <table cellspacing="0" cellpadding="0">
      ${tr(['Cash Sales', money(cashSales)])}
      ${tr(['QR Sales', money(qrSales)])}
      ${tr(['Grab Sales', money(grabSales)])}
      ${tr(['Other Sales', money(otherSales)])} // Updated from 'Aroi Dee Sales' to 'Other Sales'
      ${tr(['Direct Sales', money(directSales)])}
      ${tr(['<strong>Total Sales</strong>', `<strong>${money(totalSales)}</strong>`])}
    </table>

    <h3 style="margin:16px 0 8px">Expenses — Shopping</h3>
    <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%">
      ${tr(['<strong>Item</strong>','<strong>Shop</strong>','<strong>Amount</strong>'])}
      ${shoppingRows}
    </table>

    <h3 style="margin:16px 0 8px">Expenses — Wages</h3>
    <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%">
      ${tr(['<strong>Staff</strong>','<strong>Type</strong>','<strong>Amount</strong>'])}
      ${wagesRows}
    </table>

    <h3 style="margin:16px 0 8px">Expenses — Other Money Out</h3>
    <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%">
      ${tr(['<strong>Type</strong>','<strong>Notes</strong>','<strong>Amount</strong>'])}
      ${otherRows}
    </table>

    <table cellspacing="0" cellpadding="0" style="margin-top:12px">
      ${tr(['<strong>Total Expenses</strong>', `<strong>${money(totalExpenses)}</strong>`])}
    </table>

    <h3 style="margin:16px 0 8px">Summary</h3>
    <table cellspacing="0" cellpadding="0">
      ${tr(['Ending Cash', money(endingCash)])}
      ${tr(['Cash Banked', money(cashBanked)])}
      ${tr(['QR Sales Transferred', money(qrTransferred)])}
    </table>
  </div>`;

  await transporter.sendMail({
    from: `"SBB Ops" <${process.env.GMAIL_USER}>`,
    to: "smashbrothersburgersth@gmail.com",  // As specified in requirements
    cc: process.env.SALES_SUBMIT_CC || "",   // Optional CC
    subject: `Daily Sales Submitted — ${shiftDate}`,
    html
  });
}