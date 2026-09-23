import api from './axios';

/**
 * The directory serves one page at a time and the server clamps how large a
 * page may be, so an export cannot simply ask for everything at once. These
 * are the sizes the walk below uses: the page it requests, and the ceiling at
 * which it stops and tells the desk the file is partial rather than looping
 * over a collection of unknown size.
 */
const EXPORT_PAGE_SIZE = 500;
const EXPORT_ROW_CEILING = 20000;

export const billingApi = {
  getAllInvoices: async (params?: any): Promise<any> => api.get('/billing', { params }),
  getInvoiceById: async (id: string): Promise<any> => api.get(`/billing/${id}`),
  createInvoice: async (data: any): Promise<any> => api.post('/billing', data),
  /** Whole front-desk intake in one call: patient + bill + queued samples. */
  createVisit: async (data: any): Promise<any> => api.post('/billing/visit', data),
  addPayment: async (id: string, data: any): Promise<any> => api.post(`/billing/${id}/payments`, data),
  /**
   * A bill changed after it was raised: tests added to the same visit, or the
   * discount reworked when the patient comes in to settle their due. The
   * server re-prices the whole bill and queues samples for anything new.
   */
  reviseInvoice: async (id: string, data: any): Promise<any> => api.put(`/billing/${id}`, data),
  getByBarcode: async (barcode: string): Promise<any> => api.get(`/billing/barcode/${barcode}`),

  /**
   * Every bill matching a filter, not just the page on screen - what Export
   * writes to the file. `filters` takes the same shape the directory passes to
   * `getAllInvoices` (search, from, to, paymentStatus, patient); page and
   * limit are set here.
   *
   * `truncated` says the window was larger than the ceiling and the file holds
   * the newest rows only, so the desk can narrow the dates and export again
   * instead of quietly filing an incomplete sheet.
   */
  getInvoicesForExport: async (
    filters: Record<string, any> = {}
  ): Promise<{ invoices: any[]; total: number; truncated: boolean }> => {
    const collected: any[] = [];
    let page = 1;
    let total = 0;

    // The loop stops on the server's own count rather than on an empty page,
    // so a window that happens to divide evenly does not cost an extra call.
    for (;;) {
      const response: any = await billingApi.getAllInvoices({
        ...filters,
        page,
        limit: EXPORT_PAGE_SIZE,
      });

      const rows: any[] = Array.isArray(response) ? response : response?.invoices || [];
      const meta = response?.meta || response?.pagination || {};
      total = Number(meta.total ?? total ?? 0) || collected.length + rows.length;

      collected.push(...rows);

      if (rows.length < EXPORT_PAGE_SIZE) break;
      if (collected.length >= total) break;
      if (collected.length >= EXPORT_ROW_CEILING) break;
      page += 1;
    }

    return { invoices: collected, total, truncated: collected.length < total };
  },
};
