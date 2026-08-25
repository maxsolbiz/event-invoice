"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, Client, Settings, CreateInvoiceInput, InvoiceService } from "@/lib/api";
import InvoicePreview from "@/components/InvoicePreview";

interface ServiceRow {
  description: string;
  qty: number;
  unit_price: number;
}

export default function EditInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    pi_no: "",
    invoice_date: "",
    currency: "AED",
    client_name: "",
    client_contact: "",
    venue: "",
    event_date: "",
    event_type: "",
    event_note: "",
    client_address: "",
    vat: 0,
    payment_terms: "",
    notes: "",
    client_id: undefined as number | undefined,
  });

  const [services, setServices] = useState<ServiceRow[]>([]);

  useEffect(() => {
    Promise.all([api.getInvoice(id), api.getSettings(), api.listClients()])
      .then(([invData, s, c]) => {
        const inv = invData.invoice;
        setSettings(s.settings);
        setClients(c.clients);
        setForm({
          pi_no: inv.pi_no,
          invoice_date: inv.invoice_date,
          currency: inv.currency,
          client_name: inv.client_name,
          client_contact: inv.client_contact || "",
          venue: inv.venue || "",
          event_date: inv.event_date || "",
          event_type: inv.event_type || "",
          event_note: inv.event_note || "",
          client_address: inv.client_address || "",
          vat: inv.vat,
          payment_terms: inv.payment_terms || "",
          notes: inv.notes || "",
          client_id: inv.client_id,
        });
        setServices(
          invData.services.map((s: InvoiceService) => ({
            description: s.description,
            qty: s.qty,
            unit_price: s.unit_price,
          }))
        );
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const updateService = (index: number, field: keyof ServiceRow, value: string | number) => {
    setServices((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addService = () => {
    setServices((prev) => [...prev, { description: "", qty: 1, unit_price: 0 }]);
  };

  const removeService = (index: number) => {
    setServices((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotal = services.reduce((s, svc) => s + svc.qty * svc.unit_price, 0);
  const total = subtotal + form.vat;

  const handleClientSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const clientId = e.target.value ? Number(e.target.value) : undefined;
    const client = clients.find((c) => c.id === clientId);
    setForm((prev) => ({
      ...prev,
      client_id: clientId,
      client_name: client?.name || "",
      client_contact: client?.contact || "",
      client_address: client?.address || "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    const payload: CreateInvoiceInput = {
      ...form,
      services: services.map((s) => ({
        description: s.description,
        qty: Number(s.qty),
        unit_price: Number(s.unit_price),
      })),
    };

    try {
      await api.updateInvoice(id, payload);
      router.push("/app/invoices");
    } catch (err: any) {
      setError(err.message || "Failed to update invoice");
    } finally {
      setSaving(false);
    }
  };

  const previewInvoice = {
    ...form,
    subtotal,
    total,
  };

  if (loading) return <div className="text-gray-500">Loading invoice...</div>;

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">Edit Invoice {form.pi_no}</h1>

      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md mb-4">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Invoice Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PI Number</label>
              <input type="text" value={form.pi_no} onChange={(e) => setForm({ ...form, pi_no: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label>
              <input type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="w-full px-3 py-2 border rounded-md">
                <option>AED</option><option>USD</option><option>EUR</option><option>GBP</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Client & Event</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Saved Client</label>
              <select value={form.client_id || ""} onChange={handleClientSelect} className="w-full px-3 py-2 border rounded-md">
                <option value="">-- New Client --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
              <input type="text" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
              <input type="text" value={form.client_contact} onChange={(e) => setForm({ ...form, client_contact: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
              <input type="text" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Date</label>
              <input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
              <input type="text" value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address / Notes</label>
              <textarea value={form.client_address} onChange={(e) => setForm({ ...form, client_address: e.target.value })} className="w-full px-3 py-2 border rounded-md" rows={2} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Services</h2>
            <button type="button" onClick={addService} className="text-sm text-blue-600 hover:text-blue-800 font-medium">+ Add Service</button>
          </div>
          <div className="space-y-3">
            {services.map((svc, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_80px_120px_120px_36px] gap-3 items-end">
                <div>
                  {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>}
                  <input type="text" value={svc.description} onChange={(e) => updateService(i, "description", e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" placeholder="Service description" />
                </div>
                <div className="grid grid-cols-2 gap-3 md:contents">
                  <div>
                    {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Qty</label>}
                    <input type="number" min="0" value={svc.qty} onChange={(e) => updateService(i, "qty", Number(e.target.value))} className="w-full px-3 py-2 border rounded-md text-sm text-right" />
                  </div>
                  <div>
                    {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Unit Price</label>}
                    <input type="number" min="0" step="0.01" value={svc.unit_price} onChange={(e) => updateService(i, "unit_price", Number(e.target.value))} className="w-full px-3 py-2 border rounded-md text-sm text-right" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 md:contents">
                  <div>
                    {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">Amount</label>}
                    <div className="px-3 py-2 border rounded-md text-sm text-right bg-gray-50">{form.currency} {(svc.qty * svc.unit_price).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                  </div>
                  <div>
                    {i === 0 && <label className="block text-xs font-medium text-gray-500 mb-1">&nbsp;</label>}
                    <button type="button" onClick={() => removeService(i)} className="w-full py-2 text-red-600 hover:text-red-800 text-sm">&times;</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-end mt-4 gap-4 md:gap-6 text-sm">
            <div>Subtotal: <span className="font-semibold">{form.currency} {subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span></div>
            <div>VAT: <input type="number" min="0" step="0.01" value={form.vat} onChange={(e) => setForm({ ...form, vat: Number(e.target.value) })} className="w-24 px-2 py-1 border rounded text-right text-sm" /></div>
            <div className="font-bold">Total: {form.currency} {total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
              <input type="text" value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2 border rounded-md" rows={2} />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mb-8">
          <button type="submit" disabled={saving} className="bg-gray-900 text-white px-6 py-2 rounded-md font-medium hover:bg-gray-800 disabled:opacity-50">
            {saving ? "Saving..." : "Update Invoice"}
          </button>
          <button type="button" onClick={() => router.push("/app/invoices")} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-md font-medium hover:bg-gray-300">
            Cancel
          </button>
        </div>
      </form>

      <h2 className="text-lg font-semibold mb-3">Preview</h2>
      <InvoicePreview invoice={previewInvoice} services={services} companyName={settings?.company_name} companySubtitle={settings?.company_subtitle} />
    </div>
  );
}
