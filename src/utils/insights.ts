// src/utils/insights.ts
import { formatCurrency } from "./format";

export type Tx = {
  id: string | number;
  title: string;
  category?: string;
  amount: number; // negative = expense, positive = income
  date?: string | Date;
};

export type Budget = {
  id: string;
  category: string;
  amount: number; // monthly budget Ksh
  period?: string; // 'monthly' etc
};

export type ComputedSummary = {
  month: string;
  income: number;
  expense: number;
  net: number;
  byCategory: Record<string, { spent: number; count: number }>;
  budgetCompare: Array<{ category: string; spent: number; budget?: number; overBy?: number; usedPct?: number }>;
};

export function computeSummary(transactions: Tx[], budgets: Budget[]): ComputedSummary {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Format like "September 2025" without date-fns
  const month = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(now);

  const inMonth = transactions.filter(t => {
    const dt = t.date ? new Date(t.date) : now;
    return dt >= monthStart && dt <= monthEnd;
  });

  let income = 0, expense = 0;
  const byCategory: ComputedSummary["byCategory"] = {};

  inMonth.forEach(t => {
    if (t.amount >= 0) income += t.amount;
    else expense += Math.abs(t.amount);

    const cat = t.category || "Uncategorized";
    const spent = t.amount < 0 ? Math.abs(t.amount) : 0;
    if (!byCategory[cat]) byCategory[cat] = { spent: 0, count: 0 };
    byCategory[cat].spent += spent;
    byCategory[cat].count += 1;
  });

  const budgetCompare = Object.keys(byCategory).map(cat => {
    const spent = byCategory[cat].spent;
    const budget = budgets.find(b => b.category === cat)?.amount;
    const usedPct = budget ? Math.min(100, Math.round((spent / budget) * 100)) : undefined;
    const overBy = budget && spent > budget ? spent - budget : undefined;
    return { category: cat, spent, budget, overBy, usedPct };
  });

  return {
    month,
    income,
    expense,
    net: income - expense,
    byCategory,
    budgetCompare,
  };
}

export function generateHeuristicInsights(c: ComputedSummary): string[] {
  const lines: string[] = [];
  lines.push(`This month (${c.month}) your net is ${formatCurrency(c.net)} (${formatCurrency(c.income)} in, ${formatCurrency(c.expense)} out).`);

  const overs = c.budgetCompare.filter(x => x.overBy && x.overBy > 0).sort((a,b)=> (b.overBy! - a.overBy!));
  if (overs.length) {
    const top = overs[0];
    lines.push(`You exceeded your ${top.category} budget by ${formatCurrency(top.overBy!)}. Consider trimming this category next week.`);
  }

  const highPct = c.budgetCompare
    .filter(x => x.usedPct !== undefined && x.usedPct >= 80 && !(x.overBy && x.overBy > 0))
    .sort((a,b)=> (b.usedPct! - a.usedPct!))
    .slice(0,2);
  if (highPct.length) {
    const cats = highPct.map(x => `${x.category} (${x.usedPct}%)`).join(", ");
    lines.push(`Getting close to your budget in: ${cats}. Keep an eye on these to avoid overages.`);
  }

  const bigCats = Object.entries(c.byCategory)
    .sort((a,b)=> b[1].spent - a[1].spent)
    .slice(0,2);
  if (bigCats.length) {
    lines.push(`Top spend categories: ${bigCats.map(([k,v])=> `${k} ${formatCurrency(v.spent)}`).join(", ")}.`);
  }

  if (c.net > 0) lines.push(`Nice work! You’re saving ${formatCurrency(c.net)} so far this month.`);
  else if (c.net < 0) lines.push(`You’re overspending by ${formatCurrency(Math.abs(c.net))}. Try a mini freeze on non-essentials for 3 days.`);

  if (lines.length === 1) lines.push("All good—no risky patterns detected. Keep going!");
  return lines;
}
