"use client";

import { useEffect, useState, useCallback } from "react";
import { api, LoginEvent, ActivityLog, PaginatedResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Tab = "login" | "activity";

function LocationCell({ city, region, country }: { city: string | null; region: string | null; country: string | null }) {
  if (!city && !region && !country) return <td className="px-4 py-3 text-gray-400">—</td>;
  const parts = [city, region, country].filter(Boolean);
  return <td className="px-4 py-3 text-sm" title={parts.join(", ")}>{parts.join(", ")}</td>;
}

export default function LogsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("login");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [loginData, setLoginData] = useState<PaginatedResponse<LoginEvent> | null>(null);
  const [activityData, setActivityData] = useState<PaginatedResponse<ActivityLog> | null>(null);

  const [loginPage, setLoginPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);

  const [loginFilters, setLoginFilters] = useState({ from: "", to: "", success: "", failure_reason: "", ip: "" });
  const [activityFilters, setActivityFilters] = useState({ from: "", to: "", action: "", entity_type: "", ip: "" });

  const [appliedLoginFilters, setAppliedLoginFilters] = useState<Record<string, string>>({});
  const [appliedActivityFilters, setAppliedActivityFilters] = useState<Record<string, string>>({});

  const loadLoginEvents = useCallback(async (page: number, filters: Record<string, string>, append = false) => {
    try {
      const params: Record<string, string> = { page: String(page), limit: "50", ...filters };
      const data = await api.listLoginEvents(params);
      setLoginData(prev => append && prev ? {
        rows: [...prev.rows, ...data.rows],
        pagination: data.pagination,
      } : data);
    } catch (err: any) {
      setError(err.message || "Failed to load login events");
    }
  }, []);

  const loadActivity = useCallback(async (page: number, filters: Record<string, string>, append = false) => {
    try {
      const params: Record<string, string> = { page: String(page), limit: "50", ...filters };
      const data = await api.listActivity(params);
      setActivityData(prev => append && prev ? {
        rows: [...prev.rows, ...data.rows],
        pagination: data.pagination,
      } : data);
    } catch (err: any) {
      setError(err.message || "Failed to load activity log");
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setError("");
    if (tab === "login") {
      loadLoginEvents(1, appliedLoginFilters).finally(() => setLoading(false));
    } else {
      loadActivity(1, appliedActivityFilters).finally(() => setLoading(false));
    }
  }, [tab, appliedLoginFilters, appliedActivityFilters, loadLoginEvents, loadActivity]);

  const handleApplyLoginFilters = () => {
    const params: Record<string, string> = {};
    if (loginFilters.from) params.from = loginFilters.from;
    if (loginFilters.to) params.to = loginFilters.to;
    if (loginFilters.success) params.success = loginFilters.success;
    if (loginFilters.failure_reason) params.failure_reason = loginFilters.failure_reason;
    if (loginFilters.ip) params.ip = loginFilters.ip;
    setAppliedLoginFilters(params);
    setLoginPage(1);
    setLoginData(null);
  };

  const handleApplyActivityFilters = () => {
    const params: Record<string, string> = {};
    if (activityFilters.from) params.from = activityFilters.from;
    if (activityFilters.to) params.to = activityFilters.to;
    if (activityFilters.action) params.action = activityFilters.action;
    if (activityFilters.entity_type) params.entity_type = activityFilters.entity_type;
    if (activityFilters.ip) params.ip = activityFilters.ip;
    setAppliedActivityFilters(params);
    setActivityPage(1);
    setActivityData(null);
  };

  const handleLoadMore = () => {
    if (tab === "login" && loginData) {
      const nextPage = loginPage + 1;
      setLoginPage(nextPage);
      loadLoginEvents(nextPage, appliedLoginFilters, true);
    } else if (tab === "activity" && activityData) {
      const nextPage = activityPage + 1;
      setActivityPage(nextPage);
      loadActivity(nextPage, appliedActivityFilters, true);
    }
  };

  if (user?.role !== "admin") {
    return <div className="text-red-600 bg-red-50 p-4 rounded-md">Access denied. Admin role required.</div>;
  }

  const currentData = tab === "login" ? loginData : activityData;
  const showingCount = currentData?.rows.length || 0;
  const total = currentData?.pagination.total || 0;
  const hasMore = currentData ? showingCount < total : false;

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">Logs</h1>

      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md mb-4">{error}</div>}

      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setTab("login")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "login" ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-100"
          }`}
        >
          Login Events
        </button>
        <button
          onClick={() => setTab("activity")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "activity" ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-100"
          }`}
        >
          Activity Log
        </button>
      </div>

      {tab === "login" && (
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
              <input
                type="date"
                value={loginFilters.from}
                onChange={(e) => setLoginFilters({ ...loginFilters, from: e.target.value })}
                className="px-3 py-1.5 border rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
              <input
                type="date"
                value={loginFilters.to}
                onChange={(e) => setLoginFilters({ ...loginFilters, to: e.target.value })}
                className="px-3 py-1.5 border rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Result</label>
              <select
                value={loginFilters.success}
                onChange={(e) => setLoginFilters({ ...loginFilters, success: e.target.value })}
                className="px-3 py-1.5 border rounded-md text-sm"
              >
                <option value="">All</option>
                <option value="1">Success</option>
                <option value="0">Failed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Reason</label>
              <select
                value={loginFilters.failure_reason}
                onChange={(e) => setLoginFilters({ ...loginFilters, failure_reason: e.target.value })}
                className="px-3 py-1.5 border rounded-md text-sm"
              >
                <option value="">All</option>
                <option value="wrong_password">Wrong Password</option>
                <option value="deactivated">Deactivated</option>
                <option value="nonexistent">Nonexistent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">IP</label>
              <input
                type="text"
                placeholder="Search IP..."
                value={loginFilters.ip}
                onChange={(e) => setLoginFilters({ ...loginFilters, ip: e.target.value })}
                className="px-3 py-1.5 border rounded-md text-sm w-36"
              />
            </div>
            <button
              onClick={handleApplyLoginFilters}
              className="bg-gray-900 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-gray-800"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {tab === "activity" && (
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
              <input
                type="date"
                value={activityFilters.from}
                onChange={(e) => setActivityFilters({ ...activityFilters, from: e.target.value })}
                className="px-3 py-1.5 border rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
              <input
                type="date"
                value={activityFilters.to}
                onChange={(e) => setActivityFilters({ ...activityFilters, to: e.target.value })}
                className="px-3 py-1.5 border rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Action</label>
              <input
                type="text"
                placeholder="e.g. invoice.create"
                value={activityFilters.action}
                onChange={(e) => setActivityFilters({ ...activityFilters, action: e.target.value })}
                className="px-3 py-1.5 border rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Entity Type</label>
              <select
                value={activityFilters.entity_type}
                onChange={(e) => setActivityFilters({ ...activityFilters, entity_type: e.target.value })}
                className="px-3 py-1.5 border rounded-md text-sm"
              >
                <option value="">All</option>
                <option value="invoice">Invoice</option>
                <option value="client">Client</option>
                <option value="settings">Settings</option>
                <option value="user">User</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">IP</label>
              <input
                type="text"
                placeholder="Search IP..."
                value={activityFilters.ip}
                onChange={(e) => setActivityFilters({ ...activityFilters, ip: e.target.value })}
                className="px-3 py-1.5 border rounded-md text-sm w-36"
              />
            </div>
            <button
              onClick={handleApplyActivityFilters}
              className="bg-gray-900 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-gray-800"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-500 text-sm">Loading...</div>
        ) : currentData && currentData.rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {tab === "login" ? (
                    <>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Time</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Username</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Result</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Reason</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">IP</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Location</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">User Agent</th>
                    </>
                  ) : (
                    <>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Time</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Entity</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">IP</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Location</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {tab === "login" ? (
                  (currentData.rows as LoginEvent[]).map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 whitespace-nowrap">{row.created_at}</td>
                      <td className="px-4 py-3">{row.username_attempted}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded ${row.success ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {row.success ? "Success" : "Failed"}
                        </span>
                      </td>
                      <td className="px-4 py-3">{row.failure_reason || "\u2014"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{row.ip_address || "\u2014"}</td>
                      <LocationCell city={row.location_city} region={row.location_region} country={row.location_country} />
                      <td className="px-4 py-3" title={row.user_agent || ""}>
                        {row.user_agent ? (row.user_agent.length > 40 ? row.user_agent.slice(0, 40) + "\u2026" : row.user_agent) : "\u2014"}
                      </td>
                    </tr>
                  ))
                ) : (
                  (currentData.rows as ActivityLog[]).map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 whitespace-nowrap">{row.created_at}</td>
                      <td className="px-4 py-3">{row.username_snapshot}</td>
                      <td className="px-4 py-3"><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{row.action}</code></td>
                      <td className="px-4 py-3">{row.entity_type} #{row.entity_id}</td>
                      <td className="px-4 py-3">{row.description}</td>
                      <td className="px-4 py-3 font-mono text-xs">{row.ip_address || "\u2014"}</td>
                      <LocationCell city={row.location_city} region={row.location_region} country={row.location_country} />
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-gray-500 text-sm">No logs found</div>
        )}
      </div>

      {currentData && currentData.rows.length > 0 && (
        <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
          <span>Showing {showingCount} of {total}</span>
          {hasMore && (
            <button
              onClick={handleLoadMore}
              className="text-gray-900 font-medium hover:underline"
            >
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
