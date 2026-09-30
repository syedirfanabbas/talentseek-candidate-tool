// Booking pages for the paid 30-minute Recruiter Strategy Session (Google Calendar
// appointment schedules). Add a second recruiter's page here with a label saying which
// hours or region it suits; the billing page shows every entry.
export const SESSION_BOOKING_PAGES: { label: string; url: string }[] = [
  { label: 'Choose a time', url: 'https://calendar.app.google/5aQJZuKJV9wyXkjb8' },
]

type Order = { product_key: string; status: string }

// Only customers who have paid for a session are shown the booking pages.
export function hasPaidSession(orders: Order[] | undefined): boolean {
  return (orders || []).some(order => order.product_key === 'recruiter_session' && order.status === 'paid')
}
