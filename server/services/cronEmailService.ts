import cron from 'node-cron';
import { db } from '../db';
import { dailyStockSales, shoppingList, aiInsights } from '../../shared/schema';
import { desc, eq } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { sql } from 'drizzle-orm';
import { estimateShoppingList } from '../services/shoppingList';

// === BEGIN MANAGER QUICK CHECK: email helper ===
export async function renderManagerQuickCheckSection(salesId: number): Promise<string> {
  // header
  const [check] = await db.execute(sql`
    SELECT id, status, answeredBy, skipReason
    FROM DailyManagerCheck
    WHERE salesId = ${salesId}
    LIMIT 1;
  `) as any[];

  if (!check) return 'No record.';
  if (check.status === 'UNAVAILABLE') return 'Checklist unavailable (system).';
  if (check.status === 'SKIPPED') return `SKIPPED. Reason: ${check.skipReason || '—'}`;

  // items
  const items = await db.execute(sql`
    SELECT i.response, i.note, q.text
    FROM DailyManagerCheckItem i
    JOIN ManagerCheckQuestion q ON q.id = i.questionId
    WHERE i.dailyCheckId = ${check.id}
    ORDER BY q.id;
  `) as any[];

  const lines = [
    `Manager: ${check.answeredBy || '—'}`,
    ...items.map((i:any) => `• ${i.text} — ${i.response || '—'}${i.note ? ` (note: ${i.note})` : ''}`)
  ];
  return lines.join('\n');
}
// === END MANAGER QUICK CHECK: email helper ===

export class CronEmailService {
  private isScheduled = false;

  /**
   * Start the email cron job - runs at 9am Bangkok time
   */
  startEmailCron() {
    if (this.isScheduled) {
      console.log('Email cron already scheduled');
      return;
    }

    // Schedule for 9am Bangkok time
    cron.schedule('0 9 * * *', async () => {
      console.log('🕐 Running Daily Review email at 9am Bangkok time');
      await this.sendDailyReviewEmail();
    }, {
      timezone: 'Asia/Bangkok'
    });

    this.isScheduled = true;
    console.log('📧 Daily Review Email cron scheduled for 9am Bangkok time');
  }

