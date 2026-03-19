'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

export type Language = 'en' | 'ar'

export interface I18nContextValue {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
  dir: 'ltr' | 'rtl'
  isRTL: boolean
}

// ── Translation dictionary ────────────────────────────────────────────────────
const translations: Record<Language, Record<string, string>> = {
  en: {
    // Nav
    'nav.dashboard': 'Dashboard',
    'nav.marketplace': 'Marketplace',
    'nav.playground': 'Playground',
    'nav.jobs': 'My Jobs',
    'nav.billing': 'Billing',
    'nav.analytics': 'Analytics',
    'nav.settings': 'Settings',
    'nav.templates': 'Templates',

    // Auth
    'auth.sign_in': 'Sign In',
    'auth.sign_out': 'Sign Out',
    'auth.api_key_placeholder': 'Enter your API key',
    'auth.welcome_back': 'Welcome Back',
    'auth.no_account': "Don't have an account?",
    'auth.register_here': 'Register here',

    // Dashboard
    'dashboard.title': 'Renter Dashboard',
    'dashboard.welcome': 'Welcome back',
    'dashboard.balance': 'Account Balance',
    'dashboard.total_spent': 'Total Spent',
    'dashboard.jobs_run': 'Jobs Run',
    'dashboard.online_gpus': 'Online GPUs',

    // Marketplace
    'marketplace.title': 'GPU Marketplace',
    'marketplace.filter_placeholder': 'Filter by GPU model...',
    'marketplace.no_gpus': 'No GPUs are currently online.',
    'marketplace.no_match': 'No GPUs match your filter.',
    'marketplace.use_gpu': 'Use This GPU',
    'marketplace.pricing': 'Pricing (SAR/hr)',
    'marketplace.llm_inference': 'LLM Inference',
    'marketplace.image_gen': 'Image Generation',
    'marketplace.training': 'Training',
    'marketplace.vram': 'VRAM',
    'marketplace.location': 'Location',
    'marketplace.reliability': 'Reliability',
    'marketplace.last_seen': 'Last seen',
    'marketplace.cached_models': 'Cached Models (instant start)',
    'marketplace.online': 'Online',
    'marketplace.offline': 'Offline',

    // Templates
    'templates.title': 'Job Templates',
    'templates.subtitle': 'Pre-built scripts to get started quickly',
    'templates.use_template': 'Use Template',
    'templates.llm_chat': 'LLM Chat Inference',
    'templates.llm_chat_desc': 'Run a single-turn chat completion with any supported model',
    'templates.image_gen': 'Image Generation',
    'templates.image_gen_desc': 'Generate images with Stable Diffusion or compatible models',
    'templates.batch_embed': 'Batch Embeddings',
    'templates.batch_embed_desc': 'Embed a list of texts using a sentence-transformer model',
    'templates.finetune': 'Fine-tune LLM',
    'templates.finetune_desc': 'Run a LoRA fine-tuning job on a base model with your dataset',
    'templates.estimated_cost': 'Estimated cost',
    'templates.per_run': 'per run',
    'templates.category_inference': 'Inference',
    'templates.category_generation': 'Generation',
    'templates.category_training': 'Training',
    'templates.category_embedding': 'Embedding',

    // Common
    'common.loading': 'Loading...',
    'common.error': 'An error occurred',
    'common.retry': 'Retry',
    'common.sar': 'SAR',
    'common.sar_hr': 'SAR/hr',
    'common.online': 'Online',
    'common.offline': 'Offline',
    'common.view_all': 'View All',
    'common.quick_actions': 'Quick Actions',
    'common.recent_jobs': 'Recent Jobs',
    'common.available_gpus': 'Available GPUs',
    'common.sort_reputation': 'Sort: Reputation',
    'common.sort_vram': 'Sort: VRAM ↓',
    'common.sort_price': 'Sort: Price ↑',
    'common.sign_out': 'Sign Out',
    'common.no_jobs_yet': 'No jobs yet',
    'common.min': 'min',

    // Nav additions
    'nav.earnings': 'Earnings',
    'nav.gpu_metrics': 'GPU Metrics',
    'nav.providers': 'Providers',
    'nav.renters': 'Renters',
    'nav.finance': 'Finance',
    'nav.withdrawals': 'Withdrawals',
    'nav.security': 'Security',
    'nav.fleet': 'Fleet Health',

    // Sidebar labels
    'sidebar.provider_label': 'Provider Dashboard',
    'sidebar.renter_label': 'Renter Dashboard',
    'sidebar.admin_label': 'Admin Panel',

    // Provider dashboard
    'provider.dashboard': 'Provider Dashboard',
    'provider.today_earnings': "Today's Earnings",
    'provider.this_week': 'This Week',
    'provider.total_earnings': 'Total Earnings',
    'provider.jobs_completed': 'Jobs Completed',
    'provider.gpu_uptime': 'GPU Uptime',
    'provider.gpu_health': 'GPU Health',
    'provider.gpu_model': 'GPU Model',
    'provider.temperature': 'Temperature',
    'provider.daemon_status': 'Daemon Status',
    'provider.connected': 'Connected',
    'provider.stale': 'Stale',
    'provider.disconnected': 'Disconnected',
    'provider.last_seen': 'Last seen',
    'provider.gpu_usage': 'GPU Usage',
    'provider.vram_usage': 'VRAM Usage',
    'provider.last_7_days': 'Last 7 Days',
    'provider.current_job': 'Current Job',
    'provider.job_type': 'Job Type',
    'provider.job_id': 'Job ID',
    'provider.started': 'Started',
    'provider.no_active_jobs': 'No active jobs',
    'provider.recent_activity': 'Recent Activity',
    'provider.pause_gpu': 'Pause GPU',
    'provider.resume_gpu': 'Resume GPU',
    'provider.updating': 'Updating...',
    'provider.failed_load': 'Failed to load provider data',

    // Renter dashboard
    'renter.dashboard': 'Renter Dashboard',
    'renter.no_gpus': 'No GPUs available at the moment',
    'renter.use_gpu': 'Use GPU',
    'renter.no_jobs_playground': 'No jobs yet. Try the GPU Playground!',
    'renter.open_playground': 'Open GPU Playground',
    'renter.browse_marketplace': 'Browse Marketplace',
    'renter.manage_billing': 'Manage Billing',
    'renter.sign_in_prompt': 'Sign in with your API key to access your renter dashboard.',

    // Admin dashboard
    'admin.dashboard': 'Admin Dashboard',
    'admin.live_overview': 'Live platform overview',
    'admin.total_providers': 'Total Providers',
    'admin.online_now': 'Online Now',
    'admin.total_renters': 'Total Renters',
    'admin.active_jobs': 'Active Jobs',
    'admin.total_revenue': 'Total Revenue',
    'admin.dc1_fees': 'DC1 Fees',
    'admin.today_revenue': 'Today Revenue',
    'admin.gpu_fleet': 'GPU Fleet Breakdown',
    'admin.recent_signups': 'Recent Provider Signups',
    'admin.recent_heartbeats': 'Recent Daemon Heartbeats',
    'admin.providers_count': 'providers',
    'admin.no_gpu_data': 'No GPU data yet',
    'admin.no_signups': 'No signups yet',
    'admin.no_heartbeats': 'No heartbeats yet',
    'admin.loading': 'Loading dashboard data...',

    // Table headers
    'table.job_type': 'Job Type',
    'table.duration': 'Duration',
    'table.earnings': 'Earnings',
    'table.status': 'Status',
    'table.completed': 'Completed',
    'table.provider': 'Provider',
    'table.gpu_model': 'GPU Model',
    'table.vram': 'VRAM',
    'table.action': 'Action',
    'table.job_id': 'Job ID',
    'table.type': 'Type',
    'table.cost': 'Cost',
    'table.name': 'Name',
    'table.email': 'Email',
    'table.os': 'OS',
    'table.joined': 'Joined',
    'table.gpu': 'GPU',
    'table.ip': 'IP',
    'table.hostname': 'Hostname',
    'table.last_seen': 'Last Seen',

    // Login page
    'login.sign_in_desc': 'Sign in to access your dashboard',
    'login.email': 'Email',
    'login.api_key': 'API Key',
    'login.account_type': 'Account Type',
    'login.email_address': 'Email Address',
    'login.signing_in': 'Signing in...',
    'login.new_to_dc1': 'New to DC1?',
    'login.become_provider': 'Become a Provider',
    'login.want_to_rent': 'Want to rent GPUs?',
    'login.register_as_renter': 'Register as Renter',
    'login.email_hint': 'Use the email you registered with to sign in instantly.',
    'login.apikey_hint': 'Your API key was provided when you registered. Check your records or contact support.',
    'login.admin_needs_key': 'Admin login requires an API key',
    'login.enter_email': 'Please enter your email address',
    'login.enter_key': 'Please enter your API key',
    'login.welcome_back': 'Welcome Back',
    'login.sign_in_prompt': 'Sign in with your API key to access your renter dashboard.',

    // Provider registration
    'register.provider.title': 'Monetize Your GPU Hardware',
    'register.provider.subtitle': 'Join DC1 and earn SAR by sharing your idle GPU compute power.',
    'register.provider.form_title': 'Create Your Provider Account',
    'register.provider.full_name': 'Full Name',
    'register.provider.full_name_placeholder': 'Your full name',
    'register.provider.email': 'Email Address',
    'register.provider.email_placeholder': 'you@example.com',
    'register.provider.phone': 'Phone (Optional)',
    'register.provider.phone_placeholder': '+966 5X XXX XXXX',
    'register.provider.gpu_model': 'GPU Model',
    'register.provider.gpu_model_placeholder': 'Select your GPU',
    'register.provider.os': 'Operating System',
    'register.provider.os_placeholder': 'Select your OS',
    'register.provider.pdpl': 'I consent to DC1 processing my personal data in accordance with Saudi PDPL regulations.',
    'register.provider.submit': 'Register as Provider',
    'register.provider.submitting': 'Registering...',
    'register.provider.already_registered': 'Already registered?',
    'register.provider.sign_in': 'Sign in',
    'register.provider.success_title': 'Registration Successful!',
    'register.provider.success_desc': 'Your provider account has been created. Follow the steps below to connect your hardware to DC1.',
    'register.provider.api_key_title': 'Your API Key',
    'register.provider.api_key_desc': "Save this API key securely. You'll use it to authenticate your daemon.",
    'register.provider.install_title': 'Install the Daemon',
    'register.provider.install_desc': 'Run the appropriate command for your operating system:',
    'register.provider.progress_title': 'Setup Progress',
    'register.provider.next_title': "What's Next?",
    'register.provider.status_complete': 'Complete',
    'register.provider.status_in_progress': 'In progress...',
    'register.provider.status_pending': 'Pending',
    'register.provider.go_dashboard': 'Go to Dashboard',

    // Renter registration
    'register.renter.title': 'Access GPU Compute Power',
    'register.renter.subtitle': 'Rent powerful GPUs on-demand for AI, ML, and compute workloads.',
    'register.renter.form_title': 'Register as a Renter',
    'register.renter.full_name': 'Full Name',
    'register.renter.full_name_placeholder': 'Your full name',
    'register.renter.email': 'Email Address',
    'register.renter.email_placeholder': 'you@example.com',
    'register.renter.organization': 'Organization (Optional)',
    'register.renter.organization_placeholder': 'Company or university',
    'register.renter.use_case': 'Primary Use Case',
    'register.renter.phone': 'Phone (Optional)',
    'register.renter.phone_placeholder': '+966 5X XXX XXXX',
    'register.renter.pdpl': 'I consent to DC1 processing my personal data in accordance with Saudi PDPL regulations.',
    'register.renter.submit': 'Create Renter Account',
    'register.renter.submitting': 'Creating Account...',
    'register.renter.already_registered': 'Already have an account?',
    'register.renter.sign_in': 'Sign in',
    'register.renter.success_title': 'Account Created!',
    'register.renter.success_desc': 'Your renter account is ready. Save your API key and start renting GPUs.',
    'register.renter.api_key_title': 'Your API Key',
    'register.renter.api_key_desc': "Store this key safely. You'll need it to access your dashboard and submit jobs.",
    'register.renter.go_dashboard': 'Go to Renter Dashboard',
    'register.renter.explore': 'Explore Marketplace',
  },

  ar: {
    // Nav
    'nav.dashboard': 'لوحة التحكم',
    'nav.marketplace': 'السوق',
    'nav.playground': 'الملعب',
    'nav.jobs': 'وظائفي',
    'nav.billing': 'الفواتير',
    'nav.analytics': 'التحليلات',
    'nav.settings': 'الإعدادات',
    'nav.templates': 'القوالب',

    // Auth
    'auth.sign_in': 'تسجيل الدخول',
    'auth.sign_out': 'تسجيل الخروج',
    'auth.api_key_placeholder': 'أدخل مفتاح API الخاص بك',
    'auth.welcome_back': 'مرحباً بعودتك',
    'auth.no_account': 'ليس لديك حساب؟',
    'auth.register_here': 'سجل هنا',

    // Dashboard
    'dashboard.title': 'لوحة تحكم المستأجر',
    'dashboard.welcome': 'مرحباً بعودتك',
    'dashboard.balance': 'رصيد الحساب',
    'dashboard.total_spent': 'إجمالي الإنفاق',
    'dashboard.jobs_run': 'الوظائف المُنفَّذة',
    'dashboard.online_gpus': 'وحدات GPU المتصلة',

    // Marketplace
    'marketplace.title': 'سوق وحدات GPU',
    'marketplace.filter_placeholder': 'تصفية حسب طراز GPU...',
    'marketplace.no_gpus': 'لا توجد وحدات GPU متصلة حالياً.',
    'marketplace.no_match': 'لا توجد وحدات GPU تطابق الفلتر.',
    'marketplace.use_gpu': 'استخدم هذه الوحدة',
    'marketplace.pricing': 'الأسعار (ريال/ساعة)',
    'marketplace.llm_inference': 'استدلال نموذج اللغة',
    'marketplace.image_gen': 'توليد الصور',
    'marketplace.training': 'التدريب',
    'marketplace.vram': 'ذاكرة الفيديو',
    'marketplace.location': 'الموقع',
    'marketplace.reliability': 'الموثوقية',
    'marketplace.last_seen': 'آخر ظهور',
    'marketplace.cached_models': 'النماذج المخزنة (بداية فورية)',
    'marketplace.online': 'متصل',
    'marketplace.offline': 'غير متصل',

    // Templates
    'templates.title': 'قوالب الوظائف',
    'templates.subtitle': 'نصوص جاهزة للبدء بسرعة',
    'templates.use_template': 'استخدم القالب',
    'templates.llm_chat': 'استدلال محادثة LLM',
    'templates.llm_chat_desc': 'تشغيل إكمال محادثة أحادية الدور مع أي نموذج مدعوم',
    'templates.image_gen': 'توليد الصور',
    'templates.image_gen_desc': 'توليد صور باستخدام Stable Diffusion أو نماذج متوافقة',
    'templates.batch_embed': 'تضمين دفعي',
    'templates.batch_embed_desc': 'تضمين قائمة من النصوص باستخدام نموذج sentence-transformer',
    'templates.finetune': 'ضبط دقيق لنموذج LLM',
    'templates.finetune_desc': 'تشغيل وظيفة ضبط دقيق LoRA على نموذج أساسي مع مجموعة بياناتك',
    'templates.estimated_cost': 'التكلفة التقديرية',
    'templates.per_run': 'لكل تشغيل',
    'templates.category_inference': 'استدلال',
    'templates.category_generation': 'توليد',
    'templates.category_training': 'تدريب',
    'templates.category_embedding': 'تضمين',

    // Common
    'common.loading': 'جارٍ التحميل...',
    'common.error': 'حدث خطأ',
    'common.retry': 'إعادة المحاولة',
    'common.sar': 'ريال',
    'common.sar_hr': 'ريال/ساعة',
    'common.online': 'متصل',
    'common.offline': 'غير متصل',
    'common.view_all': 'عرض الكل',
    'common.quick_actions': 'إجراءات سريعة',
    'common.recent_jobs': 'الوظائف الأخيرة',
    'common.available_gpus': 'وحدات GPU المتاحة',
    'common.sort_reputation': 'ترتيب: السمعة',
    'common.sort_vram': 'ترتيب: الذاكرة ↓',
    'common.sort_price': 'ترتيب: السعر ↑',
    'common.sign_out': 'تسجيل الخروج',
    'common.no_jobs_yet': 'لا توجد وظائف بعد',
    'common.min': 'د',

    // Nav additions
    'nav.earnings': 'الأرباح',
    'nav.gpu_metrics': 'مقاييس GPU',
    'nav.providers': 'المزودون',
    'nav.renters': 'المستأجرون',
    'nav.finance': 'المالية',
    'nav.withdrawals': 'السحوبات',
    'nav.security': 'الأمان',
    'nav.fleet': 'صحة الأسطول',

    // Sidebar labels
    'sidebar.provider_label': 'لوحة تحكم المزود',
    'sidebar.renter_label': 'لوحة تحكم المستأجر',
    'sidebar.admin_label': 'لوحة الإدارة',

    // Provider dashboard
    'provider.dashboard': 'لوحة تحكم المزود',
    'provider.today_earnings': 'أرباح اليوم',
    'provider.this_week': 'هذا الأسبوع',
    'provider.total_earnings': 'إجمالي الأرباح',
    'provider.jobs_completed': 'الوظائف المكتملة',
    'provider.gpu_uptime': 'وقت تشغيل GPU',
    'provider.gpu_health': 'صحة GPU',
    'provider.gpu_model': 'طراز GPU',
    'provider.temperature': 'درجة الحرارة',
    'provider.daemon_status': 'حالة العميل',
    'provider.connected': 'متصل',
    'provider.stale': 'متأخر',
    'provider.disconnected': 'منقطع',
    'provider.last_seen': 'آخر ظهور',
    'provider.gpu_usage': 'استخدام GPU',
    'provider.vram_usage': 'استخدام الذاكرة',
    'provider.last_7_days': 'آخر 7 أيام',
    'provider.current_job': 'الوظيفة الحالية',
    'provider.job_type': 'نوع الوظيفة',
    'provider.job_id': 'معرف الوظيفة',
    'provider.started': 'بدأت',
    'provider.no_active_jobs': 'لا توجد وظائف نشطة',
    'provider.recent_activity': 'النشاط الأخير',
    'provider.pause_gpu': 'إيقاف GPU مؤقتاً',
    'provider.resume_gpu': 'استئناف GPU',
    'provider.updating': 'جارٍ التحديث...',
    'provider.failed_load': 'فشل تحميل بيانات المزود',

    // Renter dashboard
    'renter.dashboard': 'لوحة تحكم المستأجر',
    'renter.no_gpus': 'لا توجد وحدات GPU متاحة حالياً',
    'renter.use_gpu': 'استخدم GPU',
    'renter.no_jobs_playground': 'لا توجد وظائف بعد. جرّب ملعب GPU!',
    'renter.open_playground': 'افتح ملعب GPU',
    'renter.browse_marketplace': 'تصفح السوق',
    'renter.manage_billing': 'إدارة الفواتير',
    'renter.sign_in_prompt': 'سجّل الدخول بمفتاح API للوصول إلى لوحة تحكم المستأجر.',

    // Admin dashboard
    'admin.dashboard': 'لوحة تحكم الإدارة',
    'admin.live_overview': 'نظرة عامة حية على المنصة',
    'admin.total_providers': 'إجمالي المزودين',
    'admin.online_now': 'متصل الآن',
    'admin.total_renters': 'إجمالي المستأجرين',
    'admin.active_jobs': 'الوظائف النشطة',
    'admin.total_revenue': 'إجمالي الإيرادات',
    'admin.dc1_fees': 'رسوم DC1',
    'admin.today_revenue': 'إيرادات اليوم',
    'admin.gpu_fleet': 'تفصيل أسطول GPU',
    'admin.recent_signups': 'أحدث تسجيلات المزودين',
    'admin.recent_heartbeats': 'أحدث نبضات العميل',
    'admin.providers_count': 'مزود',
    'admin.no_gpu_data': 'لا توجد بيانات GPU بعد',
    'admin.no_signups': 'لا توجد تسجيلات بعد',
    'admin.no_heartbeats': 'لا توجد نبضات بعد',
    'admin.loading': 'جارٍ تحميل بيانات لوحة التحكم...',

    // Table headers
    'table.job_type': 'نوع الوظيفة',
    'table.duration': 'المدة',
    'table.earnings': 'الأرباح',
    'table.status': 'الحالة',
    'table.completed': 'مكتمل',
    'table.provider': 'المزود',
    'table.gpu_model': 'طراز GPU',
    'table.vram': 'الذاكرة',
    'table.action': 'الإجراء',
    'table.job_id': 'معرف الوظيفة',
    'table.type': 'النوع',
    'table.cost': 'التكلفة',
    'table.name': 'الاسم',
    'table.email': 'البريد الإلكتروني',
    'table.os': 'نظام التشغيل',
    'table.joined': 'الانضمام',
    'table.gpu': 'GPU',
    'table.ip': 'IP',
    'table.hostname': 'اسم المضيف',
    'table.last_seen': 'آخر ظهور',

    // Login page
    'login.sign_in_desc': 'سجّل الدخول للوصول إلى لوحتك',
    'login.email': 'البريد الإلكتروني',
    'login.api_key': 'مفتاح API',
    'login.account_type': 'نوع الحساب',
    'login.email_address': 'عنوان البريد الإلكتروني',
    'login.signing_in': 'جارٍ تسجيل الدخول...',
    'login.new_to_dc1': 'جديد على DC1؟',
    'login.become_provider': 'كن مزوداً',
    'login.want_to_rent': 'تريد استئجار GPU؟',
    'login.register_as_renter': 'سجّل كمستأجر',
    'login.email_hint': 'استخدم البريد الإلكتروني الذي سجّلت به للدخول فوراً.',
    'login.apikey_hint': 'تم تزويدك بمفتاح API عند التسجيل. تحقق من سجلاتك أو تواصل مع الدعم.',
    'login.admin_needs_key': 'تسجيل دخول الأدمن يتطلب مفتاح API',
    'login.enter_email': 'الرجاء إدخال عنوان بريدك الإلكتروني',
    'login.enter_key': 'الرجاء إدخال مفتاح API الخاص بك',
    'login.welcome_back': 'مرحباً بعودتك',
    'login.sign_in_prompt': 'سجّل الدخول بمفتاح API للوصول إلى لوحة تحكم المستأجر.',

    // Provider registration
    'register.provider.title': 'حوّل بطاقتك الرسومية إلى دخل',
    'register.provider.subtitle': 'انضم إلى DC1 واكسب ريالات سعودية بمشاركة طاقة GPU الخاملة.',
    'register.provider.form_title': 'إنشاء حساب مزود',
    'register.provider.full_name': 'الاسم الكامل',
    'register.provider.full_name_placeholder': 'اسمك الكامل',
    'register.provider.email': 'عنوان البريد الإلكتروني',
    'register.provider.email_placeholder': 'you@example.com',
    'register.provider.phone': 'الهاتف (اختياري)',
    'register.provider.phone_placeholder': '+966 5X XXX XXXX',
    'register.provider.gpu_model': 'طراز GPU',
    'register.provider.gpu_model_placeholder': 'اختر بطاقتك الرسومية',
    'register.provider.os': 'نظام التشغيل',
    'register.provider.os_placeholder': 'اختر نظام التشغيل',
    'register.provider.pdpl': 'أوافق على معالجة DC1 لبياناتي الشخصية وفقاً لنظام حماية البيانات الشخصية السعودي.',
    'register.provider.submit': 'التسجيل كمزود',
    'register.provider.submitting': 'جارٍ التسجيل...',
    'register.provider.already_registered': 'لديك حساب بالفعل؟',
    'register.provider.sign_in': 'تسجيل الدخول',
    'register.provider.success_title': 'تم التسجيل بنجاح!',
    'register.provider.success_desc': 'تم إنشاء حساب المزود الخاص بك. اتبع الخطوات أدناه لتوصيل جهازك بـ DC1.',
    'register.provider.api_key_title': 'مفتاح API الخاص بك',
    'register.provider.api_key_desc': 'احفظ مفتاح API هذا بأمان. ستستخدمه للمصادقة على العميل.',
    'register.provider.install_title': 'تثبيت العميل',
    'register.provider.install_desc': 'شغّل الأمر المناسب لنظام تشغيلك:',
    'register.provider.progress_title': 'تقدم الإعداد',
    'register.provider.next_title': 'ما التالي؟',
    'register.provider.status_complete': 'مكتمل',
    'register.provider.status_in_progress': 'جارٍ...',
    'register.provider.status_pending': 'قيد الانتظار',
    'register.provider.go_dashboard': 'الذهاب إلى لوحة التحكم',

    // Renter registration
    'register.renter.title': 'احصل على قوة GPU الحوسبية',
    'register.renter.subtitle': 'استأجر وحدات GPU قوية عند الطلب لأعمال الذكاء الاصطناعي والحوسبة.',
    'register.renter.form_title': 'التسجيل كمستأجر',
    'register.renter.full_name': 'الاسم الكامل',
    'register.renter.full_name_placeholder': 'اسمك الكامل',
    'register.renter.email': 'عنوان البريد الإلكتروني',
    'register.renter.email_placeholder': 'you@example.com',
    'register.renter.organization': 'المؤسسة (اختياري)',
    'register.renter.organization_placeholder': 'الشركة أو الجامعة',
    'register.renter.use_case': 'الغرض الرئيسي',
    'register.renter.phone': 'الهاتف (اختياري)',
    'register.renter.phone_placeholder': '+966 5X XXX XXXX',
    'register.renter.pdpl': 'أوافق على معالجة DC1 لبياناتي الشخصية وفقاً لنظام حماية البيانات الشخصية السعودي.',
    'register.renter.submit': 'إنشاء حساب مستأجر',
    'register.renter.submitting': 'جارٍ إنشاء الحساب...',
    'register.renter.already_registered': 'لديك حساب بالفعل؟',
    'register.renter.sign_in': 'تسجيل الدخول',
    'register.renter.success_title': 'تم إنشاء الحساب!',
    'register.renter.success_desc': 'حساب المستأجر جاهز. احفظ مفتاح API وابدأ في استئجار وحدات GPU.',
    'register.renter.api_key_title': 'مفتاح API الخاص بك',
    'register.renter.api_key_desc': 'احتفظ بهذا المفتاح بأمان. ستحتاجه للوصول إلى لوحتك وتقديم الوظائف.',
    'register.renter.go_dashboard': 'الذهاب إلى لوحة تحكم المستأجر',
    'register.renter.explore': 'استكشف السوق',
  },
}

