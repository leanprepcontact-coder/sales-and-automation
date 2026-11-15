// Message copy for every flow step. English only, per LeanPrep's public-copy rule.
// Proof claims are Mains results, so they are always labelled as Mains.
// WhatsApp messages must use Meta-approved templates: see docs/whatsapp-templates.md.
import type { Channel } from "./flows.js";

export interface Vars {
  name: string;
  plansUrl: string;
  freeUrl: string;
  checkoutUrl: string;
  courseUrl: string;
  referralCode: string | null;
  referralUrl: string | null;
  telegramConnectUrl: string | null;
  unsubscribeUrl: string;
  deadlineLine: string; // "" when no deadline is set
  testName: string | null;
  score: string | null;
}

export interface Rendered {
  email?: { subject: string; text: string; html: string };
  telegram?: { text: string };
  whatsapp?: { template: string; params: string[] };
}

const PROOF =
  "98 students who used LeanPrep cleared UPSC Mains 2026, including 11 of the 27 LEAD Batch students who appeared.";

function emailBody(lines: string[], v: Vars): { text: string; html: string } {
  const body = lines.filter((l) => l !== "");
  const footer = `You're getting this because you signed up at leanprep.in. Unsubscribe: ${v.unsubscribeUrl}`;
  const text = [...body, "", "Team LeanPrep", "", footer].join("\n");
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const linkify = (s: string) => esc(s).replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>');
  const html =
    `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2933;max-width:560px">` +
    body.map((l) => `<p>${linkify(l)}</p>`).join("") +
    `<p>Team LeanPrep</p><p style="font-size:12px;color:#6b7280">${linkify(footer)}</p></div>`;
  return { text, html };
}

type Builder = (v: Vars) => Rendered;

