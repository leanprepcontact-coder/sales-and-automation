# WhatsApp templates to submit to Meta

Meta must approve every business-initiated WhatsApp message as a template before it can be sent.
Create these in WhatsApp Manager with **category: Marketing** (except where noted), **language: English (en)**,
using exactly these names. `{{1}}`, `{{2}}` are the parameters the code fills in.

| Name | Category | Body |
| --- | --- | --- |
| `lp_a_welcome` | Marketing | Hi {{1}}, welcome to LeanPrep. Start with the free Prelims Demo 25: 25 questions in 30 minutes, with negative marking like the real paper. See where you stand today: {{2}} |
| `lp_a_offer` | Marketing | Hi {{1}}, LEAD-Prelims 2027 starts on 1 December. Self-paced tests and notes, 15 Mocks and 5 Open Tests with an All-India rank. Plans from ₹1,749 + GST: {{2}} |
| `lp_c_saved` | Marketing | Hi {{1}}, you started checkout for LEAD-Prelims 2027 but didn't finish. Your plan is saved. Complete it here: {{2}} |
| `lp_c_last` | Marketing | Hi {{1}}, this is our last reminder about your saved LEAD-Prelims 2027 plan. Complete it here: {{2}} |
| `lp_d_welcome` | Utility | Hi {{1}}, you're enrolled in LEAD-Prelims 2027. The course starts on 1 December with Concept Tests and Sectionals Round 1. Your referral code is {{2}}. |
| `lp_d_referral` | Marketing | Hi {{1}}, preparing with a friend keeps you both on schedule. Share LEAD-Prelims 2027 with your link: {{2}} |
| `lp_e_nudge` | Utility | Hi {{1}}, you haven't taken a LEAD-Prelims test this week. One Concept Test takes 30 minutes and keeps your Error Log growing. |

Notes:

- If Meta rejects a wording, change it there and keep the same name and number of parameters.
- Marketing templates are charged per message by Meta. Check the current India rate before going live.
- Only contacts with `whatsapp_opt_in = true` ever get WhatsApp. Imported lists get no WhatsApp consent.
