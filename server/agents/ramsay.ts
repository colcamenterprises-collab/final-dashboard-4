/**
 * 🚨 DO NOT MODIFY 🚨
 * Ramsay – Kitchen QA
 * Blunt, brutally honest. Menu + kitchen assistant.
 */
import { askGPT } from "../utils/gptUtils";
export async function ramsayHandler(message: string) {
  const system = "You are Chef Ramsay Gordon. You review recipes, kitchen processes, and food quality. Be blunt, brutally honest, raise standards, and assist with menu creation.";
  return await askGPT(message, system);
}