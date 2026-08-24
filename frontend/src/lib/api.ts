const API_BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw { status: res.status, message: body.error || "Request failed" };
  }

  return res.json();
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<{ message: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  logout: () =>
    request<{ message: string }>("/auth/logout", { method: "POST" }),

  me: () => request<{ user: User }>("/auth/me"),

  // Invoices
  listInvoices: () => request<{ invoices: Invoice[] }>("/invoices"),

  getInvoice: (id: number) =>
    request<{ invoice: Invoice; services: InvoiceService[] }>(`/invoices/${id}`),

  createInvoice: (data: CreateInvoiceInput) =>
    request<{ id: number; subtotal: number; total: number; message: string }>(
      "/invoices",
      { method: "POST", body: JSON.stringify(data) }
    ),

  updateInvoice: (id: number, data: CreateInvoiceInput) =>
    request<{ subtotal: number; total: number; message: string }>(
      `/invoices/${id}`,
      { method: "PUT", body: JSON.stringify(data) }
    ),

  deleteInvoice: (id: number) =>
    request<{ message: string }>(`/invoices/${id}`, { method: "DELETE" }),

  // Clients
  listClients: () => request<{ clients: Client[] }>("/clients"),

  getClient: (id: number) => request<{ client: Client }>(`/clients/${id}`),

  createClient: (data: { name: string; contact?: string; address?: string }) =>
    request<{ id: number; message: string }>("/clients", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteClient: (id: number) =>
    request<{ message: string }>(`/clients/${id}`, { method: "DELETE" }),

  // Settings
  getSettings: () => request<{ settings: Settings }>("/settings"),

  updateSettings: (data: Partial<Settings>) =>
    request<{ message: string }>("/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

// Types
export interface User {
  id: number;
  username: string;
  role: "admin" | "user";
  created_at: string;
}

export interface Invoice {
  id: number;
  pi_no: string;
  invoice_date: string;
  currency: string;
  client_name: string;
  client_contact?: string;
  venue?: string;
  event_date?: string;
  event_type?: string;
  event_note?: string;
  client_address?: string;
  vat: number;
  payment_terms?: string;
  notes?: string;
  subtotal: number;
  total: number;
  client_id?: number;
  created_by?: number;
  created_at: string;
}

export interface InvoiceService {
  id: number;
  invoice_id: number;
  sort_order: number;
  description: string;
  qty: number;
  unit_price: number;
  amount: number;
}

export interface CreateInvoiceInput {
  pi_no: string;
  invoice_date: string;
  currency: string;
  client_name: string;
  client_contact?: string;
  venue?: string;
  event_date?: string;
  event_type?: string;
  event_note?: string;
  client_address?: string;
  vat: number;
  payment_terms?: string;
  notes?: string;
  client_id?: number;
  services: { description: string; qty: number; unit_price: number }[];
}

export interface Client {
  id: number;
  name: string;
  contact?: string;
  address?: string;
  created_at: string;
}

export interface Settings {
  id: number;
  company_name: string;
  company_subtitle: string;
  invoice_prefix: string;
  default_currency: string;
  default_vat: number;
  default_payment_terms: string;
  default_notes: string;
}
