export type ExportTable = {
  title: string;
  subtitle: string; // period
  businessName: string;
  columns: string[];
  rows: (string | number)[][];
  totals?: [string, string][];
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(t: ExportTable): string {
  const lines = [t.columns.map(csvEscape).join(","), ...t.rows.map((r) => r.map(csvEscape).join(","))];
  if (t.totals?.length) {
    lines.push("");
    t.totals.forEach(([k, v]) => lines.push([csvEscape(k), csvEscape(v)].join(",")));
  }
  return "\uFEFF" + lines.join("\r\n");
}

export function exportCsv(t: ExportTable) {
  downloadBlob(new Blob([toCsv(t)], { type: "text/csv;charset=utf-8" }), `${slug(t.title)}-${slug(t.subtitle)}.csv`);
}

export async function exportPdf(t: ExportTable) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: t.columns.length > 6 ? "landscape" : "portrait" });
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(11, 13, 15);
  doc.rect(0, 0, w, 26, "F");
  doc.setTextColor(245, 158, 11);
  doc.setFontSize(16);
  doc.text(t.businessName, 14, 12);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text(`${t.title} — ${t.subtitle}`, 14, 20);
  doc.setTextColor(0, 0, 0);
  autoTable(doc, {
    startY: 32,
    head: [t.columns],
    body: t.rows.map((r) => r.map((c) => String(c))),
    headStyles: { fillColor: [245, 158, 11], textColor: [11, 13, 15] },
    styles: { fontSize: 8 },
    didDrawPage: () => {
      const h = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`Generated ${new Date().toLocaleString()}`, 14, h - 8);
      doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, w - 30, h - 8);
    },
  });
  if (t.totals?.length) {
    autoTable(doc, {
      // @ts-expect-error lastAutoTable is added by the plugin
      startY: (doc.lastAutoTable?.finalY ?? 40) + 6,
      body: t.totals,
      theme: "plain",
      styles: { fontSize: 9, fontStyle: "bold" },
    });
  }
  downloadBlob(doc.output("blob"), `${slug(t.title)}-${slug(t.subtitle)}.pdf`);
}

export async function exportDocx(t: ExportTable) {
  const d = await import("docx");
  const cell = (text: string, bold = false) =>
    new d.TableCell({ children: [new d.Paragraph({ children: [new d.TextRun({ text, bold, size: 18 })] })] });
  const table = new d.Table({
    width: { size: 100, type: d.WidthType.PERCENTAGE },
    rows: [
      new d.TableRow({ tableHeader: true, children: t.columns.map((c) => cell(c, true)) }),
      ...t.rows.map((r) => new d.TableRow({ children: r.map((c) => cell(String(c))) })),
    ],
  });
  const children: (InstanceType<typeof d.Paragraph> | InstanceType<typeof d.Table>)[] = [
    new d.Paragraph({ heading: d.HeadingLevel.TITLE, children: [new d.TextRun(t.businessName)] }),
    new d.Paragraph({ heading: d.HeadingLevel.HEADING_1, children: [new d.TextRun(t.title)] }),
    new d.Paragraph({ children: [new d.TextRun({ text: t.subtitle, italics: true })] }),
    new d.Paragraph({ children: [new d.TextRun(`Generated ${new Date().toLocaleString()}`)] }),
    table,
  ];
  if (t.totals?.length) {
    children.push(new d.Paragraph({ heading: d.HeadingLevel.HEADING_2, children: [new d.TextRun("Totals")] }));
    t.totals.forEach(([k, v]) => children.push(new d.Paragraph({ children: [new d.TextRun({ text: `${k}: `, bold: true }), new d.TextRun(v)] })));
  }
  const doc = new d.Document({ sections: [{ children }] });
  const blob = await d.Packer.toBlob(doc);
  downloadBlob(blob, `${slug(t.title)}-${slug(t.subtitle)}.docx`);
}
