/**
 * ==============================================================================
 * Master Creative AI Suite - Image-to-Image Module (module-img2img.js)
 * ==============================================================================
 *
 * @description
 * This module handles all logic for the "Img2Img" tab, including image upload,
 * metadata extraction, and refinement.
 *
 * @author Gemini
 */
import * as api from 'api';
import * as db from 'db';
import { createImageGallery, handleApiAction, pngMetadata, arrayBufferToBase64 } from 'utils';

let galleryManager;
let baseImage = null; // { base64, prompt }

export async function initialize() {
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
        zipFilenamePrefix: 'img2img-gallery'
    });
    
    const initialImages = await db.loadImagesByTab('img2img');
    galleryManager.load(initialImages);
    
    // --- Event Listeners & Setup ---
    
    // Drag and Drop / Upload
    dropZone.addEventListener('click', () => uploadInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files[0]) handleUpload(e.dataTransfer.files[0]);
    });
    uploadInput.addEventListener('change', (e) => {
        if (e.target.files[0]) handleUpload(e.target.files[0]);
    });

    async function handleUpload(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const arrayBuffer = e.target.result;
            const base64 = arrayBufferToBase64(arrayBuffer);
            const metadata = await pngMetadata.decode(arrayBuffer);
            
            promptInput.value = metadata.prompt || '';
            mainImageContainer.innerHTML = `<img src="data:image/png;base64,${base64}" class="w-full max-w-xs mx-auto rounded-lg">`;
            dropZone.innerHTML = `<img src="data:image/png;base64,${base64}" alt="Uploaded preview">`;
            baseImage = { base64, prompt: metadata.prompt };
        };
        reader.readAsArrayBuffer(file);
    }
    
    // Refine Button
    refineBtn.addEventListener('click', () => handleApiAction(refineBtn, loader, errorEl, async () => {
        const prompt = promptInput.value.trim();
        if (!prompt || !baseImage) {
            alert('Please upload an image and provide a prompt.');
            return;
        }
        const newBase64 = await api.refineImage(prompt, baseImage.base64);
        const newImage = await db.saveImage('img2img', { base64: newBase64, prompt, parentId: 'uploaded' });
        galleryManager.addImage(newImage);
    }));
    
    console.log("Img2Img Module Initialized");
}

