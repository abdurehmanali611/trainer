import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

import { format, shortDate } from '@/lib/dates';
import type { Invoice, Payment } from '@/lib/types';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function paymentDate(payment: Payment): string {
  return shortDate(payment.decided_at ?? payment.created_at);
}

function invoiceHtml(invoice: Invoice): string {
  const period = invoice.period_info;
  const generated = format(new Date(), 'MMM d, yyyy');
  const payments = invoice.payments;

  const periodRow = period
    ? `<tr>
        <td>Period</td>
        <td>${esc(shortDate(period.start_date))} – ${esc(shortDate(period.end_date))}${
          period.is_trial ? ' <span class="badge">Trial</span>' : ''
        }</td>
      </tr>`
    : '';

  const paymentsBlock =
    payments.length === 0
      ? '<p class="muted">No payments recorded.</p>'
      : `<table>
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Channel</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${payments
              .map(
                (p) => `<tr>
                  <td>${esc(p.transaction_id || '—')}</td>
                  <td>${esc(p.channel)}</td>
                  <td>${esc(p.status)}</td>
                  <td>${esc(paymentDate(p))}</td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>`;

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        color: #111111;
        background: #ffffff;
        margin: 40px;
        font-size: 14px;
        line-height: 1.5;
      }
      h1 { font-size: 22px; margin: 0 0 4px 0; }
      .subtitle { color: #6b7280; font-size: 13px; margin: 0 0 24px 0; }
      h2 {
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #6b7280;
        margin: 28px 0 10px 0;
        border-bottom: 1px solid #e5e7eb;
        padding-bottom: 6px;
      }
      table { width: 100%; border-collapse: collapse; }
      th, td {
        text-align: left;
        padding: 8px 10px;
        border-bottom: 1px solid #e5e7eb;
        font-size: 13px;
      }
      th { background: #f9fafb; color: #6b7280; font-weight: 600; }
      td:first-child, .summary td:first-child { color: #6b7280; width: 40%; }
      .summary td { border-bottom: 1px solid #e5e7eb; padding: 8px 10px; }
      .summary .amount td { font-size: 18px; font-weight: 700; color: #111111; border-bottom: none; }
      .badge {
        display: inline-block;
        background: #e5e7eb;
        color: #374151;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 600;
        padding: 2px 8px;
        margin-left: 6px;
        vertical-align: middle;
      }
      .muted { color: #6b7280; }
      .footer {
        margin-top: 32px;
        padding-top: 12px;
        border-top: 1px solid #e5e7eb;
        color: #9ca3af;
        font-size: 11px;
      }
    </style>
  </head>
  <body>
    <h1>Trainer Invoice #${invoice.id}</h1>
    <p class="subtitle">Generated ${esc(generated)}</p>

    <h2>Details</h2>
    <table class="summary">
      <tr>
        <td>Client</td>
        <td>${esc(invoice.client_name)}</td>
      </tr>
      ${periodRow}
      <tr>
        <td>Due date</td>
        <td>${esc(shortDate(invoice.due_date))}</td>
      </tr>
      <tr>
        <td>Status</td>
        <td>${esc(invoice.status)}</td>
      </tr>
      <tr class="amount">
        <td>Amount</td>
        <td>ETB ${esc(invoice.amount)}</td>
      </tr>
    </table>

    <h2>Payments</h2>
    ${paymentsBlock}

    <p class="footer">
      Invoice #${invoice.id} for ${esc(invoice.client_name)} · generated ${esc(generated)}
    </p>
  </body>
</html>`;
}

export async function exportInvoicePdf(invoice: Invoice): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: invoiceHtml(invoice) });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  } else {
    Alert.alert('Invoice PDF', uri);
  }
}
