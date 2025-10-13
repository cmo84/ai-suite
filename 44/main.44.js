/**
 * @description Bootstrap loader for the entire AI Creative Suite application.
 * This script fetches the main HTML structure, loads styles, and initializes the core application logic.
 */

async function loadAssets() {
    const assetPath = window.assetPath;
    const versioned = window.getVersionedFilename; // Use the global function from index.html

    // Inject Stylesheet
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${assetPath}${versioned('index.css')}`;
    document.head.appendChild(link);

    // Create and inject the import map with versioned URLs
    const importMap = {
        imports: {
            "db": `${assetPath}${versioned('database.js')}`,
            "api": `${assetPath}${versioned('api-handler.js')}`,
            "utils": `${assetPath}${versioned('utils.js')}`,
            "txt2img": `${assetPath}${versioned('module-txt2img.js')}`,
            "img2img": `${assetPath}${versioned('module-img2img.js')}`,
            "composer": `${assetPath}${versioned('module-composer.js')}`,
            "sketchpad": `${assetPath}${versioned('module-sketchpad.js')}`,
            "aim": `${assetPath}${versioned('module-aim.js')}`,
            "settings": `${assetPath}${versioned('module-settings.js')}`
        }
    };
    const im = document.createElement('script');
    im.type = 'importmap';
    im.textContent = JSON.stringify(importMap);
    document.head.appendChild(im);

    // Dynamically import and initialize the core application logic (filename is not versioned here)
    await import(`${window.assetPath}${window.getVersionedFilename('suite-core.js')}`);
}


async function initializeApp() {
    const assetPath = window.assetPath;
    const versioned = window.getVersionedFilename; // Use the global function from index.html
    if (!assetPath) {
        console.error("Asset path is not defined.");
        return;
    }
    
    try {
        // 1. Fetch the main HTML structure from the CDN using the versioned filename.
        const response = await fetch(`${assetPath}${versioned('app.html')}`);
        if (!response.ok) {
            throw new Error(`Failed to load ${versioned('app.html')}: ${response.statusText}`);
        }
        const html = await response.text();
        
        // 2. Inject the fetched HTML into the document body.
        document.body.innerHTML = html;

        // --- SET VERSION IN TITLE BAR ---
        const versionEl = document.getElementById('suite-version');
        if (versionEl && window.SUITE_VERSION) {
            versionEl.textContent = `v${window.SUITE_VERSION}`;
        }

        // 3. Load all versioned CSS and JS module assets.
        await loadAssets();

    } catch (error) {
        document.body.innerHTML = `<div style="color: red; padding: 20px;"><h1>Error</h1><p>Could not load application files. Please check the console for details.</p><pre>${error}</pre></div>`;
        console.error(error);
    }
}

// --- Start the application ---
initializeApp();

