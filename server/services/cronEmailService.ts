import cron from 'node-cron';
import { db } from '../db';
import { dailyStockSales, shoppingList, aiInsights } from '../../shared/schema';
import { desc, eq } from 'drizzle-orm';
import { DateTime } from 'luxon';

export class CronEmailService {
  private isScheduled = false;

  /**
   * Start the email cron job - runs at 8am Bangkok time (1am UTC)
   */
  startEmailCron() {
    if (this.isScheduled) {
      console.log('Email cron already scheduled');
      return;
    }

    // Schedule for 8am Bangkok time (1am UTC)
    cron.schedule('0 1 * * *', async () => {
      console.log('🕐 Running daily management email at 8am Bangkok time');
      await this.sendDailyManagementReport();
    }, {
      timezone: 'UTC'
    });

    this.isScheduled = true;
    console.log('📧 Email cron scheduled for 8am Bangkok time (1am UTC)');
  }

  /**
   * Send daily management report email
   */
  async sendDailyManagementReport() {
    try {
      const lastShiftDate = DateTime.now()
        .setZone('Asia/Bangkok')
        .minus({ days: 1 })
        .toISODate();

      console.log(`📊 Generating management report for ${lastShiftDate}`);

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

      // Get shopping list for the form
      const shopping = await db
        .select()
        .from(shoppingList)
        .where(eq(shoppingList.formId, formData.id));

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

      // Generate email content
      const htmlContent = this.generateEmailHTML(lastShiftDate || '', formData, shopping, analysisData, ingredients);

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
  private generateEmailHTML(date: string, formData: any, shopping: any[], analysisData: any, ingredients: any[] = []): string {
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
          <h2>🛒 Shopping List (${shopping.length} items)</h2>
          ${shopping.length > 0 ? 
            `<ul>
              ${shopping.map(item => `
                <li class="shopping-item">
                  <strong>${item.itemName}:</strong> ${item.quantity} ${item.unit || 'units'}
                  ${item.category ? `<em>(${item.category})</em>` : ''}
                </li>
              `).join('')}
            </ul>` 
            : '<p>No shopping items generated from this form.</p>'
          }
        </div>

        ${(() => {
          // Filter drinks from shopping list with cost calculation
          const drinksRequisition = shopping.filter(item => {
            const ingredient = ingredients.find(i => 
              i.name.toLowerCase() === item.itemName.toLowerCase()
            );
            return ingredient?.category === 'Drinks';
          });
          
          if (drinksRequisition.length === 0) return '';
          
          return `
            <div class="section">
              <h2>🥤 Drinks Requisition (${drinksRequisition.length} items)</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #f8f9fa;">
                    <th style="padding: 8px; text-align: left; border: 1px solid #e0e0e0;">Item</th>
                    <th style="padding: 8px; text-align: right; border: 1px solid #e0e0e0;">Qty</th>
                    <th style="padding: 8px; text-align: right; border: 1px solid #e0e0e0;">Cost (THB)</th>
                  </tr>
                </thead>
                <tbody>
                  ${drinksRequisition.map(item => {
                    const ingredient = ingredients.find(i => 
                      i.name.toLowerCase() === item.itemName.toLowerCase()
                    );
                    const cost = item.quantity * (parseFloat(ingredient?.unitCost) || 0);
                    return `
                      <tr>
                        <td style="padding: 8px; border: 1px solid #e0e0e0;">${item.itemName}</td>
                        <td style="padding: 8px; text-align: right; border: 1px solid #e0e0e0;">${item.quantity}</td>
                        <td style="padding: 8px; text-align: right; border: 1px solid #e0e0e0; font-weight: bold;">฿${cost.toFixed(2)}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `;
        })()}

        <div class="section">
          <h2>📝 Additional Notes</h2>
          <p><strong>Expense Description:</strong> ${formData.expenseDescription || 'None'}</p>
          <p><strong>Draft Status:</strong> ${formData.isDraft ? 'Draft' : 'Submitted'}</p>
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