/**
 * @description This module handles all logic for the "Text-to-Image" tab.
 */
import * as api from 'api';
import * as db from 'db';
import { createImageGallery, handleApiAction } from 'utils';

let galleryManager;
let shared;

export async function initialize(sharedUtils) {
    shared = sharedUtils;
    // --- DOM Elements ---
    const getIdeasBtn = document.getElementById('get-ideas-btn');
    const expandPromptBtn = document.getElementById('expand-prompt-btn');
    const generateBtn = document.getElementById('generate-btn');
    const refineBtn = document.getElementById('refine-btn');
    const downloadZipBtn = document.getElementById('download-zip-btn');
    
    const promptText = document.getElementById('prompt-text');
    const refinementPrompt = document.getElementById('refinement-prompt');
    const loader = document.getElementById('image-loader');
    const errorEl = document.getElementById('image-error');

    // --- Initialize Gallery ---
    galleryManager = createImageGallery({
        mainContainer: document.getElementById('gallery-container'),
        recycleBinContainer: document.getElementById('recycle-bin-container'),
        recycleBinSection: document.getElementById('recycle-bin-section'),
        toggleRecycleBtn: document.getElementById('toggle-recycle-bin-btn'),
        zipBtn: downloadZipBtn,
        zipFilenamePrefix: 'txt2img-gallery',
        onSelect: (image) => {
            document.getElementById('refinement-controls').style.display = image ? 'block' : 'none';
            if(image) refinementPrompt.focus();
        },
        onPreview: (image) => shared.showImagePreview(image)
    });

    // --- Load Data from DB ---
    const savedImages = await db.loadImages('txt2img');
    galleryManager.loadFromDB(savedImages);
    
    // --- Event Listeners ---
    getIdeasBtn.addEventListener('click', () => handleApiAction(getIdeasBtn, loader, errorEl, async () => {
        const systemPrompt = "You are an AI assistant specialized in creating vivid and imaginative prompts for AI image generators. Provide a single, detailed, and creative sentence. Do not use markdown or formatting.";
        const idea = await api.callTextApi({ 
            contents: [{ parts: [{ text: "Generate one creative image prompt." }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] }
        });
        promptText.value = idea.trim();
    }));

    expandPromptBtn.addEventListener('click', () => handleApiAction(expandPromptBtn, loader, errorEl, async () => {
        const initialPrompt = promptText.value.trim();
        if (!initialPrompt) return;
        const systemPrompt = "You are an AI assistant that expands on a user's idea to create a rich, detailed prompt. Add details about style (photorealistic, anime), composition, lighting, and mood. Transform the basic concept into a comprehensive prompt. Output only the prompt.";
        const idea = await api.callTextApi({
            contents: [{ parts: [{ text: `Expand this idea into a detailed image prompt: "${initialPrompt}"` }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] }
        });
        promptText.value = idea.trim();
    }));

    generateBtn.addEventListener('click', () => handleApiAction(generateBtn, loader, errorEl, async () => {
        const prompt = promptText.value.trim();
        if (!prompt) return;
        const base64 = await api.callImageApi({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'] } });
        const newImage = galleryManager.addImage({ base64, prompt, generationType: 'base', parentId: null, filename: `${Date.now()}_base.png` });
        await db.saveImage('txt2img', newImage);
    }));

    refineBtn.addEventListener('click', () => handleApiAction(refineBtn, loader, errorEl, async () => {
        const prompt = refinementPrompt.value.trim();
        const selectedImage = galleryManager.getSelected();
        if (!prompt || !selectedImage) return;
        
        const payload = {
            contents: [{
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: "image/png", data: selectedImage.base64 } }
                ]
            }],
            generationConfig: { responseModalities: ['IMAGE'] }
        };
        const base64 = await api.callImageApi(payload);
        const newImage = galleryManager.addImage({ base64, prompt, generationType: 'refinement', parentId: selectedImage.id, filename: `${Date.now()}_refine.png` });
        await db.saveImage('txt2img', newImage);
        refinementPrompt.value = '';
    }));
}

