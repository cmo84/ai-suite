/**
 * @description This module handles all logic for the AIM Client tab.
 */
import * as api from 'api';
import * as db from 'db';
import { makeDraggable } from 'utils';

let buddies = {};
let conversations = {};
let proactiveIntervalCheck;
let shared;

export async function initialize(sharedUtils) {
    shared = sharedUtils;
    // --- DOM Elements ---
    const buddyListContainer = document.getElementById('buddies-container');
    const addBuddyBtn = document.getElementById('add-buddy-btn');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');
    const userProfileText = document.getElementById('user-profile-text');
    const saveProfileBtn = document.getElementById('save-profile-btn');

    // --- State and Settings ---
    async function loadState() {
        buddies = await db.loadBuddies();
        userProfileText.value = await db.loadAppState('userProfile') || '';
        
        // Load conversations for existing buddies
        for(const screenName in buddies) {
            if(screenName !== 'appState'){
                conversations[screenName] = await db.loadConversation(screenName);
            }
        }
        renderBuddyList();
    }
    
    function getAppState() {
        if (!buddies.appState) buddies.appState = {};
        return buddies.appState;
    }

    // --- Event Listeners ---
    saveProfileBtn.addEventListener('click', async () => {
        await db.saveAppState('userProfile', userProfileText.value.trim());
        alert('Profile saved!');
    });

    addBuddyBtn.addEventListener('click', async () => {
        const nameInput = document.getElementById('new-buddy-name');
        const personalityInput = document.getElementById('new-buddy-personality');
        const screenName = nameInput.value.trim().replace(/[^a-zA-Z0-9_]/g, '');
        const personality = personalityInput.value.trim();

        if (screenName && personality && !buddies[screenName]) {
            const newBuddy = { 
                screenName,
                personality,
                fontSettings: { family: 'Helvetica', size: '12px' },
                proactive: { enabled: false, baseInterval: 60000, currentInterval: 60000, nextMessageTimestamp: Date.now() + 60000, awaitingReply: false }
            };
            buddies[screenName] = newBuddy;
            await db.saveBuddy(newBuddy);

            if (!conversations[screenName]) conversations[screenName] = [];
            
            nameInput.value = '';
            personalityInput.value = '';
            renderBuddyList();
        } else if (buddies[screenName]) {
            alert("A buddy with that screen name already exists.");
        }
    });

    exportBtn.addEventListener('click', async () => {
        document.querySelectorAll('.chat-window').forEach(win => {
            if (win.style.display !== 'none') saveWindowGeometry(win);
        });
        
        const dataToExport = { buddies, conversations, appState: { userProfile: await db.loadAppState('userProfile') } };
        const dataStr = JSON.stringify(dataToExport, null, 2);
        const dataBlob = new Blob([dataStr], {type: "application/json"});
        const url = URL.createObjectURL(dataBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'gemini_aim_backup.json';
        a.click();
        URL.revokeObjectURL(url);
    });

    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (importedData.buddies && importedData.conversations) {
                    for(const buddy of Object.values(importedData.buddies)) { await db.saveBuddy(buddy); }
                    for(const [screenName, history] of Object.entries(importedData.conversations)) { await db.saveConversation(screenName, history); }
                    if(importedData.appState?.userProfile) await db.saveAppState('userProfile', importedData.appState.userProfile);
                    
                    await loadState(); // Reload everything from DB
                    alert('Data imported successfully!');
                } else alert('Invalid JSON file.');
            } catch (error) { alert('Error reading file.'); console.error("Import error:", error); }
        };
        reader.readAsText(file);
        importFile.value = '';
    });
    
    // --- UI Functions ---
    function renderBuddyList() {
        const buddyCount = Object.keys(buddies).filter(k => k !== 'appState').length;
        buddyListContainer.innerHTML = `<div class="buddy-group">Buddies (${buddyCount}/${buddyCount})</div>`;
        for (const screenName in buddies) {
            if (screenName === 'appState') continue;
            const buddyEl = document.createElement('div');
            buddyEl.className = 'buddy';
            buddyEl.innerHTML = `<span>${screenName}</span>`;
            buddyEl.addEventListener('dblclick', () => openChatWindow(screenName));
            buddyListContainer.appendChild(buddyEl);
        }
    }

    function openChatWindow(screenName) {
        const windowId = `chat-window-${screenName}`;
        let chatWindow = document.getElementById(windowId);
        const buddyData = buddies[screenName];

        if (chatWindow) {
            chatWindow.style.display = 'flex';
            chatWindow.style.zIndex = getHighestZIndex() + 1;
            return;
        }

        chatWindow = document.createElement('div');
        chatWindow.id = windowId;
        chatWindow.dataset.screenName = screenName;
        chatWindow.className = 'window chat-window';
        
        if (buddyData.windowGeometry) Object.assign(chatWindow.style, buddyData.windowGeometry);
        else {
            const randomLeft = Math.floor(Math.random() * (window.innerWidth - 520));
            const randomTop = Math.floor(Math.random() * (window.innerHeight - 420));
            chatWindow.style.left = `${randomLeft > 0 ? randomLeft : 20}px`;
            chatWindow.style.top = `${randomTop > 0 ? randomTop : 20}px`;
        }
        chatWindow.style.zIndex = getHighestZIndex() + 1;
        
        chatWindow.innerHTML = `
            <div class="title-bar">
                 <div class="title-bar-text"><span>${screenName}</span></div>
                 <div class="title-bar-buttons"><div class="title-bar-button" onclick="this.closest('.window').style.display='none'">_</div></div>
            </div>
            <div class="window-body">
                <div class="messages"></div>
                <div class="input-area p-2">
                    <textarea class="chat-input" placeholder="Type message..."></textarea>
                    <div class="chat-controls">
                        <div class="loader"></div>
                        <button class="send-btn aim-button">Send</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(chatWindow);
        chatWindow.style.display = 'flex';
        makeDraggable(chatWindow, saveWindowGeometry);
        
        const messagesContainer = chatWindow.querySelector('.messages');
        const input = chatWindow.querySelector('.chat-input');
        const sendBtn = chatWindow.querySelector('.send-btn');
        
        conversations[screenName]?.forEach(msg => displayMessage(messagesContainer, msg.sender, msg.text, msg.isImage, screenName));
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        sendBtn.addEventListener('click', () => handleSendMessage(screenName));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(screenName); }
        });
    }
    
    // --- Chat Logic ---
    async function handleSendMessage(screenName) {
        const chatWindow = document.getElementById(`chat-window-${screenName}`);
        const input = chatWindow.querySelector('.chat-input');
        const messagesContainer = chatWindow.querySelector('.messages');
        const loader = chatWindow.querySelector('.loader');
        const sendBtn = chatWindow.querySelector('.send-btn');
        const messageText = input.value.trim();
        if (!messageText) return;
        
        addMessageToHistory(screenName, 'You', messageText);
        displayMessage(messagesContainer, 'You', messageText, false, screenName);
        input.value = '';
        
        loader.style.display = 'block'; sendBtn.disabled = true;

        try {
            if (messageText.toLowerCase().startsWith('/imagine ')) {
                const prompt = await createHybridPrompt(screenName, messageText.substring(8).trim());
                const response = await api.callImageApi({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'] }});
                addMessageToHistory(screenName, screenName, response, true);
                displayMessage(messagesContainer, screenName, response, true, screenName);
            } else {
                const payload = await buildTextPayload(screenName);
                const response = await api.callTextApi(payload);
                addMessageToHistory(screenName, screenName, response);
                displayMessage(messagesContainer, screenName, response, false, screenName);
            }
        } catch (error) {
            console.error("API Error:", error);
            displayMessage(messagesContainer, 'System', `Error: ${error.message}`);
        } finally {
            loader.style.display = 'none'; sendBtn.disabled = false;
        }
    }
    
    async function addMessageToHistory(screenName, sender, text, isImage = false) {
        if (!conversations[screenName]) conversations[screenName] = [];
        conversations[screenName].push({ sender, text, isImage });
        await db.saveConversation(screenName, conversations[screenName]);
    }
    
    // ... other AIM functions (displayMessage, createHybridPrompt, buildTextPayload)
    function displayMessage(container, sender, text, isImage = false, screenName = '') {
        const messageEl = document.createElement('div');
        messageEl.className = 'message p-1';
        let senderClass = 'system-message';
        if(sender === 'You') senderClass = 'my-message';
        else if (sender !== 'System') senderClass = 'buddy-message';
        
        const sanitizedText = isImage ? '' : text.replace(/</g, "&lt;").replace(/>/g, "&gt;");

        if (isImage) {
             messageEl.innerHTML = `<span class="screen-name ${senderClass}">${screenName}:</span><br><div class="chat-image-container"><img src="data:image/png;base64,${text}" class="chat-image"><a href="data:image/png;base64,${text}" download="${screenName}.png" class="download-image-btn">↓ Save</a></div>`;
        } else {
            messageEl.innerHTML = `<span class="screen-name ${senderClass}">${sender}:</span> ${sanitizedText.replace(/\n/g, '<br>')}`;
        }
        container.appendChild(messageEl);
        container.scrollTop = container.scrollHeight;
    }

    async function createHybridPrompt(screenName, userPrompt) {
         const recentHistory = (conversations[screenName] || []).filter(m => !m.isImage).slice(-6).map(m => `${m.sender}: ${m.text}`).join('\n');
         const personality = buddies[screenName].personality;
         const userProfile = await db.loadAppState('userProfile') || 'a user';
         const systemPrompt = `You are an AI assistant creating a single, concise, visually descriptive prompt for an image generator based on a character's personality, conversation history, and a user's request. Synthesize these into one creative sentence. Output only the prompt.`;
         const summarizationUserQuery = `User Profile: "${userProfile}".\nYour Personality: "${personality}"\nConversation:\n${recentHistory}\nUser Request: "${userPrompt}"`;
         return await api.callTextApi({ contents: [{ parts: [{ text: summarizationUserQuery }] }], systemInstruction: { parts: [{ text: systemPrompt }] } });
    }
    
    async function buildTextPayload(screenName) {
         const personality = buddies[screenName].personality;
         const userProfile = await db.loadAppState('userProfile') || 'a user';
         const history = (conversations[screenName] || [])
            .filter(m => !m.isImage)
            .map(m => ({
                role: m.sender === 'You' ? 'user' : 'model',
                parts: [{ text: m.text }]
            }));
         
         const systemPrompt = `You are a chatbot. Embody this personality: "${personality}". You are talking to a user with this profile: "${userProfile}". Keep responses concise like a real instant message.`;
         return { contents: history, systemInstruction: { parts: [{ text: systemPrompt }] } };
    }

    // --- Window Management ---
    function saveWindowGeometry(element) {
        const screenName = element.dataset.screenName;
        if (!screenName || !buddies[screenName]) return;
        
        const computedStyle = getComputedStyle(element);
        buddies[screenName].windowGeometry = {
            top: element.style.top, left: element.style.left,
            width: computedStyle.width, height: computedStyle.height,
        };
        db.saveBuddy(buddies[screenName]);
    }
    
    function getHighestZIndex() {
        return Array.from(document.querySelectorAll('.window'))
            .reduce((maxZ, el) => Math.max(maxZ, +el.style.zIndex || 0), 20);
    }
    
    // --- Init ---
    await loadState();
}

