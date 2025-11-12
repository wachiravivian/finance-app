export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2,
  })
    .format(amount)
    .replace("KES", "Ksh"); // replace ISO code with "Ksh"
}
export const signPrefix = (n: number) => (n < 0 ? '-' : '+');

export const formatDate = (d: string | Date) => {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};