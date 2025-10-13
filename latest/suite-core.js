/**
 * @description Core application logic, UI initialization, and module loading.
 */

import { makeDraggable } from 'utils';
import * as txt2img from 'txt2img';
import * as img2img from 'img2img';
import * as composer from 'composer';
import * as sketchpad from 'sketchpad';
import * as aim from 'aim';
import * as settings from 'settings';

function waitForElement(selector) {
    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }
        const observer = new MutationObserver(() => {
            if (document.querySelector(selector)) {
                resolve(document.querySelector(selector));
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
}

async function initializeCore() {
    await waitForElement('#main-header');

    // --- INITIALIZATION ---
    const { initializeApi } = await import('api');
    if (typeof window.SUITE_API_KEY !== 'undefined') {
        initializeApi(window.SUITE_API_KEY);
    } else {
        console.error("API Key not found.");
    }

    // --- TAB SWITCHING ---
    const tabs = document.querySelectorAll('#main-tabs .tab-btn');
    const tabContents = document.querySelectorAll('.main-content .tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('mode-button-active'));
            tab.classList.add('mode-button-active');
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`${targetTab}-tab`).classList.add('active');
            window.dispatchEvent(new Event('resize'));
        });
    });
     // Activate the first tab by default
    if (tabs.length > 0) {
        tabs[0].classList.add('mode-button-active');
    }
    
    // --- LIGHTBOX ---
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = lightbox.querySelector('.lightbox-content');
    const lightboxFilename = lightbox.querySelector('.lightbox-filename');
    const lightboxClose = lightbox.querySelector('.lightbox-close');
    const lightboxPrev = lightbox.querySelector('.lightbox-prev');
    const lightboxNext = lightbox.querySelector('.lightbox-next');

    let lightboxImages = [];
    let currentImageIndex = 0;

    let isPanning = false;
    let hasDragged = false;
    let panStartX = 0, panStartY = 0;
    let translateX = 0, translateY = 0;
    let scale = 1;

    function openLightbox(selectedImage, allImages) {
        lightboxImages = allImages;
        const selectedIndex = lightboxImages.findIndex(img => img.id === selectedImage.id);
        if (selectedIndex === -1) return;
        currentImageIndex = selectedIndex;
        updateLightboxImage();
        lightbox.classList.remove('hidden');
        document.addEventListener('keydown', handleKeyPress);
    }

    function closeLightbox() {
        lightbox.classList.add('hidden');
        document.removeEventListener('keydown', handleKeyPress);
    }

    function updateLightboxImage() {
        if (lightboxImages.length === 0) return;
        const imageData = lightboxImages[currentImageIndex];
        lightboxImg.src = `data:image/png;base64,${imageData.base64}`;
        lightboxFilename.textContent = imageData.filename;
        resetPanAndZoom();
    }

    function showNextImage() {
        currentImageIndex = (currentImageIndex + 1) % lightboxImages.length;
        updateLightboxImage();
    }

    function showPrevImage() {
        currentImageIndex = (currentImageIndex - 1 + lightboxImages.length) % lightboxImages.length;
        updateLightboxImage();
    }
    
    function resetPanAndZoom() {
        isPanning = false;
        hasDragged = false;
        translateX = 0;
        translateY = 0;
        scale = 1;
        updateTransform();
        lightboxImg.classList.remove('panning', 'native-size');
    }

    function updateTransform() {
        lightboxImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }

    function handleKeyPress(e) {
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowRight') showNextImage();
        if (e.key === 'ArrowLeft') showPrevImage();
    }

    function toggleZoom() {
        lightboxImg.classList.toggle('native-size');
        if (!lightboxImg.classList.contains('native-size')) {
            resetPanAndZoom();
        }
    }
    
    lightboxClose.addEventListener('click', closeLightbox);
    lightboxNext.addEventListener('click', showNextImage);
    lightboxPrev.addEventListener('click', showPrevImage);
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });

    lightboxImg.addEventListener('mousedown', (e) => { e.preventDefault(); if (lightboxImg.classList.contains('native-size')) { isPanning = true; panStartX = e.clientX - translateX; panStartY = e.clientY - translateY; lightboxImg.classList.add('panning'); } hasDragged = false; });
    lightboxImg.addEventListener('mousemove', (e) => { e.preventDefault(); if (isPanning) { hasDragged = true; translateX = e.clientX - panStartX; translateY = e.clientY - panStartY; updateTransform(); } });
    lightboxImg.addEventListener('mouseup', () => { isPanning = false; lightboxImg.classList.remove('panning'); if (!hasDragged) { toggleZoom(); } });
    lightboxImg.addEventListener('mouseleave', () => { if (isPanning) { isPanning = false; lightboxImg.classList.remove('panning'); } });
    lightbox.addEventListener('wheel', (e) => { e.preventDefault(); const zoomSpeed = 0.1; const zoomDirection = e.deltaY < 0 ? 1 : -1; if (zoomDirection > 0 && !lightboxImg.classList.contains('native-size')) { lightboxImg.classList.add('native-size'); } scale += zoomDirection * zoomSpeed; if (scale < 1) { resetPanAndZoom(); return; } scale = Math.max(1, Math.min(scale, 5)); updateTransform(); });


    // --- ZIP MODAL ---
    const zipModal = document.getElementById('zip-filename-modal');
    const zipInput = document.getElementById('zip-filename-input');
    const saveZipBtn = document.getElementById('save-zip-btn');
    const cancelZipBtn = document.getElementById('cancel-zip-btn');
    let zipPromiseResolve = null;

    function showZipModal(suggestedName) {
        return new Promise(resolve => {
            zipPromiseResolve = resolve;
            zipInput.value = suggestedName;
            zipModal.style.display = 'flex';
            zipInput.focus();
            zipInput.select();
        });
    }

    function hideZipModal(value) {
        zipModal.style.display = 'none';
        if (zipPromiseResolve) {
            zipPromiseResolve(value);
            zipPromiseResolve = null;
        }
    }

    saveZipBtn.addEventListener('click', () => hideZipModal(zipInput.value.trim() || zipInput.placeholder));
    cancelZipBtn.addEventListener('click', () => hideZipModal(null));
    zipInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            hideZipModal(zipInput.value.trim() || zipInput.placeholder);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            hideZipModal(null);
        }
    });

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
    
    // --- NOTIFICATION SYSTEM ---
    const notificationContainer = document.getElementById('notification-container');
    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notificationContainer.appendChild(notification);
        setTimeout(() => {
            notification.classList.add('fade-out');
            notification.addEventListener('transitionend', () => notification.remove());
        }, 3000);
    }
    
    // --- INITIALIZE ALL MODULES ---
    const shared = { 
        openLightbox,
        showCropModal,
        showNotification,
        showZipModal
    };
    txt2img.initialize(shared);
    img2img.initialize(shared);
    composer.initialize(shared);
    sketchpad.initialize(shared);
    aim.initialize(shared);
    settings.initialize(shared);
}

initializeCore();

