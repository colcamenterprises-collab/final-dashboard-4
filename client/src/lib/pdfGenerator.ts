import jsPDF from 'jspdf';

interface FormData {
  completedBy: string;
  shiftType: string;
  shiftDate: string;
  grabSales: number;
  aroiDeeSales: number;
  qrScanSales: number;
  cashSales: number;
  wages: Array<{ name: string; amount: number; type: string }>;
  shopping: Array<{ item: string; amount: number; shop: string }>;
  startingCash: number;
  endingCash: number;
  bankedAmount: number;
  inventory: Record<string, number>;
}

export const generateDailyShiftPDF = (formData: FormData, formId?: number): jsPDF => {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text('Daily Sales & Stock Report', 105, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  const currentDate = new Date().toLocaleDateString();
  const currentTime = new Date().toLocaleTimeString();
  doc.text(`Generated: ${currentDate} at ${currentTime}`, 105, 30, { align: 'center' });
  
  if (formId) {
    doc.text(`Form ID: ${formId}`, 105, 37, { align: 'center' });
  }
  
  let yPosition = 50;
  
  // Shift Information
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text('Shift Information', 20, yPosition);
  yPosition += 10;
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Completed By: ${formData.completedBy}`, 20, yPosition);
  doc.text(`Shift Type: ${formData.shiftType}`, 120, yPosition);
  yPosition += 7;
  doc.text(`Shift Date: ${formData.shiftDate}`, 20, yPosition);
  yPosition += 15;
  
  // Sales Summary
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text('Sales Summary', 20, yPosition);
  yPosition += 10;
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const totalSales = formData.grabSales + formData.aroiDeeSales + formData.qrScanSales + formData.cashSales;
  
  doc.text(`Grab Sales: ฿${formData.grabSales.toLocaleString()}`, 20, yPosition);
  doc.text(`Aroi Dee Sales: ฿${formData.aroiDeeSales.toLocaleString()}`, 120, yPosition);
  yPosition += 7;
  doc.text(`QR Scan Sales: ฿${formData.qrScanSales.toLocaleString()}`, 20, yPosition);
  doc.text(`Cash Sales: ฿${formData.cashSales.toLocaleString()}`, 120, yPosition);
  yPosition += 7;
  
  doc.setFont("helvetica", "bold");
  doc.text(`TOTAL SALES: ฿${totalSales.toLocaleString()}`, 20, yPosition);
  yPosition += 15;
  
  // Expenses
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text('Expenses', 20, yPosition);
  yPosition += 10;
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  // Wages
  if (formData.wages.length > 0) {
    doc.text('Wages & Staff Payments:', 20, yPosition);
    yPosition += 5;
    
    formData.wages.forEach((wage) => {
      doc.text(`  • ${wage.name}: ฿${wage.amount.toLocaleString()} (${wage.type})`, 25, yPosition);
      yPosition += 5;
    });
    yPosition += 5;
  }
  
  // Shopping
  if (formData.shopping.length > 0) {
    doc.text('Shopping & Purchases:', 20, yPosition);
    yPosition += 5;
    
    formData.shopping.forEach((item) => {
      const shopText = item.shop ? ` from ${item.shop}` : '';
      doc.text(`  • ${item.item}: ฿${item.amount.toLocaleString()}${shopText}`, 25, yPosition);
      yPosition += 5;
    });
    yPosition += 5;
  }
  
  const totalWages = formData.wages.reduce((sum, wage) => sum + wage.amount, 0);
  const totalShopping = formData.shopping.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = totalWages + totalShopping;
  
  doc.setFont("helvetica", "bold");
  doc.text(`TOTAL EXPENSES: ฿${totalExpenses.toLocaleString()}`, 20, yPosition);
  yPosition += 15;
  
  // Cash Management
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text('Cash Management', 20, yPosition);
  yPosition += 10;
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Starting Cash: ฿${formData.startingCash.toLocaleString()}`, 20, yPosition);
  doc.text(`Ending Cash: ฿${formData.endingCash.toLocaleString()}`, 120, yPosition);
  yPosition += 7;
  doc.text(`Banked Amount: ฿${formData.bankedAmount.toLocaleString()}`, 20, yPosition);
  yPosition += 15;
  
  // Stock Counts Summary (only non-zero items)
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text('Stock Counts (Non-Zero Items)', 20, yPosition);
  yPosition += 10;
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  const nonZeroStock = Object.entries(formData.inventory).filter(([_, value]) => value > 0);
  
  if (nonZeroStock.length > 0) {
    let column = 0;
    nonZeroStock.forEach(([item, quantity]) => {
      const xPos = 20 + (column * 90);
      doc.text(`${item}: ${quantity}`, xPos, yPosition);
      
      column++;
      if (column >= 2) {
        column = 0;
        yPosition += 5;
      }
    });
    
    if (column > 0) yPosition += 5;
  } else {
    doc.text('No stock items recorded', 20, yPosition);
    yPosition += 5;
  }
  
  yPosition += 10;
  
  // Financial Summary
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text('Financial Summary', 20, yPosition);
  yPosition += 10;
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const netCashFlow = totalSales - totalExpenses;
  
  doc.text(`Total Sales: ฿${totalSales.toLocaleString()}`, 20, yPosition);
  yPosition += 7;
  doc.text(`Total Expenses: ฿${totalExpenses.toLocaleString()}`, 20, yPosition);
  yPosition += 7;
  
  doc.setFont("helvetica", "bold");
  const netColor = netCashFlow >= 0 ? 'black' : 'red';
  doc.setTextColor(netColor === 'red' ? 255 : 0, 0, 0);
  doc.text(`Net Cash Flow: ฿${netCashFlow.toLocaleString()}`, 20, yPosition);
  doc.setTextColor(0, 0, 0); // Reset to black
  
  // Footer
  yPosition = 280;
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text('This document was automatically generated by the Restaurant Management System', 105, yPosition, { align: 'center' });
  
  return doc;
};

export const downloadPDF = (doc: jsPDF, filename: string) => {
  doc.save(filename);
};

export const generatePDFBlob = (doc: jsPDF): Blob => {
  return doc.output('blob');
};