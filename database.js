/**
 * @description Handles all interactions with the IndexedDB database using Dexie.js.
 */

const db = new Dexie('MasterCreativeSuiteDB');

db.version(1).stores({
    images: 'id, galleryId', // galleryId can be 'txt2img', 'img2img', etc.
    buddies: 'screenName',
    conversations: 'screenName',
    appState: 'key' // For storing settings like user profile, API URLs
});

// --- Image Functions ---
export async function saveImage(galleryId, imageData) {
    return await db.images.put({ galleryId, ...imageData });
}

export async function loadImages(galleryId) {
    return await db.images.where({ galleryId }).toArray();
}

export async function updateImage(imageData) {
    return await db.images.put(imageData);
}

// --- Buddy & Chat Functions ---
export async function saveBuddy(buddyData) {
    return await db.buddies.put(buddyData);
}

export async function loadBuddies() {
    const buddiesArray = await db.buddies.toArray();
    // Convert array back to the object format the app uses
    const buddiesObject = {};
    buddiesArray.forEach(buddy => {
        buddiesObject[buddy.screenName] = buddy;
    });
    return buddiesObject;
}

export async function saveConversation(screenName, conversationHistory) {
    return await db.conversations.put({ screenName, history: conversationHistory });
}

export async function loadConversation(screenName) {
    const convo = await db.conversations.get(screenName);
    return convo ? convo.history : [];
}

// --- App State / Settings Functions ---
export async function saveAppState(key, value) {
    return await db.appState.put({ key, value });
}

export async function loadAppState(key) {
    const state = await db.appState.get(key);
    return state ? state.value : null;
}