// ── Context ───────────────────────────────────────────────────────────────────
const I18nContext = createContext<I18nContextValue>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
  dir: 'ltr',
  isRTL: false,
})

// ── Provider ──────────────────────────────────────────────────────────────────
export function LanguageWrapper({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')

  // Persist language choice; restore on mount
  useEffect(() => {
    const stored = localStorage.getItem('dc1_language') as Language | null
    if (stored === 'ar' || stored === 'en') {
      setLanguageState(stored)
    }
  }, [])

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('dc1_language', lang)
  }, [])

  // Apply dir attribute and font to <html> and <body> when language changes
  useEffect(() => {
    const dir = language === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.setAttribute('dir', dir)
    document.documentElement.setAttribute('lang', language)
    if (language === 'ar') {
      document.documentElement.classList.add('font-tajawal')
      document.documentElement.classList.remove('font-inter')
      document.body.classList.add('font-tajawal')
      document.body.classList.remove('font-inter')
    } else {
      document.documentElement.classList.add('font-inter')
      document.documentElement.classList.remove('font-tajawal')
      document.body.classList.add('font-inter')
      document.body.classList.remove('font-tajawal')
    }
  }, [language])

  const t = useCallback(
    (key: string): string => {
      return translations[language][key] ?? translations['en'][key] ?? key
    },
    [language]
  )

  const value: I18nContextValue = {
    language,
    setLanguage,
    t,
    dir: language === 'ar' ? 'rtl' : 'ltr',
    isRTL: language === 'ar',
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useLanguage(): I18nContextValue {
  return useContext(I18nContext)
}

// ── Language Toggle Button ────────────────────────────────────────────────────
export function LanguageToggle({ className = '' }: { className?: string }) {
  const { language, setLanguage } = useLanguage()

  return (
    <button
      onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border border-dc1-border text-dc1-text-secondary hover:text-dc1-text-primary hover:border-dc1-border-light transition-colors ${className}`}
      aria-label={language === 'en' ? 'Switch to Arabic' : 'Switch to English'}
      title={language === 'en' ? 'عربي' : 'English'}
    >
      <span className="text-base leading-none">{language === 'en' ? '🇸🇦' : '🇬🇧'}</span>
      <span>{language === 'en' ? 'العربية' : 'English'}</span>
    </button>
  )
}
