/**
 * @description This module handles all logic for the "Image-to-Image" tab.
 */
import * as api from 'api';
import * as db from 'db';
import { createImageGallery, handleApiAction, pngMetadata, arrayBufferToBase64 } from 'utils';

let galleryManager;
let shared;
let baseImage = null;

export async function initialize(sharedUtils) {
    shared = sharedUtils;
    // --- DOM Elements ---
    const dropZone = document.getElementById('img2img-drop-zone');
    const uploadInput = document.getElementById('img2img-upload-input');
    const mainImageContainer = document.getElementById('img2img-main-image-container');
    const promptInput = document.getElementById('img2img-prompt');
    const refineBtn = document.getElementById('img2img-refine-btn');
    const loader = document.getElementById('img2img-loader');
    const errorEl = document.getElementById('img2img-error');

    // --- Initialize Gallery ---
    galleryManager = createImageGallery({
        mainContainer: document.getElementById('img2img-gallery-container'),
        recycleBinContainer: document.getElementById('img2img-recycle-bin-container'),
        recycleBinSection: document.getElementById('img2img-recycle-bin-section'),
        toggleRecycleBtn: document.getElementById('img2img-toggle-recycle-bin-btn'),
        zipBtn: document.getElementById('img2img-download-zip-btn'),
        zipFilenamePrefix: 'img2img-gallery',
        onPreview: (image) => shared.showImagePreview(image)
    });
    
    // --- Load Data from DB ---
    const savedImages = await db.loadImages('img2img');
    galleryManager.loadFromDB(savedImages);

    // --- Event Listeners ---
    dropZone.addEventListener('click', () => uploadInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]);
    });
    uploadInput.addEventListener('change', (e) => {
        if (e.target.files[0]) handleFileUpload(e.target.files[0]);
    });
    
    refineBtn.addEventListener('click', () => handleApiAction(refineBtn, loader, errorEl, async () => {
        const prompt = promptInput.value.trim();
        if (!prompt || !baseImage) {
            alert('Please upload an image and provide a prompt.');
            return;
        }
        const payload = {
            contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: "image/png", data: baseImage.base64 } }] }],
            generationConfig: { responseModalities: ['IMAGE'] }
        };
        const newBase64 = await api.callImageApi(payload);
        const newImage = galleryManager.addImage({ base64: newBase64, prompt, generationType: 'img2img', parentId: 'uploaded' });
        await db.saveImage('img2img', newImage);
    }));

    // --- Functions ---
    async function handleFileUpload(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const arrayBuffer = e.target.result;
            const base64 = arrayBufferToBase64(arrayBuffer);
            const metadata = await pngMetadata.decode(arrayBuffer);

            promptInput.value = metadata.prompt || '';
            mainImageContainer.innerHTML = `<img src="data:image/png;base64,${base64}" class="w-full max-w-xs mx-auto rounded-lg">`;
            baseImage = { base64, prompt: metadata.prompt };
        };
        reader.readAsArrayBuffer(file);
        uploadInput.value = '';
    }
}

