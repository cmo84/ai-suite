/**
 * @description Shared utility functions for the Master Creative AI Suite.
 */

/**
 * A factory function to create and manage an image gallery instance.
 * @param {object} config - Configuration object for the gallery.
 * @returns {object} A gallery manager instance.
 */
export function createImageGallery(config) {
    let gallery = [];
    let selectedId = null;
    let imageCounter = 0;

    function getFilename(prompt, index) {
        const sanitized = (prompt || 'untitled').replace(/[^a-zA-Z0-9 ]/g, '').toLowerCase();
        const words = sanitized.split(' ').filter(Boolean);
        const prefix = words.slice(0, 4).join('_') || 'image';
        return `${String(index).padStart(2, '0')}_${prefix}.png`;
    }

    async function render() {
        config.mainContainer.innerHTML = '';
        if(config.recycleBinContainer) config.recycleBinContainer.innerHTML = '';
        
        const activeImages = gallery.filter(img => img.status === 'active');
        const discardedImages = gallery.filter(img => img.status === 'discarded');

        for(const img of activeImages) await createImageElement(img, config.mainContainer);
        if(config.recycleBinContainer) {
           for(const img of discardedImages) await createImageElement(img, config.recycleBinContainer);
        }

        if (config.recycleBinSection) config.recycleBinSection.style.display = discardedImages.length > 0 ? 'block' : 'none';
        if (config.toggleRecycleBtn) config.toggleRecycleBtn.style.display = discardedImages.length > 0 ? 'block' : 'none';
        if (config.zipBtn) config.zipBtn.style.display = activeImages.length > 0 ? 'block' : 'none';
    }

    async function createImageElement(image, container) {
        const wrapper = document.createElement('div');
        wrapper.className = 'image-wrapper';
        const img = document.createElement('img');
        img.src = `data:image/png;base64,${image.base64}`;
        img.className = 'gallery-img';
        img.draggable = true;
        img.addEventListener('dragstart', (e) => e.dataTransfer.setData('application/json', JSON.stringify(image)));

        if (container === config.mainContainer) {
            if (image.id === selectedId) img.classList.add('selected');
            wrapper.addEventListener('click', () => {
                selectedId = image.id;
                if(config.onSelect) config.onSelect(image);
                render();
            });
        }
        
        const overlay = document.createElement('div');
        overlay.className = 'img-overlay';
        
        const previewBtn = document.createElement('button');
        previewBtn.className = 'overlay-btn';
        previewBtn.innerHTML = '&#128269;'; // Magnifying glass
        previewBtn.onclick = (e) => { e.stopPropagation(); config.onPreview(image); };
        
        const downloadLink = document.createElement('a');
        const processedBase64 = await pngMetadata.encode(image.base64, 'prompt', image.prompt || '');
        downloadLink.href = `data:image/png;base64,${processedBase64}`;
        downloadLink.download = image.filename;
        downloadLink.className = 'overlay-btn';
        downloadLink.innerHTML = '&#11123;'; // Down arrow
        downloadLink.onclick = (e) => e.stopPropagation();

        const deleteOrRestoreBtn = document.createElement('button');
        deleteOrRestoreBtn.className = 'overlay-btn';

        if (image.status === 'active') {
            deleteOrRestoreBtn.innerHTML = '&#128465;'; // Trash can
            deleteOrRestoreBtn.onclick = (e) => {
                e.stopPropagation();
                image.status = 'discarded';
                if (image.id === selectedId) {
                    selectedId = null;
                    if(config.onSelect) config.onSelect(null);
                }
                render();
            };
        } else {
            deleteOrRestoreBtn.innerHTML = '&#10227;'; // Restore
            deleteOrRestoreBtn.onclick = (e) => {
                e.stopPropagation();
                image.status = 'active';
                render();
            };
        }
        
        overlay.appendChild(previewBtn);
        overlay.appendChild(downloadLink);
        overlay.appendChild(deleteOrRestoreBtn);
        wrapper.appendChild(img);
        wrapper.appendChild(overlay);
        container.appendChild(wrapper);
    }

    if (config.toggleRecycleBtn) {
        config.toggleRecycleBtn.addEventListener('click', () => {
            const section = config.recycleBinSection;
            const btn = config.toggleRecycleBtn;
            if (section.style.display === 'none' || !section.style.display) {
                section.style.display = 'block';
                btn.textContent = 'Hide Recycle Bin';
            } else {
                section.style.display = 'none';
                btn.textContent = 'Show Recycle Bin';
            }
        });
    }
    
    return {
        addImage: (imageData) => {
            imageCounter++;
            const newImage = { 
                id: Date.now() + Math.random(), 
                status: 'active',
                filename: getFilename(imageData.prompt, imageCounter),
                ...imageData 
            };
            gallery.push(newImage);
            render();
            return newImage;
        },
        getImages: () => gallery.filter(img => img.status === 'active'),
        getSelected: () => gallery.find(img => img.id === selectedId),
        loadFromDB: (images) => { 
            gallery = images || []; 
            imageCounter = gallery.length;
            render(); 
        },
        updateAndSave: async (image) => {
            const index = gallery.findIndex(i => i.id === image.id);
            if (index !== -1) {
                gallery[index] = image;
            }
            await render();
            // This assumes a separate DB save call is made in the module
        }
    };
}

