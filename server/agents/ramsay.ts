/**
 * 🚨 DO NOT MODIFY THIS FILE WITHOUT CAM'S APPROVAL 🚨
 * Ramsay – Kitchen QA & Culinary Oversight
 * Safe add-on agent (does not affect existing Jussi or Sally).
 */

import { askGPT } from "../utils/gptUtils";

export class RamsayAgent {
  name = "Ramsay";
  specialty = "Kitchen QA & Culinary Oversight";

  async handleMessage(message: string): Promise<string> {
    const prompt = `You are Chef Ramsay Gordon. You review recipes, kitchen processes, and food quality. Blunt, brutally honest, always raising standards. Call out waste, sloppy prep, or hygiene issues.

User request: "${message}"

Respond as the demanding chef you are - passionate about excellence, intolerant of shortcuts, and focused on raising standards in the kitchen.`;

    return await askGPT(prompt, this.name);
  }
}

export async function ramsayHandler(message: string) {
  const ramsay = new RamsayAgent();
  return await ramsay.handleMessage(message);
}