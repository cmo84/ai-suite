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
    if (typeof SUITE_API_KEY !== 'undefined') {
        initializeApi(SUITE_API_KEY);
    } else {
        console.error("API Key not found.");
    }
    
    const suiteWindow = document.getElementById('suite-window');
    makeDraggable(suiteWindow);

    // --- MAIN WINDOW MANAGEMENT ---
    const toggleMaximizeBtn = document.getElementById('toggle-maximize-btn');
    toggleMaximizeBtn.addEventListener('click', () => {
        suiteWindow.classList.toggle('maximized');
        window.dispatchEvent(new Event('resize'));
    });

    // --- TAB SWITCHING ---
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`${targetTab}-tab`).classList.add('active');
            window.dispatchEvent(new Event('resize'));
        });
    });
    
    // --- IMAGE PREVIEW MODAL ---
    const imagePreviewModal = document.getElementById('image-preview-modal');
    const modalImage = document.getElementById('modal-image');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalPrompt = document.getElementById('modal-prompt');
    const modalDescribeBtn = document.getElementById('modal-describe-btn');
    const modalDescription = document.getElementById('modal-description');
    let currentImageForVQA = null;

    function showImagePreview(image) {
        currentImageForVQA = image;
        modalImage.src = `data:image/png;base64,${image.base64}`;
        modalPrompt.textContent = image.prompt || 'No prompt available.';
        modalDescription.classList.add('hidden');
        modalDescription.textContent = '';
        imagePreviewModal.style.display = 'flex';
    }
    
    function hideImagePreview() {
        imagePreviewModal.style.display = 'none';
        modalImage.src = '';
        modalPrompt.textContent = '';
        currentImageForVQA = null;
    }

    modalCloseBtn.addEventListener('click', hideImagePreview);
    imagePreviewModal.addEventListener('click', (e) => {
        if (e.target === imagePreviewModal) hideImagePreview();
    });
    modalDescribeBtn.addEventListener('click', async () => {
        if (!currentImageForVQA) return;
        modalDescription.textContent = 'Describing...';
        modalDescription.classList.remove('hidden');
        
        try {
            const { callTextApi } = await import('api');
            const payload = {
                contents: [{
                    parts: [
                        { text: "Describe this image in a vivid and detailed paragraph. Focus on the mood, atmosphere, and key visual elements." },
                        { inlineData: { mimeType: "image/png", data: currentImageForVQA.base64 } }
                    ]
                }],
            };
            const description = await callTextApi(payload);
            modalDescription.innerHTML = description.replace(/\n/g, '<br>');
        } catch(e) {
            modalDescription.textContent = `Error: ${e.message}`;
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
            zipPromiseResolve(null);
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
                aspectRatio: 1, viewMode: 1, background: false,
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
    
    // --- BATCH PROGRESS MODAL ---
    const batchProgressModal = document.getElementById('batch-progress-modal');
    const progressTitle = document.getElementById('progress-title');
    const progressText = document.getElementById('progress-text');
    const progressBar = document.getElementById('progress-bar');
    const successCountEl = document.getElementById('success-count');
    const failureCountEl = document.getElementById('failure-count');
    const errorListContainer = document.getElementById('error-list-container');
    const errorList = document.getElementById('error-list');
    const cancelGenerationBtn = document.getElementById('cancel-generation-btn');
    const closeProgressBtn = document.getElementById('close-progress-btn');
    
    function showBatchProgressModal() {
        progressTitle.textContent = 'Generation Progress';
        progressText.textContent = 'Initializing...';
        progressBar.style.width = '0%';
        successCountEl.textContent = '0';
        failureCountEl.textContent = '0';
        errorList.innerHTML = '';
        errorListContainer.classList.add('hidden');
        closeProgressBtn.classList.add('hidden');
        cancelGenerationBtn.classList.remove('hidden');
        cancelGenerationBtn.disabled = false;
        batchProgressModal.style.display = 'flex';
    }
    
    function updateBatchProgress(current, total, successes, failures, error) {
        progressText.textContent = `Generating image ${current} of ${total}...`;
        progressBar.style.width = `${(current / total) * 100}%`;
        successCountEl.textContent = successes;
        failureCountEl.textContent = failures;
        if(error) {
            const li = document.createElement('li');
            li.textContent = `Image ${current}: ${error}`;
            errorList.appendChild(li);
            errorListContainer.classList.remove('hidden');
        }
    }
    
    function finishBatchProgress(cancelled = false) {
        progressTitle.textContent = cancelled ? 'Generation Cancelled' : 'Generation Complete';
        progressText.textContent = cancelled ? 'Stopped by user.' : 'Finished.';
        cancelGenerationBtn.classList.add('hidden');
        closeProgressBtn.classList.remove('hidden');
    }
    
    closeProgressBtn.addEventListener('click', () => {
        batchProgressModal.style.display = 'none';
    });


    // --- INITIALIZE ALL MODULES ---
    const shared = { 
        showImagePreview, 
        showZipModal, 
        showCropModal,
        showBatchProgressModal,
        updateBatchProgress,
        finishBatchProgress,
        cancelGenerationBtn
    };
    txt2img.initialize(shared);
    img2img.initialize(shared);
    composer.initialize(shared);
    sketchpad.initialize(shared);
    aim.initialize(shared);
});

