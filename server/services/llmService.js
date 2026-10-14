import { isMustasharEnabled, generateMustasharResponse } from './mustasharService.js';

/**
 * OpenAI-compatible chat client.
 * Works with Groq, OpenRouter, LLM7, Gemini (OpenAI compat), NVIDIA NIM, etc.
 * Directory: https://github.com/open-free-llm-api/awesome-freellm-apis
 */

export const LEGAL_TEMPLATES = {
  arbitration: `
شرط التحكيم وفض النزاعات:
"اتفق الطرفان على أن أي نزاع أو خلاف ينشأ عن تفسير أو تنفيذ هذا العقد أو ما يرتبط به، تتم تسويته أولاً بالطرق الودية خلال ثلاثين (30) يوماً من إخطار أحد الطرفين للآخر. وفي حال تعذر التسوية الودية، يُحال النزاع إلى التحكيم وفقاً لأحكام قانون المرافعات المدنية والتجارية، وتتكون هيئة التحكيم من ثلاثة محكمين، يختار كل طرف محكماً ويختار المحكمان المحكم المرجح رئيساً للهيئة، ويكون قرار الهيئة نهائياً وملزماً للطرفين وواجب النفاذ فور صدوره."
  `,
  confidentiality: `
بند السرية وحماية البيانات:
"يلتزم الطرفان بالحفاظ على سرية كافة البيانات والمعلومات والمستندات الفنية أو التجارية أو القانونية المتبادلة بموجب هذا الاتفاق، ويتعهدان بعدم إفشائها لأي طرف ثالث دون موافقة كتابية مسبقة، ويسري هذا الالتزام طوال سريان هذا العقد ويستمر لمدة خمس (5) سنوات بعد انتهائه أو فسخه لأي سبب كان."
  `,
  penalties: `
بند الشرط الجزائي والتعويض الاتفاقي:
"في حال أخل أي من الطرفين بتنفيذ التزاماته الجوهرية في المواعيد المحددة، يلتزم الطرف المخل بدفع تعويض اتفاقي غير خاضع للرقابة القضائية بنسبة (0.5%) عن كل يوم تأخير، على ألا يتجاوز إجمالي التعويض (15%) من القيمة الإجمالية للعقد، مع احتفاظ الطرف المتضرر بحقه في طلب الفسخ والتعويض عن الأضرار اللاحقة إن كان لها مقتضى."
  `,
  force_majeure: `
بند القوة القاهرة والظروف الطارئة:
"لا يُعتبر أي من الطرفين مسؤولاً عن أي تأخير أو إخفاق في تنفيذ التزاماته إذا كان ذلك ناتجاً عن قوة قاهرة أو حادث فجائي لا يمكن توقعه أو دفعه (مثل الكوارث الطبيعية، الحروب، القرارات السيادية المفاجئة). ويلتزم الطرف المتأثر بإخطار الطرف الآخر خطياً خلال مدة لا تتجاوز خمسة (5) أيام من تاريخ وقوع القوة القاهرة، مع بذل أقصى مساعيه للحد من آثارها."
  `,
  jurisdiction: `
بند القانون الواجب التطبيق والاختصاص القضائي:
"يخضع هذا العقد ويفسر وفقاً للقوانين والتشريعات النافذة في الدولة الليبية. وتختص المحاكم المدنية والتجارية بمدينة [طرابلس / بنغازي] بنظر أي نزاع أو مطالبة تنشأ عن هذا العقد أو تتصل به، ما لم يتفق الطرفان كتابة على اللجوء للتحكيم."
  `
};

export function isLlmConfigured() {
  return Boolean(process.env.LLM_API_KEY);
}

