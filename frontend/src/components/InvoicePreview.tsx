"use client";

import { useRef } from "react";

interface PreviewProps {
  invoice: Record<string, any>;
  services: { description: string; qty: number; unit_price: number; amount?: number }[];
  companyName?: string;
  companySubtitle?: string;
  companyLogo?: string | null;
  companyStamp?: string | null;
}

function money(n: number) {
  return Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string) {
  if (!value) return "__________________";
  const d = new Date(value + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function amountWords(n: number) {
  n = Math.round(Number(n || 0) * 100) / 100;
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function under1000(x: number): string {
    let s = "";
    if (x >= 100) { s += ones[Math.floor(x / 100)] + " Hundred"; x %= 100; if (x) s += " "; }
    if (x >= 20) { s += tens[Math.floor(x / 10)]; x %= 10; if (x) s += " " + ones[x]; }
    else if (x > 0) s += ones[x];
    return s;
  }
  let whole = Math.floor(n);
  let result = "";
  if (whole >= 1000000) { result += under1000(Math.floor(whole / 1000000)) + " Million "; whole %= 1000000; }
  if (whole >= 1000) { result += under1000(Math.floor(whole / 1000)) + " Thousand "; whole %= 1000; }
  if (whole > 0) result += under1000(whole);
  if (!result) result = "Zero";
  return result.trim() + " UAE Dirhams Only";
}

function buildInvoiceHtml(
  invoice: Record<string, any>,
  services: { description: string; qty: number; unit_price: number; amount?: number }[],
  companyName: string,
  companySubtitle: string,
  companyLogo: string,
  companyStamp: string
) {
  const cur = invoice.currency || "AED";
  const rowsHtml = services
    .map(
      (s, i) => `
      <tr>
        <td>${String(i + 1).padStart(2, "0")}</td>
        <td><div class="desc">${escapeHtml(s.description)}</div></td>
        <td>${s.qty}</td>
        <td>${cur} ${money(s.unit_price)}</td>
        <td>${cur} ${money(s.amount ?? s.qty * s.unit_price)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  :root { --ink: #1f2937; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { font-family: Arial, Helvetica, sans-serif; color: #222; background: #fff; }
  #invoice { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 18mm 17mm 16mm; display: flex; flex-direction: column; }
  .inv-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 2px solid var(--ink); }
  .company-brand { background: linear-gradient(135deg, #f8f9fa 0%, #eef1f4 100%); padding: 16px 22px; border: 1px solid #e2e6ea; }
  .company-name { font-size: 22px; font-weight: 700; color: #111827; letter-spacing: 3.5px; text-transform: uppercase; }
  .company-subtitle { font-size: 10px; font-weight: 500; letter-spacing: 2.5px; color: #6b7280; text-transform: uppercase; margin-top: 6px; }
  .invoice-title { text-align: right; }
  .invoice-title h1 { font-size: 25px; margin: 0; letter-spacing: 1px; }
  .status { display: inline-block; margin-top: 7px; padding: 5px 10px; background: #f3f4f6; border-radius: 3px; font-size: 8px; font-weight: 700; letter-spacing: 1px; color: #4b5563; }
  .inv-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 22px; }
  .label { font-size: 8px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 7px; }
  .client-name { font-size: 13px; font-weight: 700; color: #111827; margin-bottom: 4px; white-space: pre-line; }
  .detail-line { font-size: 10px; color: #4b5563; line-height: 1.7; white-space: pre-line; }
  .inv-info { display: grid; grid-template-columns: 110px 1fr; row-gap: 7px; font-size: 10px; }
  .inv-info .v { font-weight: 600; color: #111827; }
  .event-box { margin-top: 24px; padding: 12px 14px; background: #f8f9fa; border-left: 3px solid var(--ink); display: flex; justify-content: space-between; }
  .event-label { font-size: 8px; font-weight: 700; letter-spacing: 1px; color: #6b7280; text-transform: uppercase; }
  .event-name { font-size: 12px; font-weight: 700; color: #111827; margin-top: 3px; }
  .service-section { margin-top: 20px; }
  .service-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 9px; color: #374151; }
  .inv-table { width: 100%; border-collapse: collapse; }
  .inv-table th { background: #1f2937; color: #fff; padding: 9px 10px; font-size: 8px; text-transform: uppercase; letter-spacing: .8px; text-align: left; }
  .inv-table th:first-child { width: 35px; text-align: center; }
  .inv-table th:nth-child(3), .inv-table th:nth-child(4), .inv-table th:nth-child(5) { width: 80px; text-align: right; }
  .inv-table td { padding: 10px 10px; border-bottom: 1px solid #e5e7eb; font-size: 10px; vertical-align: middle; }
  .inv-table td:first-child { text-align: center; color: #6b7280; }
  .inv-table td:nth-child(3), .inv-table td:nth-child(4), .inv-table td:nth-child(5) { text-align: right; font-weight: 600; white-space: nowrap; }
  .desc { font-weight: 700; font-size: 11px; color: #111827; }
  .summary-wrap { display: flex; justify-content: flex-end; margin-top: 10px; }
  .summary { width: 260px; }
  .summary-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 10px; color: #4b5563; }
  .summary-row.total { margin-top: 5px; padding: 12px 0; border-top: 2px solid #1f2937; font-size: 13px; font-weight: 800; color: #111827; }
  .words { margin-top: 16px; padding: 13px 15px; border: 1px solid #e5e7eb; border-radius: 3px; }
  .words .w { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 5px; }
  .words .text { font-size: 10px; font-weight: 700; color: #374151; }
  .notes { margin-top: 16px; }
  .notes-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 7px; }
  .notes-text { font-size: 9px; line-height: 1.6; color: #6b7280; white-space: pre-line; }
  .sign-area { margin-top: 45px; display: flex; justify-content: space-between; align-items: flex-end; position: relative; }
  .sign { width: 190px; }
  .sign-line { border-top: 1px solid #9ca3af; margin-bottom: 7px; }
  .sign-label { font-size: 8px; color: #6b7280; }
  .stamp { width: 170px; height: 170px; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: .8px; position: absolute; right: 0; bottom: 0; }
  .footer { margin-top: auto; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center; }
  .footer-thanks { font-size: 9px; font-weight: 700; color: #374151; letter-spacing: .4px; }
  .footer-company { margin-top: 4px; font-size: 8px; color: #9ca3af; letter-spacing: .5px; }
  @media print { @page { size: A4 portrait; margin: 0; } body { background: #fff; } #invoice { width: 210mm; min-height: 297mm; margin: 0; box-shadow: none; } }
</style>
</head>
<body>
<div id="invoice">
  <header class="inv-header">
    <div class="company-brand">
      ${companyLogo
        ? `<img src="${companyLogo}" alt="Company Logo" style="max-height:40px;max-width:300px;display:block">`
        : `<div class="company-name">${escapeHtml(companyName)}</div>`
      }
      <div class="company-subtitle">${escapeHtml(companySubtitle)}</div>
    </div>
    <div class="invoice-title">
      <h1>PROFORMA INVOICE</h1>
      <div class="status">PROFORMA</div>
    </div>
  </header>

  <section class="inv-meta">
    <div>
      <div class="label">Bill To</div>
      <div class="client-name">${escapeHtml(invoice.client_name || "______________________________")}</div>
      <div class="detail-line">Contact: ${escapeHtml(invoice.client_contact || "______________________")}</div>
      <div class="detail-line">Venue: ${escapeHtml(invoice.venue || "___________________")}</div>
      ${invoice.client_address ? `<div class="detail-line">${escapeHtml(invoice.client_address)}</div>` : ""}
    </div>
    <div>
      <div class="label">Invoice Information</div>
      <div class="inv-info">
        <div>PI Number</div><div class="v">${escapeHtml(invoice.pi_no || "")}</div>
        <div>Issue Date</div><div class="v">${formatDate(invoice.invoice_date)}</div>
        <div>Event Date</div><div class="v">${formatDate(invoice.event_date)}</div>
      </div>
    </div>
  </section>

  <section class="event-box">
    <div><div class="event-label">Event Type</div><div class="event-name">${escapeHtml(invoice.event_type || "Event")}</div></div>
    <div style="text-align:right"><div class="event-label">Currency</div><div class="event-name">${escapeHtml(cur)}</div></div>
  </section>

  <section class="service-section">
    <div class="service-title">Event Service</div>
    <table class="inv-table">
      <thead><tr><th>#</th><th>Description of Service</th><th style="text-align:center">Qty.</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </section>

  <section class="summary-wrap">
    <div class="summary">
      <div class="summary-row"><span>Subtotal</span><span>${escapeHtml(cur)} ${money(invoice.subtotal || 0)}</span></div>
      <div class="summary-row"><span>VAT</span><span>${invoice.vat ? escapeHtml(cur) + " " + money(invoice.vat) : "—"}</span></div>
      <div class="summary-row total"><span>TOTAL PAYABLE</span><span>${escapeHtml(cur)} ${money(invoice.total || 0)}</span></div>
    </div>
  </section>

  <section class="words">
    <div class="w">Total Amount in Words</div>
    <div class="text">${cur === "AED" ? amountWords(invoice.total || 0) : escapeHtml(cur) + " " + money(invoice.total || 0) + " Only"}</div>
  </section>

  <section class="notes">
    <div class="notes-title">Note</div>
    <div class="notes-text">${escapeHtml(invoice.notes || "")}<br>Payment Terms: ${escapeHtml(invoice.payment_terms || "")}</div>
  </section>

  <section class="sign-area">
    <div class="sign">
      <div class="sign-line"></div>
      <div class="sign-label">Authorized Signatory</div>
      <div class="sign-label">${escapeHtml(companyName)}</div>
    </div>
    <div class="stamp">${companyStamp
      ? `<img src="${companyStamp}" alt="Company Stamp" style="width:100%;height:100%;object-fit:contain;display:block">`
      : `Company Stamp`
    }</div>
  </section>

  <footer class="footer">
    <div class="footer-thanks">THANK YOU FOR YOUR BUSINESS</div>
    <div class="footer-company">${escapeHtml(companyName)}</div>
  </footer>
</div>
</body>
</html>`;
}

function escapeHtml(v: string) {
  return String(v ?? "").replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] as string)
  );
}

export default function InvoicePreview({ invoice, services, companyName = "MOMENT ORGANIZER EVENTS MANAGING", companySubtitle = "Event Management & Event Decoration", companyLogo, companyStamp }: PreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const html = buildInvoiceHtml(invoice, services, companyName, companySubtitle, companyLogo || "", companyStamp || "");

  const handlePrint = () => {
    iframeRef.current?.contentWindow?.print();
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={handlePrint}
          className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800"
        >
          Print / Save PDF
        </button>
      </div>
      <div className="border rounded-lg overflow-hidden shadow-lg bg-white">
        <iframe
          ref={iframeRef}
          srcDoc={html}
          className="w-full border-0"
          style={{ height: "1100px" }}
          title="Invoice Preview"
        />
      </div>
    </div>
  );
}