/**
 * Wraps an API action with loading and error handling.
 * @param {HTMLElement | HTMLElement[]} buttons - The button(s) that triggered the action.
 * @param {HTMLElement} loader - The loader element to show/hide.
 * @param {HTMLElement} errorEl - The error message element.
 * @param {Function} actionFn - The async function to execute.
 */
export async function handleApiAction(buttons, loader, errorEl, actionFn) {
    const btnArray = Array.isArray(buttons) ? buttons : [buttons];
    btnArray.forEach(btn => btn.disabled = true);
    loader.style.display = 'block';
    errorEl.style.display = 'none';
    try {
        await actionFn();
    } catch (error) {
        console.error("API Action Error:", error);
        errorEl.textContent = `Error: ${error.message}`;
        errorEl.style.display = 'block';
    } finally {
        btnArray.forEach(btn => btn.disabled = false);
        loader.style.display = 'none';
    }
}

/**
 * Converts an ArrayBuffer to a Base64 string.
 * @param {ArrayBuffer} buffer - The buffer to convert.
 * @returns {string} The Base64 encoded string.
 */
export function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

/**
 * Utility for encoding and decoding metadata in PNG files.
 */
export const pngMetadata = (() => {
    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder();

    function crc32(bytes, start = 0, length = bytes.length - start) {
        const crcTable = new Uint32Array(256).map((_, i) => {
            let c = i;
            for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
            return c;
        });
        let crc = -1;
        for (let i = start; i < start + length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xff];
        return (crc ^ -1) >>> 0;
    }

    function insertChunk(pngBytes, type, data) {
        const IEND_OFFSET = pngBytes.length - 12;
        const chunkType = textEncoder.encode(type);
        const chunkData = data;
        const chunkLength = new Uint8Array(4);
        new DataView(chunkLength.buffer).setUint32(0, chunkData.length, false);
        const chunkAndData = new Uint8Array(4 + chunkData.length);
        chunkAndData.set(chunkType, 0);
        chunkAndData.set(chunkData, 4);
        const crc = new Uint8Array(4);
        new DataView(crc.buffer).setUint32(0, crc32(chunkAndData), false);
        const newChunk = new Uint8Array(12 + chunkData.length);
        newChunk.set(chunkLength, 0);
        newChunk.set(chunkAndData, 4);
        newChunk.set(crc, 8 + chunkData.length);
        const newPngBytes = new Uint8Array(pngBytes.length + newChunk.length);
        newPngBytes.set(pngBytes.slice(0, IEND_OFFSET), 0);
        newPngBytes.set(newChunk, IEND_OFFSET);
        newPngBytes.set(pngBytes.slice(IEND_OFFSET), IEND_OFFSET + newChunk.length);
        return newPngBytes;
    }

    function extractChunks(pngBytes) {
        let offset = 8;
        const chunks = [];
        while (offset < pngBytes.length) {
            const view = new DataView(pngBytes.buffer);
            const length = view.getUint32(offset, false);
            const type = textDecoder.decode(pngBytes.slice(offset + 4, offset + 8));
            const data = pngBytes.slice(offset + 8, offset + 8 + length);
            chunks.push({ type, data });
            offset += 12 + length;
        }
        return chunks;
    }

    return {
        async encode(base64, key, value) {
            const binaryString = atob(base64);
            const pngBytes = new Uint8Array(binaryString.length).map((_, i) => binaryString.charCodeAt(i));
            const keywordBytes = textEncoder.encode(key + '\0');
            const textBytes = textEncoder.encode(value);
            const data = new Uint8Array(keywordBytes.length + textBytes.length);
            data.set(keywordBytes, 0);
            data.set(textBytes, keywordBytes.length);
            const newPngBytes = insertChunk(pngBytes, 'tEXt', data);
            return arrayBufferToBase64(newPngBytes.buffer);
        },
        async decode(arrayBuffer) {
            const pngBytes = new Uint8Array(arrayBuffer);
            const chunks = extractChunks(pngBytes);
            const textChunks = chunks.filter(c => c.type === 'tEXt');
            const metadata = {};
            for (const chunk of textChunks) {
                const separatorIndex = chunk.data.indexOf(0);
                if (separatorIndex > 0) {
                    const key = textDecoder.decode(chunk.data.slice(0, separatorIndex));
                    const value = textDecoder.decode(chunk.data.slice(separatorIndex + 1));
                    metadata[key] = value;
                }
            }
            return metadata;
        }
    };
})();

