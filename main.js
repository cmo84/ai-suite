/**
 * @description Bootstrap loader for the entire AI Creative Suite application.
 * This script fetches the main HTML structure, loads styles, and initializes the core application logic.
 */

async function loadAssets() {
    const assetPath = window.assetPath;
    const cacheBust = window.cacheBust || '';

    // Inject Stylesheet
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${assetPath}index.css${cacheBust}`;
    document.head.appendChild(link);

    // Create and inject the import map
    const importMap = {
        imports: {
            "db": `${assetPath}database.js${cacheBust}`,
            "api": `${assetPath}api-handler.js${cacheBust}`,
            "utils": `${assetPath}utils.js${cacheBust}`,
            "txt2img": `${assetPath}module-txt2img.js${cacheBust}`,
            "img2img": `${assetPath}module-img2img.js${cacheBust}`,
            "composer": `${assetPath}module-composer.js${cacheBust}`,
            "sketchpad": `${assetPath}module-sketchpad.js${cacheBust}`,
            "aim": `${assetPath}module-aim.js${cacheBust}`
        }
    };
    const im = document.createElement('script');
    im.type = 'importmap';
    im.textContent = JSON.stringify(importMap);
    document.head.appendChild(im);

    // Dynamically import and initialize the core application logic
    await import(`${assetPath}suite-core.js${cacheBust}`);
}


async function initializeApp() {
    const assetPath = window.assetPath;
    const cacheBust = window.cacheBust || '';
    if (!assetPath) {
        console.error("Asset path is not defined.");
        return;
    }
    
    try {
        // 1. Fetch the main HTML structure from the CDN.
        const response = await fetch(`${assetPath}app.html${cacheBust}`);
        if (!response.ok) {
            throw new Error(`Failed to load app.html: ${response.statusText}`);
        }
        const html = await response.text();
        
        // 2. Inject the fetched HTML into the document body.
        document.body.innerHTML = html;

        // 3. Load all versioned CSS and JS module assets.
        await loadAssets();

    } catch (error) {
        document.body.innerHTML = `<div style="color: red; padding: 20px;"><h1>Error</h1><p>Could not load application files. Please check the console for details.</p><pre>${error}</pre></div>`;
        console.error(error);
    }
}

// --- Start the application ---
initializeApp();

