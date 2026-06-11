/**
 * Alice Chatbot Plugin
 * A standalone, embeddable chatbot widget.
 *
 * Usage:
 *   <script>
 *     window.AliceChatConfig = {
 *       apiBaseUrl:    'https://your-api.com/api/v1',
 *       nurseryId:     'your-nursery-id',
 *       signupUrl:     'https://your-app.com/signup',
 *       maxMessages:   3,
 *       title:         'Alice AI Guide',
 *       welcomeMessage:'Hello! How can I help you today?',
 *       primaryColor:  '#1D7A74',
 *     };
 *   </script>
 *   <script src="alice-plugin.js"></script>
 */
(function () {
    // --- CONFIG ---
    const userConfig = window.AliceChatConfig || {};
    const apiBase = userConfig.apiBaseUrl || 'https://alice-apis-hjdsgjcsh8b2esbz.westeurope-01.azurewebsites.net/api/v1';
    const nurseryId = userConfig.nurseryId;

    if (!nurseryId) {
        console.error('[AlicePlugin] nurseryId is required in window.AliceChatConfig');
    }

    const cfg = Object.assign({
        apiUrl: `${apiBase}/partner-nursery/${nurseryId}/chat`,
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
    }, userConfig);

    // --- STATE ---
    let isOpen = false;

    const SESSION_KEY = 'alice_session_id';
    const COUNT_KEY   = 'alice_msg_count';
    const LIMIT_KEY   = 'alice_limit_hit';

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

    let messagesSent = parseInt(localStorage.getItem(COUNT_KEY) || '0', 10);
    if (isNaN(messagesSent)) messagesSent = 0;

    const limitAlreadyHit = localStorage.getItem(LIMIT_KEY) === 'true';
    const remaining = Math.max(0, cfg.maxMessages - messagesSent);

    // --- STYLES (injected into Shadow DOM) ---
    const css = `
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :host {
            position: fixed;
            bottom: 28px;
            right: 28px;
            z-index: 99999;
            font-family: 'Josefin Sans', 'Segoe UI', sans-serif;
            display: block;
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
            font-family: 'Josefin Sans', 'Segoe UI', sans-serif;
        }
        .alice-window.open { display: flex; animation: aliceSlideUp .28s ease; }
        @keyframes aliceSlideUp {
            from { transform: translateY(16px); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
        }

        .alice-header {
            background: ${cfg.primaryColor}; color: #fff;
            padding: 16px 20px; font-weight: 700; font-size: 15px;
            display: flex; justify-content: space-between; align-items: center;
            flex-shrink: 0;
        }
        .alice-header-close {
            cursor: pointer; font-size: 22px; line-height: 1;
            opacity: .8; transition: opacity .2s; background: none;
            border: none; color: #fff; padding: 0;
        }
        .alice-header-close:hover { opacity: 1; }

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

        .alice-msg a { color: ${cfg.primaryColor}; text-decoration: underline; word-break: break-all; }
        .alice-msg a:hover { opacity: .8; }

        .alice-msg h1, .alice-msg h2, .alice-msg h3 { margin: 8px 0 4px; font-size: 1.1em; line-height: 1.2; }
        .alice-msg h1 { font-size: 1.25em; }
        .alice-msg p { margin: 0 0 8px; }
        .alice-msg p:last-child { margin-bottom: 0; }
        .alice-msg ul { margin: 4px 0 8px; padding-left: 20px; }
        .alice-msg li { margin-bottom: 4px; }
        .alice-msg pre { background: rgba(0,0,0,0.05); padding: 8px; border-radius: 6px; overflow-x: auto; margin: 8px 0; }
        .alice-msg code { font-family: monospace; background: rgba(0,0,0,0.05); padding: 2px 4px; border-radius: 4px; font-size: 0.9em; }
        .alice-msg pre code { background: none; padding: 0; }

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

        .alice-counter {
            font-size: 11px; text-align: center; padding: 5px 0 4px;
            background: #fff; color: #aaa; flex-shrink: 0;
            border-top: 1px solid #f0f0f0;
        }
        .alice-counter.warn { color: #e57373; }

        .alice-input-area {
            padding: 8px 10px;
            display: flex;
            align-items: center;
            background: #fff;
            border-radius: 100px;
            border: 1.5px solid #ddd;
            margin: 0 12px 10px;
            transition: border-color .2s;
        }
        .alice-input-area:focus-within { border-color: ${cfg.primaryColor}; }

        .alice-input {
            flex: 1;
            border: none;
            padding: 8px 12px;
            border-radius: 100px;
            outline: none;
            font-size: 13.5px;
            background: transparent;
            font-family: inherit;
            color: #333;
        }
        .alice-input:disabled { cursor: not-allowed; color: #999; }

        .alice-send {
            background: ${cfg.primaryColor};
            color: #fff;
            border: none;
            width: 34px;
            min-width: 34px;
            max-width: 34px;
            height: 34px;
            min-height: 34px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            margin-right: 2px;
            padding: 0;
            transition: opacity .2s, transform .15s;
        }
        .alice-send:hover { opacity: .85; transform: scale(1.07); }
        .alice-send:disabled { opacity: .45; cursor: not-allowed; }

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
            font-family: inherit;
        }
        .alice-suggestion-item:hover {
            background: ${cfg.primaryColor};
            color: #fff;
            transform: translateY(-1px);
            box-shadow: 0 3px 8px rgba(0,0,0,0.1);
        }
    `;

    // --- MARKED ---
    const markedScript = document.createElement('script');
    markedScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js';
    document.head.appendChild(markedScript);

    markedScript.onload = function () {

        // --- HOST ELEMENT (fixed position wrapper) ---
        const hostEl = document.getElementById('alice-chat-plugin') || (() => {
            const el = document.createElement('div');
            el.id = 'alice-chat-plugin';
            // Position the host element itself
            el.style.cssText = 'position:fixed;bottom:28px;right:28px;z-index:99999;font-family:inherit;';
            document.body.appendChild(el);
            return el;
        })();

        // --- SHADOW ROOT ---
        const shadow = hostEl.attachShadow({ mode: 'open' });

        // Inject styles into shadow
        const styleEl = document.createElement('style');
        styleEl.textContent = css;
        shadow.appendChild(styleEl);

        // Inject HTML into shadow
        const wrap = document.createElement('div');
        wrap.innerHTML = `
            <div class="alice-window" id="alice-win">
                <div class="alice-header">
                    <span>${cfg.title}</span>
                    <button class="alice-header-close" id="alice-close">&times;</button>
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
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
        shadow.appendChild(wrap);

        // --- DOM REFS (all from shadow) ---
        const winEl          = shadow.querySelector('#alice-win');
        const bubble         = shadow.querySelector('#alice-bubble');
        const closeBtn       = shadow.querySelector('#alice-close');
        const msgList        = shadow.querySelector('#alice-messages');
        const form           = shadow.querySelector('#alice-form');
        const inputEl        = shadow.querySelector('#alice-input');
        const sendBtn        = shadow.querySelector('#alice-send-btn');
        const counter        = shadow.querySelector('#alice-counter');
        const suggestionsBox = shadow.querySelector('#alice-suggestions');

        // --- HELPERS ---
        function parseMarkdown(text) {
            if (!text) return '';
            return marked.parse(text, {
                gfm: true,
                breaks: true,
            });
        }

        function addMsg(text, type) {
            const d = document.createElement('div');
            d.className = `alice-msg ${type}`;
            if (type === 'ai') {
                d.innerHTML = parseMarkdown(text);
            } else {
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
            if (msgList.querySelector('.alice-limit-box')) return;
            const box = document.createElement('div');
            box.className = 'alice-limit-box';
            box.innerHTML = `
                <div class="alice-limit-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c53030" stroke-width="2">
                        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                </div>
                <div class="alice-limit-title">Free Trial Limit Reached</div>
                <div class="alice-limit-text">
                    You've used all ${cfg.maxMessages} free chats. Sign up for unlimited expert guidance!
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
                if (limitAlreadyHit || messagesSent >= cfg.maxMessages) showLimitUI();
                renderSuggestions();
            } else {
                winEl.classList.remove('open');
            }
        }

        // --- SUBMIT ---
        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            if (messagesSent >= cfg.maxMessages || localStorage.getItem(LIMIT_KEY) === 'true') {
                showLimitUI();
                return;
            }

            const text = inputEl.value.trim();
            if (!text) return;

            addMsg(text, 'user');
            inputEl.value = '';
            suggestionsBox.style.display = 'none';

            const loadingEl = addMsg('Alice is thinking...', 'ai');

            const patience = setTimeout(() => {
                if (loadingEl.parentNode) loadingEl.textContent = 'Still searching... bear with me!';
            }, 10000);

            try {
                const res = await fetch(cfg.apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: text, session_id: sessionId }),
                });

                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const rawText = await res.text();
                let reply;
                try {
                    const parsed = JSON.parse(rawText);
                    reply = parsed.Data || parsed.message || parsed.reply || rawText;
                } catch (_) {
                    reply = rawText;
                }

                clearTimeout(patience);
                if (loadingEl.parentNode) loadingEl.remove();

                if (typeof reply === 'string' && reply.toLowerCase().includes('expired')) {
                    messagesSent = cfg.maxMessages;
                    localStorage.setItem(COUNT_KEY, String(messagesSent));
                    showLimitUI();
                    return;
                }

                addMsg(typeof reply === 'string' ? reply : JSON.stringify(reply), 'ai');

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
                addMsg('Connection error: ' + err.message, 'ai');
                console.error('[AlicePlugin] Error:', err);
            }
        });

        // --- EVENTS ---
        bubble.addEventListener('click', toggleChat);
        closeBtn.addEventListener('click', toggleChat);

        if (limitAlreadyHit) {
            inputEl.disabled = true;
            sendBtn.disabled = true;
            inputEl.placeholder = 'Sign up to continue chatting...';
        }

    }; // end markedScript.onload

})();