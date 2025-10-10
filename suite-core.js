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

// Defer execution until after the DOM has been updated by main.js
setTimeout(() => {
    // --- INITIALIZATION ---
    if (typeof window.SUITE_API_KEY !== 'undefined') {
        initializeApi(window.SUITE_API_KEY);
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

    // --- ADVANCED LIGHTBOX ---
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = lightbox.querySelector('.lightbox-content');
    const lightboxFilename = lightbox.querySelector('.lightbox-filename');
    const lightboxClose = lightbox.querySelector('.lightbox-close');
    const lightboxPrev = lightbox.querySelector('.lightbox-prev');
    const lightboxNext = lightbox.querySelector('.lightbox-next');

    let lightboxImages = [];
    let currentLightboxIndex = 0;
    let isPanning = false;
    let hasDragged = false;
    let panStartX = 0, panStartY = 0;
    let translateX = 0, translateY = 0;
    let scale = 1;

    function openLightbox(images, startIndex) {
        if (!images || images.length === 0) return;
        lightboxImages = images;
        currentLightboxIndex = startIndex;
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
        const imageData = lightboxImages[currentLightboxIndex];
        lightboxImg.src = `data:image/png;base64,${imageData.base64}`;
        lightboxFilename.textContent = imageData.filename;
        resetPanAndZoom(); 
    }

    function showNextImage() {
        currentLightboxIndex = (currentLightboxIndex + 1) % lightboxImages.length;
        updateLightboxImage();
    }

    function showPrevImage() {
        currentLightboxIndex = (currentLightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
        updateLightboxImage();
    }

    function toggleZoom() {
        lightboxImg.classList.toggle('native-size');
        if (!lightboxImg.classList.contains('native-size')) {
            resetPanAndZoom();
        }
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

    lightboxClose.addEventListener('click', closeLightbox);
    lightboxNext.addEventListener('click', showNextImage);
    lightboxPrev.addEventListener('click', showPrevImage);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });

    lightboxImg.addEventListener('mousedown', (e) => {
        e.preventDefault(); 
        if (lightboxImg.classList.contains('native-size')) {
            isPanning = true;
            panStartX = e.clientX - translateX;
            panStartY = e.clientY - translateY;
            lightboxImg.classList.add('panning');
        }
        hasDragged = false; 
    });

    lightboxImg.addEventListener('mousemove', (e) => {
        e.preventDefault();
        if (isPanning) {
            hasDragged = true; 
            translateX = e.clientX - panStartX;
            translateY = e.clientY - panStartY;
            updateTransform();
        }
    });

    lightboxImg.addEventListener('mouseup', () => {
        isPanning = false;
        lightboxImg.classList.remove('panning');
        if (!hasDragged) toggleZoom();
    });

    lightboxImg.addEventListener('mouseleave', () => {
        if (isPanning) {
            isPanning = false;
            lightboxImg.classList.remove('panning');
        }
    });

    lightbox.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomSpeed = 0.1;
        const zoomDirection = e.deltaY < 0 ? 1 : -1;
        if (zoomDirection > 0 && !lightboxImg.classList.contains('native-size')) {
            lightboxImg.classList.add('native-size');
        }
        scale += zoomDirection * zoomSpeed;
        if (scale < 1) {
            resetPanAndZoom();
            return;
        }
        scale = Math.max(1, Math.min(scale, 5));
        updateTransform();
    });


    // --- ZIP MODAL ---
    const zipFilenameModal = document.getElementById('zip-filename-modal');
    const zipFilenameInput = zipFilenameModal.querySelector('#zip-filename-input');
    const saveZipBtn = zipFilenameModal.querySelector('#save-zip-btn');
    const cancelZipBtn = zipFilenameModal.querySelector('#cancel-zip-btn');
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
    const cropImageTarget = cropModal.querySelector('#crop-image-target');
    const confirmCropBtn = cropModal.querySelector('#confirm-crop-btn');
    const cancelCropBtn = cropModal.querySelector('#cancel-crop-btn');
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

    // --- INITIALIZE ALL MODULES ---
    const shared = { 
        showZipModal, 
        showCropModal,
        openLightbox
    };
    txt2img.initialize(shared);
    img2img.initialize(shared);
    composer.initialize(shared);
    sketchpad.initialize(shared);
    aim.initialize(shared);
}, 0);

