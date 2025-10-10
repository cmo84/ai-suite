/**
 * @description This module handles all logic for the AIM Client tab.
 */
import * as api from 'api';
import * as db from 'db';
import { makeDraggable, pcmToWav, base64ToArrayBuffer } from 'utils';

let buddies = {};
let conversations = {};
let proactiveIntervalCheck;
let shared;

const ttsVoices = {
    "Zephyr": "Bright", "Puck": "Upbeat", "Charon": "Informative", "Kore": "Firm", 
    "Fenrir": "Excitable", "Leda": "Youthful", "Orus": "Firm", "Aoede": "Breezy", 
    "Callirrhoe": "Easy-going", "Autonoe": "Bright", "Enceladus": "Breathy", 
    "Iapetus": "Clear", "Umbriel": "Easy-going", "Algieba": "Smooth", "Despina": "Smooth",
    "Erinome": "Clear", "Algenib": "Gravelly", "Rasalgethi": "Informative", "Laomedeia": "Upbeat",
    "Achernar": "Soft", "Alnilam": "Firm", "Schedar": "Even", "Gacrux": "Mature",
    "Pulcherrima": "Forward", "Achird": "Friendly", "Zubenelgenubi": "Casual",
    "Vindemiatrix": "Gentle", "Sadachbia": "Lively", "Sadaltager": "Knowledgeable", "Sulafat": "Warm"
};

