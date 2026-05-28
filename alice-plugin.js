/**
 * Alice Chatbot Plugin
 * A standalone, embeddable chatbot widget.
 * 
 * Usage:
 *   <script>
 *     window.AliceChatConfig = {
 *       apiUrl:        'https://your-api.com/api/v1/freeChat',  // required
 *       signupUrl:     'https://your-app.com/signup',           // required
 *       maxMessages:   3,                                        // optional, default: 3
 *       title:         'Alice AI Guide',                         // optional
 *       welcomeMessage:'Hello! How can I help you today?',       // optional
 *       primaryColor:  '#1D7A74',                                // optional
 *     };
 *   </script>
 *   <script src="alice-plugin.js"></script>
 */
(function () {
    // ─── CONFIG ───────────────────────────────────────────────────────────────
    const cfg = Object.assign({
        //actual backend api need to be updated
        apiUrl: 'http://clientapp.narola.online:2450/api/v1/nurii-chat',
        signupUrl: 'https://chat.alice-ai.co.uk/signup',
        maxMessages: 3,
        title: 'Alice AI Guide',
        welcomeMessage: "Hello! I'm Alice. How can I help you today?",
        primaryColor: '#1D7A74',
        suggestions: [
            "How do I choose the right nursery for my child?",
            "What should I look for when visiting a nursery?",
            "Is my child ready to start nursery?",
            "What funding am I entitled to and how does it work?"
        ]
    }, window.AliceChatConfig || {});

    // ─── STATE ────────────────────────────────────────────────────────────────
    let isOpen = false;

    const SESSION_KEY = 'alice_session_id';
    const COUNT_KEY = 'alice_msg_count';   // how many messages already sent
    const LIMIT_KEY = 'alice_limit_hit';   // 'true' when limit reached

    const generateUUID = () => {
        try { return crypto.randomUUID(); }
        catch (_) {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });
        }
    };

    let sessionId = localStorage.getItem(SESSION_KEY) || generateUUID();
    localStorage.setItem(SESSION_KEY, sessionId);

    // messagesSent = number of messages already consumed by the user
    let messagesSent = parseInt(localStorage.getItem(COUNT_KEY) || '0', 10);
    if (isNaN(messagesSent)) messagesSent = 0;

    const limitAlreadyHit = localStorage.getItem(LIMIT_KEY) === 'true';
    const remaining = Math.max(0, cfg.maxMessages - messagesSent);

    // ─── STYLES ───────────────────────────────────────────────────────────────
    const css = `
        #alice-chat-plugin *{box-sizing:border-box;}
        #alice-chat-plugin {
            position: fixed; bottom: 28px; right: 28px; z-index: 99999;
            font-family: 'Josefin Sans', 'Segoe UI', sans-serif;
        }
        .alice-bubble {
            width: 60px; height: 60px; background: ${cfg.primaryColor};
            border-radius: 50%; display: flex; align-items: center;
            justify-content: center; cursor: pointer;
            box-shadow: 0 6px 20px rgba(0,0,0,0.25); transition: transform .25s;
        }
        .alice-bubble:hover { transform: scale(1.1); }

        .alice-window {
            position: absolute; bottom: 72px; right: 0;
            width: 350px; height: 520px; background: #fff;
            border-radius: 18px; box-shadow: 0 12px 40px rgba(0,0,0,0.18);
            display: none; flex-direction: column; overflow: hidden;
        }
        .alice-window.open { display: flex; animation: aliceSlideUp .28s ease; }
        @keyframes aliceSlideUp {
            from { transform: translateY(16px); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
        }

        /* Header */
        .alice-header {
            background: ${cfg.primaryColor}; color: #fff;
            padding: 16px 20px; font-weight: 700; font-size: 15px;
            display: flex; justify-content: space-between; align-items: center;
            flex-shrink: 0;
        }
        .alice-header-close {
            cursor: pointer; font-size: 22px; line-height: 1;
            opacity: .8; transition: opacity .2s;
        }
        .alice-header-close:hover { opacity: 1; }

        /* Messages */
        .alice-messages {
            flex: 1; padding: 14px 12px; overflow-y: auto;
            background: #f7f8fa; display: flex; flex-direction: column; gap: 10px;
        }
        .alice-msg {
            max-width: 82%; padding: 10px 14px;
            border-radius: 14px; font-size: 13.5px; line-height: 1.45;
            word-break: break-word;
        }
        .alice-msg.ai   { background: #edf0f2; color: #333; align-self: flex-start; border-bottom-left-radius: 3px; }
        .alice-msg.user { background: ${cfg.primaryColor}; color: #fff; align-self: flex-end; border-bottom-right-radius: 3px; }

        .alice-msg h1, .alice-msg h2, .alice-msg h3 { margin: 8px 0 4px; font-size: 1.1em; line-height: 1.2; }
        .alice-msg h1 { font-size: 1.25em; }
        .alice-msg p { margin: 0 0 8px; }
        .alice-msg p:last-child { margin-bottom: 0; }
        .alice-msg ul { margin: 4px 0 8px; padding-left: 20px; }
        .alice-msg li { margin-bottom: 4px; }
        .alice-msg pre { background: rgba(0,0,0,0.05); padding: 8px; border-radius: 6px; overflow-x: auto; margin: 8px 0; }
        .alice-msg code { font-family: monospace; background: rgba(0,0,0,0.05); padding: 2px 4px; border-radius: 4px; font-size: 0.9em; }
        .alice-msg pre code { background: none; padding: 0; }

        /* Limit box */
        .alice-limit-box {
            background: #fff4f4; border: 1px solid #ffd5d5;
            border-radius: 14px; padding: 20px 16px;
            text-align: center; display: flex; flex-direction: column;
            align-items: center; gap: 10px;
        }
        .alice-limit-icon {
            width: 44px; height: 44px; background: #fee2e2;
            border-radius: 50%; display: flex; align-items: center; justify-content: center;
        }
        .alice-limit-title { font-weight: 700; font-size: 14px; color: #c53030; }
        .alice-limit-text  { font-size: 12.5px; color: #666; }
        .alice-limit-btn {
            display: inline-block; background: ${cfg.primaryColor}; color: #fff;
            text-decoration: none; padding: 9px 22px; border-radius: 20px;
            font-weight: 700; font-size: 13px; transition: opacity .2s;
        }
        .alice-limit-btn:hover { opacity: .88; }

        /* Counter */
        .alice-counter {
            font-size: 11px; text-align: center; padding: 5px 0 4px;
            background: #fff; color: #aaa; flex-shrink: 0;
            border-top: 1px solid #f0f0f0;
        }
        .alice-counter.warn { color: #e57373; }

        /* Input area */
        .alice-input-area {
            padding: 10px 12px; border-top: 1px solid #eee;
            display: flex; gap: 8px; background: #fff; flex-shrink: 0;
        }
        .alice-input {
            flex: 1; border: 1.5px solid #ddd; padding: 9px 14px;
            border-radius: 22px; outline: none; font-size: 13.5px;
            transition: border-color .2s;
        }
        .alice-input:focus { border-color: ${cfg.primaryColor}; }
        .alice-input:disabled { background: #f5f5f5; cursor: not-allowed; color: #999; }
        .alice-send {
            background: ${cfg.primaryColor}; color: #fff; border: none;
            width: 38px; height: 38px; border-radius: 50%; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            transition: opacity .2s; flex-shrink: 0;
        }
        .alice-send:disabled { opacity: .45; cursor: not-allowed; }

        /* Suggestions */
        .alice-suggestions {
            padding: 10px 12px;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            background: #fff;
            border-top: 1px solid #f0f0f0;
        }
        .alice-suggestion-item {
            background: #fff;
            color: ${cfg.primaryColor};
            border: 1px solid ${cfg.primaryColor};
            padding: 7px 14px;
            border-radius: 18px;
            font-size: 12.5px;
            cursor: pointer;
            transition: all .2s;
            line-height: 1.3;
        }
        .alice-suggestion-item:hover {
            background: ${cfg.primaryColor};
            color: #fff;
            transform: translateY(-1px);
            box-shadow: 0 3px 8px rgba(0,0,0,0.1);
        }
    `;

    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    // ─── HTML ─────────────────────────────────────────────────────────────────
    const wrap = document.getElementById('alice-chat-plugin') || (() => {
        const el = document.createElement('div');
        el.id = 'alice-chat-plugin';
        document.body.appendChild(el);
        return el;
    })();
    wrap.innerHTML = `
        <div class="alice-window" id="alice-win">
            <div class="alice-header">
                <span>${cfg.title}</span>
                <span class="alice-header-close" id="alice-close">&times;</span>
            </div>
            <div class="alice-messages" id="alice-messages">
                <div class="alice-msg ai">${cfg.welcomeMessage}</div>
            </div>
            <div class="alice-counter" id="alice-counter">
                ${limitAlreadyHit ? 'No free chats left' : `${remaining} free chat${remaining !== 1 ? 's' : ''} remaining`}
            </div>
            <div class="alice-suggestions" id="alice-suggestions"></div>
            <form class="alice-input-area" id="alice-form">
                <input class="alice-input" id="alice-input" type="text"
                    placeholder="Ask a question..."
                    ${limitAlreadyHit ? 'disabled' : ''}>
                <button class="alice-send" type="submit" id="alice-send-btn"
                    ${limitAlreadyHit ? 'disabled' : ''}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                    </svg>
                </button>
            </form>
        </div>
        <div class="alice-bubble" id="alice-bubble">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
            </svg>
        </div>
    `;

    // ─── DOM REFS ─────────────────────────────────────────────────────────────
    const winEl = document.getElementById('alice-win');
    const bubble = document.getElementById('alice-bubble');
    const closeBtn = document.getElementById('alice-close');
    const msgList = document.getElementById('alice-messages');
    const form = document.getElementById('alice-form');
    const inputEl = document.getElementById('alice-input');
    const sendBtn = document.getElementById('alice-send-btn');
    const counter = document.getElementById('alice-counter');
    const suggestionsBox = document.getElementById('alice-suggestions');

    // ─── HELPERS ──────────────────────────────────────────────────────────────
    function parseMarkdown(text) {
        if (!text) return '';

        let html = text
            // Escape HTML tags to prevent XSS
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Block Elements
        // Code blocks
        html = html.replace(/```([\s\S]*?)```/g, function (match, code) {
            return '<pre><code>' + code + '</code></pre>';
        });

        // Headers
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

        // Lists
        // First convert list items
        html = html.replace(/^\s*[\-\*]\s+(.*$)/gim, '<li>$1</li>');
        html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>');

        // Wrap adjacent <li> tags into <ul>
        html = html.replace(/(?:<li>.*<\/li>\n?)+/gim, function (match) {
            return '<ul>' + match + '</ul>';
        });

        // Inline Elements
        // Bold Italic
        html = html.replace(/\*\*\*([^\*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
        // Bold
        html = html.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
        // Italic
        html = html.replace(/\*([^\*]+)\*/g, '<em>$1</em>');

        // Inline Code
        html = html.replace(/`(.*?)`/g, '<code>$1</code>');

        // Newlines -> <br>
        html = html.replace(/\n/g, '<br/>');

        // Clean up <br/> around block tags
        html = html.replace(/(<br\/>)*<ul>(<br\/>)*/gi, '<ul>');
        html = html.replace(/(<br\/>)*<\/ul>(<br\/>)*/gi, '</ul>');
        html = html.replace(/(<br\/>)*<li>(<br\/>)*/gi, '<li>');
        html = html.replace(/(<br\/>)*<\/li>(<br\/>)*/gi, '</li>');
        html = html.replace(/(<br\/>)*<h([1-6])>(.*?)<\/h\2>(<br\/>)*/gi, '<h$2>$3</h$2>');
        html = html.replace(/(<br\/>)*<pre>(.*?)<\/pre>(<br\/>)*/gi, '<pre>$2</pre>');

        return html;
    }

    function addMsg(text, type) {
        const d = document.createElement('div');
        d.className = `alice-msg ${type}`;

        if (type === 'ai') {
            d.innerHTML = parseMarkdown(text);
        } else {
            // Escape user text to prevent XSS
            let safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            d.innerHTML = safeText.replace(/\n/g, '<br/>');
        }

        msgList.appendChild(d);
        msgList.scrollTop = msgList.scrollHeight;
        return d;
    }

    function updateCounter(left) {
        if (left <= 0) {
            counter.textContent = 'No free chats left';
            counter.classList.add('warn');
        } else {
            counter.textContent = `${left} free chat${left !== 1 ? 's' : ''} remaining`;
            counter.classList.toggle('warn', left === 1);
        }
    }

    function showLimitUI() {
        // Prevent duplicates
        if (msgList.querySelector('.alice-limit-box')) return;

        const box = document.createElement('div');
        box.className = 'alice-limit-box';
        box.innerHTML = `
            <div class="alice-limit-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                     stroke="#c53030" stroke-width="2">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856
                             c1.54 0 2.502-1.667 1.732-3
                             L13.732 4c-.77-1.333-2.694-1.333-3.464 0
                             L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
            </div>
            <div class="alice-limit-title">Free Trial Limit Reached</div>
            <div class="alice-limit-text">
                You've used all ${cfg.maxMessages} free chats. Sign up for
                unlimited expert guidance!
            </div>
            <a href="${cfg.signupUrl}" class="alice-limit-btn">Sign Up for Free &rarr;</a>
        `;
        msgList.appendChild(box);
        msgList.scrollTop = msgList.scrollHeight;

        inputEl.disabled = true;
        sendBtn.disabled = true;
        inputEl.placeholder = 'Sign up to continue chatting...';
        updateCounter(0);

        localStorage.setItem(LIMIT_KEY, 'true');
    }

    function renderSuggestions() {
        if (!cfg.suggestions || cfg.suggestions.length === 0 || messagesSent > 0) {
            suggestionsBox.style.display = 'none';
            return;
        }

        suggestionsBox.innerHTML = '';
        cfg.suggestions.forEach(q => {
            const btn = document.createElement('div');
            btn.className = 'alice-suggestion-item';
            btn.textContent = q;
            btn.addEventListener('click', () => {
                inputEl.value = q;
                form.dispatchEvent(new Event('submit'));
                suggestionsBox.style.display = 'none';
            });
            suggestionsBox.appendChild(btn);
        });
        suggestionsBox.style.display = 'flex';
    }

    function toggleChat() {
        isOpen = !isOpen;
        if (isOpen) {
            winEl.classList.add('open');
            if (!inputEl.disabled) inputEl.focus();
            // Restore limit UI on re-open if needed
            if (limitAlreadyHit || messagesSent >= cfg.maxMessages) showLimitUI();
            renderSuggestions();
        } else {
            winEl.classList.remove('open');
        }
    }

    // ─── SUBMIT ───────────────────────────────────────────────────────────────
    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        // Guard: limit already hit
        if (messagesSent >= cfg.maxMessages || localStorage.getItem(LIMIT_KEY) === 'true') {
            showLimitUI();
            return;
        }

        const text = inputEl.value.trim();
        if (!text) return;

        addMsg(text, 'user');
        inputEl.value = '';
        suggestionsBox.style.display = 'none';

        const loadingEl = addMsg('Alice is thinking…', 'ai');

        // Patience fallback
        const patience = setTimeout(() => {
            if (loadingEl.parentNode) loadingEl.textContent = 'Still searching… bear with me!';
        }, 10000);

        try {
            const res = await fetch(cfg.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, session_id: sessionId }),
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            // Handle both plain-text and JSON responses
            const rawText = await res.text();
            let reply;
            try {
                const parsed = JSON.parse(rawText);
                reply = parsed.Data || parsed.message || parsed.reply || rawText;
            } catch (_) {
                // API returned plain text — use it directly
                reply = rawText;
            }

            clearTimeout(patience);
            if (loadingEl.parentNode) loadingEl.remove();

            // Backend-driven expiry
            if (typeof reply === 'string' && reply.toLowerCase().includes('expired')) {
                messagesSent = cfg.maxMessages;
                localStorage.setItem(COUNT_KEY, String(messagesSent));
                showLimitUI();
                return;
            }

            addMsg(typeof reply === 'string' ? reply : JSON.stringify(reply), 'ai');

            // Increment count
            messagesSent++;
            localStorage.setItem(COUNT_KEY, String(messagesSent));
            const left = Math.max(0, cfg.maxMessages - messagesSent);
            updateCounter(left);

            if (messagesSent >= cfg.maxMessages) {
                setTimeout(showLimitUI, 800);
            }

        } catch (err) {
            clearTimeout(patience);
            if (loadingEl.parentNode) loadingEl.remove();
            addMsg(`⚠ Connection error: ${err.message}`, 'ai');
            console.error('[AlicePlugin] Error:', err);
        }
    });

    // ─── EVENTS ───────────────────────────────────────────────────────────────
    bubble.addEventListener('click', toggleChat);
    closeBtn.addEventListener('click', toggleChat);

    // Restore limit state on load
    if (limitAlreadyHit) {
        inputEl.disabled = true;
        sendBtn.disabled = true;
        inputEl.placeholder = 'Sign up to continue chatting...';
    }

})();
