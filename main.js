/**
 * @description Bootstrap loader for the entire AI Creative Suite application.
 * This script injects the HTML structure, loads styles, and initializes the core application logic.
 */

// --- CONFIGURATION ---
// The SUITE_VERSION is inherited from the script tag in index.html, but we define a fallback.
const APP_VERSION = window.SUITE_VERSION || "14"; 
const REPO = window.repo || "cmo84/ai-suite@release";

function getAppHTML() {
    return `
    <div id="suite-window" class="window">
         <div class="title-bar">
            <div class="title-bar-text">
                <span>AI Creative Suite</span>
            </div>
            <div class="title-bar-buttons">
                <div id="toggle-maximize-btn" class="title-bar-button">1</div>
            </div>
        </div>
        <div class="window-body">
            <div class="sidebar">
                <button class="aim-button tab-btn" data-tab="chat">AIM Client</button>
                <button class="aim-button tab-btn" data-tab="image">Txt2Img</button>
                <button class="aim-button tab-btn" data-tab="img2img">Img2Img</button>
                <button class="aim-button tab-btn" data-tab="composer">Composer</button>
                <button class="aim-button tab-btn" data-tab="sketch">Sketchpad</button>
            </div>
            <div class="main-content">
                <!-- AIM Client Tab -->
                <div id="chat-tab" class="tab-content active tool-content">
                    <h1 class="text-2xl font-bold mb-4">Gemini AIM Client</h1>
                    <div id="buddy-list-content">
                        <div class="tool-card">
                           <h2 class="text-xl font-bold mb-2">Your Profile</h2>
                           <textarea id="user-profile-text" class="tool-input h-20 text-xs" placeholder="Describe yourself..."></textarea>
                           <button id="save-profile-btn" class="aim-button mt-2">Save Profile</button>
                        </div>
                        <div class="tool-card">
                             <h2 class="text-xl font-bold mb-2">Buddy List</h2>
                             <div class="buddies" id="buddies-container"><div class="buddy-group">Buddies (0/0)</div></div>
                             <h3 class="text-lg font-bold mt-4 mb-2">Add a Buddy</h3>
                             <input type="text" id="new-buddy-name" class="w-full p-1 mb-2 border border-gray-500" placeholder="Screen Name">
                             <textarea id="new-buddy-personality" class="w-full p-1 mb-2 h-16 border border-gray-500" placeholder="Personality..."></textarea>
                             <button id="add-buddy-btn" class="aim-button">Add Buddy</button>
                        </div>
                         <div class="tool-card">
                             <h2 class="text-xl font-bold mb-2">Data Management</h2>
                              <div class="flex gap-2">
                                <button id="export-btn" class="aim-button flex-1">Export</button>
                                <button id="import-btn" class="aim-button flex-1">Import</button>
                                <input type="file" id="import-file" accept=".json" style="display: none;">
                            </div>
                         </div>
                    </div>
                </div>

                <!-- Text to Image Generator Tab -->
                <div id="image-tab" class="tab-content tool-content">
                    <h1 class="text-2xl font-bold mb-4">Text-to-Image Generator</h1>
                    <div class="tool-card">
                        <h2 class="text-xl font-bold mb-2">1. Create Image</h2>
                         <textarea id="prompt-text" class="tool-input" placeholder="e.g., A photorealistic portrait of a knight..."></textarea>
                         <div class="mt-4">
                            <label for="image-count" class="block text-sm font-medium text-gray-400 mb-1 text-center">Number of Images:</label>
                            <input type="number" id="image-count" value="1" min="1" max="8" class="tool-input w-28 mx-auto block p-2 text-sm text-center">
                        </div>
                         <div class="flex gap-2 mt-4 flex-wrap justify-center">
                             <button id="get-ideas-btn" class="tool-btn tool-btn-secondary">✨ Get Ideas</button>
                             <button id="expand-prompt-btn" class="tool-btn tool-btn-secondary">Expand</button>
                             <button id="generate-btn" class="tool-btn">Generate</button>
                         </div>
                    </div>
                     <div class="tool-card">
                        <div class="flex justify-between items-center mb-4">
                           <h2 class="text-xl font-bold">2. Image History & Refinement</h2>
                           <button id="download-zip-btn" class="tool-btn hidden">Download All</button>
                        </div>
                        <div id="gallery-container" class="gallery-container"></div>
                        <div id="image-loader" class="loader hidden mx-auto my-4"></div>
                        <p id="image-error" class="text-red-500 hidden text-center my-2"></p>
                        
                        <div id="refinement-controls" class="hidden mt-4">
                            <h3 class="font-bold">Refine Selected Image:</h3>
                            <textarea id="refinement-prompt" class="tool-input mt-2" placeholder="e.g., Change armor to gold..."></textarea>
                            <button id="refine-btn" class="tool-btn tool-btn-secondary mt-2">Refine Image</button>
                        </div>
                        
                        <div id="recycle-bin-section" class="mt-6 hidden">
                            <h3 class="font-bold">Recycle Bin</h3>
                            <div id="recycle-bin-container" class="gallery-container mt-2"></div>
                        </div>
                        <button id="toggle-recycle-bin-btn" class="text-sm text-blue-600 hover:underline mt-4 hidden">Show Recycle Bin</button>
                    </div>
                </div>

                <!-- Image to Image Tab -->
                <div id="img2img-tab" class="tab-content tool-content">
                    <h1 class="text-2xl font-bold mb-4">Image-to-Image</h1>
                    <div class="tool-card">
                        <h2 class="text-xl font-bold mb-2">1. Upload Image</h2>
                        <div id="img2img-drop-zone" class="drop-zone">
                             <p>Drop a PNG here or click to upload</p>
                        </div>
                        <input type="file" id="img2img-upload-input" class="hidden" accept="image/png">
                    </div>
                    <div class="tool-card">
                        <div class="flex justify-between items-center mb-4">
                           <h2 class="text-xl font-bold">2. Refine Image</h2>
                           <button id="img2img-download-zip-btn" class="tool-btn hidden">Download All</button>
                        </div>
                         <div id="img2img-main-image-container" class="mb-4"></div>
                         <textarea id="img2img-prompt" class="tool-input" placeholder="Prompt will be loaded from image metadata if available..."></textarea>
                         <button id="img2img-refine-btn" class="tool-btn tool-btn-secondary mt-2">Generate</button>
                         
                         <h3 class="font-bold mt-4">Results:</h3>
                         <div id="img2img-gallery-container" class="gallery-container mt-2"></div>
                         <div id="img2img-loader" class="loader hidden mx-auto my-4"></div>
                         <p id="img2img-error" class="text-red-500 hidden text-center my-2"></p>
                        
                         <div id="img2img-recycle-bin-section" class="mt-6 hidden">
                            <h3 class="font-bold">Recycle Bin</h3>
                            <div id="img2img-recycle-bin-container" class="gallery-container mt-2"></div>
                        </div>
                        <button id="img2img-toggle-recycle-bin-btn" class="text-sm text-blue-600 hover:underline mt-4 hidden">Show Recycle Bin</button>
                    </div>
                </div>

                <!-- Composer Tab -->
                <div id="composer-tab" class="tab-content tool-content">
                    <h1 class="text-2xl font-bold mb-4">Image Composer</h1>
                     <div class="tool-card">
                         <h2 class="text-xl font-bold mb-2">1. Add Elements</h2>
                         <p class="text-sm text-gray-600 mb-4">Drag images from the galleries or upload new ones.</p>
                         <div class="grid md:grid-cols-3 gap-4 mb-4">
                            <div id="subject-zone" class="drop-zone"><h3 class="font-bold">Subject</h3></div>
                            <div id="scene-zone" class="drop-zone"><h3 class="font-bold">Scene</h3></div>
                            <div id="style-zone" class="drop-zone"><h3 class="font-bold">Style</h3></div>
                         </div>
                         <textarea id="composer-prompt" class="tool-input" placeholder="Add a text prompt to guide the composition..."></textarea>
                         <button id="compose-btn" class="tool-btn mt-2">Generate Composition</button>
                         <input type="file" id="composer-upload-input" class="hidden" accept="image/*">
                     </div>
                     <div class="tool-card">
                         <div class="flex justify-between items-center mb-4">
                            <h2 class="text-xl font-bold">2. Result</h2>
                            <button id="composer-download-zip-btn" class="tool-btn hidden">Download All</button>
                         </div>
                          <div id="composer-result-container" class="gallery-container" style="min-height: 256px;"></div>
                          <div id="composer-loader" class="loader hidden mx-auto my-4"></div>
                          <p id="composer-error" class="text-red-500 hidden text-center my-2"></p>
                         <div id="composer-recycle-bin-section" class="mt-6 hidden">
                            <h3 class="font-bold">Recycle Bin</h3>
                            <div id="composer-recycle-bin-container" class="gallery-container mt-2"></div>
                        </div>
                        <button id="composer-toggle-recycle-bin-btn" class="text-sm text-blue-600 hover:underline mt-4 hidden">Show Recycle Bin</button>
                     </div>
                </div>

                <!-- Sketchpad Tab -->
                <div id="sketch-tab" class="tab-content tool-content">
                   <h1 class="text-2xl font-bold mb-4">Sketch to Image</h1>
                   <div class="tool-card">
                       <div class="grid md:grid-cols-3 gap-6 items-start">
                            <div class="md:col-span-2 aspect-square"><canvas id="sketchpad"></canvas></div>
                            <div class="flex flex-col space-y-4">
                                <textarea id="sketch-prompt" class="tool-input" placeholder="Describe your sketch..."></textarea>
                                <div>
                                    <label for="brush-color">Color:</label>
                                    <input type="color" id="brush-color" value="#000000" class="w-full h-8">
                                </div>
                                <div>
                                    <label for="brush-size">Size: <span id="brush-size-value">5</span></label>
                                    <input type="range" id="brush-size" min="1" max="50" value="5" class="w-full">
                                </div>
                                <div class="flex space-x-2">
                                    <button id="eraser-btn" class="tool-btn tool-btn-secondary flex-1">Eraser</button>
                                    <button id="clear-sketch-btn" class="tool-btn tool-btn-danger flex-1">Clear</button>
                                </div>
                                <button id="generate-from-sketch-btn" class="tool-btn">Generate from Sketch</button>
                            </div>
                       </div>
                   </div>
                    <div class="tool-card">
                         <div class="flex justify-between items-center mb-4">
                            <h2 class="text-xl font-bold">2. Result</h2>
                            <button id="sketch-download-zip-btn" class="tool-btn hidden">Download All</button>
                         </div>
                         <div id="sketch-result-container" class="gallery-container" style="min-height: 256px;"></div>
                         <div id="sketch-loader" class="loader hidden mx-auto my-4"></div>
                         <p id="sketch-error" class="text-red-500 hidden text-center my-2"></p>
                        <div id="sketch-recycle-bin-section" class="mt-6 hidden">
                            <h3 class="font-bold">Recycle Bin</h3>
                            <div id="sketch-recycle-bin-container" class="gallery-container mt-2"></div>
                        </div>
                        <button id="sketch-toggle-recycle-bin-btn" class="text-sm text-blue-600 hover:underline mt-4 hidden">Show Recycle Bin</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Modals and other hidden elements -->
    <div id="image-preview-modal" class="fixed inset-0 bg-black bg-opacity-80 flex-col items-center justify-center p-4 z-50 hidden" style="backdrop-filter: blur(5px);">
        <button id="modal-close-btn" class="absolute top-4 right-4 text-white text-4xl font-bold">&times;</button>
        <p id="modal-prompt" class="text-white text-center mb-4 p-2 bg-black/50 rounded-md"></p>
        <img id="modal-image" src="" class="max-w-full max-h-[80vh] object-contain">
        <div id="modal-vqa-container" class="mt-4 text-center">
            <button id="modal-describe-btn" class="tool-btn tool-btn-secondary">✨ Describe Image</button>
            <div id="modal-description" class="mt-2 text-gray-300 bg-black/50 p-3 rounded-md hidden max-w-2xl"></div>
        </div>
    </div>

    <div id="zip-filename-modal" class="fixed inset-0 bg-black bg-opacity-70 hidden items-center justify-center z-50">
        <div class="tool-card bg-gray-800 w-full max-w-md">
            <h2 class="text-xl font-bold text-white mb-4">Name Your ZIP File</h2>
            <input id="zip-filename-input" type="text" class="tool-input bg-gray-700 text-white" placeholder="filename...">
            <div class="flex gap-4 mt-4">
                <button id="cancel-zip-btn" class="aim-button flex-1">Cancel</button>
                <button id="save-zip-btn" class="tool-btn flex-1">Save & Download</button>
            </div>
        </div>
    </div>
    
    <div id="crop-modal" class="fixed inset-0 bg-black bg-opacity-70 hidden items-center justify-center z-50">
        <div class="tool-card bg-gray-800 w-full max-w-2xl">
             <h2 class="text-xl font-bold text-white mb-4">Crop Image</h2>
             <div><img id="crop-image-target"></div>
             <div class="flex gap-4 mt-4">
                 <button id="cancel-crop-btn" class="aim-button flex-1">Cancel</button>
                 <button id="confirm-crop-btn" class="tool-btn flex-1">Crop & Use</button>
             </div>
        </div>
    </div>

     <div id="batch-progress-modal" class="fixed inset-0 bg-black bg-opacity-70 hidden items-center justify-center z-50">
        <div class="tool-card bg-gray-800 w-full max-w-lg">
             <h2 id="progress-title" class="text-2xl font-bold text-white mb-4 text-center">Generation Progress</h2>
             <p id="progress-text" class="text-center text-gray-300 mb-4">Initializing...</p>
             <div class="w-full bg-gray-700 rounded-full h-4 mb-4">
                 <div id="progress-bar" class="bg-blue-600 h-4 rounded-full transition-all duration-500" style="width: 0%"></div>
             </div>
             <div class="flex justify-around text-center mb-4">
                 <div>
                     <p class="text-lg font-bold text-green-400">Successful</p>
                     <p id="success-count" class="text-2xl font-bold text-white">0</p>
                 </div>
                 <div>
                     <p class="text-lg font-bold text-red-400">Failed</p>
                     <p id="failure-count" class="text-2xl font-bold text-white">0</p>
                 </div>
             </div>
             <div id="error-list-container" class="hidden">
                <p class="text-center text-gray-400 text-sm">Failure Details:</p>
                <ul id="error-list" class="mt-2 text-sm text-red-300 max-h-24 overflow-y-auto bg-gray-900/50 p-2 rounded-md"></ul>
            </div>
             <div class="text-center mt-6 flex justify-center gap-4">
                 <button id="cancel-generation-btn" class="tool-btn tool-btn-danger">Cancel</button>
                 <button id="close-progress-btn" class="aim-button hidden">Close</button>
             </div>
        </div>
    </div>
    `;
}

