'use client'

/**
 * DCP Phase 1 — AI Chat Support Widget
 *
 * Self-hosted AI-powered support chat widget connected to DCP's own inference API.
 * Replaces the feedback-only flow with an intelligent chat that answers questions about DCP.
 *
 * Features:
 * - Floating chat bubble button (bottom-right)
 * - AI-powered responses via /api/chat → /v1/chat/completions
 * - Typing indicators during AI response
 * - Error states with retry option
 * - Session management (stores conversation in localStorage)
 * - RTL / Arabic support via useLanguage()
 * - Respects cookie consent
 *
 * Usage:
 *   <ChatWidget />
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useLanguage } from '../../lib/i18n'

type WidgetView = 'button' | 'chat'
type MessageRole = 'user' | 'assistant' | 'system'

interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: number
  error?: boolean
}

interface ChatResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
  error?: string
}

const STORAGE_KEY = 'dcp_chat_session'
const SESSION_TIMEOUT_MS = 30 * 60 * 1000

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function getStoredSession(): { messages: ChatMessage[]; lastActivity: number } | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const session = JSON.parse(stored)
    if (!Array.isArray(session.messages)) return null
    return session
  } catch {
    return null
  }
}

function saveSession(messages: ChatMessage[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      messages,
      lastActivity: Date.now(),
    }))
  } catch { /* noop */ }
}

function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch { /* noop */ }
}

const WELCOME_MESSAGE: ChatMessage = {
  id: generateId(),
  role: 'assistant',
  content: 'مرحباً! أنا مساعد DCP الذكي. كيف يمكنني مساعدتك اليوم؟\n\nHello! I\'m the DCP Support Assistant. How can I help you today?',
  timestamp: Date.now(),
}

const QUICK_QUESTIONS = [
  'How do I register as a provider?',
  'How does pricing work?',
  'What models are available?',
  'How do I integrate via API?',
]

export default function ChatWidget() {
  const { language } = useLanguage()
  const isRTL = language === 'ar'

  const [view, setView] = useState<WidgetView>('button')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping, scrollToBottom])

  useEffect(() => {
    const session = getStoredSession()
    if (session) {
      const isExpired = Date.now() - session.lastActivity > SESSION_TIMEOUT_MS
      if (isExpired) {
        clearSession()
      } else {
        setMessages(session.messages.length > 0 ? session.messages : [WELCOME_MESSAGE])
      }
    } else {
      setMessages([WELCOME_MESSAGE])
    }
  }, [])

  useEffect(() => {
    if (messages.length > 0 && messages[0].id !== WELCOME_MESSAGE.id) {
      saveSession(messages)
    }
  }, [messages])

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isTyping) return

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsTyping(true)
    setError(null)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || `Request failed (${response.status})`)
      }

      const data: ChatResponse = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      const assistantContent = data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.'

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: assistantContent,
        timestamp: Date.now(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get response. Please try again.'

      const errorAssistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: `⚠️ ${errorMessage}`,
        timestamp: Date.now(),
        error: true,
      }

      setMessages((prev) => [...prev, errorAssistantMessage])
      setError(errorMessage)
    } finally {
      setIsTyping(false)
      inputRef.current?.focus()
    }
  }, [messages, isTyping])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(inputValue)
  }, [inputValue, sendMessage])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputValue)
    }
  }, [inputValue, sendMessage])

  const clearChat = useCallback(() => {
    clearSession()
    setMessages([WELCOME_MESSAGE])
    setError(null)
  }, [])

  const t = (en: string, ar: string) => (isRTL ? ar : en)

  const panelClass = 'fixed bottom-20 right-4 z-50 w-80 sm:w-96 rounded-xl border border-dc1-border bg-dc1-surface-l1 shadow-2xl flex flex-col max-h-[500px]'
  const panelDir = isRTL ? 'rtl' : 'ltr'

  if (view === 'button') {
    return (
      <button
        onClick={() => setView('chat')}
        className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 text-white shadow-lg hover:shadow-cyan-400/30 hover:scale-105 transition-all duration-200 flex items-center justify-center text-xl"
        aria-label={t('Chat with support', 'تواصل مع الدعم')}
        title={t('Chat with support', 'تواصل مع الدعم')}
      >
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse" />
      </button>
    )
  }

  return (
    <div className={panelClass} dir={panelDir}>
      <div className="flex items-center justify-between border-b border-dc1-border px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-dc1-text-primary">{t('DCP Support', 'دعم DCP')}</p>
            <p className="text-xs text-dc1-text-muted">{t('AI Assistant', 'مساعد ذكي')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearChat}
            className="text-dc1-text-muted hover:text-dc1-text-primary transition-colors text-xs px-2 py-1 rounded border border-dc1-border hover:border-dc1-text-muted"
            title={t('New chat', 'محادثة جديدة')}
          >
            {t('New', 'جديد')}
          </button>
          <button
            onClick={() => setView('button')}
            className="text-dc1-text-muted hover:text-dc1-text-primary transition-colors text-lg leading-none"
            aria-label={t('Close', 'إغلاق')}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-dc1-amber text-dc1-void rounded-br-md'
                  : msg.error
                  ? 'bg-red-500/10 border border-red-500/30 text-red-400 rounded-bl-md'
                  : 'bg-dc1-surface-l2 text-dc1-text-primary rounded-bl-md'
              }`}
              style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-dc1-surface-l2 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-dc1-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-dc1-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-dc1-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {error && !isTyping && (
          <div className="flex justify-center">
            <button
              onClick={() => {
                const lastUserMsg = messages.filter((m) => m.role === 'user').pop()
                if (lastUserMsg) sendMessage(lastUserMsg.content)
              }}
              className="text-xs text-dc1-amber hover:underline"
            >
              {t('Retry', 'إعادة المحاولة')}
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {messages.length === 1 && messages[0].id === WELCOME_MESSAGE.id && !isTyping && (
        <div className="px-4 pb-2">
          <p className="text-xs text-dc1-text-muted mb-2">{t('Quick questions:', 'أسئلة سريعة:')}</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="text-xs px-2.5 py-1 rounded-full bg-dc1-surface-l2 border border-dc1-border text-dc1-text-secondary hover:text-dc1-amber hover:border-dc1-amber transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="border-t border-dc1-border p-3 shrink-0">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('Type your message…', 'اكتب رسالتك…')}
            className="flex-1 bg-dc1-surface-l2 border border-dc1-border rounded-xl px-3 py-2 text-sm text-dc1-text-primary placeholder:text-dc1-text-muted resize-none focus:outline-none focus:border-dc1-amber transition-colors"
            rows={1}
            disabled={isTyping}
            style={{ maxHeight: '120px' }}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isTyping}
            className="h-10 w-10 rounded-xl bg-dc1-amber text-dc1-void hover:bg-dc1-amber-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shrink-0"
            aria-label={t('Send', 'إرسال')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-dc1-text-muted mt-1.5 text-center">
          {t('DCP AI Assistant — for general support only', 'مساعد DCP الذكي — للدعم العام فقط')}
        </p>
      </form>
    </div>
  )
}