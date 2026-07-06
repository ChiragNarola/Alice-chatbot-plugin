/**
 * Alice Admin Chatbot Plugin (Streaming, unlimited, no storage, no suggestions)
 *
 * Usage:
 *   <script>
 *     window.AliceChatConfig = {
 *       apiUrl:        'https://your-api.com/api/v1/admin-chatbot/message',
 *       title:         'Admin Chatbot',
 *       welcomeMessage:'Hello! How can I help you today?',
 *       primaryColor:  '#1D7A74',
 *     };
 *   </script>
 *   <script src="alice-admin-plugin.js"></script>
 */
(function () {
    const userConfig = window.AliceChatConfig || {};

    if (!userConfig.apiUrl) {
        console.error('[AliceAdminPlugin] apiUrl is required in window.AliceChatConfig');
    }

    const cfg = Object.assign({
        apiUrl: userConfig.apiUrl,
        title: 'Ask A.L.I.C.E',
        welcomeMessage: "Hello! I'm A.L.I.C.E. I'm here to help you with operational questions — signups, chats, feedback, usage, and more. What would you like to know today?",
        primaryColor: '#1D7A74'
    }, userConfig);

    let isOpen = false;

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
    `;

    const markedScript = document.createElement('script');
    markedScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js';
    document.head.appendChild(markedScript);

    markedScript.onload = function () {

        const hostEl = document.getElementById('alice-chat-plugin') || (() => {
            const el = document.createElement('div');
            el.id = 'alice-chat-plugin';
            el.style.cssText = 'position:fixed;bottom:28px;right:28px;z-index:99999;font-family:inherit;';
            document.body.appendChild(el);
            return el;
        })();

        const shadow = hostEl.attachShadow({ mode: 'open' });

        const styleEl = document.createElement('style');
        styleEl.textContent = css;
        shadow.appendChild(styleEl);

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
                <form class="alice-input-area" id="alice-form">
                    <input class="alice-input" id="alice-input" type="text" placeholder="Ask a question...">
                    <button class="alice-send" type="submit" id="alice-send-btn">
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

        const winEl    = shadow.querySelector('#alice-win');
        const bubble   = shadow.querySelector('#alice-bubble');
        const closeBtn = shadow.querySelector('#alice-close');
        const msgList  = shadow.querySelector('#alice-messages');
        const form     = shadow.querySelector('#alice-form');
        const inputEl  = shadow.querySelector('#alice-input');
        const sendBtn  = shadow.querySelector('#alice-send-btn');

        function parseMarkdown(text) {
            if (!text) return '';
            return marked.parse(text, { gfm: true, breaks: true });
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

        function toggleChat() {
            isOpen = !isOpen;
            if (isOpen) {
                winEl.classList.add('open');
                inputEl.focus();
            } else {
                winEl.classList.remove('open');
            }
        }

        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            const text = inputEl.value.trim();
            if (!text) return;

            addMsg(text, 'user');
            inputEl.value = '';
            inputEl.disabled = true;
            sendBtn.disabled = true;

            const aiEl = addMsg('', 'ai');
            aiEl.innerHTML = '<em>Thinking...</em>';
            let fullReply = '';
            let firstChunk = true;

            try {
                const body = new URLSearchParams();
                body.append('message', text);

                const res = await fetch(cfg.apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: body.toString(),
                });

                if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

                const reader = res.body.getReader();
                const decoder = new TextDecoder('utf-8');

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    if (!chunk) continue;

                    if (firstChunk) {
                        aiEl.innerHTML = '';
                        firstChunk = false;
                    }

                    fullReply += chunk;
                    aiEl.innerHTML = parseMarkdown(fullReply);
                    msgList.scrollTop = msgList.scrollHeight;
                }

                if (!fullReply) {
                    aiEl.innerHTML = parseMarkdown("Sorry, I didn't get a response. Please try again.");
                }

            } catch (err) {
                aiEl.innerHTML = parseMarkdown('Connection error: ' + err.message);
                console.error('[AliceAdminPlugin] Error:', err);
            } finally {
                inputEl.disabled = false;
                sendBtn.disabled = false;
                inputEl.focus();
            }
        });

        bubble.addEventListener('click', toggleChat);
        closeBtn.addEventListener('click', toggleChat);

    };
})();