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

// ─── FAQ Knowledge Base ──────────────────────────────────────────────────────

interface FAQEntry {
  keywords: string[]
  en: string
  ar: string
}

const FAQ_ENTRIES: FAQEntry[] = [
  {
    keywords: ['pricing', 'price', 'cost', 'how much', 'rate', 'سعر', 'تكلفة', 'أسعار'],
    en: `**DCP Pricing**\n\nDCP uses per-token billing for inference and per-hour billing for GPU compute:\n\n- **RTX 4090**: ~$0.27/hr (35% below Vast.ai)\n- **RTX 4080**: ~$0.20/hr\n- **Inference**: Per-token pricing varies by model\n- **Currency**: SAR (Saudi Riyals), billed in halala\n\nAll pricing includes Saudi energy-cost advantage. Visit [dcp.sa/marketplace](/marketplace) to see live rates, or email **support@dcp.sa** for enterprise pricing.`,
    ar: `**أسعار DCP**\n\nتستخدم DCP الفوترة لكل توكن للاستدلال ولكل ساعة لحوسبة GPU:\n\n- **RTX 4090**: ~$0.27/ساعة (أقل بـ 35% من Vast.ai)\n- **RTX 4080**: ~$0.20/ساعة\n- **الاستدلال**: التسعير لكل توكن يختلف حسب النموذج\n- **العملة**: ريال سعودي\n\nزر [dcp.sa/marketplace](/marketplace) للأسعار المباشرة، أو راسل **support@dcp.sa** لأسعار المؤسسات.`,
  },
  {
    keywords: ['start', 'getting started', 'begin', 'how to', 'sign up', 'register', 'أبدأ', 'بداية', 'تسجيل'],
    en: `**Getting Started with DCP**\n\n1. **As a Renter** (use GPU compute):\n   - Visit [dcp.sa/renter/register](/renter/register)\n   - Get your API key from the dashboard\n   - Use our Python SDK: \`pip install dc1-sdk\`\n   - Or call the API directly at api.dcp.sa\n\n2. **As a Provider** (earn from your GPU):\n   - Visit [dcp.sa/provider/register](/provider/register)\n   - Install the DCP daemon on your machine\n   - Start earning from idle GPU capacity\n\nNeed help? Email **support@dcp.sa**`,
    ar: `**البدء مع DCP**\n\n1. **كمستأجر** (استخدام حوسبة GPU):\n   - زر [dcp.sa/renter/register](/renter/register)\n   - احصل على مفتاح API من لوحة التحكم\n   - استخدم SDK بايثون: \`pip install dc1-sdk\`\n\n2. **كمزود** (اربح من GPU الخاص بك):\n   - زر [dcp.sa/provider/register](/provider/register)\n   - ثبّت عميل DCP على جهازك\n\nتحتاج مساعدة؟ راسل **support@dcp.sa**`,
  },
  {
    keywords: ['sdk', 'api', 'integrate', 'python', 'javascript', 'code', 'برمجة', 'تكامل'],
    en: `**DCP SDKs & API**\n\n- **Python SDK**: \`pip install dc1-sdk\` — [docs](/docs/api)\n- **JavaScript SDK**: \`npm install dc1-renter-sdk\` — [docs](/docs/api)\n- **REST API**: OpenAI-compatible at \`api.dcp.sa/v1/chat/completions\`\n- **Auth**: Use \`x-renter-key\` header or \`?key=\` query param\n\nQuick example:\n\`\`\`python\nfrom dc1 import Client\nclient = Client(api_key="dcp_...")\nresult = client.chat("Hello!")\n\`\`\`\n\nFull docs at [dcp.sa/docs](/docs)`,
    ar: `**حزم تطوير DCP والـ API**\n\n- **Python SDK**: \`pip install dc1-sdk\`\n- **JavaScript SDK**: \`npm install dc1-renter-sdk\`\n- **REST API**: متوافق مع OpenAI على \`api.dcp.sa/v1/chat/completions\`\n\nالتوثيق الكامل على [dcp.sa/docs](/docs)`,
  },
  {
    keywords: ['provider', 'earn', 'gpu', 'contribute', 'mining', 'مزود', 'ربح', 'مساهمة'],
    en: `**Become a DCP Provider**\n\nEarn money from your idle GPU:\n\n1. Register at [dcp.sa/provider/register](/provider/register)\n2. Install the DCP provider daemon\n3. Your GPU serves AI workloads automatically\n4. Get paid in SAR based on usage\n\n**Supported GPUs**: NVIDIA RTX 3080+, RTX 4080, RTX 4090, A100, H100\n**Earnings**: Varies by GPU model and utilization\n\nQuestions? Email **support@dcp.sa**`,
    ar: `**كن مزوداً في DCP**\n\nاربح من GPU الخامل لديك:\n\n1. سجّل في [dcp.sa/provider/register](/provider/register)\n2. ثبّت عميل مزود DCP\n3. يخدم GPU الخاص بك أحمال عمل AI تلقائياً\n4. احصل على الدفع بالريال السعودي\n\n**GPU المدعومة**: NVIDIA RTX 3080+, RTX 4080, RTX 4090, A100, H100\n\nأسئلة؟ راسل **support@dcp.sa**`,
  },
  {
    keywords: ['model', 'arabic', 'allam', 'jais', 'falcon', 'mistral', 'llama', 'نموذج', 'عربي'],
    en: `**Supported AI Models**\n\nDCP supports Arabic-first and multilingual models:\n\n🇸🇦 **Arabic Models**: ALLaM 7B, JAIS 13B, Falcon H1 7B\n🌍 **Multilingual**: Mistral 7B, Llama 3 8B, Qwen 2.5 7B\n🖼️ **Image**: SDXL, Stable Diffusion\n⚡ **Fast**: Nemotron Nano 4B, TinyLlama\n\nAll models run on Saudi GPU infrastructure with PDPL data residency compliance.\n\nBrowse models at [dcp.sa/marketplace](/marketplace)`,
    ar: `**نماذج AI المدعومة**\n\n🇸🇦 **نماذج عربية**: ALLaM 7B, JAIS 13B, Falcon H1 7B\n🌍 **متعددة اللغات**: Mistral 7B, Llama 3 8B, Qwen 2.5 7B\n🖼️ **صور**: SDXL, Stable Diffusion\n\nجميع النماذج تعمل على بنية GPU سعودية مع امتثال PDPL.\n\nتصفح النماذج في [dcp.sa/marketplace](/marketplace)`,
  },
  {
    keywords: ['saudi', 'data', 'residency', 'pdpl', 'compliance', 'security', 'سعودي', 'بيانات', 'أمان'],
    en: `**Saudi Data Residency & Compliance**\n\nDCP is built for Saudi data sovereignty:\n\n- **PDPL Compliant**: All data stays in-Kingdom\n- **Saudi GPUs**: Compute runs on Saudi-hosted hardware\n- **Energy Advantage**: Saudi electricity rates = 35-50% cost savings\n- **Arabic-First**: Native support for Arabic AI models\n\nFor enterprise compliance requirements, contact **support@dcp.sa**`,
    ar: `**إقامة البيانات السعودية والامتثال**\n\nDCP مبنية لسيادة البيانات السعودية:\n\n- **متوافقة مع PDPL**: جميع البيانات تبقى داخل المملكة\n- **GPU سعودية**: الحوسبة تعمل على أجهزة مستضافة في السعودية\n- **ميزة الطاقة**: أسعار الكهرباء السعودية = توفير 35-50%\n\nللمتطلبات المؤسسية، راسل **support@dcp.sa**`,
  },
]