export function generateLocalLegalResponse(mode, prompt, caseData) {
  const p = (prompt || '').toLowerCase();

  if (mode === 'draft_clause') {
    if (p.includes('تحكيم') || p.includes('نزاع')) {
      return {
        title: 'صياغة شرط التحكيم وفض النزاعات',
        content: LEGAL_TEMPLATES.arbitration.trim(),
        advice: 'يُراعى تحديد مقر وهيئة التحكيم ولغة التحكيم بدقة قبل التوقيع.'
      };
    }
    if (p.includes('سرية') || p.includes('إفشاء') || p.includes('معلومات')) {
      return {
        title: 'صياغة بند السرية وعدم الإفشاء',
        content: LEGAL_TEMPLATES.confidentiality.trim(),
        advice: 'يُنصح بتحديد المستثنيات من السرية كالبيانات المتاحة للعموم أو المطلوبة بحكم قضائي.'
      };
    }
    if (p.includes('جزائي') || p.includes('غرامة') || p.includes('تأخير')) {
      return {
        title: 'صياغة الشرط الجزائي وغرامة التأخير',
        content: LEGAL_TEMPLATES.penalties.trim(),
        advice: 'يجب التحقق من تناسب الشرط الجزائي مع الضرر المتوقع حتى لا يخضع لتقدير وتخفيض القاضي.'
      };
    }
    if (p.includes('قوة قاهرة') || p.includes('ظروف طارئة')) {
      return {
        title: 'صياغة بند القوة القاهرة والظروف الاستثنائية',
        content: LEGAL_TEMPLATES.force_majeure.trim(),
        advice: 'يُنصح بإضافة التزام بتقديم تقرير دوري عن زوال ظرف القوة القاهرة.'
      };
    }
    return {
      title: 'صياغة بند القانون الواجب التطبيق والاختصاص',
      content: LEGAL_TEMPLATES.jurisdiction.trim(),
      advice: 'حدد المحكمة المختصة محلياً ونوعياً وقيمة النزاع.'
    };
  }

  if (mode === 'summarize_case' && caseData) {
    return {
      title: `الملخص القانوني للقضية رقم ${caseData.case_number}: ${caseData.title}`,
      content: `
أولاً: ملخص وقائع النزاع:
تتعلق الدعوى بموضوع "${caseData.title}" المقيدة برقم (${caseData.case_number})، حيث يمثل المكتب الطرف (${caseData.client_name}) ضد الخصم (${caseData.opponent_name || 'الطرف الآخر'}).

ثانياً: الأساس القانوني والمطالبات:
- نوع القضية: ${caseData.case_type || 'مدني / تجاري'}
- الحالة الراهنة: ${caseData.status === 'active' ? 'قيد النظر والمرافعة' : caseData.status}
- المحكمة المختصة: المحكمة الابتدائية / الدائرة المختصة

ثالثاً: الخطة الإجرائية والتوصيات:
1. استكمال إيداع حوافظ المستندات المؤيدة للدفوع الجوهرية.
2. طلب ندب خبير حسابي أو هندسي في حال تطلب النزاع تقديراً فنياً.
3. تجهيز مذكرة الدفوع القانونية للرد على مذكرات الخصم ووكيله (${caseData.opponent_lawyer || 'محامي الخصم'}).
      `.trim(),
      advice: 'يوصى بمراجعة المواعيد الإجرائية والطعون لضمان عدم فوات المواعيد القانونية.'
    };
  }

  return {
    title: 'الرأي القانوني والتوجيه الإجرائي',
    content: `
بناءً على المعطيات الواردة في استشارتكم بشأن: "${prompt}"

1. التأصيل القانوني العام:
وفقاً للقواعد العامة في القانون المدني والتجاري وقانون المرافعات، فإن إثبات الالتزامات يقع على عاتق المدعي عملاً بقاعدة (البينة على من ادعى)، وتعتبر المحررات المكتوبة حجة بين أطرافها ما لم يثبت تزويرها أو بطلانها.

2. الخطوات العملية المقترحة:
أ- توجيه إنذار رسمي على يد محضر بإعذار الطرف الآخر وتحديد أجل محدد لتنفيذ الالتزام.
ب- تحريز كافة المراسلات والمستندات وسندات القبض المتعلقة بالدعوى.
ج- إعداد صحيفة الدعوى متضمنة الأسانيد الواقعية والنصوص القانونية المؤيدة، والمطالبة بالتعويض عن الأضرار المادية والمعنوية.
د- طلب الحجز التحفظي في حال وجود خشية من تهريب أموال المدين أو تبديد الضمان العام.
    `.trim(),
    advice: 'يُفضل مراجعة ملف القضية والمستندات الأصلية للتحقق من خلوها من الثغرات الشكلية.'
  };
}

