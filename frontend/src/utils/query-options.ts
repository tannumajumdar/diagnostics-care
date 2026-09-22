/**
 * The catalogue the front desk bills against - tests, referring doctors and
 * organisations.
 *
 * The app caches every query for five minutes and does not re-read on refocus,
 * which is right for a list the desk is paging through but wrong for the
 * master: a test the admin adds has to be addable at the desk straight away,
 * and until this existed the receptionist kept being offered the old catalogue
 * until the cache expired or the tab was hard-reloaded.
 */
export const catalogueQuery = {
  staleTime: 0,
  refetchOnMount: 'always',
  refetchOnWindowFocus: true,
} as const;

/** Query keys the master screens invalidate after changing the catalogue. */
export const CATALOGUE_QUERY_KEYS = [
  'visit-tests',
  'tests-billing',
  'visit-doctors',
  'doctors-billing',
  'visit-orgs',
  'orgs-billing',
  'visit-packages',
] as const;

/**
 * Every queue a specimen or a result moves through.
 *
 * The bench, the collection desk and the pathologist are all looking at the
 * same work from different ends, so a result submitted on one screen has to
 * appear on the others straight away. Queries are cached for five minutes and
 * do not re-read on refocus, which is right for a list being paged through
 * and wrong for a work queue: the technician sent a report up, the
 * pathologist opened Verification and was told there was nothing waiting -
 * for the next five minutes.
 *
 * Anything that moves a sample or a result invalidates all of these, because
 * one action moves it out of one queue and into another.
 */
export const LAB_QUERY_KEYS = [
  'results',
  'results-verification-queue',
  'result-entry-visit',
  'samples',
  'samples-collection',
  'samples-processing',
  'sample-stats',
  'sample-timeline',
  'workflow',
] as const;

/**
 * Every cached figure that moves when money does - a bill raised, a payment
 * taken, a payout recorded.
 *
 * Queries are cached for five minutes by default, which is right for a list
 * being paged through and wrong for a day's takings: the desk collects ₹500
 * and the dashboard keeps showing the total from before it. Anything that
 * changes the money invalidates these, so the day's figures are the day's
 * figures.
 */
export const MONEY_QUERY_KEYS = [
  'invoices',
  'invoice-details',
  'dashboard-invoices',
  'dashboard-collections',
  'dashboard-collection-trend',
  'dashboard-overall-collections',
  'daily-collections',
  'dashboard-payouts',
  'sample-stats',
] as const;
