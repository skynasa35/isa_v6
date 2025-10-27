


import { GoogleGenAI, Type } from "@google/genai";
import { SummaryData, VibrationRecord } from '../types';

let ai: GoogleGenAI | null = null;

const getAiClient = async (): Promise<GoogleGenAI> => {
    if (ai) {
        return ai;
    }
    
    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey === "undefined") {
        console.error("Gemini API key is not configured or available in environment variables.");
        throw new Error("The application is not configured correctly to use the AI service. Please contact support.");
    }
    
    ai = new GoogleGenAI({ apiKey });
    return ai;
};


export async function generateNarrativeSummary(summary: SummaryData, language: 'en' | 'fr'): Promise<string> {
    const model = 'gemini-2.5-flash';
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
        const response = await client.models.generateContent({
            model,
            contents,
            config: {
                systemInstruction,
                temperature: 0.5,
            }
        });
        return response.text;
    } catch (error) {
        console.error("Gemini API call failed for narrative summary:", error);
        throw error;
    }
}


export async function diagnoseVibratorIssues(records: VibrationRecord[], vibratorId: string, language: 'en' | 'fr'): Promise<string> {
    if (records.length === 0) {
        return language === 'fr' ? 'Aucune donnée disponible pour ce vibreur.' : 'No data available for this vibrator.';
    }

    const model = 'gemini-2.5-flash';
    
    const warnings = records.filter(r => r.hasWarning).length;
    const overloads = records.filter(r => r.hasOverload).length;
    const totalRecords = records.length;
    
    const avgDistortion = totalRecords > 0 ? records.reduce((sum, r) => sum + (r.averageDistortion || 0), 0) / totalRecords : 0;

    if (warnings === 0 && overloads === 0 && avgDistortion < 5) {
        return ""; // Return empty string to signify no issues
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
        const response = await client.models.generateContent({
            model,
            contents,
            config: {
                systemInstruction,
                temperature: 0.6,
            }
        });
        return response.text;
    } catch (error) {
        console.error(`Gemini API call failed for vibrator ${vibratorId} diagnosis:`, error);
        throw error;
    }
}
