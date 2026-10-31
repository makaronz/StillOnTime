/**
 * Characters that make a spreadsheet treat a cell as a formula when the file is
 * opened in Excel, LibreOffice or Google Sheets. Tab, carriage return and line
 * feed are included because some applications skip leading whitespace before
 * checking (OWASP lists all three).
 */
const FORMULA_TRIGGER = /^[=+\-@\t\r\n]/;

/**
 * Formats a value as a quoted CSV field (RFC 4180): the whole field is wrapped
 * in double quotes and embedded double quotes are doubled.
 *
 * Text that would be evaluated as a formula is prefixed with a single quote so
 * it is displayed literally (OWASP "CSV injection"). Mail subjects and senders
 * are controlled by whoever sent the mail, so every exported field goes through
 * this.
 */
export const toCsvCell = (value: unknown): string => {
  if (value === null || value === undefined) return '""';
  const text = value instanceof Date ? value.toISOString() : String(value);
  const safe = FORMULA_TRIGGER.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};
