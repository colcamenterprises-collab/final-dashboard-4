import { Router } from "express";
import axios from "axios";

const router = Router();

const LINE_TOKEN = process.env.LINE_NOTIFY_TOKEN;

router.post("/send", async (req, res) => {
  try {
    const { message, recipeName, ingredients } = req.body;

    if (!message && !ingredients) {
      return res.status(400).json({ error: "Message or ingredients required" });
    }

    let notifyMessage = message;
    
    if (!notifyMessage && ingredients && recipeName) {
      const ingredientList = ingredients
        .map((ing: { name: string; qty: number; unit: string; wasteAdj: number }) => 
          `- ${ing.name}: ${ing.wasteAdj.toFixed(2)} ${ing.unit}`)
        .join("\n");
      
      notifyMessage = `🍔 Recipe Approved: ${recipeName}\n\nShopping List:\n${ingredientList}`;
    }

    if (!LINE_TOKEN) {
      console.log("LINE_NOTIFY_TOKEN not configured. Mock send:");
      console.log(`[LINE MOCK] ${notifyMessage}`);
      return res.json({ 
        success: true, 
        mock: true, 
        message: "Line notification mocked (token not configured)" 
      });
    }

    const response = await axios.post(
      "https://notify-api.line.me/api/notify",
      new URLSearchParams({ message: notifyMessage }),
      {
        headers: {
          Authorization: `Bearer ${LINE_TOKEN}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    res.json({ success: true, lineResponse: response.data });
  } catch (error: any) {
    console.error("Line notification error:", error.response?.data || error.message);
    res.status(500).json({ 
      error: "Failed to send Line notification",
      details: error.response?.data || error.message 
    });
  }
});

export default router;
