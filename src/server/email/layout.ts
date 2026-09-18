import "server-only";

/**
 * Shared email chrome. Table-based, inline-styled, no external assets:
 * the layout that survives Outlook, Gmail clipping and dark-mode inversion.
 * Templates never interpolate secrets or internal identifiers.
 */

export type EmailButton = { label: string; href: string };

const INK = "#14120F";
const MUTED = "#6F6759";
const PAPER = "#FBF9F5";
const LINE = "#E5E0D5";
const CLAY = "#A8452B";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function emailLayout(options: {
  preheader: string;
  heading: string;
  bodyHtml: string;
  button?: EmailButton;
  footerNote?: string;
}): string {
  const { preheader, heading, bodyHtml, button, footerNote } = options;
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:32px 16px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid ${LINE};">
    <tr><td style="padding:28px 32px 0 32px;">
      <span style="font:600 12px/1 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:${MUTED};">Kiip Mall</span>
    </td></tr>
    <tr><td style="padding:16px 32px 0 32px;">
      <h1 style="margin:0;font:600 26px/1.15 Georgia,'Times New Roman',serif;color:${INK};letter-spacing:-.01em;">${escapeHtml(heading)}</h1>
    </td></tr>
    <tr><td style="padding:16px 32px 0 32px;font:400 15px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${INK};">
      ${bodyHtml}
    </td></tr>
    ${
      button
        ? `<tr><td style="padding:24px 32px 0 32px;">
      <a href="${escapeHtml(button.href)}" style="display:inline-block;background:${INK};color:${PAPER};text-decoration:none;font:600 14px/1 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;padding:14px 22px;">${escapeHtml(button.label)}</a>
    </td></tr>`
        : ""
    }
    <tr><td style="padding:28px 32px 28px 32px;">
      <div style="height:1px;background:${LINE};margin-bottom:16px"></div>
      <p style="margin:0;font:400 12px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${MUTED};">
        ${escapeHtml(footerNote ?? "You are receiving this email because of an action taken on your Kiip Mall account.")}
      </p>
      <p style="margin:8px 0 0 0;font:400 12px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${MUTED};">
        Kiip Mall · <a href="{{APP_URL}}" style="color:${CLAY};text-decoration:none;">kiipmall.example</a>
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

export function detailTable(rows: Array<[string, string]>): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-top:1px solid ${LINE};">
  ${rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:10px 0;border-bottom:1px solid ${LINE};font:400 13px/1.4 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${MUTED};">${escapeHtml(label)}</td>
         <td align="right" style="padding:10px 0;border-bottom:1px solid ${LINE};font:500 13px/1.4 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${INK};">${escapeHtml(value)}</td></tr>`,
    )
    .join("")}
</table>`;
}
