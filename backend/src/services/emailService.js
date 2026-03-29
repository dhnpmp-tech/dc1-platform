const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_ADDRESS = 'DCP Platform <noreply@dcp.sa>';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toSafeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatSar(value) {
  return toSafeNumber(value, 0).toFixed(2);
}

function formatHalalaAsSar(value) {
  return formatSar(toSafeNumber(value, 0) / 100);
}

function getFrontendUrl() {
  return (process.env.FRONTEND_URL || 'https://dcp.sa').replace(/\/+$/, '');
}

function notificationFooterText() {
  return 'Manage notifications at dcp.sa/renter/settings';
}

function notificationFooterHtml() {
  return `<p style="margin-top:16px;color:#666;font-size:13px">Manage notifications at <a href="https://dcp.sa/renter/settings">dcp.sa/renter/settings</a></p>`;
}

async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[emailService] RESEND_API_KEY not set, skipping email to ${to}`);
    return { ok: false, reason: 'not_configured' };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to,
        subject,
        html,
        text,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const details = await response.text();
      console.error(`[emailService] Failed to send email (${response.status}) to ${to}: ${details}`);
      return { ok: false, reason: 'provider_error', status: response.status };
    }

    return { ok: true };
  } catch (error) {
    console.error(`[emailService] Network error while emailing ${to}:`, error.message);
    return { ok: false, reason: 'network_error' };
  }
}

function buildWelcomeTemplate({ name, apiKey, role }) {
  const frontend = getFrontendUrl();
  const dashboardPath = role === 'provider' ? '/provider' : '/renter';
  const dashboardUrl = `${frontend}${dashboardPath}`;
  const quickstartUrl = `${frontend}/docs`;
  const roleLabel = role === 'provider' ? 'Provider' : 'Renter';
  const roleLabelAr = role === 'provider' ? 'مزود' : 'مستأجر';

  return {
    subject: 'Welcome to DCP — your API key | مرحباً بك في DCP — مفتاح API الخاص بك',
    text: [
      `Welcome to DCP, ${name}!`,
      '',
      `Your ${roleLabel} API key: ${apiKey}`,
      `Dashboard: ${dashboardUrl}`,
      `Quickstart Guide: ${quickstartUrl}`,
      '',
      'Save this key securely. It will not be shown again.',
      '',
      `مرحباً بك في DCP، ${name}!`,
      '',
      `مفتاح API الخاص بحساب ${roleLabelAr}: ${apiKey}`,
      `لوحة التحكم: ${dashboardUrl}`,
      `دليل البدء السريع: ${quickstartUrl}`,
      '',
      'يرجى حفظ هذا المفتاح لأنه لن يظهر مرة أخرى.',
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;color:#111;line-height:1.6">
        <h2>Welcome to DCP</h2>
        <p>Hello ${escapeHtml(name)}, your <strong>${escapeHtml(roleLabel)}</strong> account is ready.</p>
        <p><strong>API Key:</strong><br><code>${escapeHtml(apiKey)}</code></p>
        <p><a href="${dashboardUrl}">Open dashboard</a> | <a href="${quickstartUrl}">Quickstart guide</a></p>
        <hr />
        <h2>مرحباً بك في DCP</h2>
        <p>مرحباً ${escapeHtml(name)}، حسابك كـ <strong>${escapeHtml(roleLabelAr)}</strong> جاهز.</p>
        <p><strong>مفتاح API:</strong><br><code>${escapeHtml(apiKey)}</code></p>
        <p><a href="${dashboardUrl}">لوحة التحكم</a> | <a href="${quickstartUrl}">دليل البدء السريع</a></p>
      </div>
    `,
  };
}

