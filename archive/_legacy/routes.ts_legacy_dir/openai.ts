import OpenAI from "openai";

/*
Follow these instructions when using this blueprint:
1. Note that the newest OpenAI model is "gpt-4o", not "gpt-4". gpt-4o was released after your knowledge cutoff. Always prefer using gpt-4o as it is the latest model. When copying code from this blueprint, ensure you also mention this information verbatim as a comment so that you don't revert it to "gpt-4": `// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user`
2. Use the response_format: { type: "json_object" } option
3. Request output in JSON format in the prompt
*/

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface MarketingContent {
  version1: {
    headline: string;
    body: string;
    hashtags?: string[];
  };
  version2: {
    headline: string;
    body: string;
    hashtags?: string[];
  };
  version3: {
    headline: string;
    body: string;
    hashtags?: string[];
  };
}

export async function generateMarketingContent(
  burgerName: string,
  ingredients: string[],
  notes: string = "",
  outputType: "delivery" | "advertising" | "social"
): Promise<MarketingContent> {
  const systemPrompt = `You are a food branding and marketing expert writing punchy, clear, and persuasive copy for a premium burger restaurant based in Thailand. The brand is called Smash Brothers Burgers, inspired by In-N-Out, and known for juicy, hand-smashed patties, bold flavours, and no-nonsense quality.

You will be given a burger name and a list of ingredients. Based on the output type selected (Delivery Partner Description, Advertising Headline & Body, or Social Media Post), generate appropriate content.

The tone should be modern, energetic, and written to grab attention — but slightly different for each platform as outlined below.

Generate 3 different versions of content based on the selected output type. Keep them all under platform-specific limits.

If Delivery Partner, give:
- A punchy burger name/title
- A short, clear food description (max 250 characters, no emojis)

If Advertising, give:
- A headline (under 80 characters)
- A body paragraph (under 300 characters, max impact, no emojis)

If Social Media, give:
- A headline/opening line (can be informal or cheeky)
- A caption-style body (max 300 characters, OK to be more casual)
- Add 3 relevant hashtags (keep local audience in mind)

Make sure all 3 options have subtle variety — not just synonyms.

Return the response in JSON format with this structure:
{
  "version1": {
    "headline": "...",
    "body": "...",
    "hashtags": ["...", "...", "..."] // only for social media
  },
  "version2": {
    "headline": "...",
    "body": "...",
    "hashtags": ["...", "...", "..."] // only for social media
  },
  "version3": {
    "headline": "...",
    "body": "...",
    "hashtags": ["...", "...", "..."] // only for social media
  }
}`;

  const ingredientsList = ingredients.join(", ");
  const outputTypeText = outputType === "delivery" ? "Delivery Partner (e.g., GrabFood description)" 
    : outputType === "advertising" ? "Advertising (headline + short body)"
    : "Social Media (Instagram/Facebook post)";

  const userPrompt = `Burger Name: ${burgerName}

Ingredients: ${ingredientsList}

Notes (if any): ${notes}

Type of Output: ${outputTypeText}

Generate 3 different versions of content for this burger.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 1000
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result as MarketingContent;
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error("Failed to generate marketing content");
  }
}