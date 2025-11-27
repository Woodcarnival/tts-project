
import { GoogleGenAI, Type } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

export const fetchChapterList = async (novelName: string): Promise<string[]> => {
  if (!novelName || novelName.trim().length < 2) {
    throw new Error("Novel name is too short or invalid.");
  }

  const ai = getClient();
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `List the titles of the first 100 chapters for the webnovel "${novelName}". 
      If there are fewer than 100 chapters, list all of them.
      
      Strict Rules:
      1. Return ONLY a clean JSON array of strings.
      2. The array must be ordered sequentially from Chapter 1 to Chapter 100.
      3. Do not include the chapter number in the string if it's just "Chapter X", but DO include the title.
         Example: ["The Beginning", "Meeting the King", ...]
      4. If a chapter has no title other than "Chapter X", just return "Chapter X".
      5. Verify the novel exists. If you cannot find this novel, return an empty array.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    
    const chapters = JSON.parse(text) as string[];
    
    if (chapters.length === 0) {
      throw new Error("No chapters found for this novel.");
    }
    
    return chapters;
  } catch (error) {
    console.error("Error fetching chapter list:", error);
    throw new Error("Failed to retrieve chapter list. The novel might not exist or the service is busy.");
  }
};

export const fetchChapterContent = async (novelName: string, chapterTitle: string, chapterNumber: number): Promise<{ content: string; sourceUrl?: string }> => {
  const ai = getClient();

  try {
    // We use search grounding to find the actual text content from the web
    // Specifically prioritizing the requested sources
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: `Find and retrieve the full text content for Chapter ${chapterNumber}: "${chapterTitle}" of the webnovel "${novelName}".
      
      Search Priority (try these sites first):
      - readernovel.net
      - lightnovelpub.org
      - novelbin.com
      
      Rules:
      1. Provide the story text formatted in Markdown.
      2. If the full text is copyright protected and strictly unavailable, provide a very detailed summary of the events in this chapter.
      3. Format with proper paragraph breaks.
      4. Do not include introductory phrases like "Here is the chapter". Just start with the story.
      5. If the content cannot be found after searching, return the string "CONTENT_NOT_FOUND".`,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    const content = response.text;
    
    if (!content || content.includes("CONTENT_NOT_FOUND")) {
        throw new Error("Content not found");
    }
    
    // Extract source URL if available from grounding metadata
    let sourceUrl: string | undefined = undefined;
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks && groundingChunks.length > 0) {
        // Attempt to find a valid web URL, prioritizing the preferred domains
        const preferredDomains = ['readernovel.net', 'lightnovelpub.org', 'novelbin.com'];
        
        // First try to find a chunk from preferred domains
        const preferredChunk = groundingChunks.find((c: any) => {
            if (!c.web?.uri) return false;
            return preferredDomains.some(domain => c.web.uri.includes(domain));
        });

        if (preferredChunk) {
            sourceUrl = preferredChunk.web.uri;
        } else {
            // Fallback to any web chunk
            const webChunk = groundingChunks.find((c: any) => c.web?.uri);
            if (webChunk) {
                sourceUrl = webChunk.web.uri;
            }
        }
    }

    return { content, sourceUrl };
  } catch (error) {
    console.error(`Error fetching content for ${chapterTitle}:`, error);
    throw error;
  }
};
