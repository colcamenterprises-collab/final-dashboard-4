import { Router } from "express";
import { db } from "../db";
import { dailyReviewComments } from "../../shared/schema";
import { eq } from "drizzle-orm";

export const dailyReviewCommentsRouter = Router();

// GET /api/daily-review-comments/:date - Get comment for specific date
dailyReviewCommentsRouter.get("/:date", async (req, res) => {
  try {
    const { date } = req.params;
    
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }

    const [comment] = await db
      .select()
      .from(dailyReviewComments)
      .where(eq(dailyReviewComments.businessDate, date))
      .limit(1);

    if (!comment) {
      return res.json({ comment: "", actualAmountBanked: null });
    }

    res.json({ 
      comment: comment.comment,
      actualAmountBanked: comment.actualAmountBanked ? parseFloat(comment.actualAmountBanked) : null
    });
  } catch (error) {
    console.error("Error fetching comment:", error);
    res.status(500).json({ error: "Failed to fetch comment" });
  }
});

// POST /api/daily-review-comments/:date - Save or update comment for a date
dailyReviewCommentsRouter.post("/:date", async (req, res) => {
  try {
    const { date } = req.params;
    const { comment, actualAmountBanked, createdBy } = req.body;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }

    if (comment !== undefined && typeof comment !== "string") {
      return res.status(400).json({ error: "Comment must be a string" });
    }

    // Upsert: update if exists, insert if not
    const [saved] = await db
      .insert(dailyReviewComments)
      .values({
        businessDate: date,
        comment: comment || "",
        actualAmountBanked: actualAmountBanked !== null && actualAmountBanked !== undefined 
          ? actualAmountBanked.toString() 
          : null,
        createdBy: createdBy || null,
      })
      .onConflictDoUpdate({
        target: dailyReviewComments.businessDate,
        set: {
          comment: comment || "",
          actualAmountBanked: actualAmountBanked !== null && actualAmountBanked !== undefined 
            ? actualAmountBanked.toString() 
            : null,
          createdBy: createdBy || null,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json({ 
      ok: true,
      message: "Review saved successfully",
      comment: saved.comment,
      actualAmountBanked: saved.actualAmountBanked ? parseFloat(saved.actualAmountBanked) : null
    });
  } catch (error) {
    console.error("Error saving comment:", error);
    res.status(500).json({ error: "Failed to save comment" });
  }
});
