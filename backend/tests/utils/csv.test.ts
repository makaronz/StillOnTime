import { toCsvCell } from "../../src/utils/csv";

describe("toCsvCell", () => {
  it("wraps values in quotes and doubles embedded quotes", () => {
    expect(toCsvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it("keeps commas and newlines inside the quoted field", () => {
    expect(toCsvCell("Callsheet, dzien 4")).toBe('"Callsheet, dzien 4"');
  });

  it("renders null and undefined as an empty quoted field", () => {
    expect(toCsvCell(null)).toBe('""');
    expect(toCsvCell(undefined)).toBe('""');
  });

  it("serialises dates as ISO strings", () => {
    expect(toCsvCell(new Date("2026-01-02T03:04:05.000Z"))).toBe(
      '"2026-01-02T03:04:05.000Z"'
    );
  });

  // Mail subject and sender are controlled by whoever sent the mail. A field
  // that starts with one of these characters is evaluated as a formula when the
  // exported file is opened in Excel, LibreOffice or Google Sheets.
  it.each(["=HYPERLINK(\"http://evil\",\"x\")", "+1+1", "-2+3", "@SUM(1)", "\t=1", "\r=1", "\n=1"])(
    "neutralises formula injection for %j",
    (payload) => {
      const cell = toCsvCell(payload);
      expect(cell.startsWith(`"'`)).toBe(true);
    }
  );

  it("does not alter ordinary text that merely contains a formula character", () => {
    expect(toCsvCell("a=b")).toBe('"a=b"');
    expect(toCsvCell("2026-01-02")).toBe('"2026-01-02"');
  });
});
