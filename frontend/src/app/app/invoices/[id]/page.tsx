"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, Invoice, InvoiceService, Settings } from "@/lib/api";
import InvoicePreview from "@/components/InvoicePreview";

export default function ViewInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [services, setServices] = useState<InvoiceService[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.getInvoice(id), api.getSettings()])
      .then(([invData, settData]) => {
        setInvoice(invData.invoice);
        setServices(invData.services);
        setSettings(settData.settings);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-gray-500">Loading invoice...</div>;
  if (error) return <div className="text-red-600">Error: {error}</div>;
  if (!invoice) return <div className="text-gray-500">Invoice not found</div>;

  return (
    <div className="max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Invoice {invoice.pi_no}</h1>
        <button onClick={() => router.push("/app/invoices")} className="text-gray-600 hover:text-gray-800 text-sm">&larr; Back to list</button>
      </div>

      <InvoicePreview
        invoice={invoice}
        services={services}
        companyName={settings?.company_name}
        companySubtitle={settings?.company_subtitle}
      />
    </div>
  );
}
