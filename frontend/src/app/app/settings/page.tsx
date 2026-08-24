"use client";

import { useEffect, useState } from "react";
import { api, Settings } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    api.getSettings()
      .then((data) => setSettings(data.settings))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.updateSettings(settings);
      setSuccess("Settings saved successfully");
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-gray-500">Loading settings...</div>;
  if (user?.role !== "admin") {
    return <div className="text-red-600 bg-red-50 p-4 rounded-md">Access denied. Admin role required.</div>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md mb-4">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 text-sm p-3 rounded-md mb-4">{success}</div>}

      {settings && (
        <form onSubmit={handleSave} className="bg-white rounded-lg shadow p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
            <input type="text" value={settings.company_name} onChange={(e) => setSettings({ ...settings, company_name: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Subtitle</label>
            <input type="text" value={settings.company_subtitle} onChange={(e) => setSettings({ ...settings, company_subtitle: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Prefix</label>
            <input type="text" value={settings.invoice_prefix} onChange={(e) => setSettings({ ...settings, invoice_prefix: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Currency</label>
              <select value={settings.default_currency} onChange={(e) => setSettings({ ...settings, default_currency: e.target.value })} className="w-full px-3 py-2 border rounded-md">
                <option>AED</option><option>USD</option><option>EUR</option><option>GBP</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default VAT</label>
              <input type="number" min="0" step="0.01" value={settings.default_vat} onChange={(e) => setSettings({ ...settings, default_vat: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-md" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Payment Terms</label>
            <input type="text" value={settings.default_payment_terms} onChange={(e) => setSettings({ ...settings, default_payment_terms: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Notes</label>
            <textarea value={settings.default_notes} onChange={(e) => setSettings({ ...settings, default_notes: e.target.value })} className="w-full px-3 py-2 border rounded-md" rows={3} />
          </div>
          <div>
            <button type="submit" disabled={saving} className="bg-gray-900 text-white px-6 py-2 rounded-md font-medium hover:bg-gray-800 disabled:opacity-50">
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
