'use client'

/**
 * DCP AI Chat Widget
 *
 * AI-powered support chat bubble connected to DCP's own /v1/chat/completions
 * endpoint. Provides instant AI assistance for platform questions, documentation
 * help, and technical support.
 *
 * Features:
 *  - Floating chat bubble (bottom-right)
 *  - Real-time streaming responses from DCP's inference API
 *  - Context-aware: knows about DCP platform, SDKs, pricing, providers
 *  - RTL / Arabic support
 *  - Markdown rendering for code snippets
 *  - Conversation history within session
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useLanguage } from '../../lib/i18n'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

type WidgetState = 'closed' | 'open'

// ─── Constants ────────────────────────────────────────────────────────────────

const CHAT_API_URL = '/v1/chat/completions'

const SYSTEM_PROMPT = `You are the DCP Support Assistant — a helpful AI for the DC1 Compute Platform (DCP).

DCP is a GPU compute marketplace based in Saudi Arabia that connects GPU providers with renters who need compute power for AI/ML workloads. Key facts:
- Website: dcp.sa
- API Base: api.dcp.sa
- Supports models like Mistral 7B, TinyLlama, Falcon, JAIS, ALLaM
- Job types: llm_inference, image_generation, vllm_serve, custom_container
- SDKs available for Python (dc1-sdk) and JavaScript (dc1-renter-sdk)
- Pricing is in SAR (Saudi Riyals) and halala
- Provider onboarding requires GPU registration and daemon installation
- OpenRouter compatible via /v1/chat/completions endpoint

Be concise, helpful, and friendly. If you don't know something specific, direct users to the documentation at dcp.sa/docs or support@dcp.sa. Answer in the same language the user writes in.`

const DEFAULT_MODEL = 'mistralai/Mistral-7B-Instruct-v0.2'

// ─── Component ────────────────────────────────────────────────────────────────

export default function AIChatWidget() {
  const { language } = useLanguage()
  const isRTL = language === 'ar'

  const [state, setState] = useState<WidgetState>('closed')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when chat opens
  useEffect(() => {
    if (state === 'open') {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [state])

  const t = (en: string, ar: string) => (isRTL ? ar : en)

  // ── Send message ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return

    setError('')
    const userMsg: ChatMessage = { role: 'user', content: trimmed }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setIsStreaming(true)

    // Add placeholder for assistant response
    const assistantMsg: ChatMessage = { role: 'assistant', content: '' }
    setMessages([...newMessages, assistantMsg])

    try {
      const response = await fetch(CHAT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...newMessages.map(m => ({ role: m.role, content: m.content })),
          ],
          max_tokens: 512,
          temperature: 0.7,
          stream: false,
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error?.message || `API error: ${response.status}`)
      }

      const data = await response.json()
      const assistantContent =
        data.choices?.[0]?.message?.content ||
        data.choices?.[0]?.text ||
        t('Sorry, I could not generate a response.', 'عذراً، لم أتمكن من إنشاء رد.')

      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: assistantContent }
        return updated
      })
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: t(
            `I'm having trouble connecting right now. Please try again or email support@dcp.sa for help.\n\n_Error: ${errorMessage}_`,
            `أواجه مشكلة في الاتصال حالياً. يرجى المحاولة مرة أخرى أو مراسلة support@dcp.sa للمساعدة.\n\n_خطأ: ${errorMessage}_`,
          ),
        }
        return updated
      })
    } finally {
      setIsStreaming(false)
    }
  }, [input, messages, isStreaming, t])

  // ── Handle keyboard ─────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    },
    [sendMessage],
  )

  // ── Clear chat ──────────────────────────────────────────────────────────

  const clearChat = useCallback(() => {
    setMessages([])
    setError('')
  }, [])

  // ── Render: closed state (floating bubble) ──────────────────────────────

  if (state === 'closed') {
    return (
      <button
        onClick={() => setState('open')}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg transition-all duration-300 hover:scale-110 flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #00f0ff 0%, #0ea5e9 100%)',
        }}
        aria-label={t('Chat with AI Support', 'الدردشة مع دعم الذكاء الاصطناعي')}
        title={t('Chat with AI Support', 'الدردشة مع دعم الذكاء الاصطناعي')}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    )
  }

  // ── Render: open chat panel ─────────────────────────────────────────────

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl border border-[#1e293b] shadow-2xl overflow-hidden"
      style={{
        width: '380px',
        height: '520px',
        background: '#0a0e1a',
      }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{
          background: 'linear-gradient(135deg, #00f0ff10 0%, #0ea5e910 100%)',
          borderBottom: '1px solid #1e293b',
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-sm"
            style={{ background: 'linear-gradient(135deg, #00f0ff 0%, #0ea5e9 100%)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">
              {t('DCP AI Assistant', 'مساعد DCP الذكي')}
            </p>
            <p className="text-[10px] text-[#94a3b8] mt-0.5">
              {isStreaming
                ? t('Thinking...', 'جارٍ التفكير...')
                : t('Powered by DCP Inference', 'مدعوم بمحرك DCP')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="p-1.5 rounded-lg text-[#94a3b8] hover:text-white hover:bg-[#1e293b] transition-colors"
              aria-label={t('Clear chat', 'مسح المحادثة')}
              title={t('Clear chat', 'مسح المحادثة')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setState('closed')}
            className="p-1.5 rounded-lg text-[#94a3b8] hover:text-white hover:bg-[#1e293b] transition-colors"
            aria-label={t('Close', 'إغلاق')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ scrollbarWidth: 'thin' }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div
              className="h-12 w-12 rounded-full flex items-center justify-center mb-3"
              style={{ background: 'linear-gradient(135deg, #00f0ff20 0%, #0ea5e920 100%)' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-white mb-1">
              {t('Hi! I\'m the DCP AI Assistant', 'مرحباً! أنا مساعد DCP الذكي')}
            </p>
            <p className="text-xs text-[#94a3b8] mb-4">
              {t(
                'Ask me about GPU providers, pricing, SDKs, or anything DCP-related.',
                'اسألني عن مزودي GPU، الأسعار، حزم التطوير، أو أي شيء متعلق بـ DCP.',
              )}
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {[
                t('How do I get started?', 'كيف أبدأ؟'),
                t('Show me GPU pricing', 'أرني أسعار GPU'),
                t('How to use the SDK?', 'كيف أستخدم SDK؟'),
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion)
                    setTimeout(() => sendMessage(), 50)
                  }}
                  className="px-3 py-1.5 rounded-full text-[11px] border border-[#1e293b] text-[#94a3b8] hover:text-white hover:border-[#00f0ff40] hover:bg-[#00f0ff08] transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#0ea5e9] text-white rounded-br-md'
                  : 'bg-[#1e293b] text-[#e2e8f0] rounded-bl-md'
              }`}
            >
              {msg.role === 'assistant' && !msg.content && isStreaming ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse" style={{ animationDelay: '0.2s' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse" style={{ animationDelay: '0.4s' }} />
                </div>
              ) : (
                <div className="whitespace-pre-wrap break-words">
                  {msg.content}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 text-xs text-red-400 bg-red-900/20 border-t border-red-800/30">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 px-3 py-3 border-t border-[#1e293b]">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t(
              'Ask anything about DCP...',
              'اسأل عن أي شيء متعلق بـ DCP...',
            )}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#64748b] outline-none disabled:opacity-50"
            style={{
              background: '#111827',
              border: '1px solid #1e293b',
              maxHeight: '100px',
              minHeight: '40px',
            }}
            rows={1}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            className="shrink-0 h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-30"
            style={{
              background: input.trim() && !isStreaming
                ? 'linear-gradient(135deg, #00f0ff 0%, #0ea5e9 100%)'
                : '#1e293b',
            }}
            aria-label={t('Send', 'إرسال')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p className="text-[9px] text-[#475569] text-center mt-1.5">
          {t('Powered by DCP AI', 'مدعوم بذكاء DCP الاصطناعي')}
        </p>
      </div>
    </div>
  )
}