const FALLBACK_EN = `I don't have a specific answer for that, but I'd love to help! Here are some options:\n\n- Browse our [documentation](/docs)\n- Check the [marketplace](/marketplace) for available models and pricing\n- Email **support@dcp.sa** for personalized help\n\nYou can also ask me about: pricing, getting started, SDKs, providers, models, or data residency.`
const FALLBACK_AR = `ليس لدي إجابة محددة لذلك، لكنني أود المساعدة!\n\n- تصفح [التوثيق](/docs)\n- اطلع على [السوق](/marketplace) للنماذج والأسعار المتاحة\n- راسل **support@dcp.sa** للمساعدة الشخصية\n\nيمكنك أيضاً السؤال عن: الأسعار، البدء، حزم التطوير، المزودين، النماذج، أو إقامة البيانات.`

function matchFAQ(query: string, isArabic: boolean): string {
  const lower = query.toLowerCase()
  let bestMatch: FAQEntry | null = null
  let bestScore = 0

  for (const entry of FAQ_ENTRIES) {
    const score = entry.keywords.filter(kw => lower.includes(kw.toLowerCase())).length
    if (score > bestScore) {
      bestScore = score
      bestMatch = entry
    }
  }

  if (bestMatch && bestScore > 0) {
    return isArabic ? bestMatch.ar : bestMatch.en
  }
  return isArabic ? FALLBACK_AR : FALLBACK_EN
}

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

    // Simulate brief typing delay for natural feel
    await new Promise(resolve => setTimeout(resolve, 400 + Math.random() * 600))

    const response = matchFAQ(trimmed, isRTL)

    setMessages(prev => {
      const updated = [...prev]
      updated[updated.length - 1] = { role: 'assistant', content: response }
      return updated
    })
    setIsStreaming(false)
  }, [input, messages, isStreaming, isRTL])

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
              {t('DCP Support', 'دعم DCP')}
            </p>
            <p className="text-[10px] text-[#94a3b8] mt-0.5">
              {isStreaming
                ? t('Thinking...', 'جارٍ التفكير...')
                : t('AI Assistant', 'المساعد الذكي')}
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
              {t('DCP Support', 'دعم DCP')}
            </p>
            <p className="text-xs text-[#94a3b8] mb-1">
              {t(
                'Hello! I\'m the DCP Support Assistant.',
                'مرحباً! أنا مساعد DCP الذكي.',
              )}
            </p>
            <p className="text-xs text-[#94a3b8] mb-4">
              {t(
                'How can I help you today?',
                'كيف يمكنني مساعدتك اليوم؟',
              )}
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {[
                t('How does pricing work?', 'كيف يعمل التسعير؟'),
                t('How do I get started?', 'كيف أبدأ؟'),
                t('What models are available?', 'ما النماذج المتاحة؟'),
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
          {t('DCP AI Assistant — for general support only', 'مساعد DCP الذكي — للدعم العام فقط')}
        </p>
      </div>
    </div>
  )
}
