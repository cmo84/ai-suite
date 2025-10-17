/**
 * @description This module handles all logic for the "Image Composer" tab.
 */
import * as api from 'api';
import * as db from 'db';
import { createImageGallery, handleApiAction } from 'utils';

let resultManager;
let shared;
let activeDropZone = null;

export async function initialize(sharedUtils) {
    shared = sharedUtils;
    // --- DOM Elements ---
    const composeBtn = document.getElementById('compose-btn');
    const loader = document.getElementById('composer-loader');
    const errorEl = document.getElementById('composer-error');
    const uploadInput = document.getElementById('composer-upload-input');
    const promptInput = document.getElementById('composer-prompt');
    const dropZones = {
        subject: document.getElementById('subject-zone'),
        scene: document.getElementById('scene-zone'),
        style: document.getElementById('style-zone')
    };
    
    // --- Initialize Gallery ---
    resultManager = createImageGallery({
        mainContainer: document.getElementById('composer-result-container'),
        recycleBinContainer: document.getElementById('composer-recycle-bin-container'),
        recycleBinSection: document.getElementById('composer-recycle-bin-section'),
        toggleRecycleBtn: document.getElementById('composer-toggle-recycle-bin-btn'),
        zipBtn: document.getElementById('composer-download-zip-btn'),
        zipFilenamePrefix: 'composer-gallery',
        onPreview: (image) => shared.showImagePreview(image),
        shared: shared
    });
    
    // --- Load Data from DB ---
    const savedImages = await db.loadImages('composer');
    resultManager.loadFromDB(savedImages);

    // --- Event Listeners ---
    Object.values(dropZones).forEach(zone => {
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', (e) => {
            e.preventDefault(); zone.classList.remove('drag-over');
            try {
                const data = JSON.parse(e.dataTransfer.getData('application/json'));
                zone.innerHTML = `<img src="data:image/png;base64,${data.base64}" data-base64="${data.base64}">`;
            } catch (err) { console.error("Drop error:", err); }
        });
        zone.addEventListener('click', () => { activeDropZone = zone; uploadInput.click(); });
    });
    
    uploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file && activeDropZone) {
            const imageUrl = URL.createObjectURL(file);
            const croppedBase64 = await shared.showCropModal(imageUrl);
            URL.revokeObjectURL(imageUrl);
            
            if (croppedBase64) {
                activeDropZone.innerHTML = `<img src="data:image/png;base64,${croppedBase64}" data-base64="${croppedBase64}">`;
            }
        }
        uploadInput.value = '';
        activeDropZone = null;
    });

    composeBtn.addEventListener('click', () => handleApiAction(composeBtn, loader, errorEl, async () => {
        const prompt = promptInput.value.trim();
        const parts = [];
        if (prompt) {
            parts.push({ text: `Create a new image based on the following elements. Text prompt: ${prompt}` });
        } else {
            parts.push({ text: "Create a new image based on the following elements." });
        }
        
        let hasImageInput = false;
        for (const zoneName in dropZones) {
            const img = dropZones[zoneName].querySelector('img');
            if (img && img.dataset.base64) {
                parts.push({ text: `For the ${zoneName}:` });
                parts.push({ inlineData: { mimeType: "image/png", data: img.dataset.base64 } });
                hasImageInput = true;
            }
        }
        
        if (!prompt && !hasImageInput) return;
        
        const base64 = await api.callImageApi({ contents: [{ parts }], generationConfig: { responseModalities: ['IMAGE'] } });
        const newImage = resultManager.addImage({ base64, prompt, generationType: 'composition', parentId: null });
        await db.saveImage('composer', newImage);
    }));
}

