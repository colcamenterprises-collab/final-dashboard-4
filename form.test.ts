import { describe, it, expect } from '@jest/globals';
import { z } from 'zod';
import { app } from '../server'; // Adjust path to your Express app
import request from 'supertest';

// Shared Zod schema example for daily_stock_sales form
const formSchema = z.object({
  completedBy: z.string().min(1),
  shiftType: z.enum(['morning', 'evening']), // Adjust as needed
  shiftDate: z.string().datetime(),
  // Add other fields...
});

describe('End-of-Shift Form API', () => {
  it('should validate and save form data', async () => {
    const validData = {
      completedBy: 'Staff1',
      shiftType: 'evening',
      shiftDate: '2025-07-16T00:00:00Z',
      // Fill rest...
    };
    const response = await request(app)
      .post('/api/daily-stock-sales') // Adjust endpoint
      .send(validData)
      .expect(201);
    expect(response.body).toHaveProperty('id');
  });

  it('should reject invalid form data', async () => {
    const invalidData = { completedBy: '' }; // Missing fields
    await request(app)
      .post('/api/daily-stock-sales')
      .send(invalidData)
      .expect(400);
  });
});