const API = "http://127.0.0.1:8000";
let currentChatId = null;

// ─── ON PAGE LOAD ───
window.onload = async () => {
    await loadChatHistory();
};

// ─── NEW CHAT ───
document.getElementById("newChatBtn").addEventListener("click", async () => {
    const res = await fetch(`${API}/chat/new`, { method: "POST" });
    const data = await res.json();
    currentChatId = data.chat_id;
    clearMessages();
    await loadChatHistory();
    setActiveChat(currentChatId);
    document.getElementById("chatTitle").textContent = "New Chat";
});

// ─── SEND MESSAGE (text) ───
document.getElementById("sendBtn").addEventListener("click", sendMessage);
document.getElementById("messageInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
});

async function sendMessage() {
    const input = document.getElementById("messageInput");
    const text = input.value.trim();
    if (!text) return;
    if (!currentChatId) {
        alert("Please start a new chat first!");
        return;
    }

    input.value = "";
    appendMessage("user", text);
    const loading = appendLoading();

    try {
        const res = await fetch(`${API}/chat/${currentChatId}/message`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: currentChatId, message: text })
        });
        const data = await res.json();
        loading.remove();
        appendMessage("assistant", data.response);
    } catch (err) {
        loading.remove();
        appendMessage("assistant", "❌ Something went wrong. Is the backend running?");
    }
}

// ─── IMAGE UPLOAD ───
document.getElementById("imageUpload").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Auto-create a new chat if none exists
    if (!currentChatId) {
        const res = await fetch(`${API}/chat/new`, { method: "POST" });
        const data = await res.json();
        currentChatId = data.chat_id;
        await loadChatHistory();
        setActiveChat(currentChatId);
    }

    // Show image preview in chat
    clearWelcome();
    appendImageMessage(file);
    const loading = appendLoading();
    document.getElementById("sendBtn").disabled = true;

    try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`${API}/chat/${currentChatId}/analyze`, {
            method: "POST",
            body: formData
        });
        const data = await res.json();
        loading.remove();

        // Show prediction badge + AI response
        appendPrediction(data.prediction);
        appendMessage("assistant", data.response);

        // Update sidebar title
        await loadChatHistory();
        setActiveChat(currentChatId);
        document.getElementById("chatTitle").textContent =
            `${data.prediction.plant} - ${data.prediction.condition}`;

    } catch (err) {
        loading.remove();
        appendMessage("assistant", "❌ Could not analyze image. Is the backend running?");
    }

    document.getElementById("sendBtn").disabled = false;
    e.target.value = "";
});

// ─── LOAD CHAT HISTORY (sidebar) ───
async function loadChatHistory() {
    const res = await fetch(`${API}/chat/history`);
    const data = await res.json();
    const container = document.getElementById("chatHistory");
    container.innerHTML = "";

    if (data.chats.length === 0) {
        container.innerHTML = `<p style="color:#555; font-size:13px; padding:12px;">No chats yet</p>`;
        return;
    }

    // Show newest first
    data.chats.reverse().forEach(chat => {
        const div = document.createElement("div");
        div.className = "chat-item";
        div.textContent = chat.title;
        div.dataset.id = chat.id;
        div.addEventListener("click", () => loadChat(chat.id));
        container.appendChild(div);
    });
}

// ─── LOAD A SPECIFIC CHAT ───
async function loadChat(chatId) {
    const res = await fetch(`${API}/chat/${chatId}`);
    const data = await res.json();
    currentChatId = chatId;
    clearMessages();
    setActiveChat(chatId);

    const title = data.messages.length > 0
        ? document.querySelector(`[data-id="${chatId}"]`)?.textContent
        : "New Chat";
    document.getElementById("chatTitle").textContent = title || "Chat";

    data.messages.forEach(msg => {
        if (msg.type === "image") {
            const div = document.createElement("div");
            div.className = "message user";
            div.innerHTML = `<div class="message-content">📸 ${msg.content}</div>`;
            document.getElementById("messages").appendChild(div);
            if (msg.prediction) appendPrediction(msg.prediction);
        } else {
            appendMessage(msg.role, msg.content);
        }
    });
}

// ─── UI HELPERS ───
function clearMessages() {
    document.getElementById("messages").innerHTML = `
        <div class="welcome-message">
            <div class="welcome-icon">🌱</div>
            <h2>Welcome to Plant Doctor AI</h2>
            <p>Upload a photo of a plant leaf and I'll diagnose any diseases and tell you how to treat them.</p>
            <div class="welcome-tips">
                <div class="tip">📸 Upload a clear photo of the leaf</div>
                <div class="tip">🔍 Get instant disease diagnosis</div>
                <div class="tip">💊 Receive treatment advice</div>
            </div>
        </div>`;
}

function clearWelcome() {
    const welcome = document.querySelector(".welcome-message");
    if (welcome) welcome.remove();
}

function appendMessage(role, text) {
    clearWelcome();
    const messages = document.getElementById("messages");
    const div = document.createElement("div");
    div.className = `message ${role}`;
    div.innerHTML = `<div class="message-content">${formatText(text)}</div>`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
}

function appendImageMessage(file) {
    const messages = document.getElementById("messages");
    const url = URL.createObjectURL(file);
    const div = document.createElement("div");
    div.className = "message user";
    div.innerHTML = `
        <img src="${url}" class="message-image" />
        <div class="message-content">📸 ${file.name}</div>`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

function appendPrediction(prediction) {
    const messages = document.getElementById("messages");
    const div = document.createElement("div");
    div.className = "message assistant";
    div.innerHTML = `
        <div class="prediction-badge">
            <span class="plant-name">🌿 ${prediction.plant}</span>
            <span class="condition">⚠️ ${prediction.condition}</span>
            <span class="confidence">Confidence: ${prediction.confidence}%</span>
        </div>`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

function appendLoading() {
    const messages = document.getElementById("messages");
    const div = document.createElement("div");
    div.className = "message assistant";
    div.innerHTML = `
        <div class="loading-dots">
            <span></span><span></span><span></span>
        </div>`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
}

function setActiveChat(chatId) {
    document.querySelectorAll(".chat-item").forEach(el => {
        el.classList.toggle("active", el.dataset.id === chatId);
    });
}

function formatText(text) {
    // Convert markdown-like formatting to HTML
    return text
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/\n/g, "<br>");
}