function loadAssets() {
    // Inject Stylesheet
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://cdn.jsdelivr.net/gh/${REPO}/dist/${APP_VERSION}/index.css`;
    document.head.appendChild(link);

    // Inject Import Map
    const importMap = document.createElement('script');
    importMap.type = 'importmap';
    importMap.textContent = JSON.stringify({
        imports: {
            "db": `https://cdn.jsdelivr.net/gh/${REPO}/dist/${APP_VERSION}/database.js`,
            "api": `https://cdn.jsdelivr.net/gh/${REPO}/dist/${APP_VERSION}/api-handler.js`,
            "utils": `https://cdn.jsdelivr.net/gh/${REPO}/dist/${APP_VERSION}/utils.js`,
            "txt2img": `https://cdn.jsdelivr.net/gh/${REPO}/dist/${APP_VERSION}/module-txt2img.js`,
            "img2img": `https://cdn.jsdelivr.net/gh/${REPO}/dist/${APP_VERSION}/module-img2img.js`,
            "composer": `https://cdn.jsdelivr.net/gh/${REPO}/dist/${APP_VERSION}/module-composer.js`,
            "sketchpad": `https://cdn.jsdelivr.net/gh/${REPO}/dist/${APP_VERSION}/module-sketchpad.js`,
            "aim": `https://cdn.jsdelivr.net/gh/${REPO}/dist/${APP_VERSION}/module-aim.js`
        }
    });
    document.head.appendChild(importMap);

    // Inject and execute the core application logic
    const coreScript = document.createElement('script');
    coreScript.type = 'module';
    coreScript.src = `https://cdn.jsdelivr.net/gh/${REPO}/dist/${APP_VERSION}/suite-core.js`;
    document.head.appendChild(coreScript);
}

function initializeApp() {
    // 1. Inject the main HTML structure into the document body.
    document.body.innerHTML = getAppHTML();
    
    // 2. Load all versioned CSS and JS module assets from the CDN.
    loadAssets();
}

// --- Start the application ---
initializeApp();

