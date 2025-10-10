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
    const imageCountInput = document.getElementById('image-count');
    const refinementPrompt = document.getElementById('refinement-prompt');
    const loader = document.getElementById('image-loader');
    const errorEl = document.getElementById('image-error');

    // --- Preview Pane Elements ---
    const previewPane = document.getElementById('txt2img-preview-pane');
    const previewImage = document.getElementById('txt2img-preview-image');
    const previewInfo = document.getElementById('txt2img-preview-info');

    // --- Initialize Gallery ---
    galleryManager = createImageGallery({
        mainContainer: document.getElementById('gallery-container'),
        recycleBinContainer: document.getElementById('recycle-bin-container'),
        recycleBinSection: document.getElementById('recycle-bin-section'),
        toggleRecycleBtn: document.getElementById('toggle-recycle-bin-btn'),
        zipBtn: downloadZipBtn,
        zipFilenamePrefix: 'txt2img-gallery',
        onSelect: (image, allImages) => {
            const refinementControls = document.getElementById('refinement-controls');
            if (image) {
                refinementControls.style.display = 'block';
                refinementPrompt.focus();
                
                previewPane.classList.remove('hidden');
                previewImage.src = `data:image/png;base64,${image.base64}`;

                let detailsHTML = `<h3 class="font-bold mb-2 break-all">${image.filename}</h3>`;
                 if (image.generationType === 'base' || image.generationType === 'upload') {
                    detailsHTML += `<p class="font-bold">Base Prompt:</p><p class="break-words">${image.prompt}</p>`;
                } else {
                    const parentImage = allImages.find(img => img.id === image.parentId);
                    detailsHTML += `<p class="font-bold">Refined from:</p><p class="break-words">${parentImage?.filename || 'Unknown'}</p>`;
                    detailsHTML += `<p class="font-bold mt-2">Refinement Prompt:</p><p class="break-words">${image.prompt}</p>`;
                }
                
                const fullPreviewHTML = `
                    <div id="image-details-content">${detailsHTML}</div>
                    <div class="mt-2">
                        <button id="describe-image-btn" class="tool-btn tool-btn-secondary text-xs py-1 px-2">✨ Describe</button>
                        <div id="image-description-container" class="mt-1 text-gray-400 bg-gray-900/50 p-2 rounded-md hidden"></div>
                    </div>`;
                previewInfo.innerHTML = fullPreviewHTML;
                
                document.getElementById('describe-image-btn').addEventListener('click', () => describeImage(image));

            } else {
                refinementControls.style.display = 'none';
                previewPane.classList.add('hidden');
            }
        },
        onPreview: (image) => shared.showImagePreview(image),
        shared: shared
    });

    async function describeImage(image) {
        const describeBtn = document.getElementById('describe-image-btn');
        const descriptionContainer = document.getElementById('image-description-container');
        
        describeBtn.disabled = true;
        describeBtn.innerHTML = '...';
        descriptionContainer.classList.remove('hidden');
        descriptionContainer.innerHTML = 'Generating description...';

        try {
            const payload = {
                contents: [{
                    parts: [
                        { text: "Describe this image in a concise but evocative paragraph." },
                        { inlineData: { mimeType: "image/png", data: image.base64 } }
                    ]
                }],
            };
            const description = await api.callTextApi(payload);
            descriptionContainer.textContent = description.trim();
        } catch (error) {
            descriptionContainer.textContent = `Error: ${error.message}`;
        } finally {
            describeBtn.disabled = false;
            describeBtn.innerHTML = '✨ Describe';
        }
    }


    // --- Load Data from DB ---
    const savedImages = await db.loadImages('txt2img');
    galleryManager.loadFromDB(savedImages);
    
    // --- Event Listeners ---
    getIdeasBtn.addEventListener('click', () => handleApiAction([getIdeasBtn, expandPromptBtn, generateBtn], loader, errorEl, async () => {
        const systemPrompt = "You are an AI assistant specialized in creating vivid and imaginative prompts for AI image generators. Provide a single, detailed, and creative sentence. Do not use markdown or formatting.";
        const idea = await api.callTextApi({ 
            contents: [{ parts: [{ text: "Generate one creative image prompt." }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] }
        });
        promptText.value = idea.trim();
    }));

    expandPromptBtn.addEventListener('click', () => handleApiAction([getIdeasBtn, expandPromptBtn, generateBtn], loader, errorEl, async () => {
        const initialPrompt = promptText.value.trim();
        if (!initialPrompt) return;
        const systemPrompt = "You are an AI assistant that expands on a user's idea to create a rich, detailed prompt. Add details about style (photorealistic, anime), composition, lighting, and mood. Transform the basic concept into a comprehensive prompt. Output only the prompt.";
        const idea = await api.callTextApi({
            contents: [{ parts: [{ text: `Expand this idea into a detailed image prompt: "${initialPrompt}"` }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] }
        });
        promptText.value = idea.trim();
    }));

    generateBtn.addEventListener('click', async () => {
        const prompt = promptText.value.trim();
        if (!prompt) return;
        const imageCount = parseInt(imageCountInput.value, 10);
        
        if (imageCount === 1) {
            // Single image generation
            await handleApiAction(generateBtn, loader, errorEl, async () => {
                const base64 = await api.callImageApi({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'] } });
                const newImage = galleryManager.addImage({ base64, prompt, generationType: 'base', parentId: null });
                await db.saveImage('txt2img', newImage);
            });
        } else {
            // Batch generation
            await handleBatchGeneration(prompt, imageCount);
        }
    });

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
        const newImage = galleryManager.addImage({ base64, prompt, generationType: 'refinement', parentId: selectedImage.id });
        await db.saveImage('txt2img', newImage);
        refinementPrompt.value = '';
    }));
    
    async function handleBatchGeneration(prompt, total) {
        let isCancelled = false;
        
        // --- Non-Modal Progress UI Elements ---
        const progressContainer = document.getElementById('generation-progress-container');
        const progressTitle = document.getElementById('progress-title');
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        const successCountEl = document.getElementById('success-count');
        const failureCountEl = document.getElementById('failure-count');
        const errorListContainer = document.getElementById('error-list-container');
        const errorList = document.getElementById('error-list');
        const closeProgressBtn = document.getElementById('close-progress-btn');
        const cancelBtn = document.getElementById('cancel-generation-btn');

        // --- Reset and Show UI ---
        progressContainer.classList.remove('hidden');
        progressTitle.textContent = 'Generation Progress';
        progressText.textContent = 'Initializing...';
        progressBar.style.width = '0%';
        successCountEl.textContent = '0';
        failureCountEl.textContent = '0';
        errorList.innerHTML = '';
        errorListContainer.classList.add('hidden');
        closeProgressBtn.classList.add('hidden');
        cancelBtn.classList.remove('hidden');
        cancelBtn.disabled = false;

        const onCancel = () => {
            isCancelled = true;
            cancelBtn.disabled = true;
            progressText.textContent = "Cancelling... waiting for current image to finish.";
        };
        cancelBtn.addEventListener('click', onCancel, { once: true });
        closeProgressBtn.onclick = () => progressContainer.classList.add('hidden');
        
        let successes = 0;
        let failures = 0;
        
        for (let i = 1; i <= total; i++) {
            if (isCancelled) break;
            progressText.textContent = `Generating image ${i} of ${total}...`;
            try {
                const base64 = await api.callImageApi({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'] } });
                const newImage = galleryManager.addImage({ base64, prompt, generationType: 'base', parentId: null });
                await db.saveImage('txt2img', newImage);
                successes++;
                successCountEl.textContent = successes;
            } catch (e) {
                failures++;
                failureCountEl.textContent = failures;
                const li = document.createElement('li');
                li.textContent = `Image ${i}: ${e.message}`;
                errorList.appendChild(li);
                errorListContainer.classList.remove('hidden');
            }
            progressBar.style.width = `${(i / total) * 100}%`;
            // Simple delay to avoid hitting rate limits too hard
            if (i < total) await new Promise(res => setTimeout(res, 500));
        }
        
        progressTitle.textContent = isCancelled ? 'Generation Cancelled' : 'Generation Complete';
        progressText.textContent = isCancelled ? 'Stopped by user.' : 'Finished.';
        cancelBtn.classList.add('hidden');
        closeProgressBtn.classList.remove('hidden');
        cancelBtn.removeEventListener('click', onCancel);
    }
}

