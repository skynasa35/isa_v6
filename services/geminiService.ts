import { GoogleGenAI } from "@google/genai";
import { SummaryData, VibrationRecord } from '../types';

/**
 * نجلب المفتاح من أكثر من مصدر (حسب إعدادك):
 * - process.env.API_KEY أو process.env.GEMINI_API_KEY (يتم حقنها وقت الـ build عبر vite.config.ts)
 * - import.meta.env.VITE_GEMINI_API_KEY (أسلوب Vite القياسي)
 * - window.__GEMINI_API_KEY (احتياطي اختياري إن حبيت تحقنه يدوياً)
 */
function resolveGeminiKey(): string {
  // قد يتم استبدال process.env.* بسلاسل نصية أثناء البناء (Vite define)
  // لذلك الوصول له آمن في الـ runtime.
  const proc: any = (typeof process !== 'undefined') ? process : {};
  const meta: any = (typeof import !== 'undefined' && typeof import.meta !== 'undefined') ? import.meta : {};

  return (
    proc.env?.API_KEY ||
    proc.env?.GEMINI_API_KEY ||
    meta.env?.VITE_GEMINI_API_KEY ||
    meta.env?.VITE_API_KEY ||
    (typeof window !== 'undefined' ? (window as any).__GEMINI_API_KEY : '') ||
    ''
  );
}

// اختياري: اسم الموديل من البيئة، وإلا الافتراضي
function resolveModel(defaultModel = 'gemini-2.5-flash') {
  const meta: any = (typeof import !== 'undefined' && typeof import.meta !== 'undefined') ? import.meta : {};
  const fromEnv = meta.env?.VITE_GEMINI_MODEL;
  return (typeof fromEnv === 'string' && fromEnv.length > 0) ? fromEnv : defaultModel;
}

let ai: GoogleGenAI | null = null;

const getAiClient = async (): Promise<GoogleGenAI> => {
    if (ai) return ai;

    const apiKey = resolveGeminiKey();
    if (!apiKey) {
        console.error("Gemini API key is not configured or available in environment variables.");
        throw new Error("The application is not configured correctly to use the AI service. Please set VITE_GEMINI_API_KEY (or process.env.API_KEY) before building.");
    }

    ai = new GoogleGenAI({ apiKey });
    return ai;
};

export async function generateNarrativeSummary(summary: SummaryData, language: 'en' | 'fr'): Promise<string> {
    const model = resolveModel('gemini-2.5-flash');
    const langInstruction = language === 'fr'
        ? "Le rapport doit être rédigé en français."
        : "The report must be written in English.";

    const systemInstruction = `You are an expert operations analyst for a seismic survey crew. Your task is to interpret a performance summary JSON and write a concise, insightful narrative report.
${langInstruction}

The report should:
1. Start with a high-level overview of the day's work.
2. Highlight the top-performing vibrators, mentioning their contribution.
3. Identify underperforming or problematic vibrators, pointing out high duplicate rates or other issues.
4. Conclude with a key takeaway or a practical recommendation for the supervisor.

Do not just list the numbers from the JSON. Instead, interpret their meaning and provide actionable insights. The tone should be professional and clear.`;

    const contents = `Analyze the following performance data and generate the report:\n\n${JSON.stringify(summary, null, 2)}`;

    try {
        const client = await getAiClient();
        const response: any = await client.models.generateContent({
            model,
            contents,
            config: {
                systemInstruction,
                temperature: 0.5,
            }
        });

        // بعض نسخ المكتبات ترجع response.text() كدالة
        // وأخرى قد تعطي خاصية text مباشرة – نغطي الحالتين:
        const txt = typeof response?.text === 'function'
          ? await response.text()
          : (response?.text ?? '');

        return String(txt);
    } catch (error) {
        console.error("Gemini API call failed for narrative summary:", error);
        throw error;
    }
}

export async function diagnoseVibratorIssues(records: VibrationRecord[], vibratorId: string, language: 'en' | 'fr'): Promise<string> {
    if (records.length === 0) {
        return language === 'fr' ? 'Aucune donnée disponible pour ce vibreur.' : 'No data available for this vibrator.';
    }

    const model = resolveModel('gemini-2.5-flash');

    const warnings = records.filter(r => r.hasWarning).length;
    const overloads = records.filter(r => r.hasOverload).length;
    const totalRecords = records.length;

    const avgDistortion = totalRecords > 0 ? records.reduce((sum, r) => sum + (r.averageDistortion || 0), 0) / totalRecords : 0;

    if (warnings === 0 && overloads === 0 && avgDistortion < 5) {
        return ""; // لا توجد مشاكل
    }

    const avgPhase = totalRecords > 0 ? records.reduce((sum, r) => sum + (r.averagePhase || 0), 0) / totalRecords : 0;
    const avgForce = totalRecords > 0 ? records.reduce((sum, r) => sum + (r.averageForce || 0), 0) / totalRecords : 0;

    const langInstruction = language === 'fr'
        ? "L'analyse et la recommandation doivent être rédigées en français."
        : "The analysis and recommendation must be written in English.";

    const systemInstruction = `You are a senior field maintenance engineer specializing in seismic vibrators. Analyze the provided data summary for a specific vibrator and give a concise root cause analysis and a recommended action plan.
${langInstruction}

Analyze these key indicators:
- A high number of warnings (mass, plate flags).
- A high number of overloads (force, pressure, etc.).
- Consistently high distortion or phase values.

Based on the analysis, provide:
1.  **Potential Problem:** A single, most likely root cause.
2.  **Recommendation:** A single, clear, actionable step for the field crew.

The response should be very short and clear. Format the output with "Potential Problem:" and "Recommendation:" labels.`;

    const contents = `
Data for Vibrator: ${vibratorId}
- Total Records: ${totalRecords}
- Records with Warnings: ${warnings} (${((warnings / totalRecords) * 100).toFixed(1)}%)
- Records with Overloads: ${overloads} (${((overloads / totalRecords) * 100).toFixed(1)}%)
- Average Distortion: ${avgDistortion.toFixed(1)}%
- Average Phase: ${avgPhase.toFixed(1)}°
- Average Force: ${avgForce.toFixed(1)}%
`;

    try {
        const client = await getAiClient();
        const response: any = await client.models.generateContent({
            model,
            contents,
            config: {
                systemInstruction,
                temperature: 0.6,
            }
        });

        const txt = typeof response?.text === 'function'
          ? await response.text()
          : (response?.text ?? '');

        return String(txt);
    } catch (error) {
        console.error(`Gemini API call failed for vibrator ${vibratorId} diagnosis:`, error);
        throw error;
    }
}
