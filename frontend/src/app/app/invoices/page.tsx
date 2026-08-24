"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Invoice } from "@/lib/api";

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listInvoices()
      .then((data) => setInvoices(data.invoices))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this invoice?")) return;
    try {
      await api.deleteInvoice(id);
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    } catch (err: any) {
      alert(err.message || "Delete failed");
    }
  };

  if (loading) return <div className="text-gray-500">Loading invoices...</div>;
  if (error) return <div className="text-red-600">Error: {error}</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <Link
          href="/app/invoices/new"
          className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800"
        >
          + New Invoice
        </Link>
      </div>

      {invoices.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No invoices yet. Create your first one.
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PI No</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium">{inv.pi_no}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{inv.client_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{inv.invoice_date}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium">
                    {inv.currency} {Number(inv.total).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/app/invoices/${inv.id}`} className="text-blue-600 hover:text-blue-800 text-sm mr-3">
                      View
                    </Link>
                    <button onClick={() => handleDelete(inv.id)} className="text-red-600 hover:text-red-800 text-sm">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
