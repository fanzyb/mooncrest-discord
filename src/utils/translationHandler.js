import fetch from "node-fetch";

export async function translateText(text, sourceLang, targetLang, bidirectional = false) {
    if (!text) return null;

    // Access key lazily to avoid hoisting issues
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("[Translation] Missing GEMINI_API_KEY in .env");
        return null;
    }

    const modelName = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    let systemPrompt = "";
    if (bidirectional) {
        systemPrompt = `
        You are a professional translator.
        The input text is likely in either "${sourceLang}" or "${targetLang}".
        
        INSTRUCTIONS:
        1. Detect the language of the input text.
        2. If the text is in "${sourceLang}", translate it to "${targetLang}".
        3. If the text is in "${targetLang}", translate it to "${sourceLang}".
        4. If it is unclear, default to translating to "${targetLang}".
        5. OUTPUT ONLY THE TRANSLATED TEXT. No explanations, no "Here is the translation", no quotes.
        `;
    } else {
        systemPrompt = `
        You are a professional translator.
        Translate the following text from "${sourceLang}" to "${targetLang}".
        
        INSTRUCTIONS:
        1. If the text is already in "${targetLang}", return it exactly as is.
        2. OUTPUT ONLY THE TRANSLATED TEXT. No explanations.
        `;
    }

    const contents = [
        {
            role: "user",
            parts: [{ text: text }]
        }
    ];

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: contents,
                systemInstruction: { parts: [{ text: systemPrompt }] }
            })
        });

        const data = await response.json();
        const translatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        return translatedText ? translatedText.trim() : null;
    } catch (error) {
        console.error("[Translation Error]", error);
        return null;
    }
}
