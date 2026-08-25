"use client";

import { useEffect, useState, useRef } from "react";
import { api, Settings } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

function resizeImage(file: File, maxWidth: number, maxHeight: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;
      ctx!.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/png"));
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const logoInputRef = useRef<HTMLInputElement>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);
  const [logoLoading, setLogoLoading] = useState(false);
  const [stampLoading, setStampLoading] = useState(false);

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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !settings) return;
    setLogoLoading(true);
    try {
      const dataUri = await resizeImage(file, 300, 80);
      setSettings({ ...settings, company_logo: dataUri });
    } catch (err: any) {
      setError(err.message || "Failed to process logo");
    } finally {
      setLogoLoading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleStampUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !settings) return;
    setStampLoading(true);
    try {
      const dataUri = await resizeImage(file, 260, 130);
      setSettings({ ...settings, company_stamp: dataUri });
    } catch (err: any) {
      setError(err.message || "Failed to process stamp");
    } finally {
      setStampLoading(false);
      if (stampInputRef.current) stampInputRef.current.value = "";
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
        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h2 className="text-lg font-bold">Company Information</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <input type="text" value={settings.company_name} onChange={(e) => setSettings({ ...settings, company_name: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Subtitle</label>
              <input type="text" value={settings.company_subtitle} onChange={(e) => setSettings({ ...settings, company_subtitle: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h2 className="text-lg font-bold">Company Logo</h2>
            <p className="text-xs text-gray-500">Displayed in the invoice header. When uploaded, replaces the company name text. Recommended: 300×80px PNG or JPG.</p>
            {settings.company_logo ? (
              <div className="space-y-3">
                <div className="border rounded-md p-3 inline-block bg-gray-50">
                  <img src={settings.company_logo} alt="Company Logo" className="max-h-20 max-w-[300px]" />
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, company_logo: null })}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Remove Logo
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoLoading}
                  className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                  {logoLoading ? "Processing..." : "Upload Logo"}
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h2 className="text-lg font-bold">Company Stamp</h2>
            <p className="text-xs text-gray-500">Displayed in the signature area. Recommended: 260×130px PNG or JPG.</p>
            {settings.company_stamp ? (
              <div className="space-y-3">
                <div className="border rounded-md p-3 inline-block bg-gray-50">
                  <img src={settings.company_stamp} alt="Company Stamp" className="max-h-[65px] max-w-[130px]" />
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, company_stamp: null })}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Remove Stamp
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <input
                  ref={stampInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleStampUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => stampInputRef.current?.click()}
                  disabled={stampLoading}
                  className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                  {stampLoading ? "Processing..." : "Upload Stamp"}
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h2 className="text-lg font-bold">Invoice Defaults</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Prefix</label>
              <input type="text" value={settings.invoice_prefix} onChange={(e) => setSettings({ ...settings, invoice_prefix: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