  /**
   * Send comprehensive Daily Review email
   */
  async sendDailyReviewEmail() {
    try {
      const { formatInTimeZone } = await import('date-fns-tz');
      const { subDays } = await import('date-fns');
      const yesterday = formatInTimeZone(subDays(new Date(), 1), 'Asia/Bangkok', 'yyyy-MM-dd');

      console.log(`📊 Generating Daily Review email for ${yesterday}`);

      const { loadStaffForm, loadPosShift, loadDailyReview, loadFinance, buildFBvsSalesChart, rollsStatus, meatStatus, loadCanonicalSales, loadCanonicalShiftExpenses, loadCanonicalReconciliation } = await import('../email/dailyReviewData');
      const { dailySummaryTemplate } = await import('../email/templates/dailySummary');
      const { sendMail } = await import('../email/mailer');

      // Load from legacy sources
      const [form, pos, review, fin] = await Promise.all([
        loadStaffForm(yesterday),
        loadPosShift(yesterday),
        loadDailyReview(yesterday),
        loadFinance(yesterday),
      ]);

      // Load from canonical sources (PATCH: Table-based Daily Review)
      const [canonicalSales, canonicalExpenses, canonicalRecon] = await Promise.all([
        loadCanonicalSales(yesterday),
        loadCanonicalShiftExpenses(yesterday),
        loadCanonicalReconciliation(yesterday),
      ]);

      const fbVsSalesChartDataUrl =
        fin.fbExpensesMTD > 0 || fin.salesIncomeMTD > 0
          ? await buildFBvsSalesChart({ fb: fin.fbExpensesMTD, sales: fin.salesIncomeMTD })
          : undefined;

      const rStatus = rollsStatus(pos.expectedRolls, form.rollsRecorded);
      const mStatus = meatStatus(pos.expectedMeatGrams, form.meatRecordedGrams);

      // Build canonical reconciliation data
      const canonicalReconciliation = canonicalRecon ? {
        posSales: canonicalRecon.posSales,
        declaredSales: canonicalRecon.declaredSales,
        salesVariance: canonicalRecon.salesVariance,
        expectedBuns: canonicalRecon.expectedBuns,
        actualBuns: canonicalRecon.declaredBuns,
        bunVariance: canonicalRecon.bunsVariance,
        expectedMeat: canonicalRecon.expectedMeat,
        actualMeat: canonicalRecon.declaredMeat,
        meatVariance: canonicalRecon.meatVariance,
      } : null;

      const html = dailySummaryTemplate({
        dateISO: yesterday,
        form: {
          totalSales: form.totalSales,
          bankedCash: form.bankedCash,
          bankedQR: form.bankedQR,
          closingCash: form.closingCash,
          balanced: form.balanced,
          itemisedSales: form.itemisedSales,
          itemisedExpenses: form.itemisedExpenses,
        },
        pos: {
          totalSales: pos.totalSales,
          expensesTotal: pos.expensesTotal,
          expectedCash: pos.expectedCash,
          actualCash: pos.actualCash,
          balanced: pos.balanced,
          itemisedSales: pos.itemisedSales,
          itemisedExpenses: pos.itemisedExpenses,
        },
        anomalies: review.anomalies,
        managerNotes: review.managerNotes ?? null,
        mtd: {
          businessExpenses: fin.businessExpensesMTD,
          shiftExpenses: fin.shiftExpensesMTD,
          foodAndBeverageExpenses: fin.fbExpensesMTD,
          salesIncome: fin.salesIncomeMTD,
          fbVsSalesChartDataUrl,
          businessExpensesToday: fin.businessExpensesToday,
          shiftExpensesToday: fin.shiftExpensesToday,
        },
        priority: {
          rolls: {
            expected: pos.expectedRolls,
            recorded: form.rollsRecorded,
            variance: rStatus.variance,
            status: rStatus.status,
          },
          meat: {
            expectedGrams: pos.expectedMeatGrams,
            recordedGrams: form.meatRecordedGrams,
            varianceGrams: mStatus.varianceG,
            status: mStatus.status,
          },
        },
        // PATCH: Add canonical data from canonical tables
        canonical: {
          shiftExpenses: canonicalExpenses.shiftExpenses,
          totalShiftExpenses: canonicalExpenses.totalShiftExpenses,
          reconciliation: canonicalReconciliation,
          itemsByCategory: canonicalSales.itemsByCategory,
        },
      });

      const subject = `Daily Review — ${yesterday}`;
      const to = process.env.EMAIL_TO_MANAGEMENT ?? 'smashbrothersburgersth@gmail.com';

      await sendMail({ to, subject, html });
      console.log(`✅ Daily Review email sent successfully to ${to}`);
    } catch (error) {
      console.error('❌ Daily Review email failed:', error);
    }
  }

  // Keep old method for backwards compatibility (now deprecated)
  async sendDailyManagementReport() {
    try {
      const lastShiftDate = DateTime.now()
        .setZone('Asia/Bangkok')
        .minus({ days: 1 })
        .toISODate();

      console.log(`📊 [DEPRECATED] Generating old management report for ${lastShiftDate}`);

      // Get latest form data
      const form = await db
        .select()
        .from(dailyStockSales)
        .orderBy(desc(dailyStockSales.shiftDate))
        .limit(1);

      if (!form.length) {
        console.log('No form data found for daily report');
        return;
      }

      const formData = form[0];

      // Get shopping list from the new categorized endpoint
      const shoppingResponse = await fetch('http://localhost:5000/api/shopping-list');
      const shoppingData = await shoppingResponse.json();
      const { groupedList = {}, totalItems = 0 } = shoppingData;

      // Add shopping list cost estimation
      let shoppingCostData = null;
      try {
        // Get the shopping list ID (assuming it's available from formData or create a mock ID)
        const listId = formData.shoppingListId || 1; // Use actual list ID from your data
        const { total, breakdown, missingPricing } = await estimateShoppingList(listId);
        shoppingCostData = { total, breakdown, missingPricing };
      } catch (e) {
        console.error('Shopping list estimation error:', e);
        shoppingCostData = { total: 0, breakdown: [], missingPricing: [] };
      }

      // Pricing completeness diagnostic
      let pricingCompleteness = '';
      try {
        const pricingRows: any[] = await db.execute(sql`
          SELECT
            SUM(CASE WHEN package_cost IS NULL OR package_cost=0 THEN 1 ELSE 0 END)::int AS missing,
            COUNT(*)::int AS total
          FROM ingredients;
        `);
        const { missing, total } = pricingRows[0];
        if (missing / total > 0.1) {
          pricingCompleteness = `⚠️ Warning: ${missing}/${total} ingredients missing prices (>10%)`;
        }
      } catch (e) {
        console.error('Pricing completeness check error:', e);
      }

      // Get ingredients data for drinks cost calculation
      const { pool } = await import('../db');
      const ingredientsQuery = await pool.query('SELECT name, "unitCost", category FROM ingredient_v2');
      const ingredients = ingredientsQuery.rows;

      // Get latest analysis insight
      const insight = await db
        .select()
        .from(aiInsights)
        .where(eq(aiInsights.type, 'shift_analysis'))
        .orderBy(desc(aiInsights.createdAt))
        .limit(1);

      const analysisData = insight.length > 0 ? insight[0] : null;

// === BEGIN MANAGER QUICK CHECK: email section insert ===
const managerCheck = await renderManagerQuickCheckSection(formData.id);
// === END MANAGER QUICK CHECK: email section insert ===

      // Generate email content
      const htmlContent = this.generateEmailHTML(lastShiftDate || '', formData, { groupedList, totalItems }, analysisData, ingredients, managerCheck, shoppingCostData, pricingCompleteness);

      // Send email using Gmail API
      await this.sendEmail(htmlContent, lastShiftDate || '');

      console.log(`✅ Daily management report sent for ${lastShiftDate}`);
    } catch (error) {
      console.error('❌ Error sending daily management report:', error);
    }
  }

