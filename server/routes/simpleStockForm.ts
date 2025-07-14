import { Request, Response } from 'express';
import { db } from '../db';
import { simpleStockForms } from '../../shared/schema';

export const simpleStockFormRoutes = {
  // Save draft
  saveDraft: async (req: Request, res: Response) => {
    try {
      console.log('Saving simple stock form draft:', req.body);
      
      const formData = {
        ...req.body,
        isDraft: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await db.insert(simpleStockForms).values(formData).returning();
      
      console.log('Draft saved successfully:', result[0]);
      res.json(result[0]);
    } catch (error) {
      console.error('Error saving draft:', error);
      res.status(500).json({ error: 'Failed to save draft' });
    }
  },

  // Submit form
  submitForm: async (req: Request, res: Response) => {
    try {
      console.log('Submitting simple stock form:', req.body);
      
      const formData = {
        ...req.body,
        isDraft: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await db.insert(simpleStockForms).values(formData).returning();
      
      console.log('Form submitted successfully:', result[0]);
      
      // Send email notification in background (non-blocking)
      if (!req.body.isDraft) {
        setImmediate(async () => {
          try {
            const { sendSimpleFormEmail } = await import('../services/simpleEmailService');
            await sendSimpleFormEmail(result[0]);
            console.log('Email sent successfully for form:', result[0].id);
          } catch (emailError) {
            console.error('Email sending failed (non-blocking):', emailError);
          }
        });
      }
      
      res.json(result[0]);
    } catch (error) {
      console.error('Error submitting form:', error);
      res.status(500).json({ error: 'Failed to submit form' });
    }
  },

  // Get all forms
  getAllForms: async (req: Request, res: Response) => {
    try {
      const forms = await db.select().from(simpleStockForms).orderBy(simpleStockForms.createdAt);
      res.json(forms);
    } catch (error) {
      console.error('Error getting forms:', error);
      res.status(500).json({ error: 'Failed to get forms' });
    }
  }
};