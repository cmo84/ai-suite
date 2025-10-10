/**
 * @description A centralized module for handling all API calls.
 */

let apiKey = '';

export function initializeApi(key) {
    apiKey = key;
}

const safetySettings = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

/**
 * Calls a Gemini text generation model.
 * @param {object} payload - The full payload for the generateContent API.
 * @returns {Promise<string>} The generated text.
 */
export async function callTextApi(payload) {
    const modelName = "gemini-2.5-flash-preview-05-20";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    // Ensure safety settings are included
    const finalPayload = { ...payload, safetySettings };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload)
    });

    if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);
    
    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (text) {
        return text;
    } else {
        let reason = "No text data found in API response.";
        if (result?.candidates?.[0]?.finishReason && result.candidates[0].finishReason !== 'STOP') {
             reason = `Generation stopped. Reason: ${result.candidates[0].finishReason}`;
        }
        throw new Error(reason);
    }
}

/**
 * Calls a Gemini image generation model (Flash Image).
 * @param {object} payload - The full payload for the generateContent API.
 * @returns {Promise<string>} The Base64 encoded image data.
 */
export async function callImageApi(payload) {
    const modelName = "gemini-2.5-flash-image-preview";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const finalPayload = { ...payload, safetySettings };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload)
    });

    if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);
    
    const result = await response.json();
    const base64Data = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    
    if (base64Data) {
        return base64Data;
    } else {
        let reason = "No image data found in API response.";
        if (result?.candidates?.[0]?.finishReason && result.candidates[0].finishReason !== 'STOP') {
             reason = `Generation stopped. Reason: ${result.candidates[0].finishReason}`;
        }
        throw new Error(reason);
    }
}