const availableModels = [
    "gemini-2.0-flash",
    "gemini-2.5-flash-preview-05-20",
    "gemini-pro"
];

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
        for(const screenName in buddies) {
            if(screenName !== 'appState'){
                conversations[screenName] = await db.loadConversation(screenName);
            }
        }
        renderBuddyList();
    }

    // --- Event Listeners ---
    saveProfileBtn.addEventListener('click', async () => {
        await db.saveAppState('userProfile', userProfileText.value.trim());
        shared.showNotification('Profile saved!');
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
                ttsEnabled: false,
                ttsVoice: 'Sulafat',
                proactive: { enabled: false, baseInterval: 60000, currentInterval: 60000, nextMessageTimestamp: Date.now() + 60000, awaitingReply: false, isTriggering: false },
                model: availableModels[0]
            };
            buddies[screenName] = newBuddy;
            await db.saveBuddy(newBuddy);
            if (!conversations[screenName]) conversations[screenName] = [];
            
            nameInput.value = '';
            personalityInput.value = '';
            renderBuddyList();
            shared.showNotification(`Buddy "${screenName}" added.`);
        } else if (buddies[screenName]) {
            shared.showNotification("A buddy with that screen name already exists.", 'error');
        } else {
             shared.showNotification("Please provide a screen name and personality.", 'error');
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
                    await loadState();
                    shared.showNotification('Data imported successfully!');
                } else shared.showNotification('Invalid JSON file.', 'error');
            } catch (error) { 
                shared.showNotification('Error reading file.', 'error');
                console.error("Import error:", error); 
            }
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
            chatWindow.style.left = `${Math.floor(Math.random() * (window.innerWidth - 520))}px`;
            chatWindow.style.top = `${Math.floor(Math.random() * (window.innerHeight - 420))}px`;
        }
        chatWindow.style.zIndex = getHighestZIndex() + 1;
        
        chatWindow.innerHTML = `
            <div class="title-bar">
                 <div class="title-bar-text"><span>${screenName}</span></div>
                 <div class="title-bar-buttons"><div class="title-bar-button" onclick="this.closest('.window').style.display='none'">_</div></div>
            </div>
            <div class="window-body">
                <div class="toolbar">
                    <select class="font-face"></select>
                    <select class="font-size"></select>
                    <label class="proactive-control"><input type="checkbox" class="proactive-toggle"> Proactive</label>
                    <select class="proactive-frequency"></select>
                    <label class="tts-control"><input type="checkbox" class="tts-toggle"> TTS</label>
                    <select class="tts-voice-select"></select>
                    <select class="model-select"></select>
                </div>
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
        const fontFaceSelect = chatWindow.querySelector('.font-face');
        const fontSizeSelect = chatWindow.querySelector('.font-size');
        const proactiveToggle = chatWindow.querySelector('.proactive-toggle');
        const proactiveFrequency = chatWindow.querySelector('.proactive-frequency');
        const ttsToggle = chatWindow.querySelector('.tts-toggle');
        const ttsVoiceSelect = chatWindow.querySelector('.tts-voice-select');
        const modelSelect = chatWindow.querySelector('.model-select');

        // Populate controls
        ['Helvetica', 'Arial', 'Times New Roman', 'Courier New', 'Verdana'].forEach(f => fontFaceSelect.add(new Option(f,f)));
        ['10px', '12px', '14px', '16px'].forEach(s => fontSizeSelect.add(new Option(s.replace('px',''),s)));
        Object.entries({15000: 'ASAP', 30000: 'Often', 60000: 'Normal', 180000: 'Slow'}).forEach(([val, txt]) => proactiveFrequency.add(new Option(txt,val)));
        for (const voice in ttsVoices) ttsVoiceSelect.add(new Option(`${voice} (${ttsVoices[voice]})`, voice));
        availableModels.forEach(m => modelSelect.add(new Option(m, m)));
        
        // Load settings and attach listeners
        const applyFontSettings = (family, size) => {
            messagesContainer.style.fontFamily = family;
            messagesContainer.style.fontSize = size;
            input.style.fontFamily = family;
            input.style.fontSize = size;
            fontFaceSelect.value = family;
            fontSizeSelect.value = size;
        };
        fontFaceSelect.onchange = () => { buddyData.fontSettings.family = fontFaceSelect.value; applyFontSettings(buddyData.fontSettings.family, buddyData.fontSettings.size); db.saveBuddy(buddyData); };
        fontSizeSelect.onchange = () => { buddyData.fontSettings.size = fontSizeSelect.value; applyFontSettings(buddyData.fontSettings.family, buddyData.fontSettings.size); db.saveBuddy(buddyData); };
        proactiveToggle.onchange = proactiveFrequency.onchange = () => {
            buddyData.proactive.enabled = proactiveToggle.checked;
            buddyData.proactive.baseInterval = parseInt(proactiveFrequency.value);
            buddyData.proactive.currentInterval = buddyData.proactive.baseInterval;
            buddyData.proactive.nextMessageTimestamp = Date.now() + buddyData.proactive.currentInterval;
            db.saveBuddy(buddyData);
        };
        ttsToggle.onchange = () => { buddyData.ttsEnabled = ttsToggle.checked; db.saveBuddy(buddyData); };
        ttsVoiceSelect.onchange = () => { buddyData.ttsVoice = ttsVoiceSelect.value; db.saveBuddy(buddyData); };
        modelSelect.onchange = () => { buddyData.model = modelSelect.value; db.saveBuddy(buddyData); };

        applyFontSettings(buddyData.fontSettings.family, buddyData.fontSettings.size);
        proactiveToggle.checked = buddyData.proactive.enabled;
        proactiveFrequency.value = buddyData.proactive.baseInterval;
        ttsToggle.checked = buddyData.ttsEnabled;
        ttsVoiceSelect.value = buddyData.ttsVoice;
        modelSelect.value = buddyData.model;
        
        // Load history and wire up chat
        (conversations[screenName] || []).forEach(msg => displayMessage(messagesContainer, msg.sender, msg.text, msg.isImage, screenName));
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        sendBtn.onclick = () => handleSendMessage(screenName);
        input.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(screenName); }};
    }
    
    // --- Chat Logic ---
    async function handleSendMessage(screenName) {
        const chatWindow = document.getElementById(`chat-window-${screenName}`);
        const input = chatWindow.querySelector('.chat-input');
        const messageText = input.value.trim();
        if (!messageText) return;

        const messagesContainer = chatWindow.querySelector('.messages');
        const loader = chatWindow.querySelector('.loader');
        const sendBtn = chatWindow.querySelector('.send-btn');
        const model = buddies[screenName].model;
        
        addMessageToHistory(screenName, 'You', messageText);
        displayMessage(messagesContainer, 'You', messageText);
        input.value = '';
        
        loader.style.display = 'block'; sendBtn.disabled = true;

        try {
            if (messageText.toLowerCase().startsWith('/imagine ')) {
                const prompt = await createHybridPrompt(screenName, messageText.substring(8).trim());
                displayMessage(messagesContainer, 'System', `*~*~Sara is drawing: ${prompt}~*~*`);
                const response = await api.callImageApi({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'] }});
                const msgEl = displayMessage(messagesContainer, screenName, "omg check this out!", false, screenName);
                appendImage(msgEl, response, prompt);
                addMessageToHistory(screenName, screenName, response, true);
            } else {
                const payload = await buildTextPayload(screenName);
                const response = await api.callTextApi(payload, model);
                const msgEl = displayMessage(messagesContainer, screenName, response, false, screenName);
                addMessageToHistory(screenName, screenName, response);
                if (buddies[screenName].ttsEnabled) {
                    const { audioBase64, sampleRate } = await api.callTtsApi(response, buddies[screenName].ttsVoice);
                    appendAudioControls(msgEl, audioBase64, sampleRate);
                }
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
    
    function displayMessage(container, sender, text, isImage = false, screenName = '') {
        const messageEl = document.createElement('div');
        messageEl.className = 'message p-1';
        let senderClass = 'system-message';
        if(sender === 'You') senderClass = 'my-message';
        else if (sender !== 'System') senderClass = 'buddy-message';
        
        messageEl.innerHTML = `<span class="screen-name ${senderClass}">${screenName || sender}:</span> ${isImage ? '' : text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}`;
        container.appendChild(messageEl);
        container.scrollTop = container.scrollHeight;
        return messageEl;
    }

    function appendImage(messageEl, base64, prompt) {
        const imgContainer = document.createElement('div');
        imgContainer.className = 'chat-image-container';
        imgContainer.innerHTML = `<img src="data:image/png;base64,${base64}" class="chat-image" alt="${prompt}"><a href="data:image/png;base64,${base64}" download="${prompt.slice(0,20)}.png" class="download-image-btn">Save</a>`;
        messageEl.appendChild(imgContainer);
    }
    
    function appendAudioControls(messageEl, audioBase64, sampleRate) {
        const pcmData = base64ToArrayBuffer(audioBase64);
        const wavBlob = pcmToWav(pcmData, sampleRate);
        const audioUrl = URL.createObjectURL(wavBlob);
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.autoplay = true;
        audio.src = audioUrl;
        audio.classList.add('w-full', 'h-8', 'mt-2');
        messageEl.appendChild(audio);
    }

    async function createHybridPrompt(screenName, userPrompt) {
         const history = (conversations[screenName] || []).filter(m => !m.isImage).slice(-6).map(m => `${m.sender}: ${m.text}`).join('\n');
         const personality = buddies[screenName].personality;
         const userProfile = await db.loadAppState('userProfile') || 'a user';
         const model = buddies[screenName].model;
         const system = `You are an AI creating a concise, visually descriptive prompt for an image generator. Synthesize the user's profile, character's personality, conversation, and user's request into one creative sentence. Output only the prompt.`;
         const query = `User Profile: "${userProfile}".\nCharacter Personality: "${personality}"\nConversation:\n${history}\nUser Request: "${userPrompt}"`;
         return await api.callTextApi({ contents: [{ parts: [{ text: query }] }], systemInstruction: { parts: [{ text: system }] } }, model);
    }
    
    async function buildTextPayload(screenName) {
         const personality = buddies[screenName].personality;
         const userProfile = await db.loadAppState('userProfile') || 'a user';
         const history = (conversations[screenName] || []).map(m => ({ role: m.sender === 'You' ? 'user' : 'model', parts: [{ text: m.isImage ? `[I just sent an image]` : m.text }] }));
         const system = `You are a chatbot. Embody this personality: "${personality}". You are talking to a user with this profile: "${userProfile}". Keep responses concise like a real instant message.`;
         return { contents: history, systemInstruction: { parts: [{ text: system }] } };
    }

    async function callProactiveTextApi(screenName) {
        const { personality, model } = buddies[screenName];
        const userProfile = await db.loadAppState('userProfile') || 'a user';
        const history = (conversations[screenName] || []).map(m => ({ role: m.sender === 'You' ? 'user' : 'model', parts: [{ text: m.isImage ? `[I sent an image]` : m.text }] }));
        let system;
        if (history.length === 0) {
             system = `You are a chatbot with personality: "${personality}". You are talking to a user with profile: "${userProfile}". This is your first message. Introduce yourself and start a conversation. Be concise and include text, not just an emoji.`;
        } else {
             system = `You are a chatbot with personality: "${personality}". You are talking to a user with profile: "${userProfile}". Review the chat history, then send a new, proactive message to re-engage them. Start a new, natural thought. Be concise and include text, not just an emoji.`;
        }
        return await api.callTextApi({ contents: history, systemInstruction: { parts: [{ text: system }] } }, model);
    }

    async function triggerProactiveMessage(screenName) {
        const buddy = buddies[screenName];
        if (!buddy?.proactive.enabled) return;
        try {
            buddy.proactive.isTriggering = true;
            await db.saveBuddy(buddy);
            const messageText = await callProactiveTextApi(screenName);
            if (!messageText || !messageText.trim() || /^\p{Emoji_Presentation}$/u.test(messageText.trim())) {
                return; // Skip empty/emoji-only messages
            }
            openChatWindow(screenName);
            const messagesContainer = document.querySelector(`#chat-window-${screenName} .messages`);
            const msgEl = displayMessage(messagesContainer, screenName, messageText, false, screenName);
            addMessageToHistory(screenName, screenName, messageText);
            if (buddy.ttsEnabled) {
                const { audioBase64, sampleRate } = await api.callTtsApi(messageText, buddy.ttsVoice);
                appendAudioControls(msgEl, audioBase64, sampleRate);
            }
            buddy.proactive.awaitingReply = true;
            buddy.proactive.currentInterval *= 2; 
            buddy.proactive.nextMessageTimestamp = Date.now() + buddy.proactive.currentInterval;
        } catch (error) {
            console.error(`Proactive error for ${screenName}:`, error);
            buddy.proactive.nextMessageTimestamp = Date.now() + (buddy.proactive.currentInterval || buddy.proactive.baseInterval);
        } finally {
            buddy.proactive.isTriggering = false;
            await db.saveBuddy(buddy);
        }
    }

    function proactiveEngine() {
        const now = Date.now();
        for (const screenName in buddies) {
            if (screenName === 'appState') continue;
            const buddy = buddies[screenName];
            if (buddy.proactive?.enabled && !buddy.proactive.isTriggering && now > buddy.proactive.nextMessageTimestamp) {
                triggerProactiveMessage(screenName);
            }
        }
    }

    // --- Window Management ---
    async function saveWindowGeometry(element) {
        const screenName = element.dataset.screenName;
        if (!screenName) return;

        const buddy = buddies[screenName];
        if (!buddy) return;

        buddy.windowGeometry = {
            top: element.style.top, left: element.style.left,
            width: getComputedStyle(element).width, height: getComputedStyle(element).height,
        };
        await db.saveBuddy(buddy);
    }
    
    function getHighestZIndex() {
        return Array.from(document.querySelectorAll('.window'))
            .reduce((maxZ, el) => Math.max(maxZ, +el.style.zIndex || 0), 20);
    }
    
    // --- Init ---
    await loadState();
    proactiveIntervalCheck = setInterval(proactiveEngine, 5000);
}

