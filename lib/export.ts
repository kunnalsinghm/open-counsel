import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ChoiceListItem, StudentProfileInput } from "@/lib/types";

export function exportCsv(items: ChoiceListItem[]) {
  const header = [
    "Preference",
    "Institute",
    "Branch",
    "Quota",
    "Category",
    "Opening Rank",
    "Closing Rank",
    "Risk Band",
    "Confidence",
  ];
  const rows = items.map((i) => [
    i.preferenceNumber,
    i.instituteName,
    i.branchShortCode,
    i.quota,
    i.category,
    i.historicalOpeningRank,
    i.historicalClosingRank,
    i.riskBand,
    i.confidence,
  ]);
  const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, "opencounsel-choice-list.csv");
}

export function exportPdf(items: ChoiceListItem[], profile: StudentProfileInput) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("OpenCounsel — Choice List Report", 14, 18);
  doc.setFontSize(10);
  doc.text(
    `Rank: ${profile.categoryRank ?? profile.crlRank}   Category: ${profile.category}   Exam: ${profile.examSystemCode}   Generated: ${new Date().toLocaleDateString(
      "en-IN"
    )}`,
    14,
    26
  );

  autoTable(doc, {
    startY: 32,
    head: [["#", "Institute", "Branch", "Quota", "Cat.", "Open", "Close", "Band"]],
    body: items.map((i) => [
      i.preferenceNumber,
      i.instituteName,
      i.branchShortCode,
      i.quota,
      i.category,
      i.historicalOpeningRank,
      i.historicalClosingRank,
      i.riskBand,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [79, 70, 229] },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? 32;
  doc.setFontSize(8);
  doc.text(
    "Disclaimer: This report is generated from historical counseling data and does not guarantee " +
      "admission. OpenCounsel is an independent tool, not affiliated with JoSAA, CSAB, MCC, NTA, or " +
      "any counseling authority. Always verify against the latest official notification.",
    14,
    finalY + 10,
    { maxWidth: 180 }
  );

  doc.save("opencounsel-choice-list.pdf");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