const T: Record<string, Builder> = {
  a_welcome: (v) => ({
    email: {
      subject: "Your free Prelims 2027 diagnostic is ready",
      ...emailBody([
        `Hi ${v.name},`,
        "Welcome to LeanPrep. Start with one thing: the free Prelims Demo 25. It's 25 questions in 30 minutes, with negative marking like the real paper, and it shows you where you stand today.",
        `Start here: ${v.freeUrl}`,
        v.telegramConnectUrl ? `Get your scores and test reminders on Telegram: ${v.telegramConnectUrl}` : "",
      ], v),
    },
    whatsapp: { template: "lp_a_welcome", params: [v.name, v.freeUrl] },
  }),

  a_nudge_test: (v) => {
    const msg = `Hi ${v.name}, your free Prelims diagnostic is waiting: 25 questions, 30 minutes, and you'll see exactly where you stand. ${v.freeUrl}`;
    return {
      telegram: { text: msg },
      email: {
        subject: "25 questions. 30 minutes. Where do you stand?",
        ...emailBody([`Hi ${v.name},`, "You signed up but haven't taken your free diagnostic yet. It takes 30 minutes and tells you which subjects need work first.", `Take it now: ${v.freeUrl}`], v),
      },
    };
  },

  a_proof: (v) => ({
    email: {
      subject: "What 98 Mains clearers had in common",
      ...emailBody([
        `Hi ${v.name},`,
        PROOF,
        "LEAD-Prelims 2027 brings the same approach to Prelims. It's designed and reviewed by Rahul Shekhar (AIR 75, CSE 2025): Smaran notes, Concept Tests, Sectionals, 15 Mocks and 5 Open Tests with an All-India rank. Every wrong answer goes to your Error Log so you can retest it.",
        "The course starts on 1 December 2026.",
        `See the plans: ${v.plansUrl}`,
        v.deadlineLine,
      ], v),
    },
  }),

  a_offer: (v) => ({
    whatsapp: { template: "lp_a_offer", params: [v.name, v.plansUrl] },
    email: {
      subject: "LEAD-Prelims 2027: plans from ₹1,749 + GST",
      ...emailBody([
        `Hi ${v.name},`,
        "LEAD-Prelims 2027 is self-paced, with tests and notes released on a schedule, and access runs until 31 May 2027. Plans start at ₹1,749 + GST, which is 50% off the full price.",
        `Pick your plan: ${v.plansUrl}`,
        v.deadlineLine,
      ], v),
    },
  }),

  b_score: (v) => {
    const scoreLine = v.score ? `You scored ${v.score}${v.testName ? ` on ${v.testName}` : ""}.` : "Your test result is ready.";
    return {
      email: {
        subject: "Your test result and what to do next",
        ...emailBody([
          `Hi ${v.name},`,
          scoreLine,
          "One test shows you where you stand. The full course has Concept Tests, Sectionals and 15 Mocks, with every mistake saved to your Error Log to retest.",
          `See LEAD-Prelims 2027: ${v.plansUrl}`,
        ], v),
      },
      telegram: { text: `${scoreLine} The full LEAD-Prelims 2027 course keeps every mistake in your Error Log so you can retest it. ${v.plansUrl}` },
    };
  },

  c_saved: (v) => ({
    whatsapp: { template: "lp_c_saved", params: [v.name, v.checkoutUrl] },
    email: {
      subject: "Your LEAD-Prelims plan is saved",
      ...emailBody([`Hi ${v.name},`, "You started checkout but didn't finish. Your plan is still saved. You can complete payment here:", v.checkoutUrl], v),
    },
  }),

  c_payment_help: (v) => ({
    email: {
      subject: "Trouble paying? Here's help",
      ...emailBody([
        `Hi ${v.name},`,
        "If payment didn't go through, here are the usual fixes:",
        "1. UPI: approve the request in your UPI app within 5 minutes.",
        "2. Card: check that online payments are enabled on it.",
        "3. GST: 18% is added at checkout, and you get a GST invoice.",
        `Finish here: ${v.checkoutUrl}`,
        "Still stuck? Reply to this email and we'll help.",
      ], v),
    },
  }),

  c_last: (v) => ({
    whatsapp: { template: "lp_c_last", params: [v.name, v.checkoutUrl] },
    email: {
      subject: "Last reminder: your LEAD-Prelims plan",
      ...emailBody([`Hi ${v.name},`, "This is our last reminder about your saved plan.", `Complete it here: ${v.checkoutUrl}`, v.deadlineLine], v),
    },
  }),

  d_welcome: (v) => ({
    email: {
      subject: "Welcome to LEAD-Prelims 2027",
      ...emailBody([
        `Hi ${v.name},`,
        "You're in. The course starts on 1 December 2026 with Concept Tests and Sectionals Round 1, which stay open until 10 January.",
        "Your first step: take one Concept Test this week, so your Error Log starts building from day one.",
        v.telegramConnectUrl ? `Get test reminders on Telegram: ${v.telegramConnectUrl}` : "",
        v.referralUrl ? `Your referral code is ${v.referralCode}. Share this link with a friend: ${v.referralUrl}` : "",
      ], v),
    },
    whatsapp: { template: "lp_d_welcome", params: [v.name, v.referralCode ?? "-"] },
  }),

  d_adaptive_upsell: (v) => ({
    email: {
      subject: "Tests built from your own mistakes",
      ...emailBody([
        `Hi ${v.name},`,
        "Adaptive tests are five tests built from the questions you got wrong or skipped. They open after the Mocks, so they target exactly what you still miss.",
        "You can add them to your plan for ₹250 (GS) or ₹500 (GS + CSAT), plus GST.",
        `Add Adaptive: ${v.plansUrl}`,
      ], v),
    },
  }),

  d_referral: (v) => ({
    whatsapp: { template: "lp_d_referral", params: [v.name, v.referralUrl ?? v.plansUrl] },
    email: {
      subject: "Prepare with a friend",
      ...emailBody([
        `Hi ${v.name},`,
        "Preparing alongside someone keeps you both on schedule.",
        v.referralUrl ? `Share your link: ${v.referralUrl}` : `Share LEAD-Prelims: ${v.plansUrl}`,
      ], v),
    },
  }),

  e_nudge: (v) => {
    const msg = `Hi ${v.name}, you haven't taken a LEAD-Prelims test this week. One Concept Test takes 30 minutes and keeps your Error Log growing.`;
    return {
      telegram: { text: msg },
      whatsapp: { template: "lp_e_nudge", params: [v.name] },
      email: { subject: "Your next LEAD-Prelims test", ...emailBody([msg, `Open your course: ${v.courseUrl}`], v) },
    };
  },
};

export function render(template: string, channel: Channel, v: Vars): Rendered[Channel] {
  const b = T[template];
  if (!b) throw new Error(`Unknown template: ${template}`);
  const out = b(v)[channel];
  if (!out) throw new Error(`Template ${template} has no ${channel} version`);
  return out;
}

export function hasChannel(template: string, channel: Channel): boolean {
  const b = T[template];
  if (!b) return false;
  const dummy = b({
    name: "x", plansUrl: "x", freeUrl: "x", checkoutUrl: "x", courseUrl: "x", referralCode: "x", referralUrl: "x",
    telegramConnectUrl: "x", unsubscribeUrl: "x", deadlineLine: "", testName: null, score: null,
  });
  return Boolean(dummy[channel]);
}

export const TEMPLATE_KEYS = Object.keys(T);
