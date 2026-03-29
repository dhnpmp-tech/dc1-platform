const emailService = require('../services/emailService');

describe('emailService Arabic transactional copy normalization', () => {
  const templates = emailService.__private;

  test('welcome template keeps clear bilingual subject and Arabic greeting', () => {
    const t = templates.buildWelcomeTemplate({
      name: 'Ali',
      apiKey: 'k_test_123',
      role: 'provider',
    });
    expect(t.subject).toContain('مرحباً بك في DCP');
    expect(t.text).toContain('مفتاح API الخاص بحساب مزود');
    expect(t.html).toContain('حسابك كـ <strong>مزود</strong> جاهز');
  });

  test('queued template uses consistent Arabic waiting-list wording', () => {
    const t = templates.buildJobQueuedTemplate({
      jobId: '42',
      jobType: 'inference',
      imageType: 'vllm',
      quotedCostHalala: 1234,
      queuePosition: 3,
      estimatedDurationMinutes: 9,
    });
    expect(t.subject).toContain('قائمة انتظار DCP');
    expect(t.text).toContain('تم إدراج الطلب #42 في قائمة انتظار DCP.');
    expect(t.html).toContain('تم إدراج الطلب في قائمة الانتظار');
  });

  test('started template keeps coherent Arabic execution phrasing', () => {
    const t = templates.buildJobStartedTemplate({
      jobId: '42',
      jobType: 'inference',
      imageType: 'vllm',
      estimatedDurationMinutes: 9,
    });
    expect(t.subject).toContain('بدأ تنفيذ طلبك');
    expect(t.text).toContain('بدأ تنفيذ الطلب #42 على مزود في DCP.');
    expect(t.html).toContain('قيد التنفيذ الآن على مزود DCP');
  });

  test('completed template avoids awkward تم اكتمال phrasing', () => {
    const t = templates.buildJobCompletedTemplate({
      jobId: '42',
      actualCostHalala: 800,
      gpuSecondsUsed: 120,
      jobType: 'inference',
      imageType: 'vllm',
    });
    expect(t.subject).toContain('اكتمل الطلب والنتائج جاهزة');
    expect(t.text).toContain('اكتمل الطلب #42 والنتائج جاهزة.');
    expect(t.html).toContain('اكتمل الطلب <strong>#42</strong> والنتائج جاهزة.');
    expect(t.text).not.toContain('تم اكتمال');
    expect(t.html).not.toContain('تم اكتمال');
  });

  test('failed template uses consistent refund wording', () => {
    const t = templates.buildJobFailedTemplate({
      jobId: '42',
      lastError: 'OOM',
      refundedAmountHalala: 1000,
      retryAttempts: 2,
    });
    expect(t.subject).toContain('فشل الطلب وأُعيد المبلغ إلى رصيدك');
    expect(t.text).toContain('فشل الطلب #42 وأُعيد المبلغ إلى رصيدك في DCP.');
    expect(t.html).toContain('فشل الطلب <strong>#42</strong> وأُعيد المبلغ إلى رصيدك في DCP.');
  });

  test('withdrawal approved template uses clear Arabic confirmation', () => {
    const t = templates.buildWithdrawalApprovedTemplate({ amountSar: 25 });
    expect(t.subject).toContain('تمت الموافقة على السحب');
    expect(t.text).toContain('تمت الموافقة على طلب السحب بمبلغ 25.00 ريال.');
    expect(t.html).toContain('تمت الموافقة على السحب بقيمة <strong>25.00 ريال</strong>.');
  });
});
