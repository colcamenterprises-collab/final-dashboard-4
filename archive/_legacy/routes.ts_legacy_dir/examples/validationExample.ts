import express from "express";
import { validateFormData } from "../utils/formValidator";

const router = express.Router();

// Example using the utility function format you requested
router.post("/submit-form-example", async (req, res) => {
  try {
    const rawData = req.body;

    // ✅ Run validation using utility function
    const { valid, errors, validatedData } = validateFormData(rawData);

    if (!valid) {
      return res.status(400).json({ success: false, errors });
    }

    // ✅ Insert `validatedData` into DB
    console.log("✅ Validation passed, saving data:", validatedData);
    // await database.save(validatedData);

    return res.status(200).json({ 
      success: true, 
      data: validatedData,
      message: "Form validated and saved successfully"
    });
  } catch (err) {
    console.error("Form submission error:", err);
    return res.status(500).json({ success: false, error: "Server error." });
  }
});

export default router;