function buildJobCompleteTemplate({ jobId, costSar, model, durationMinutes, providerEarningSar }) {
  const frontend = getFrontendUrl();
  const jobDetailUrl = `${frontend}/renter/jobs/${encodeURIComponent(String(jobId || ''))}`;
  const safeModel = model || 'General compute';
  const durationLabel = Number.isFinite(durationMinutes) ? `${durationMinutes} min` : 'N/A';
  const earningLabel = Number.isFinite(providerEarningSar) ? `${formatSar(providerEarningSar)} SAR` : 'N/A';
  const costLabel = formatSar(costSar);

  return {
    subject: `DCP Job #${jobId} completed — ${costLabel} SAR | اكتمل طلب DCP #${jobId}`,
    text: [
      `Your job #${jobId} is complete.`,
      `Model: ${safeModel}`,
      `Duration: ${durationLabel}`,
      `Cost: ${costLabel} SAR`,
      `Provider earning: ${earningLabel}`,
      `Job details: ${jobDetailUrl}`,
      '',
      `اكتمل الطلب #${jobId}.`,
      `النموذج: ${safeModel}`,
      `المدة: ${durationLabel}`,
      `التكلفة: ${costLabel} ريال`,
      `دخل المزود: ${earningLabel}`,
      `تفاصيل الطلب: ${jobDetailUrl}`,
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;color:#111;line-height:1.6">
        <h2>Job Completed</h2>
        <p>Your job <strong>#${escapeHtml(jobId)}</strong> has completed.</p>
        <ul>
          <li><strong>Model:</strong> ${escapeHtml(safeModel)}</li>
          <li><strong>Duration:</strong> ${escapeHtml(durationLabel)}</li>
          <li><strong>Cost:</strong> ${escapeHtml(costLabel)} SAR</li>
          <li><strong>Provider earning:</strong> ${escapeHtml(earningLabel)}</li>
        </ul>
        <p><a href="${jobDetailUrl}">View job details</a></p>
        <hr />
        <h2>اكتمل الطلب</h2>
        <p>اكتمل الطلب <strong>#${escapeHtml(jobId)}</strong>.</p>
        <ul>
          <li><strong>النموذج:</strong> ${escapeHtml(safeModel)}</li>
          <li><strong>المدة:</strong> ${escapeHtml(durationLabel)}</li>
          <li><strong>التكلفة:</strong> ${escapeHtml(costLabel)} ريال</li>
          <li><strong>دخل المزود:</strong> ${escapeHtml(earningLabel)}</li>
        </ul>
        <p><a href="${jobDetailUrl}">عرض تفاصيل الطلب</a></p>
      </div>
    `,
  };
}

function buildJobQueuedTemplate({
  jobId,
  jobType,
  imageType,
  quotedCostHalala,
  queuePosition,
  estimatedDurationMinutes,
}) {
  const frontend = getFrontendUrl();
  const jobDetailUrl = `${frontend}/renter/jobs/${encodeURIComponent(String(jobId || ''))}`;
  const quotedCostLabel = formatHalalaAsSar(quotedCostHalala);
  const queueLabel = Number.isFinite(Number(queuePosition)) ? String(Number(queuePosition)) : 'N/A';
  const durationLabel = Number.isFinite(Number(estimatedDurationMinutes))
    ? `${Number(estimatedDurationMinutes)} min`
    : 'N/A';
  const safeJobType = jobType || 'general';
  const safeImageType = imageType || 'default';
  const footer = notificationFooterText();

  return {
    subject: `Job queued on DCP — #${jobId} | تم إدراج الطلب في قائمة انتظار DCP`,
    text: [
      `Your job #${jobId} has been queued on DCP.`,
      `Job type: ${safeJobType}`,
      `Container image type: ${safeImageType}`,
      `Quoted cost: ${quotedCostLabel} SAR`,
      `Queue position: ${queueLabel}`,
      `Estimated duration: ${durationLabel}`,
      `Track job: ${jobDetailUrl}`,
      '',
      `تم إدراج الطلب #${jobId} في قائمة انتظار DCP.`,
      `نوع المهمة: ${safeJobType}`,
      `نوع الحاوية: ${safeImageType}`,
      `التكلفة التقديرية: ${quotedCostLabel} ريال`,
      `ترتيب الطابور: ${queueLabel}`,
      `المدة التقديرية: ${durationLabel}`,
      `متابعة الطلب: ${jobDetailUrl}`,
      '',
      footer,
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;color:#111;line-height:1.6">
        <h2>Job Queued on DCP</h2>
        <p>Your job <strong>#${escapeHtml(jobId)}</strong> has been queued.</p>
        <ul>
          <li><strong>Job type:</strong> ${escapeHtml(safeJobType)}</li>
          <li><strong>Container image type:</strong> ${escapeHtml(safeImageType)}</li>
          <li><strong>Quoted cost:</strong> ${escapeHtml(quotedCostLabel)} SAR</li>
          <li><strong>Queue position:</strong> ${escapeHtml(queueLabel)}</li>
          <li><strong>Estimated duration:</strong> ${escapeHtml(durationLabel)}</li>
        </ul>
        <p><a href="${jobDetailUrl}">Track this job</a></p>
        <hr />
        <h2>تم إدراج الطلب في قائمة الانتظار</h2>
        <p>تم إدراج الطلب <strong>#${escapeHtml(jobId)}</strong> في قائمة الانتظار.</p>
        <ul>
          <li><strong>نوع المهمة:</strong> ${escapeHtml(safeJobType)}</li>
          <li><strong>نوع الحاوية:</strong> ${escapeHtml(safeImageType)}</li>
          <li><strong>التكلفة التقديرية:</strong> ${escapeHtml(quotedCostLabel)} ريال</li>
          <li><strong>ترتيب الطابور:</strong> ${escapeHtml(queueLabel)}</li>
          <li><strong>المدة التقديرية:</strong> ${escapeHtml(durationLabel)}</li>
        </ul>
        <p><a href="${jobDetailUrl}">متابعة الطلب</a></p>
        ${notificationFooterHtml()}
      </div>
    `,
  };
}

function buildJobStartedTemplate({
  jobId,
  jobType,
  imageType,
  estimatedDurationMinutes,
}) {
  const frontend = getFrontendUrl();
  const jobDetailUrl = `${frontend}/renter/jobs/${encodeURIComponent(String(jobId || ''))}`;
  const durationLabel = Number.isFinite(Number(estimatedDurationMinutes))
    ? `${Number(estimatedDurationMinutes)} min`
    : 'N/A';
  const safeJobType = jobType || 'general';
  const safeImageType = imageType || 'default';
  const footer = notificationFooterText();

  return {
    subject: `Your DCP job has started — #${jobId} | بدأ تنفيذ طلبك على DCP`,
    text: [
      `Your job #${jobId} has started on a DCP provider.`,
      `Job type: ${safeJobType}`,
      `Container image type: ${safeImageType}`,
      `Estimated duration: ${durationLabel}`,
      `Track progress: ${jobDetailUrl}`,
      '',
      `بدأ تنفيذ الطلب #${jobId} على مزود في DCP.`,
      `نوع المهمة: ${safeJobType}`,
      `نوع الحاوية: ${safeImageType}`,
      `المدة التقديرية: ${durationLabel}`,
      `متابعة التنفيذ: ${jobDetailUrl}`,
      '',
      footer,
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;color:#111;line-height:1.6">
        <h2>Your Job Has Started</h2>
        <p>Your job <strong>#${escapeHtml(jobId)}</strong> is now running on a DCP provider.</p>
        <ul>
          <li><strong>Job type:</strong> ${escapeHtml(safeJobType)}</li>
          <li><strong>Container image type:</strong> ${escapeHtml(safeImageType)}</li>
          <li><strong>Estimated duration:</strong> ${escapeHtml(durationLabel)}</li>
        </ul>
        <p><a href="${jobDetailUrl}">Track progress</a></p>
        <hr />
        <h2>بدأ تنفيذ الطلب</h2>
        <p>الطلب <strong>#${escapeHtml(jobId)}</strong> قيد التنفيذ الآن على مزود DCP.</p>
        <ul>
          <li><strong>نوع المهمة:</strong> ${escapeHtml(safeJobType)}</li>
          <li><strong>نوع الحاوية:</strong> ${escapeHtml(safeImageType)}</li>
          <li><strong>المدة التقديرية:</strong> ${escapeHtml(durationLabel)}</li>
        </ul>
        <p><a href="${jobDetailUrl}">متابعة التنفيذ</a></p>
        ${notificationFooterHtml()}
      </div>
    `,
  };
}

function buildJobCompletedTemplate({
  jobId,
  actualCostHalala,
  gpuSecondsUsed,
  jobType,
  imageType,
}) {
  const frontend = getFrontendUrl();
  const jobDetailUrl = `${frontend}/renter/jobs/${encodeURIComponent(String(jobId || ''))}`;
  const costLabel = formatHalalaAsSar(actualCostHalala);
  const gpuSecondsLabel = Number.isFinite(Number(gpuSecondsUsed)) ? String(Number(gpuSecondsUsed)) : 'N/A';
  const safeJobType = jobType || 'general';
  const safeImageType = imageType || 'default';
  const footer = notificationFooterText();

  return {
    subject: `Job complete — results ready (#${jobId}) | اكتمل الطلب والنتائج جاهزة`,
    text: [
      `Your job #${jobId} is complete and results are ready.`,
      `Job type: ${safeJobType}`,
      `Container image type: ${safeImageType}`,
      `Actual cost: ${costLabel} SAR`,
      `GPU seconds used: ${gpuSecondsLabel}`,
      `Open results: ${jobDetailUrl}`,
      '',
      `اكتمل الطلب #${jobId} والنتائج جاهزة.`,
      `نوع المهمة: ${safeJobType}`,
      `نوع الحاوية: ${safeImageType}`,
      `التكلفة الفعلية: ${costLabel} ريال`,
      `ثواني GPU المستخدمة: ${gpuSecondsLabel}`,
      `عرض النتائج: ${jobDetailUrl}`,
      '',
      footer,
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;color:#111;line-height:1.6">
        <h2>Job Completed</h2>
        <p>Your job <strong>#${escapeHtml(jobId)}</strong> is complete and results are ready.</p>
        <ul>
          <li><strong>Job type:</strong> ${escapeHtml(safeJobType)}</li>
          <li><strong>Container image type:</strong> ${escapeHtml(safeImageType)}</li>
          <li><strong>Actual cost:</strong> ${escapeHtml(costLabel)} SAR</li>
          <li><strong>GPU seconds used:</strong> ${escapeHtml(gpuSecondsLabel)}</li>
        </ul>
        <p><a href="${jobDetailUrl}">Open results</a></p>
        <hr />
        <h2>اكتمل الطلب</h2>
        <p>اكتمل الطلب <strong>#${escapeHtml(jobId)}</strong> والنتائج جاهزة.</p>
        <ul>
          <li><strong>نوع المهمة:</strong> ${escapeHtml(safeJobType)}</li>
          <li><strong>نوع الحاوية:</strong> ${escapeHtml(safeImageType)}</li>
          <li><strong>التكلفة الفعلية:</strong> ${escapeHtml(costLabel)} ريال</li>
          <li><strong>ثواني GPU المستخدمة:</strong> ${escapeHtml(gpuSecondsLabel)}</li>
        </ul>
        <p><a href="${jobDetailUrl}">عرض النتائج</a></p>
        ${notificationFooterHtml()}
      </div>
    `,
  };
}

function buildJobFailedTemplate({
  jobId,
  lastError,
  refundedAmountHalala,
  retryAttempts,
}) {
  const frontend = getFrontendUrl();
  const jobDetailUrl = `${frontend}/renter/jobs/${encodeURIComponent(String(jobId || ''))}`;
  const refundLabel = formatHalalaAsSar(refundedAmountHalala);
  const retryLabel = Number.isFinite(Number(retryAttempts)) ? String(Number(retryAttempts)) : '0';
  const safeError = lastError || 'No additional error details reported.';
  const footer = notificationFooterText();

  return {
    subject: `Job failed — funds refunded (#${jobId}) | فشل الطلب وأُعيد المبلغ إلى رصيدك`,
    text: [
      `Your job #${jobId} failed and funds were refunded.`,
      `Last error: ${safeError}`,
      `Refunded amount: ${refundLabel} SAR`,
      `Retry attempts: ${retryLabel}`,
      `Job details: ${jobDetailUrl}`,
      '',
      `فشل الطلب #${jobId} وأُعيد المبلغ إلى رصيدك في DCP.`,
      `آخر خطأ: ${safeError}`,
      `المبلغ المرتجع: ${refundLabel} ريال`,
      `عدد محاولات إعادة التشغيل: ${retryLabel}`,
      `تفاصيل الطلب: ${jobDetailUrl}`,
      '',
      footer,
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;color:#111;line-height:1.6">
        <h2>Job Failed — Funds Refunded</h2>
        <p>Your job <strong>#${escapeHtml(jobId)}</strong> failed and your balance was refunded.</p>
        <ul>
          <li><strong>Last error:</strong> ${escapeHtml(safeError)}</li>
          <li><strong>Refunded amount:</strong> ${escapeHtml(refundLabel)} SAR</li>
          <li><strong>Retry attempts:</strong> ${escapeHtml(retryLabel)}</li>
        </ul>
        <p><a href="${jobDetailUrl}">View job details</a></p>
        <hr />
        <h2>فشل الطلب وأُعيد المبلغ إلى رصيدك</h2>
        <p>فشل الطلب <strong>#${escapeHtml(jobId)}</strong> وأُعيد المبلغ إلى رصيدك في DCP.</p>
        <ul>
          <li><strong>آخر خطأ:</strong> ${escapeHtml(safeError)}</li>
          <li><strong>المبلغ المرتجع:</strong> ${escapeHtml(refundLabel)} ريال</li>
          <li><strong>عدد المحاولات:</strong> ${escapeHtml(retryLabel)}</li>
        </ul>
        <p><a href="${jobDetailUrl}">عرض تفاصيل الطلب</a></p>
        ${notificationFooterHtml()}
      </div>
    `,
  };
}

function buildWithdrawalApprovedTemplate({ amountSar }) {
  const amountLabel = formatSar(amountSar);
  return {
    subject: `DCP: Withdrawal of ${amountLabel} SAR approved | تمت الموافقة على السحب`,
    text: [
      `Your withdrawal request for ${amountLabel} SAR has been approved.`,
      'Expected processing time: 3-5 business days.',
      '',
      `تمت الموافقة على طلب السحب بمبلغ ${amountLabel} ريال.`,
      'المدة المتوقعة للتحويل: من 3 إلى 5 أيام عمل.',
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;color:#111;line-height:1.6">
        <h2>Withdrawal Approved</h2>
        <p>Your withdrawal of <strong>${escapeHtml(amountLabel)} SAR</strong> has been approved.</p>
        <p>Expected processing time: <strong>3-5 business days</strong>.</p>
        <hr />
        <h2>تمت الموافقة على السحب</h2>
        <p>تمت الموافقة على السحب بقيمة <strong>${escapeHtml(amountLabel)} ريال</strong>.</p>
        <p>المدة المتوقعة للتحويل: <strong>من 3 إلى 5 أيام عمل</strong>.</p>
      </div>
    `,
  };
}

function buildDataExportReadyTemplate({ accountType, requestedAt, deliveryMode }) {
  const safeAccountType = accountType === 'provider' ? 'provider' : 'renter';
  const requestedLabel = requestedAt || new Date().toISOString();
  const isDirect = deliveryMode === 'direct';
  const frontend = getFrontendUrl();
  const settingsUrl = `${frontend}/${safeAccountType}/settings`;
  const deliveryText = isDirect
    ? 'Your export was delivered directly in the API response.'
    : 'Your export is ready for download from your account settings.';
  const deliveryTextAr = isDirect
    ? 'تم تسليم التصدير مباشرة في استجابة واجهة API.'
    : 'تصدير بياناتك جاهز للتنزيل من صفحة الإعدادات.';

  return {
    subject: 'DCP data export request received | تم استلام طلب تصدير البيانات',
    text: [
      `We received your PDPL data export request (${safeAccountType}).`,
      `Requested at: ${requestedLabel}`,
      deliveryText,
      `Settings: ${settingsUrl}`,
      '',
      `تم استلام طلب تصدير البيانات وفق PDPL (${safeAccountType}).`,
      `وقت الطلب: ${requestedLabel}`,
      deliveryTextAr,
      `الإعدادات: ${settingsUrl}`,
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;color:#111;line-height:1.6">
        <h2>PDPL Data Export Request</h2>
        <p>We received your data export request for your <strong>${escapeHtml(safeAccountType)}</strong> account.</p>
        <ul>
          <li><strong>Requested at:</strong> ${escapeHtml(requestedLabel)}</li>
          <li><strong>Status:</strong> ${escapeHtml(deliveryText)}</li>
        </ul>
        <p><a href="${settingsUrl}">Open account settings</a></p>
        <hr />
        <h2>طلب تصدير البيانات (PDPL)</h2>
        <p>تم استلام طلب تصدير البيانات لحساب <strong>${escapeHtml(safeAccountType)}</strong>.</p>
        <ul>
          <li><strong>وقت الطلب:</strong> ${escapeHtml(requestedLabel)}</li>
          <li><strong>الحالة:</strong> ${escapeHtml(deliveryTextAr)}</li>
        </ul>
        <p><a href="${settingsUrl}">فتح إعدادات الحساب</a></p>
      </div>
    `,
  };
}

async function sendWelcomeEmail(to, name, apiKey, role) {
  if (!to || !name || !apiKey) {
    return { ok: false, reason: 'invalid_arguments' };
  }

  const template = buildWelcomeTemplate({
    name,
    apiKey,
    role: role === 'provider' ? 'provider' : 'renter',
  });

  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

async function sendWithdrawalApprovedEmail(to, amountSar) {
  if (!to) {
    return { ok: false, reason: 'invalid_arguments' };
  }

  const template = buildWithdrawalApprovedTemplate({ amountSar });
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

async function sendJobQueued(to, data = {}) {
  if (!to || !data.job_id) {
    return { ok: false, reason: 'invalid_arguments' };
  }
  const template = buildJobQueuedTemplate({
    jobId: data.job_id,
    jobType: data.job_type,
    imageType: data.image_type,
    quotedCostHalala: data.quoted_cost_halala,
    queuePosition: data.queue_position,
    estimatedDurationMinutes: data.estimated_duration_minutes,
  });
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

async function sendJobStarted(to, data = {}) {
  if (!to || !data.job_id) {
    return { ok: false, reason: 'invalid_arguments' };
  }
  const template = buildJobStartedTemplate({
    jobId: data.job_id,
    jobType: data.job_type,
    imageType: data.image_type,
    estimatedDurationMinutes: data.estimated_duration_minutes,
  });
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

async function sendJobCompleted(to, data = {}) {
  if (!to || !data.job_id) {
    return { ok: false, reason: 'invalid_arguments' };
  }
  const template = buildJobCompletedTemplate({
    jobId: data.job_id,
    actualCostHalala: data.actual_cost_halala,
    gpuSecondsUsed: data.gpu_seconds_used,
    jobType: data.job_type,
    imageType: data.image_type,
  });
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

async function sendJobFailed(to, data = {}) {
  if (!to || !data.job_id) {
    return { ok: false, reason: 'invalid_arguments' };
  }
  const template = buildJobFailedTemplate({
    jobId: data.job_id,
    lastError: data.last_error,
    refundedAmountHalala: data.refunded_amount_halala,
    retryAttempts: data.retry_attempts,
  });
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

async function sendDataExportReady(to, data = {}) {
  if (!to) {
    return { ok: false, reason: 'invalid_arguments' };
  }
  const template = buildDataExportReadyTemplate({
    accountType: data.accountType,
    requestedAt: data.requestedAt,
    deliveryMode: data.deliveryMode,
  });
  return sendEmail({
    to,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

// Backward compatibility for existing callers
async function sendJobCompleteEmail(to, jobId, costSar, model, details = {}) {
  return sendJobCompleted(to, {
    job_id: jobId,
    actual_cost_halala: Math.round(toSafeNumber(costSar, 0) * 100),
    gpu_seconds_used: details.gpuSecondsUsed,
    job_type: model || details.jobType,
    image_type: details.imageType,
  });
}

module.exports = {
  sendWelcomeEmail,
  sendJobQueued,
  sendJobStarted,
  sendJobCompleted,
  sendJobFailed,
  sendJobCompleteEmail,
  sendWithdrawalApprovedEmail,
  sendDataExportReady,
};

module.exports.__private = {
  buildWelcomeTemplate,
  buildJobQueuedTemplate,
  buildJobStartedTemplate,
  buildJobCompletedTemplate,
  buildJobFailedTemplate,
  buildWithdrawalApprovedTemplate,
};