function modeInstructions(mode) {
  if (mode === 'draft_clause') {
    return 'صغ بنداً عقدياً عربياً فصيحاً جاهزاً للإدراج في العقد، مع عنوان واضح.';
  }
  if (mode === 'summarize_case') {
    return 'لخّص القضية وقدّم خطة دفاع إجرائية عملية، دون اختراع وقائع غير واردة.';
  }
  return 'قدّم رأياً قانونياً توجيهياً عاماً مع خطوات عملية. هذا ليس بديلاً عن رأي المحامي الموقع.';
}

function buildUserPrompt(mode, prompt, caseData) {
  const parts = [modeInstructions(mode)];
  if (prompt) {
    parts.push(`طلب المستخدم:\n${prompt}`);
  }
  if (caseData) {
    parts.push(`بيانات القضية المتاحة:
- الرقم: ${caseData.case_number || ''}
- العنوان: ${caseData.title || ''}
- الموكل: ${caseData.client_name || ''}
- الخصم: ${caseData.opponent_name || ''}
- محامي الخصم: ${caseData.opponent_lawyer || ''}
- النوع: ${caseData.case_type || ''}
- الحالة: ${caseData.status || ''}`);
  }
  parts.push('أرجع JSON فقط بالشكل: {"title":"...","content":"...","advice":"..."}');
  return parts.join('\n\n');
}

function parseModelJson(text) {
  if (!text) return null;
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1].trim() : trimmed;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.content || parsed.title)) {
      return {
        title: parsed.title || 'المساعد القانوني الذكي',
        content: parsed.content || raw,
        advice: parsed.advice || ''
      };
    }
  } catch {
    // fall through
  }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1));
      if (parsed?.content || parsed?.title) {
        return {
          title: parsed.title || 'المساعد القانوني الذكي',
          content: parsed.content || raw,
          advice: parsed.advice || ''
        };
      }
    } catch {
      // ignore
    }
  }
  return {
    title: 'المساعد القانوني الذكي',
    content: trimmed,
    advice: ''
  };
}

export async function generateLlmLegalResponse(mode, prompt, caseData) {
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = (process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');
  const model = process.env.LLM_MODEL || 'llama-3.3-70b-versatile';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content:
              'أنت مساعد قانوني عربي لمكتب محاماة. أجب بالعربية الفصحى. لا تختلق نصوص قوانين أو أرقام مواد غير مؤكدة. وضّح أن الناتج مسودة للمراجعة المهنية.'
          },
          {
            role: 'user',
            content: buildUserPrompt(mode, prompt, caseData)
          }
        ]
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`LLM HTTP ${res.status}: ${detail.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    const parsed = parseModelJson(text);
    if (!parsed) {
      throw new Error('Empty LLM response');
    }
    return { ...parsed, source: 'llm', model };
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateLegalAssist(mode, prompt, caseData, options = {}) {
  if (isMustasharEnabled()) return generateMustasharResponse(mode, prompt, caseData, options);
  if (isLlmConfigured()) {
    try {
      return await generateLlmLegalResponse(mode, prompt, caseData);
    } catch (err) {
      console.warn('[LLM] Falling back to local templates:', err.message);
    }
  }

  return {
    ...generateLocalLegalResponse(mode, prompt, caseData),
    source: 'local'
  };
}
