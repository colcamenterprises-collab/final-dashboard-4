import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const file = path.join(__dirname, 'manager_checklist_questions.json');
  if (!fs.existsSync(file)) {
    console.log('No manager_checklist_questions.json found. Skipping.');
    return;
  }
  const list = JSON.parse(fs.readFileSync(file, 'utf8')) as Array<{
    text: string; category?: string; enabled?: boolean; weight?: number;
  }>;
  for (const q of list) {
    await prisma.managerCheckQuestion.upsert({
      where: { text: q.text },
      update: { category: q.category ?? null, enabled: q.enabled ?? true, weight: q.weight ?? 1 },
      create: { text: q.text, category: q.category ?? null, enabled: q.enabled ?? true, weight: q.weight ?? 1 }
    });
  }
  console.log(`Seeded ${list.length} manager check questions.`);
}

main().finally(() => prisma.$disconnect());