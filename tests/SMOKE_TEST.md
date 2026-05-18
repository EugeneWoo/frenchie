# Frenchie Manual Smoke Test

Prerequisites: npm start, open http://localhost:3000, real API keys in .env

[ ] 1. Page loads — "Frenchie" wordmark visible, question card shows "Press New Question"
[ ] 2. New Question — question appears in French, TTS audio plays automatically
[ ] 3. Replay button — appears after TTS, replays without new API call
[ ] 4. Text mode — type a French response, Submit → feedback panel shows 7 sections with scores
[ ] 5. Score badges — circular, colour-coded (red/amber/green based on band)
[ ] 6. Speech mode — toggle to Speech, Record → speak French → Stop → transcript appears
[ ] 7. Speech submit — Submit with transcript → feedback panel shows correctly
[ ] 8. Repeat question — answer same question twice → "Progress vs Last Attempt" section appears
[ ] 9. History panel — click History → panel slides in from right (max 1/3 screen), shows entry
[ ] 10. Delta badge — repeat question shows +N or -N badge in history panel
[ ] 11. Excel upload — upload 2-column .xlsx → mode indicator changes → new question from file
[ ] 12. Excel no model answer — upload 1-column .xlsx → evaluates contextually (no model answer)
[ ] 13. Return to defaults — click "Return to default questions" → seeded bank restored
[ ] 14. AI Theme — click "Home & Abroad" → 5 questions generated → new question displayed
[ ] 15. Clear history — click Clear → confirm → history wiped, UI reset, mode indicator reset
[ ] 16. 48h TTL — set localStorage entry timestamp to 49h ago → reload → history cleared
[ ] 17. Responsive — resize to 375px width → layout stacks correctly, no overflow
[ ] 18. No API keys in browser — open DevTools Network → no keys in request headers or URLs
