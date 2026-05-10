/**
 * SmartLine Enterprise Agent — Native Component
 * Chat + Voice, shared memory, Lead Agents Studio design
 * No iframe. Uses API at lead-agents-api.onrender.com
 */
(function () {
  const API_BASE = window.SMARTLINE_API_BASE || 'https://lead-agents-api.onrender.com';

  function createWidget(container) {
    const apiBase = container.dataset.apiBase || API_BASE;
    const agentName = container.dataset.agentName || 'SmartLine Enterprise Agent';
    const agentAvatar = container.dataset.agentAvatar || (agentName === 'Strawberry' ? 'S' : 'SL');
    const root = document.createElement('div');
    root.className = 'smartline-agent-widget';
    const micSvg = '<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 1 3 3v8a3 3 0 0 1-6 0V4a3 3 0 0 1 3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>';
    const stopSvg = '<svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
    root.innerHTML = `
      <div class="agent-window smartline-native">
        <div class="agent-window-header">
          <div class="agent-avatar" aria-hidden="true">${agentAvatar}</div>
          <div class="agent-info">
            <h3>${agentName}</h3>
            <span>Chat or talk — same conversation</span>
          </div>
        </div>
        <div class="agent-waveform sl-waveform idle">
          <span class="bar"></span><span class="bar"></span><span class="bar"></span>
          <span class="bar"></span><span class="bar"></span><span class="bar"></span>
          <span class="bar"></span><span class="bar"></span><span class="bar"></span>
        </div>
        <div class="agent-window-body">
          <div class="agent-messages sl-messages"></div>
          <div class="agent-mic-notice sl-mic-notice">
            <p><strong>Voice mode:</strong> Your browser will ask for microphone access so you can speak to SmartLine. This is for security—only you hear your conversation. We never record without your consent.</p>
          </div>
          <div class="agent-controls">
            <div class="agent-input-row">
              <input type="text" class="sl-chat-input" placeholder="Type your message..." autocomplete="off">
              <button type="button" class="btn-send sl-send-btn" title="Send">
                <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                <span class="btn-label">Send</span>
              </button>
            </div>
            <div class="agent-voice-row">
              <button type="button" class="btn-voice sl-voice-btn" title="Start voice">
                ${micSvg}
                <span class="btn-label">Start Voice</span>
              </button>
              <button type="button" class="btn-stop sl-stop-btn sl-voice-off" title="Stop voice" aria-hidden="true" tabindex="-1">
                ${stopSvg}
                <span class="btn-label">Stop</span>
              </button>
            </div>
          </div>
          <p class="agent-status sl-status"></p>
        </div>
      </div>
    `;
    root.dataset.agentName = agentName;
    container.appendChild(root);
    return root;
  }

  async function init() {
    const containers = document.querySelectorAll('[data-smartline-agent]');
    if (!containers.length) return;
    containers.forEach((c) => {
      const widget = createWidget(c);
      attachHandlers(widget, c.dataset.apiBase || API_BASE);
    });
  }

  function attachHandlers(root, apiBase) {
    const chatInput = root.querySelector('.sl-chat-input');
    const sendBtn = root.querySelector('.sl-send-btn');
    const voiceBtn = root.querySelector('.sl-voice-btn');
    const stopBtn = root.querySelector('.sl-stop-btn');
    const messagesEl = root.querySelector('.sl-messages');
    const statusEl = root.querySelector('.sl-status');
    const micNotice = root.querySelector('.sl-mic-notice');
    const waveform = root.querySelector('.sl-waveform');
    const avatar = root.querySelector('.agent-avatar');

    let conversationId = null;
    let session = null;
    let isVoiceActive = false;

    function setVoiceChrome(active) {
      if (active) {
        voiceBtn.classList.add('sl-voice-off');
        voiceBtn.setAttribute('aria-hidden', 'true');
        voiceBtn.setAttribute('tabindex', '-1');
        stopBtn.classList.remove('sl-voice-off');
        stopBtn.removeAttribute('aria-hidden');
        stopBtn.removeAttribute('tabindex');
      } else {
        stopBtn.classList.add('sl-voice-off');
        stopBtn.setAttribute('aria-hidden', 'true');
        stopBtn.setAttribute('tabindex', '-1');
        voiceBtn.classList.remove('sl-voice-off');
        voiceBtn.removeAttribute('aria-hidden');
        voiceBtn.removeAttribute('tabindex');
      }
    }

    function setStatus(msg, isError = false) {
      statusEl.textContent = msg;
      statusEl.className = 'agent-status' + (isError ? ' error' : '');
    }

    function streamTextIntoEl(el, text, onTick, speed = 12) {
      el.textContent = '';
      let i = 0;
      function tick() {
        if (i < text.length) {
          el.textContent = text.slice(0, i + 1);
          i++;
          if (onTick) onTick();
          setTimeout(tick, speed);
        } else {
          el.classList.remove('streaming');
        }
      }
      el.classList.add('streaming');
      tick();
    }

    function addMessageToUI(role, content, options = {}) {
      if (!content || !content.trim()) return;
      const stream = options.stream ?? (role === 'assistant');
      const div = document.createElement('div');
      div.className = 'agent-msg ' + (role === 'user' ? 'agent-msg-user' : 'agent-msg-assistant');
      const p = document.createElement('p');
      div.appendChild(p);
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      if (stream && role === 'assistant') {
        streamTextIntoEl(p, content, () => { messagesEl.scrollTop = messagesEl.scrollHeight; });
      } else {
        p.textContent = content;
      }
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    async function ensureSession() {
      if (conversationId) return conversationId;
      const res = await fetch(`${apiBase}/api/smartline/session`, { method: 'POST' });
      const data = await res.json();
      conversationId = data.conversationId;
      return conversationId;
    }

    async function sendChat() {
      const text = chatInput.value.trim();
      if (!text) return;
      chatInput.value = '';
      addMessageToUI('user', text);
      chatInput.disabled = true;
      setStatus('Thinking...');
      try {
        await ensureSession();
        const res = await fetch(`${apiBase}/api/smartline/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, message: text })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        addMessageToUI('assistant', data.response);
        setStatus('');
      } catch (err) {
        setStatus(err.message || 'Something went wrong', true);
      }
      chatInput.disabled = false;
    }

    async function startVoice() {
      voiceBtn.disabled = true;
      micNotice.style.display = 'block';
      setStatus('Connecting...');
      try {
        await ensureSession();
        const url = `${apiBase}/api/smartline/token?conversationId=${encodeURIComponent(conversationId)}`;
        const tokenRes = await fetch(url);
        if (!tokenRes.ok) throw new Error('Voice API unavailable — try again in a moment');
        const { token } = await tokenRes.json();
        if (!token) throw new Error('Voice API unavailable — try again in a moment');

        const { RealtimeAgent, RealtimeSession, tool } = await import('https://esm.sh/@openai/agents@0.4.11/realtime');
        const { z } = await import('https://esm.sh/zod@3.23.8');

        const toolFetch = (name, args) =>
          fetch(`${apiBase}/api/smartline/tool`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ toolName: name, args })
          }).then(r => r.json()).then(r => JSON.stringify(r));

        const agentDisplayName = root.dataset.agentName || 'SmartLine Enterprise Agent';
        const agent = new RealtimeAgent({
          name: agentDisplayName,
          instructions: `You are ${agentDisplayName}. Professional, trusted. Use your tools. 2-3 sentences max.`,
          tools: [
            tool({ name: 'lookup_services', description: 'Look up SmartLine services, pricing.', parameters: z.object({ query: z.string(), category: z.string().optional() }), execute: ({ query, category }) => toolFetch('lookup_services', { query, category }) }),
            tool({ name: 'lookup_faq', description: 'Look up FAQs.', parameters: z.object({ question: z.string(), topic: z.string().optional() }), execute: ({ question, topic }) => toolFetch('lookup_faq', { question, topic }) }),
            tool({ name: 'lookup_objection', description: 'Objection handling.', parameters: z.object({ objection: z.string() }), execute: ({ objection }) => toolFetch('lookup_objection', { objection }) }),
            tool({ name: 'lookup_case_study', description: 'Case studies.', parameters: z.object({ industry: z.string().optional(), topic: z.string().optional() }), execute: (a) => toolFetch('lookup_case_study', a) }),
            tool({ name: 'lookup_client_info', description: 'SmartLine info.', parameters: z.object({ field: z.string().optional() }), execute: ({ field }) => toolFetch('lookup_client_info', { field }) })
          ]
        });

        session = new RealtimeSession(agent, { transport: 'webrtc', model: 'gpt-realtime', config: { audio: { output: { voice: 'shimmer' } } } });

        const voiceTranscript = [];
        const onTranscript = (ev) => {
            try {
              const r = ev?.response ?? ev;
              if (!r) return;
              if (r.role === 'user' && r.content) {
                const text = typeof r.content === 'string' ? r.content : (Array.isArray(r.content) ? r.content.find(c => c.type === 'input_transcript')?.transcript ?? r.content[0]?.text : null) ?? '';
                if (text.trim()) { addMessageToUI('user', text); voiceTranscript.push({ role: 'user', content: text }); }
              }
              if (r.role === 'assistant' && r.content) {
                const text = typeof r.content === 'string' ? r.content : (Array.isArray(r.content) ? r.content.find(c => c.type === 'output_text')?.text ?? r.content.find(c => c.type === 'output_audio')?.transcript : null) ?? (r.content[0]?.text ?? r.content[0]?.transcript ?? '');
                if (text.trim()) { addMessageToUI('assistant', text); voiceTranscript.push({ role: 'assistant', content: text }); }
              }
            } catch (_) {}
        };
        const bind = (emitter, ev, fn) => { if (emitter?.on) emitter.on(ev, fn); else if (emitter?.addEventListener) emitter.addEventListener(ev, fn); };
        ['response', 'agent_end', 'history_added'].forEach(ev => bind(session, ev, onTranscript));
        bind(session, 'history_updated', (ev) => {
          try {
            const items = ev?.history ?? ev?.items ?? (Array.isArray(ev) ? ev : []);
            for (const it of items) {
              if (it?.role === 'user' && it?.content) {
                const text = typeof it.content === 'string' ? it.content : it.content?.find?.(c => c.type === 'input_transcript')?.transcript ?? it.content?.[0]?.text ?? '';
                if (text.trim() && !voiceTranscript.some(m => m.content === text)) { addMessageToUI('user', text); voiceTranscript.push({ role: 'user', content: text }); }
              }
              if (it?.role === 'assistant' && it?.content) {
                const text = typeof it.content === 'string' ? it.content : it.content?.find?.(c => c.type === 'output_text')?.text ?? it.content?.find?.(c => c.type === 'output_audio')?.transcript ?? it.content?.[0]?.text ?? '';
                if (text.trim() && !voiceTranscript.some(m => m.content === text)) { addMessageToUI('assistant', text); voiceTranscript.push({ role: 'assistant', content: text }); }
              }
            }
          } catch (_) {}
        });
        window.__sl_voiceTranscript = voiceTranscript;

        await session.connect({ apiKey: token });
        isVoiceActive = true;
        setVoiceChrome(true);
        waveform.classList.remove('idle');
        waveform.classList.add('talking');
        if (avatar) avatar.classList.add('talking');
        setStatus('Speak now. Transcript appears in chat. Click Stop when done.');
      } catch (err) {
        const msg = err.message || '';
        const isApiError = /token|fetch|network|connection|unavailable/i.test(msg);
        setStatus(isApiError ? 'Voice API unavailable — try again in a moment' : msg, true);
        voiceBtn.disabled = false;
      }
    }

    async function endVoice() {
      const transcript = window.__sl_voiceTranscript || [];
      try {
        if (session) {
          try { session.close(); } catch (e) { console.warn('Session close:', e); }
          session = null;
        }
        if (conversationId && transcript.length > 0) {
          try {
            await fetch(`${apiBase}/api/smartline/transcript`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ conversationId, messages: transcript })
            });
          } catch (_) {}
        }
      } finally {
        window.__sl_voiceTranscript = [];
        isVoiceActive = false;
        voiceBtn.disabled = false;
        setVoiceChrome(false);
        waveform.classList.add('idle');
        waveform.classList.remove('talking');
        if (avatar) avatar.classList.remove('talking');
        setStatus('');
      }
    }

    chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
    sendBtn.addEventListener('click', sendChat);
    voiceBtn.addEventListener('click', (e) => { e.preventDefault(); startVoice(); });
    voiceBtn.addEventListener('touchend', (e) => { e.preventDefault(); startVoice(); }, { passive: false });
    stopBtn.addEventListener('click', (e) => { e.preventDefault(); endVoice(); });
    stopBtn.addEventListener('touchend', (e) => { e.preventDefault(); endVoice(); }, { passive: false });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
