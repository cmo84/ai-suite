/**
 * @description A centralized module for handling all API calls.
 */


const safetySettings = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

/**
 * Calls a Gemini text generation model.
 * @param {object} payload - The full payload for the generateContent API.
 * @param {string} modelName - The name of the model to use.
 * @returns {Promise<string>} The generated text.
 */
export async function callTextApi(payload, modelName = "gemini-2.5-flash-preview-05-20") {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${window.getSuiteApiKey()}`;
    
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
 * @param {string} aspectRatio - The desired aspect ratio for the image, e.g., "1:1", "16:9".
 * @returns {Promise<string>} The Base64 encoded image data.
 */
export async function callImageApi(payload, aspectRatio = '1:1') {
    // Model updated to stable Imagen 4.0 as only Imagen models are currently functional
    const modelName = "imagen-4.0-generate-001";
    // Endpoint updated to :predict for Imagen compatibility
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:predict?key=${window.getSuiteApiKey()}`;

    // Map Gemini-style payload to the Imagen instances/parameters schema
    const prompt = payload.contents?.[0]?.parts?.find(p => p.text)?.text || "";
    const baseImage = payload.contents?.[0]?.parts?.find(p => p.inlineData)?.inlineData?.data;

    const finalPayload = {
        instances: [
            { 
                prompt: prompt,
                image: baseImage ? { bytesBase64Encoded: baseImage } : undefined
            }
        ],
        parameters: {
            sampleCount: 1,
            aspectRatio: aspectRatio
        },
        safetySettings
    };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload)
    });

    if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);
    
    const result = await response.json();
    // Parse result based on Imagen's prediction output schema
    const base64Data = result.predictions?.[0]?.bytesBase64Encoded;
    
    if (base64Data) {
        return base64Data;
    } else {
        let reason = "No image data found in API response.";
        if (result?.error) {
             reason = `API Error: ${result.error.message}`;
        }
        throw new Error(reason);
    }
}

/**
 * Calls the Gemini TTS model.
 * @param {string} text - The text to synthesize.
 * @param {string} voiceName - The name of the voice to use.
 * @returns {Promise<{audioBase64: string, sampleRate: number}>}
 */
export async function callTtsApi(text, voiceName = 'Sulafat') {
    const payload = {
        contents: [{ parts: [{ text }] }],
        generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voiceName }
                }
            }
        },
        model: "gemini-2.5-flash-preview-tts"
    };

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${window.getSuiteApiKey()}`;

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`TTS API Error: ${response.status} ${response.statusText}`);
    const result = await response.json();
    
    const audioData = result?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    const mimeType = result?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType;

    if (audioData && mimeType && mimeType.startsWith("audio/")) {
        const sampleRateMatch = mimeType.match(/rate=(\d+)/);
        const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1], 10) : 24000;
        return { audioBase64: audioData, sampleRate };
    } else {
        throw new Error("No audio data found in TTS API response.");
    }
}