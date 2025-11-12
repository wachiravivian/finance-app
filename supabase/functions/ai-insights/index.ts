// supabase/functions/ai-insights/index.ts
// Deno (Supabase Edge Functions)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js"; // via deno.json import map

type Summary = {
  month: string;
  income: number;
  expense: number;
  net: number;
  byCategory: Record<string, { spent: number; count: number }>;
  budgetCompare: Array<{ category: string; spent: number; budget?: number; overBy?: number; usedPct?: number }>;
};
type Input = { summary: Summary };

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function promptFromSummary(s: Summary) {
  const topCats = Object.entries(s.byCategory)
    .sort((a, b) => b[1].spent - a[1].spent)
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${v.spent}`)
    .join(", ");

  const overs = s.budgetCompare
    .filter((x) => (x.overBy || 0) > 0)
    .sort((a, b) => (b.overBy! - a.overBy!))
    .map((x) => `${x.category} over by ${x.overBy}`);

  return `
You are a friendly Kenyan personal-finance coach. Currency is Ksh.

Month: ${s.month}
Income: ${s.income}
Expense: ${s.expense}
Net: ${s.net}

Top spend categories: ${topCats || "none"}
Budget overages: ${overs.join("; ") || "none"}

Give 4–6 concise bullet insights. Be concrete and practical.
Avoid shaming; suggest small actions (e.g., set a micro-goal, reduce one expense by X%).
Return JSON: { "insights": string[] } only.
`.trim();
}

Deno.serve(async (req: Request) => {
  try {
    const input = (await req.json()) as Input;
    if (!input?.summary) {
      return new Response(JSON.stringify({ error: "Missing summary" }), { status: 400 });
    }

    if (!OPENAI_API_KEY) {
      // No AI key -> return empty; client will fallback to local insights
      return new Response(JSON.stringify({ insights: [] }), { headers: { "Content-Type": "application/json" } });
    }

    const body = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful financial coach." },
        { role: "user", content: promptFromSummary(input.summary) },
      ],
      temperature: 0.3,
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content || "";
    let parsed: { insights: string[] } = { insights: [] };
    try {
      parsed = JSON.parse(text);
      if (!Array.isArray(parsed.insights)) parsed.insights = [text];
    } catch {
      parsed = { insights: [text] };
    }

    // (Optional) Save to DB using service role
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && parsed.insights.length) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const jwt = authHeader.replace("Bearer ", "");
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: userData } = await admin.auth.getUser(jwt);
      const userId = userData?.user?.id;
      if (userId) {
        await admin.from("insights").insert({
          user_id: userId,
          cluster: 0,
          summary: parsed.insights.join("\n"),
        });
      }
    }

    return new Response(JSON.stringify(parsed), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
