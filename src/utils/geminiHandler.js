import fetch from "node-fetch";

/**
 * Generates content using Google Gemini AI.
 * @param {string} prompt - The user prompt.
 * @param {string} systemInstruction - Optional system instruction.
 * @returns {Promise<string|null>} The generated text or null if failed.
 */
export async function generateContent(prompt, systemInstruction = "") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("[Gemini] Missing GEMINI_API_KEY in .env");
        return null;
    }

    const modelName = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const contents = [
        {
            role: "user",
            parts: [{ text: prompt }]
        }
    ];

    const body = {
        contents: contents
    };

    if (systemInstruction) {
        body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (data.error) {
            console.error("[Gemini API Error]", data.error);
            return null;
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        return text ? text.trim() : null;
    } catch (error) {
        console.error("[Gemini Network Error]", error);
        return null;
    }
}
