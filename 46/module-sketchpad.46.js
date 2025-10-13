/**
 * @description This module handles all logic for the "Sketchpad" tab.
 */
import * as api from 'api';
import * as db from 'db';
import { createImageGallery, handleApiAction } from 'utils';

let resultManager;
let shared;

export async function initialize(sharedUtils) {
    shared = sharedUtils;
    // --- DOM Elements ---
    const sketchpad = document.getElementById('sketchpad');
    const sketchPrompt = document.getElementById('sketch-prompt');
    const brushColor = document.getElementById('brush-color');
    const brushSize = document.getElementById('brush-size');
    const brushSizeValue = document.getElementById('brush-size-value');
    const eraserBtn = document.getElementById('eraser-btn');
    const clearSketchBtn = document.getElementById('clear-sketch-btn');
    const generateBtn = document.getElementById('generate-from-sketch-btn');
    const loader = document.getElementById('sketch-loader');
    const errorEl = document.getElementById('sketch-error');
    
    if(!sketchpad) return;
    const ctx = sketchpad.getContext('2d');
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    // --- Initialize Gallery ---
    resultManager = createImageGallery({
        mainContainer: document.getElementById('sketch-result-container'),
        recycleBinContainer: document.getElementById('sketch-recycle-bin-container'),
        recycleBinSection: document.getElementById('sketch-recycle-bin-section'),
        toggleRecycleBtn: document.getElementById('sketch-toggle-recycle-bin-btn'),
        zipBtn: document.getElementById('sketch-download-zip-btn'),
        zipFilenamePrefix: 'sketch-gallery',
        onPreview: (image) => shared.showImagePreview(image)
    });

    // --- Load Data from DB ---
    const savedImages = await db.loadImages('sketch');
    resultManager.loadFromDB(savedImages);
    
    // --- Canvas Logic ---
    function setCanvasSize() {
        const container = sketchpad.parentElement;
        sketchpad.width = container.clientWidth;
        sketchpad.height = container.clientHeight;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, sketchpad.width, sketchpad.height);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = brushColor.value; 
        ctx.lineWidth = brushSize.value;
    }

    function draw(e) {
        if (!isDrawing) return;
        e.preventDefault();
        const rect = sketchpad.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;
        
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();
        [lastX, lastY] = [x, y];
    }

    // --- Event Listeners ---
    sketchpad.addEventListener('mousedown', (e) => {
        isDrawing = true;
        const rect = sketchpad.getBoundingClientRect();
        [lastX, lastY] = [e.clientX - rect.left, e.clientY - rect.top];
    });
    sketchpad.addEventListener('touchstart', (e) => {
        isDrawing = true;
        const rect = sketchpad.getBoundingClientRect();
        [lastX, lastY] = [e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top];
    });

    sketchpad.addEventListener('mousemove', draw);
    sketchpad.addEventListener('touchmove', draw);

    sketchpad.addEventListener('mouseup', () => isDrawing = false);
    sketchpad.addEventListener('mouseout', () => isDrawing = false);
    sketchpad.addEventListener('touchend', () => isDrawing = false);
    
    brushColor.addEventListener('input', (e) => ctx.strokeStyle = e.target.value);
    brushSize.addEventListener('input', (e) => {
        ctx.lineWidth = e.target.value;
        brushSizeValue.textContent = e.target.value;
    });
    eraserBtn.addEventListener('click', () => { ctx.strokeStyle = 'white'; });
    clearSketchBtn.addEventListener('click', () => {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, sketchpad.width, sketchpad.height);
    });

    generateBtn.addEventListener('click', () => handleApiAction(generateBtn, loader, errorEl, async () => {
        const prompt = sketchPrompt.value.trim();
        if (!prompt) return;
        const sketchData = sketchpad.toDataURL('image/png').split(',')[1];
        const payload = {
            contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: "image/png", data: sketchData } }] }],
            generationConfig: { responseModalities: ['IMAGE'] }
        };
        const base64 = await api.callImageApi(payload);
        const newImage = resultManager.addImage({ base64, prompt, generationType: 'sketch', parentId: null });
        await db.saveImage('sketch', newImage);
    }));

    // --- Initialization ---
    setCanvasSize();
    new ResizeObserver(setCanvasSize).observe(sketchpad.parentElement);
}

