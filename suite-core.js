/**
 * @description Core application logic, UI initialization, and module loading.
 */

import { initializeApi } from 'api';
import { makeDraggable } from 'utils';
import * as txt2img from 'txt2img';
import * as img2img from 'img2img';
import * as composer from 'composer';
import * as sketchpad from 'sketchpad';
import * as aim from 'aim';

document.addEventListener('DOMContentLoaded', () => {
    // --- INITIALIZATION ---
    
    // Pass the globally scoped API key to the API handler module.
    if (typeof SUITE_API_KEY !== 'undefined') {
        initializeApi(SUITE_API_KEY);
    } else {
        console.error("API Key not found. The application will not be able to connect to Google APIs.");
    }
    
    const suiteWindow = document.getElementById('suite-window');
    makeDraggable(suiteWindow);

    // --- MAIN WINDOW MANAGEMENT ---
    const toggleMaximizeBtn = document.getElementById('toggle-maximize-btn');
    let isMaximized = false;
    toggleMaximizeBtn.addEventListener('click', () => {
        suiteWindow.classList.toggle('maximized');
        isMaximized = !isMaximized;
        // This might be needed to force canvases to redraw after resize
        window.dispatchEvent(new Event('resize'));
    });

    // --- TAB SWITCHING ---
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            tabContents.forEach(content => {
                content.classList.remove('active');
            });
            
            document.getElementById(`${targetTab}-tab`).classList.add('active');
            
            // Re-trigger resize to fix any canvas issues on hidden tabs
            window.dispatchEvent(new Event('resize'));
        });
    });
    
    // --- IMAGE PREVIEW MODAL ---
    const imagePreviewModal = document.getElementById('image-preview-modal');
    const modalImage = document.getElementById('modal-image');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalPrompt = document.getElementById('modal-prompt');
    
    function showImagePreview(image) {
        modalImage.src = `data:image/png;base64,${image.base64}`;
        modalPrompt.textContent = image.prompt || 'No prompt available.';
        imagePreviewModal.style.display = 'flex';
    }
    
    function hideImagePreview() {
        imagePreviewModal.style.display = 'none';
        modalImage.src = '';
        modalPrompt.textContent = '';
    }

    modalCloseBtn.addEventListener('click', hideImagePreview);
    imagePreviewModal.addEventListener('click', (e) => {
        if (e.target === imagePreviewModal) {
            hideImagePreview();
        }
    });

    // --- ZIP MODAL ---
    const zipFilenameModal = document.getElementById('zip-filename-modal');
    const zipFilenameInput = document.getElementById('zip-filename-input');
    const saveZipBtn = document.getElementById('save-zip-btn');
    const cancelZipBtn = document.getElementById('cancel-zip-btn');
    let zipPromiseResolve = null;

    function showZipModal(suggestedName) {
        return new Promise(resolve => {
            zipPromiseResolve = resolve;
            zipFilenameInput.value = suggestedName;
            zipFilenameModal.style.display = 'flex';
            zipFilenameInput.focus();
            zipFilenameInput.select();
        });
    }

    function hideZipModal() {
        zipFilenameModal.style.display = 'none';
        if (zipPromiseResolve) {
            zipPromiseResolve(null); // Resolve with null if cancelled
            zipPromiseResolve = null;
        }
    }

    saveZipBtn.addEventListener('click', () => {
        if (zipPromiseResolve) {
            zipPromiseResolve(zipFilenameInput.value.trim() || 'image-gallery');
            zipPromiseResolve = null;
        }
        zipFilenameModal.style.display = 'none';
    });
    cancelZipBtn.addEventListener('click', hideZipModal);

    // --- CROP MODAL ---
    const cropModal = document.getElementById('crop-modal');
    const cropImageTarget = document.getElementById('crop-image-target');
    const confirmCropBtn = document.getElementById('confirm-crop-btn');
    const cancelCropBtn = document.getElementById('cancel-crop-btn');
    let cropPromiseResolve = null;
    let cropperInstance = null;

    function showCropModal(imageUrl) {
         return new Promise(resolve => {
            cropPromiseResolve = resolve;
            cropImageTarget.src = imageUrl;
            cropModal.style.display = 'flex';
            
            if(cropperInstance) cropperInstance.destroy();
            cropperInstance = new Cropper(cropImageTarget, {
                aspectRatio: 1,
                viewMode: 1,
                background: false,
            });
        });
    }

    function hideCropModal() {
        cropModal.style.display = 'none';
        if (cropperInstance) cropperInstance.destroy();
        cropperInstance = null;
        if(cropPromiseResolve) {
            cropPromiseResolve(null);
            cropPromiseResolve = null;
        }
    }
    
    confirmCropBtn.addEventListener('click', () => {
        if (cropperInstance && cropPromiseResolve) {
            const base64 = cropperInstance.getCroppedCanvas({
                width: 512, height: 512, imageSmoothingQuality: 'high'
            }).toDataURL('image/png').split(',')[1];
            cropPromiseResolve(base64);
        }
        hideCropModal();
    });
    cancelCropBtn.addEventListener('click', hideCropModal);


    // --- INITIALIZE ALL MODULES ---
    const shared = { showImagePreview, showZipModal, showCropModal };
    txt2img.initialize(shared);
    img2img.initialize(shared);
    composer.initialize(shared);
    sketchpad.initialize(shared);
    aim.initialize(shared);
});

