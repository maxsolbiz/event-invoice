"use client";

import { useEffect, useState } from "react";
import { api, Client } from "@/lib/api";

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit modal state
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [editName, setEditName] = useState("");
  const [editContact, setEditContact] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const loadClients = () => {
    api.listClients()
      .then((data) => setClients(data.clients))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadClients(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.createClient({ name: name.trim(), contact: contact.trim(), address: address.trim() });
      setName(""); setContact(""); setAddress("");
      loadClients();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, clientName: string) => {
    if (!confirm(`Delete client "${clientName}"?`)) return;
    try {
      await api.deleteClient(id);
      loadClients();
    } catch (err: any) {
      if (err.status === 409) {
        alert("Cannot delete client with existing invoices.");
      } else {
        alert(err.message || "Delete failed");
      }
    }
  };

  const openEdit = (client: Client) => {
    setEditClient(client);
    setEditName(client.name);
    setEditContact(client.contact || "");
    setEditAddress(client.address || "");
    setEditError("");
  };

  const closeEdit = () => {
    setEditClient(null);
    setEditError("");
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editClient || !editName.trim()) return;
    setEditSaving(true);
    setEditError("");
    try {
      await api.updateClient(editClient.id, {
        name: editName.trim(),
        contact: editContact.trim(),
        address: editAddress.trim(),
      });
      closeEdit();
      loadClients();
    } catch (err: any) {
      setEditError(err.message || "Update failed");
    } finally {
      setEditSaving(false);
    }
  };

  if (loading) return <div className="text-gray-500">Loading clients...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Clients</h1>

      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md mb-4">{error}</div>}

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Add Client</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border rounded-md" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
            <input type="text" value={contact} onChange={(e) => setContact(e.target.value)} className="w-full px-3 py-2 border rounded-md" placeholder="+971..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
          </div>
          <div className="sm:col-span-3">
            <button type="submit" disabled={saving} className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
              {saving ? "Saving..." : "Add Client"}
            </button>
          </div>
        </form>
      </div>

      {clients.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">No clients yet.</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.contact || "\u2014"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.address || "\u2014"}</td>
                    <td className="px-4 py-3 text-right space-x-3">
                      <button onClick={() => openEdit(c)} className="text-gray-600 hover:text-gray-900 text-sm">Edit</button>
                      <button onClick={() => handleDelete(c.id, c.name)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeEdit}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Edit Client</h2>
            </div>
            <form onSubmit={handleEdit} className="px-6 py-4 space-y-4">
              {editError && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md">{editError}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-3 py-2 border rounded-md" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
                <input type="text" value={editContact} onChange={(e) => setEditContact(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input type="text" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
              </div>
            </form>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button type="button" onClick={closeEdit} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
              <button type="submit" form="edit-client-form" disabled={editSaving || !editName.trim()} onClick={handleEdit} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50">{editSaving ? "Saving..." : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
