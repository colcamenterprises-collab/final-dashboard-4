import { prisma } from "../../lib/prisma";

const QUESTIONS = [
  { section: "Raw Meat Storage", label: "Raw meat stored below cooked food", isCritical: true },
  { section: "Raw Meat Storage", label: "Meat fridge ≤ 4°C", isCritical: true },
  { section: "Raw Meat Storage", label: "Freezer ≤ -18°C", isCritical: true },
  { section: "Raw Meat Handling", label: "Separate raw meat prep area", isCritical: true },
  { section: "Raw Meat Handling", label: "Separate boards and utensils used", isCritical: true },
  { section: "Cooking Safety", label: "Burgers fully cooked (no raw centre)", isCritical: true },
  { section: "Cooking Safety", label: "No bare-hand contact with cooked food", isCritical: true },

  { section: "Frying & Hot Food", label: "Fryer oil clean and changed on schedule", isCritical: false },
  { section: "Frying & Hot Food", label: "Food not mixed between old and new batches", isCritical: false },

  { section: "Cleaning & Sanitation", label: "Prep surfaces cleaned and sanitised", isCritical: false },
  { section: "Cleaning & Sanitation", label: "Floors clean and dry", isCritical: false },
  { section: "Cleaning & Sanitation", label: "Bins emptied and lined", isCritical: false },

  { section: "Staff Hygiene", label: "Clean uniforms worn", isCritical: false },
  { section: "Staff Hygiene", label: "Hands washed correctly", isCritical: false },

  { section: "Environment & Pest Control", label: "No signs of pests", isCritical: false },

  { section: "Equipment & Safety", label: "Fire extinguisher accessible", isCritical: true },
  { section: "Equipment & Safety", label: "Fire blanket accessible", isCritical: true }
];

async function run() {
  await prisma.healthSafetyAuditItem.deleteMany();
  await prisma.healthSafetyAudit.deleteMany();
  await prisma.healthSafetyQuestion.deleteMany();

  for (let i = 0; i < QUESTIONS.length; i++) {
    await prisma.healthSafetyQuestion.create({
      data: {
        ...QUESTIONS[i],
        isActive: true,
        sortOrder: i + 1
      }
    });
  }

  console.log("✅ Health & Safety questions seeded:", QUESTIONS.length);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
