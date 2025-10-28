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
      return res.json({ comment: "" });
    }

    res.json({ comment: comment.comment });
  } catch (error) {
    console.error("Error fetching comment:", error);
    res.status(500).json({ error: "Failed to fetch comment" });
  }
});

// POST /api/daily-review-comments - Save or update comment for a date
dailyReviewCommentsRouter.post("/", async (req, res) => {
  try {
    const { businessDate, comment, createdBy } = req.body;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }

    if (typeof comment !== "string") {
      return res.status(400).json({ error: "Comment must be a string" });
    }

    // Upsert: update if exists, insert if not
    const [saved] = await db
      .insert(dailyReviewComments)
      .values({
        businessDate,
        comment,
        createdBy: createdBy || null,
      })
      .onConflictDoUpdate({
        target: dailyReviewComments.businessDate,
        set: {
          comment,
          createdBy: createdBy || null,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json({ ok: true, comment: saved.comment });
  } catch (error) {
    console.error("Error saving comment:", error);
    res.status(500).json({ error: "Failed to save comment" });
  }
});
