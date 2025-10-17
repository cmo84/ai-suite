/**
 * @description This module handles all logic for the AIM Client tab.
 */
import * as api from 'api';
import * as db from 'db';
import { pcmToWav, base64ToArrayBuffer } from 'utils';

let buddies = {};
let conversations = {};
let proactiveIntervalCheck;
let shared;
let activeChats = {}; // Tracks open chat tabs and their state
let currentAttachment = null; // Holds { base64, file } for multimodal chat

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
    const chatTabsBar = document.getElementById('chat-tabs-bar');
    const chatPanelsContainer = document.getElementById('chat-panels-container');
    const clearChatModal = document.getElementById('clear-chat-modal');
    const confirmClearChatBtn = document.getElementById('confirm-clear-chat-btn');
    const cancelClearChatBtn = document.getElementById('cancel-clear-chat-btn');

    let screenNameToClear = null;

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
    
    confirmClearChatBtn.addEventListener('click', async () => {
        if (screenNameToClear) {
            conversations[screenNameToClear] = [];
            await db.saveConversation(screenNameToClear, []);
            const panel = document.getElementById(`chat-panel-${screenNameToClear}`);
            if (panel) {
                panel.querySelector('.chat-messages').innerHTML = '';
            }
            shared.showNotification(`Chat history with ${screenNameToClear} cleared.`);
        }
        clearChatModal.style.display = 'none';
        screenNameToClear = null;
    });
    cancelClearChatBtn.addEventListener('click', () => {
        clearChatModal.style.display = 'none';
        screenNameToClear = null;
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
            buddyEl.addEventListener('dblclick', () => openChatTab(screenName));
            buddyListContainer.appendChild(buddyEl);
        }
    }

    function openChatTab(screenName) {
        if (activeChats[screenName]) {
            setActiveTab(screenName);
            return;
        }

        const buddyData = buddies[screenName];
        
        // Create Tab Button
        const tabBtn = document.createElement('button');
        tabBtn.className = 'chat-tab-btn';
        tabBtn.dataset.screenName = screenName;
        tabBtn.innerHTML = `${screenName} <span class="chat-tab-close-btn">&times;</span>`;
        chatTabsBar.appendChild(tabBtn);

        // Create Chat Panel
        const panel = createChatPanel(screenName, buddyData);
        chatPanelsContainer.appendChild(panel);
        
        activeChats[screenName] = { tab: tabBtn, panel: panel };
        
        // Event Listeners for Tab
        tabBtn.addEventListener('click', (e) => {
            if (e.target.classList.contains('chat-tab-close-btn')) {
                closeChatTab(screenName);
            } else {
                setActiveTab(screenName);
            }
        });

        setActiveTab(screenName);
    }
    
    function closeChatTab(screenName) {
        const chat = activeChats[screenName];
        if (chat) {
            chat.tab.remove();
            chat.panel.remove();
            delete activeChats[screenName];
            
            const remainingTabs = Object.keys(activeChats);
            if (remainingTabs.length > 0) {
                setActiveTab(remainingTabs[0]);
            }
        }
    }

    function setActiveTab(screenName) {
        Object.values(activeChats).forEach(chat => {
            chat.tab.classList.remove('active');
            chat.panel.classList.remove('active');
        });
        activeChats[screenName].tab.classList.add('active');
        activeChats[screenName].panel.classList.add('active');
    }
    
    function createChatPanel(screenName, buddyData) {
        const panel = document.createElement('div');
        panel.id = `chat-panel-${screenName}`;
        panel.className = 'chat-panel';
        panel.dataset.screenName = screenName;
        
        panel.innerHTML = `
            <div class="chat-toolbar">
                <select class="font-face"></select>
                <select class="font-size"></select>
                <label class="proactive-control"><input type="checkbox" class="proactive-toggle"> Proactive</label>
                <select class="proactive-frequency"></select>
                <label class="tts-control"><input type="checkbox" class="tts-toggle"> TTS</label>
                <select class="tts-voice-select"></select>
                <select class="model-select"></select>
                <button class="clear-chat-btn tool-btn tool-btn-danger tool-btn-secondary" title="Clear Chat History">&#128465;</button>
            </div>
            <div class="chat-messages"></div>
            <div class="chat-input-area">
                <div id="attachment-preview-${screenName}" class="mb-2"></div>
                <textarea class="chat-input tool-input" placeholder="Type message..."></textarea>
                <div class="chat-controls">
                    <button class="attach-btn aim-button" title="Attach Image">📎</button>
                    <input type="file" class="attach-input hidden" accept="image/*">
                    <div class="loader"></div>
                    <button class="send-btn aim-button">Send</button>
                </div>
            </div>
        `;
        
        // Populate controls and wire up listeners
        const messagesContainer = panel.querySelector('.chat-messages');
        const input = panel.querySelector('.chat-input');
        const sendBtn = panel.querySelector('.send-btn');
        const attachBtn = panel.querySelector('.attach-btn');
        const attachInput = panel.querySelector('.attach-input');
        const fontFaceSelect = panel.querySelector('.font-face');
        const fontSizeSelect = panel.querySelector('.font-size');
        const proactiveToggle = panel.querySelector('.proactive-toggle');
        const proactiveFrequency = panel.querySelector('.proactive-frequency');
        const ttsToggle = panel.querySelector('.tts-toggle');
        const ttsVoiceSelect = panel.querySelector('.tts-voice-select');
        const modelSelect = panel.querySelector('.model-select');
        const clearChatBtn = panel.querySelector('.clear-chat-btn');
        
        ['Helvetica', 'Arial', 'Times New Roman', 'Courier New', 'Verdana'].forEach(f => fontFaceSelect.add(new Option(f,f)));
        ['10px', '12px', '14px', '16px'].forEach(s => fontSizeSelect.add(new Option(s.replace('px',''),s)));
        Object.entries({15000: 'ASAP', 30000: 'Often', 60000: 'Normal', 180000: 'Slow'}).forEach(([val, txt]) => proactiveFrequency.add(new Option(txt,val)));
        for (const voice in ttsVoices) ttsVoiceSelect.add(new Option(`${voice} (${ttsVoices[voice]})`, voice));
        availableModels.forEach(m => modelSelect.add(new Option(m, m)));
        
        const applyFontSettings = (family, size) => {
            messagesContainer.style.fontFamily = family; messagesContainer.style.fontSize = size;
            input.style.fontFamily = family; input.style.fontSize = size;
            fontFaceSelect.value = family; fontSizeSelect.value = size;
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
        clearChatBtn.onclick = () => { screenNameToClear = screenName; clearChatModal.style.display = 'flex'; };

        applyFontSettings(buddyData.fontSettings.family, buddyData.fontSettings.size);
        proactiveToggle.checked = buddyData.proactive.enabled;
        proactiveFrequency.value = buddyData.proactive.baseInterval;
        ttsToggle.checked = buddyData.ttsEnabled;
        ttsVoiceSelect.value = buddyData.ttsVoice;
        modelSelect.value = buddyData.model;
        
        (conversations[screenName] || []).forEach(msg => displayMessage(messagesContainer, msg.sender, msg.text, msg.isImage, screenName));
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        sendBtn.onclick = () => handleSendMessage(screenName);
        input.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(screenName); }};
        attachBtn.onclick = () => attachInput.click();
        attachInput.onchange = (e) => handleAttachment(e, screenName);

        return panel;
    }
    
    // --- Chat Logic ---
    function handleAttachment(event, screenName) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            currentAttachment = {
                base64: e.target.result.split(',')[1],
                file: file
            };
            const previewContainer = document.getElementById(`attachment-preview-${screenName}`);
            previewContainer.innerHTML = `
                <img src="${e.target.result}" alt="Attachment preview">
                <span>${file.name}</span>
                <button class="tool-btn tool-btn-danger text-xs p-1">&times;</button>
            `;
            previewContainer.querySelector('button').onclick = () => {
                currentAttachment = null;
                previewContainer.innerHTML = '';
            };
        };
        reader.readAsDataURL(file);
        event.target.value = ''; // Reset input
    }
    
    async function handleSendMessage(screenName) {
        const panel = document.getElementById(`chat-panel-${screenName}`);
        const input = panel.querySelector('.chat-input');
        const messageText = input.value.trim();
        if (!messageText && !currentAttachment) return;

        const messagesContainer = panel.querySelector('.messages');
        const loader = panel.querySelector('.loader');
        const sendBtn = panel.querySelector('.send-btn');
        const model = buddies[screenName].model;
        
        addMessageToHistory(screenName, 'You', messageText, !!currentAttachment);
        displayMessage(messagesContainer, 'You', messageText, !!currentAttachment, screenName, currentAttachment?.base64);
        input.value = '';
        if (currentAttachment) {
            document.getElementById(`attachment-preview-${screenName}`).innerHTML = '';
        }
        
        loader.style.display = 'block'; sendBtn.disabled = true;

        try {
            if (messageText.toLowerCase().startsWith('/imagine ')) {
                const prompt = await createHybridPrompt(screenName, messageText.substring(8).trim());
                displayMessage(messagesContainer, 'System', `*~*~Generating image: ${prompt}~*~*`);
                const response = await api.callImageApi({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'] } });
                const msgEl = displayMessage(messagesContainer, screenName, "Check this out!", false, screenName);
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
            currentAttachment = null;
        }
    }
    
    async function addMessageToHistory(screenName, sender, text, isImage = false) {
        if (!conversations[screenName]) conversations[screenName] = [];
        const message = { sender, text, isImage };
        // If the user sent an image, save its base64 data in the history
        if (sender === 'You' && isImage && currentAttachment) {
            message.base64 = currentAttachment.base64;
        }
        conversations[screenName].push(message);
        await db.saveConversation(screenName, conversations[screenName]);
    }
    
    function displayMessage(container, sender, text, isImage = false, screenName = '', base64 = null) {
        const messageEl = document.createElement('div');
        messageEl.className = 'chat-message';
        let senderClass = 'system-message';
        if(sender === 'You') senderClass = 'my-message';
        else if (sender !== 'System') senderClass = 'buddy-message';
        
        let contentHTML = `<span class="screen-name ${senderClass}">${screenName || sender}:</span> ${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}`;
        if(isImage && base64) {
             contentHTML += `<div class="chat-image-container"><img src="data:image/png;base64,${base64}" class="chat-image"></div>`;
        }
        
        messageEl.innerHTML = contentHTML;
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
         
         const history = (conversations[screenName] || []).map(m => {
             const role = m.sender === 'You' ? 'user' : 'model';
             const parts = [];
             if (m.text) parts.push({ text: m.text });
             if (m.base64) parts.push({ inlineData: { mimeType: 'image/png', data: m.base64 }});
             else if (m.isImage) parts.push({ text: `[${role === 'user' ? 'I' : 'You'} sent an image]` });
             return { role, parts };
         });
         
         // Add the current attachment if it exists
         if (currentAttachment) {
            history[history.length - 1].parts.push({
                inlineData: { mimeType: currentAttachment.file.type, data: currentAttachment.base64 }
            });
         }

         const system = `You are a chatbot. Embody this personality: "${personality}". You are talking to a user with this profile: "${userProfile}". You can see images they send. Keep responses concise like a real instant message.`;
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
            openChatTab(screenName);
            const messagesContainer = document.querySelector(`#chat-panel-${screenName} .chat-messages`);
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
    
    // --- Init ---
    await loadState();
    proactiveIntervalCheck = setInterval(proactiveEngine, 5000);
}
