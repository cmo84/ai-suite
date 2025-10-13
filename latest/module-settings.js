/**
 * @description This module handles all logic for the Settings tab.
 */
import * as db from 'db';
import * as api from 'api';

let shared;

const safetyCategories = [
    { id: 'HARM_CATEGORY_HARASSMENT', name: 'Harassment' },
    { id: 'HARM_CATEGORY_HATE_SPEECH', name: 'Hate Speech' },
    { id: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', name: 'Sexually Explicit' },
    { id: 'HARM_CATEGORY_DANGEROUS_CONTENT', name: 'Dangerous Content' },
];

const safetyThresholds = [
    { id: 'BLOCK_NONE', name: 'Block None (Unsafe)' },
    { id: 'BLOCK_ONLY_HIGH', name: 'Block High Severity' },
    { id: 'BLOCK_MEDIUM_AND_ABOVE', name: 'Block Medium & High (Recommended)' },
    { id: 'BLOCK_LOW_AND_ABOVE', name: 'Block Low, Medium & High (Strict)' },
];

export async function initialize(sharedUtils) {
    shared = sharedUtils;
    const container = document.getElementById('safety-settings-container');
    const saveBtn = document.getElementById('save-safety-settings-btn');
    
    if (!container || !saveBtn) return;

    // Load settings from DB
    let currentSettings = await db.loadAppState('safetySettings');
    if (!currentSettings || currentSettings.length !== 4) {
        // Use a reasonable default if not yet saved
        currentSettings = [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        ];
    }
    
    // Push the loaded settings to the API handler on startup
    api.updateSafetySettings(currentSettings);

    // Render the UI with the current settings
    render(container, currentSettings);

    // Save button logic
    saveBtn.addEventListener('click', async () => {
        const newSettings = safetyCategories.map(cat => {
            const select = document.getElementById(`safety-select-${cat.id}`);
            return { category: cat.id, threshold: select.value };
        });
        
        await db.saveAppState('safetySettings', newSettings);
        api.updateSafetySettings(newSettings);
        shared.showNotification('Safety settings saved!');
    });
}

function render(container, settings) {
    container.innerHTML = '';
    safetyCategories.forEach(category => {
        const setting = settings.find(s => s.category === category.id);
        const currentThreshold = setting ? setting.threshold : 'BLOCK_MEDIUM_AND_ABOVE';
        
        const div = document.createElement('div');
        div.className = 'grid grid-cols-1 md:grid-cols-3 items-center gap-4';
        
        const label = document.createElement('label');
        label.htmlFor = `safety-select-${category.id}`;
        label.className = 'text-gray-300 font-medium md:col-span-1';
        label.textContent = category.name;
        
        const select = document.createElement('select');
        select.id = `safety-select-${category.id}`;
        select.className = 'tool-input md:col-span-2 bg-gray-700';
        
        safetyThresholds.forEach(threshold => {
            const option = document.createElement('option');
            option.value = threshold.id;
            option.textContent = threshold.name;
            if (threshold.id === currentThreshold) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        
        div.appendChild(label);
        div.appendChild(select);
        container.appendChild(div);
    });
}