/**
 * Makes a window element draggable by its title bar.
 * @param {HTMLElement} element - The window element to make draggable.
 * @param {Function} onDragEnd - Callback to execute when dragging finishes.
 */
export function makeDraggable(element, onDragEnd = () => {}) {
    const titleBar = element.querySelector(".title-bar");
    if (!titleBar) return;
    
    const dragMouseDown = (e) => {
        e.preventDefault();
        let pos3 = e.clientX; 
        let pos4 = e.clientY;
        
        const highestZ = Array.from(document.querySelectorAll('.window'))
            .reduce((maxZ, el) => Math.max(maxZ, +el.style.zIndex || 0), 20);
        element.style.zIndex = highestZ + 1;

        const elementDrag = (e) => {
            e.preventDefault();
            const pos1 = pos3 - e.clientX; 
            const pos2 = pos4 - e.clientY;
            pos3 = e.clientX; 
            pos4 = e.clientY;
            element.style.top = `${element.offsetTop - pos2}px`;
            element.style.left = `${element.offsetLeft - pos1}px`;
        };
        const closeDragElement = () => {
            document.onmouseup = null; 
            document.onmousemove = null;
            onDragEnd(element);
        };
        document.onmouseup = closeDragElement; 
        document.onmousemove = elementDrag;
    }
    titleBar.onmousedown = dragMouseDown;

    element.addEventListener('mouseup', () => {
        setTimeout(() => onDragEnd(element), 0);
    });
}


// --- TTS UTILITIES ---
export function base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

export function pcmToWav(pcmData, sampleRate) {
    const pcm16 = new Int16Array(pcmData);
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);
    const numChannels = 1;
    const bitsPerSample = 16;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcm16.byteLength;

    // RIFF chunk descriptor
    view.setUint8(0, 'R'.charCodeAt(0)); view.setUint8(1, 'I'.charCodeAt(0));
    view.setUint8(2, 'F'.charCodeAt(0)); view.setUint8(3, 'F'.charCodeAt(0));
    view.setUint32(4, 36 + dataSize, true);
    view.setUint8(8, 'W'.charCodeAt(0)); view.setUint8(9, 'A'.charCodeAt(0));
    view.setUint8(10, 'V'.charCodeAt(0)); view.setUint8(11, 'E'.charCodeAt(0));
    // "fmt " sub-chunk
    view.setUint8(12, 'f'.charCodeAt(0)); view.setUint8(13, 'm'.charCodeAt(0));
    view.setUint8(14, 't'.charCodeAt(0)); view.setUint8(15, ' '.charCodeAt(0));
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    // "data" sub-chunk
    view.setUint8(36, 'd'.charCodeAt(0)); view.setUint8(37, 'a'.charCodeAt(0));
    view.setUint8(38, 't'.charCodeAt(0)); view.setUint8(39, 'a'.charCodeAt(0));
    view.setUint32(40, dataSize, true);

    return new Blob([view, pcm16], { type: 'audio/wav' });
}