  /**
   * Generate HTML email content
   */
  private generateEmailHTML(date: string, formData: any, shoppingData: { groupedList: any, totalItems: number }, analysisData: any, ingredients: any[] = [], managerCheck: string = '', shoppingCostData: any = null, pricingCompleteness: string = ''): string {
    const balanceStatus = analysisData?.description?.includes('No anomalies') ? 'Yes' : 'No';
    const anomalies = analysisData?.description || 'No analysis available';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; }
          .section { margin: 20px 0; padding: 15px; border: 1px solid #e0e0e0; border-radius: 5px; }
          .metric { display: inline-block; margin: 10px 20px 10px 0; }
          .balance-yes { color: #28a745; font-weight: bold; }
          .balance-no { color: #dc3545; font-weight: bold; }
          .shopping-item { margin: 5px 0; padding: 5px; background-color: #f8f9fa; }
          ul { list-style-type: none; padding: 0; }
          li { margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🍔 Smash Brothers Burgers - Daily Management Report</h1>
          <p><strong>Date:</strong> ${date}</p>
          <p><strong>Generated:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })} (Bangkok Time)</p>
        </div>

        <div class="section">
          <h2>📊 Form Summary</h2>
          <div class="metric">
            <strong>Total Sales:</strong> ฿${(formData.totalSales || 0).toLocaleString()}
          </div>
          <div class="metric">
            <strong>Total Expenses:</strong> ฿${(formData.totalExpenses || 0).toLocaleString()}
          </div>
          <div class="metric">
            <strong>Cash Sales:</strong> ฿${(formData.cashSales || 0).toLocaleString()}
          </div>
          <div class="metric">
            <strong>Completed By:</strong> ${formData.completedBy || 'N/A'}
          </div>
          <div class="metric">
            <strong>Shift Type:</strong> ${formData.shiftType || 'N/A'}
          </div>
        </div>

        <div class="section">
          <h2>⚖️ Comparison & Balance</h2>
          <p><strong>Balance Status:</strong> 
            <span class="${balanceStatus === 'Yes' ? 'balance-yes' : 'balance-no'}">
              ${balanceStatus}
            </span>
          </p>
          <p><strong>Analysis:</strong> ${anomalies}</p>
        </div>

        <div class="section">
          <h2>✅ Manager Quick Check</h2>
          <pre style="white-space: pre-wrap; font-family: Arial, sans-serif;">${managerCheck}</pre>
        </div>

        <div class="section">
          <h2>🛒 Shopping List (${shoppingData.totalItems} items)</h2>
          ${Object.keys(shoppingData.groupedList).length > 0 ? 
            Object.entries(shoppingData.groupedList).map(([category, items]) => `
              <div class="category-section" style="margin-bottom: 20px;">
                <h3 style="color: #e74c3c; margin-bottom: 10px; border-bottom: 2px solid #e74c3c; padding-bottom: 5px;">
                  ${category} (${items.length} items)
                </h3>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
                  <thead>
                    <tr style="background-color: #f8f9fa;">
                      <th style="padding: 8px; text-align: left; border: 1px solid #e0e0e0;">Item</th>
                      <th style="padding: 8px; text-align: right; border: 1px solid #e0e0e0;">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${items.map(item => `
                      <tr>
                        <td style="padding: 8px; border: 1px solid #e0e0e0;">${item.name}</td>
                        <td style="padding: 8px; text-align: right; border: 1px solid #e0e0e0; font-weight: bold;">${item.qty}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `).join('')
            : '<p>No shopping items generated from this form.</p>'
          }
        </div>

        ${shoppingCostData ? `
          <div class="section">
            <h2>💰 Shopping List — Estimated Cost</h2>
            ${shoppingCostData.breakdown.map(b => `
              <p>• ${b.name}: ~฿${b.estimated.toFixed(2)} (${b.priceSource})</p>
            `).join('')}
            <p></p>
            <p><strong>Estimated Total: ~฿${shoppingCostData.total.toFixed(2)}</strong></p>
            ${shoppingCostData.missingPricing.length > 0 ? `
              <div style="margin-top: 15px; padding: 10px; background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px;">
                <h3 style="color: #856404; margin-top: 0;">Missing Prices (needs update)</h3>
                <p style="color: #856404;">${shoppingCostData.missingPricing.join(', ')}</p>
              </div>
            ` : ''}
          </div>
        ` : `
          <div class="section">
            <h2>💰 Shopping List — Estimated Cost</h2>
            <p>Unavailable (estimator error)</p>
          </div>
        `}

        ${(() => {
          // Get items from shopping list categories
          const drinksItems = shoppingData.groupedList['Drinks'] || [];
          const meatItems = shoppingData.groupedList['Meat'] || [];
          const breadItems = shoppingData.groupedList['Bread'] || [];
          const freshFoodItems = (shoppingData.groupedList['Fresh Food'] || []).filter(item => 
            item.name.toLowerCase().includes('bun') || item.name.toLowerCase().includes('roll') || item.name.toLowerCase().includes('bread')
          );
          
          // Combine bread and fresh food rolls/buns
          const allRollsAndBuns = [...breadItems, ...freshFoodItems];
          
          let specialSections = '';
          
          if (drinksItems.length > 0) {
            specialSections += `
              <div class="section">
                <h2>🥤 Drinks Summary</h2>
                <p><strong>${drinksItems.length} drinks items</strong> are included in the shopping list above with cost tracking:</p>
                <ul>
                  ${drinksItems.map(item => `<li>${item.name} x${item.qty}</li>`).join('')}
                </ul>
              </div>
            `;
          }
          
          if (meatItems.length > 0) {
            specialSections += `
              <div class="section">
                <h2>🥩 Meat Summary</h2>
                <p><strong>${meatItems.length} meat items</strong> are included in the shopping list above:</p>
                <ul>
                  ${meatItems.map(item => `<li>${item.name} x${item.qty}</li>`).join('')}
                </ul>
              </div>
            `;
          }
          
          if (allRollsAndBuns.length > 0) {
            specialSections += `
              <div class="section">
                <h2>🍞 Rolls & Buns Summary</h2>
                <p><strong>${allRollsAndBuns.length} rolls/buns items</strong> are included in the shopping list above:</p>
                <ul>
                  ${allRollsAndBuns.map(item => `<li>${item.name} x${item.qty}</li>`).join('')}
                </ul>
              </div>
            `;
          }
          
          return specialSections;
        })()}

        <div class="section">
          <h2>📝 Additional Notes</h2>
          <p><strong>Expense Description:</strong> ${formData.expenseDescription || 'None'}</p>
          <p><strong>Draft Status:</strong> ${formData.isDraft ? 'Draft' : 'Submitted'}</p>
          ${pricingCompleteness ? `<p style="color: #856404; font-weight: bold;">${pricingCompleteness}</p>` : ''}
        </div>

        <hr>
        <p style="color: #666; font-size: 12px;">
          This report was automatically generated by the Smash Brothers Burgers management system.
          Report generated at ${new Date().toISOString()}
        </p>
      </body>
      </html>
    `;
  }

  /**
   * Send email using Gmail API
   */
  private async sendEmail(htmlContent: string, date: string) {
    try {
      const { sendManagementSummary } = await import('./gmailService');
      
      const emailData = {
        formData: { completedBy: 'System', shiftType: 'Daily Report' },
        shoppingList: [],
        submissionTime: new Date(),
        customSubject: `🍔 Daily Management Report - ${date}`,
        customHtml: htmlContent
      };

      await sendManagementSummary(emailData);
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  /**
   * Manual trigger for testing
   */
  async sendTestReport() {
    console.log('🧪 Sending test management report');
    await this.sendDailyManagementReport();
  }
}

export const cronEmailService = new CronEmailService();