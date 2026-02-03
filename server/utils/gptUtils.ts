import OpenAI from "openai";
import winston from "winston";

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/gpt.log' })
  ]
});

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function askGPT(prompt: string, agentName?: string): Promise<string> {
  try {
    logger.info(`GPT Request from ${agentName || 'Unknown'}: ${prompt.substring(0, 100)}...`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.7
    });
    
    const result = response.choices[0].message.content || "No response generated";
    logger.info(`GPT Response for ${agentName || 'Unknown'}: ${result.substring(0, 100)}...`);
    
    return result;
  } catch (err: any) {
    logger.error(`GPT error for ${agentName || 'Unknown'}: ${err.message}`, { error: err });
    return `I'm experiencing technical difficulties right now. Please try again in a moment.`;
  }
}

export { logger };