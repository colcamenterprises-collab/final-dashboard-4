import { google } from 'googleapis';
import type { DailyStockSales } from '@shared/schema';

interface GoogleSheetsConfig {
  serviceAccountEmail: string;
  privateKey: string;
  spreadsheetId: string;
}

class GoogleSheetsService {
  private sheets: any;
  private spreadsheetId: string;
  private isAuthenticated = false;

  constructor() {
    this.spreadsheetId = process.env.GOOGLE_SHEETS_ID || '';
    this.initializeAuth();
  }

  private async initializeAuth() {
    try {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
        console.log('📋 Google Sheets: OAuth credentials not configured');
        return;
      }

      // Use OAuth2 authentication (same as Gmail API)
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'https://developers.google.com/oauthplayground'
      );

      oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      });

      this.sheets = google.sheets({ version: 'v4', auth: oauth2Client });
      this.isAuthenticated = true;
      console.log('📋 Google Sheets: OAuth authentication successful');
    } catch (error) {
      console.error('📋 Google Sheets: Authentication failed:', error);
      this.isAuthenticated = false;
    }
  }

  async createSpreadsheetIfNeeded(): Promise<string> {
    if (!this.isAuthenticated) {
      throw new Error('Google Sheets not authenticated');
    }

    try {
      // Check if spreadsheet exists
      if (this.spreadsheetId) {
        await this.sheets.spreadsheets.get({
          spreadsheetId: this.spreadsheetId,
        });
        return this.spreadsheetId;
      }

      // Create new spreadsheet
      const response = await this.sheets.spreadsheets.create({
        resource: {
          properties: {
            title: 'Restaurant Hub - Daily Stock & Sales Backup',
          },
          sheets: [
            {
              properties: {
                title: 'Daily Forms',
                gridProperties: {
                  rowCount: 1000,
                  columnCount: 30,
                },
              },
            },
          ],
        },
      });

      this.spreadsheetId = response.data.spreadsheetId;
      console.log('📋 Created new Google Spreadsheet:', this.spreadsheetId);
      
      // Add headers
      await this.setupHeaders();
      
      return this.spreadsheetId;
    } catch (error) {
      console.error('📋 Failed to create/access spreadsheet:', error);
      throw error;
    }
  }

  private async setupHeaders() {
    const headers = [
      'ID', 'Completed By', 'Shift Type', 'Shift Date', 'Starting Cash', 'Ending Cash',
      'Grab Sales', 'FoodPanda Sales', 'Aroi Dee Sales', 'QR Scan Sales', 'Cash Sales', 'Total Sales',
      'Salary Wages', 'Shopping', 'Gas Expense', 'Total Expenses', 'Expense Description',
      'Burger Buns Stock', 'Rolls Ordered', 'Meat Weight', 'Drink Stock Count',
      'Fresh Food', 'Frozen Food', 'Shelf Items', 'Kitchen Items', 'Packaging Items',
      'Wage Entries', 'Shopping Entries', 'Receipt Photos', 'Created At', 'Updated At'
    ];

    try {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: 'Daily Forms!A1:AD1',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [headers],
        },
      });
      console.log('📋 Headers added to spreadsheet');
    } catch (error) {
      console.error('📋 Failed to add headers:', error);
    }
  }

  async backupDailyStockSales(formData: DailyStockSales): Promise<boolean> {
    if (!this.isAuthenticated) {
      console.log('📋 Google Sheets not authenticated, skipping backup');
      return false;
    }

    try {
      await this.createSpreadsheetIfNeeded();

      const row = [
        formData.id,
        formData.completedBy,
        formData.shiftType,
        formData.shiftDate?.toISOString().split('T')[0] || '',
        formData.startingCash || '0',
        formData.endingCash || '0',
        formData.grabSales || '0',
        formData.foodPandaSales || '0',
        formData.aroiDeeSales || '0',
        formData.qrScanSales || '0',
        formData.cashSales || '0',
        formData.totalSales || '0',
        formData.salaryWages || '0',
        formData.shopping || '0',
        formData.gasExpense || '0',
        formData.totalExpenses || '0',
        formData.expenseDescription || '',
        formData.burgerBunsStock || 0,
        formData.rollsOrderedCount || 0,
        formData.meatWeight || '0',
        formData.drinkStockCount || 0,
        JSON.stringify(formData.freshFood || {}),
        JSON.stringify(formData.frozenFood || {}),
        JSON.stringify(formData.shelfItems || {}),
        JSON.stringify(formData.kitchenItems || {}),
        JSON.stringify(formData.packagingItems || {}),
        JSON.stringify(formData.wageEntries || []),
        JSON.stringify(formData.shoppingEntries || []),
        JSON.stringify(formData.receiptPhotos || []),
        formData.createdAt?.toISOString() || new Date().toISOString(),
        formData.updatedAt?.toISOString() || new Date().toISOString()
      ];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Daily Forms!A:AD',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [row],
        },
      });

      console.log(`📋 Successfully backed up form ${formData.id} to Google Sheets`);
      return true;
    } catch (error) {
      console.error('📋 Failed to backup to Google Sheets:', error);
      return false;
    }
  }

  async getBackupData(): Promise<DailyStockSales[]> {
    if (!this.isAuthenticated) {
      return [];
    }

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Daily Forms!A2:AD',
      });

      const rows = response.data.values || [];
      return rows.map((row: any[]) => ({
        id: parseInt(row[0]) || 0,
        completedBy: row[1] || '',
        shiftType: row[2] || '',
        shiftDate: new Date(row[3] || Date.now()),
        startingCash: row[4] || '0',
        endingCash: row[5] || '0',
        grabSales: row[6] || '0',
        foodPandaSales: row[7] || '0',
        aroiDeeSales: row[8] || '0',
        qrScanSales: row[9] || '0',
        cashSales: row[10] || '0',
        totalSales: row[11] || '0',
        salaryWages: row[12] || '0',
        shopping: row[13] || '0',
        gasExpense: row[14] || '0',
        totalExpenses: row[15] || '0',
        expenseDescription: row[16] || '',
        burgerBunsStock: parseInt(row[17]) || 0,
        rollsOrderedCount: parseInt(row[18]) || 0,
        meatWeight: row[19] || '0',
        drinkStockCount: parseInt(row[20]) || 0,
        freshFood: row[21] ? JSON.parse(row[21]) : {},
        frozenFood: row[22] ? JSON.parse(row[22]) : {},
        shelfItems: row[23] ? JSON.parse(row[23]) : {},
        kitchenItems: row[24] ? JSON.parse(row[24]) : {},
        packagingItems: row[25] ? JSON.parse(row[25]) : {},
        wageEntries: row[26] ? JSON.parse(row[26]) : [],
        shoppingEntries: row[27] ? JSON.parse(row[27]) : [],
        receiptPhotos: row[28] ? JSON.parse(row[28]) : [],
        createdAt: new Date(row[29] || Date.now()),
        updatedAt: new Date(row[30] || Date.now()),
      }));
    } catch (error) {
      console.error('📋 Failed to retrieve backup data:', error);
      return [];
    }
  }

  isConfigured(): boolean {
    return this.isAuthenticated && !!this.spreadsheetId;
  }

  getSpreadsheetUrl(): string {
    return this.spreadsheetId 
      ? `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit`
      : '';
  }
}

export const googleSheetsService = new GoogleSheetsService();