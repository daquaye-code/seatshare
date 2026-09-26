export const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
export const fmtDay = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
export const fmtFare = (n) => `GH₵ ${Number(n).toFixed(2)}`
export const dateStr = (d) => {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
export const errMsg = (e) => e?.message || 'Something went wrong. Try again.'
export const statusLabel = {
  pending: 'Waiting for driver',
  accepted: 'Confirmed',
  declined: 'Declined',
  cancelled: 'Cancelled'
}
