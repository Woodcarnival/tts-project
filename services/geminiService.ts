
import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

// Helper to clean and parse JSON from markdown response
const parseJsonFromResponse = (text: string) => {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error("No JSON object found in response");
    
    const jsonStr = text.substring(start, end + 1);
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("JSON Parse Error:", error);
    console.log("Raw Text:", text);
    throw new Error("Failed to interpret AI response. Please try again.");
  }
};

// Retry utility with exponential backoff
const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 2000
): Promise<T> => {
  let delay = initialDelay;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      // Check for 429 or quota related errors
      const isRateLimit = error.status === 429 || 
                          error.code === 429 ||
                          (error.message && (error.message.includes('429') || error.message.includes('quota') || error.message.includes('exhausted')));
      
      if (isRateLimit) {
        if (i === maxRetries - 1) {
          throw new Error("API quota exceeded. Please try again later or slow down.");
        }
        console.warn(`Rate limit hit. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff: 2s -> 4s -> 8s
        continue;
      }

      // If it's not a rate limit error, throw immediately (unless it's a network blip, but usually we throw)
      throw error;
    }
  }
  throw new Error("Operation failed after retries");
};

export const fetchNovelMetadata = async (novelName: string): Promise<{
  exists: boolean;
  title: string;
  author: string;
  totalChapters: number;
  chapterTitles: string[];
  error?: string;
}> => {
  if (!novelName || novelName.trim().length < 2) {
    throw new Error("Novel name is too short.");
  }

  const ai = getClient();
  
  return retryWithBackoff(async () => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Search for the webnovel "${novelName}" specifically on sites like readernovel.net, lightnovelpub.org, and novelbin.com.
        
        I need metadata about this novel to create a table of contents.
        
        Return a STRICT JSON object with this exact structure (no markdown formatting outside the JSON):
        {
          "exists": boolean, // true if found on any of the specified sites
          "title": string, // The full, correct title of the novel
          "author": string, // The author's name
          "totalChapters": number, // The estimated total number of chapters (e.g., 1500). If unknown, guess based on latest chapter.
          "chapterTitles": string[] // An array containing the titles of the first 20 chapters.
        }
        
        If the novel cannot be found on these sites, set "exists" to false.`,
        config: {
          tools: [{ googleSearch: {} }],
        }
      });

      const text = response.text;
      if (!text) throw new Error("Empty response from AI");
      
      return parseJsonFromResponse(text);
    } catch (error: any) {
      console.error("Error fetching novel metadata:", error);
      throw error;
    }
  });
};

export const fetchChapterContent = async (novelName: string, chapterNumber: number, currentTitle?: string): Promise<{ content: string; title: string; sourceUrl?: string }> => {
  const ai = getClient();

  return retryWithBackoff(async () => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", 
        contents: `Search for and retrieve the full text content of Chapter ${chapterNumber} of the webnovel "${novelName}".
        ${currentTitle && !currentTitle.startsWith('Chapter') ? `The chapter title is likely "${currentTitle}".` : ''}
        
        Prioritize searching: readernovel.net, lightnovelpub.org, novelbin.com.
        
        Return a STRICT JSON object with this exact structure:
        {
          "found": boolean, // true if content is retrieved
          "title": string, // The specific title of this chapter (e.g., "The Beginning")
          "content": string // The full story text in Markdown format. Use ## for headers. Ensure it is long and complete.
        }
        
        Rules:
        1. If the text is found, "found" is true.
        2. If strictly unavailable, "found" is false.
        3. Do NOT include filler text like "Here is the chapter". Just the JSON.`,
        config: {
          tools: [{ googleSearch: {} }],
        }
      });

      const text = response.text;
      if (!text) throw new Error("Empty response from AI");

      const result = parseJsonFromResponse(text);
      
      if (!result.found || !result.content || result.content.includes("CONTENT_NOT_FOUND")) {
          throw new Error("Chapter content unavailable.");
      }
      
      let sourceUrl: string | undefined = undefined;
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks && groundingChunks.length > 0) {
          const chunk = groundingChunks.find((c: any) => c.web?.uri);
          if (chunk) sourceUrl = chunk.web.uri;
      }

      return { 
        content: result.content, 
        title: result.title || `Chapter ${chapterNumber}`,
        sourceUrl 
      };
    } catch (error: any) {
      console.error(`Error fetching chapter ${chapterNumber}:`, error);
      if (error.message && error.message.includes("JSON")) {
           throw new Error("Error parsing chapter data. Please retry.");
      }
      throw error;
    }
  });
};
