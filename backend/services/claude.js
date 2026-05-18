'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL = 'gemini-2.5-flash-lite';

const EDEXCEL_THEMES = {
  'home-abroad': 'Home & Abroad',
  'education-employment': 'Education and Employment',
  'personal-life': 'Personal Life and Relationships',
  'world-around-us': 'The World Around Us',
  'social-activities': 'Social Activities',
  'fitness-health': 'Fitness & Health',
};

async function evaluateResponse({ question, studentResponse, modelAnswer, priorAttempts = [] }) {
  const hasPrior = priorAttempts.length > 0;
  const capped = priorAttempts.slice(-3);

  const systemPrompt = `You are a GCSE French speaking examiner using the Edexcel mark scheme.
Assess the student's response using two criteria, each scored out of 5:
- Communication (0–5): clarity, relevance, comprehensibility
- Range & Accuracy (0–5): vocabulary range, grammatical accuracy, tense variety

overallScore = communicationScore + rangeAccuracyScore (total out of 10).

Return ONLY a JSON object with these exact fields:
{
  "overallScore": <int 0-10>,
  "communicationScore": <int 0-5>,
  "rangeAccuracyScore": <int 0-5>,
  "rawResponse": "<echo student input verbatim>",
  "correctedAnswer": "<improved French version of student answer>",
  "modelAnswer": <"model answer string" or null>,
  "comments": "<English feedback: what went well, what to improve, specific grammar/vocab notes>"${hasPrior ? ',\n  "progressComparison": "<English paragraph comparing this attempt to the most recent prior attempt>"' : ''}
}
All fields except correctedAnswer and modelAnswer must be in English.${!modelAnswer ? '\nNo model answer was provided — evaluate contextually against Edexcel band descriptors.' : ''}`;

  const userContent = [
    `Question: ${question}`,
    `Student response: ${studentResponse}`,
    modelAnswer ? `Model answer: ${modelAnswer}` : null,
    hasPrior ? `Prior attempts (most recent last):\n${capped.map((a, i) => `${i + 1}. Score ${a.overallScore}/10 — "${a.response}"`).join('\n')}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent(userContent);
  const raw = result.response.text().trim();
  const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  const parsed = JSON.parse(jsonStr);

  if (modelAnswer) {
    parsed.modelAnswer = modelAnswer;
  } else {
    parsed.modelAnswer = null;
  }

  return parsed;
}

async function generateQuestions(themeSlug, count = 5) {
  const themeLabel = EDEXCEL_THEMES[themeSlug];

  const model = genAI.getGenerativeModel({ model: MODEL });

  const result = await model.generateContent(
    `Generate ${count} GCSE Edexcel general conversation questions in French for the theme "${themeLabel}".
Requirements:
- Age-appropriate for Year 10–11 UK students (14–16)
- Match the style of real Edexcel speaking exam questions
- Varied: some open, some comparative, some opinion-based
- Return ONLY a JSON array of strings, no other text

Example format: ["Question 1?", "Question 2?"]`
  );

  const raw = result.response.text().trim();
  const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(jsonStr);
}

module.exports = { evaluateResponse, generateQuestions, EDEXCEL_THEMES };
