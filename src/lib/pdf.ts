import type { ItineraryPlan } from "@/lib/rag";

/**
 * Renders the generated itinerary to a PDF in the browser using jsPDF.
 * Imported dynamically so the library never lands in the server bundle.
 */
export async function downloadItineraryPdf(plan: ItineraryPlan, userName?: string | null): Promise<string> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = 0;

  const INK: [number, number, number] = [16, 26, 34];
  const MUTED: [number, number, number] = [96, 108, 118];
  const ACCENT: [number, number, number] = [207, 109, 13];

  function ensureSpace(needed: number) {
    if (cursorY + needed > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
    }
  }

  // Header band
  doc.setFillColor(8, 19, 27);
  doc.rect(0, 0, pageWidth, 96, "F");
  doc.setFillColor(...ACCENT);
  doc.rect(0, 92, pageWidth, 4, "F");

  doc.setTextColor(255, 214, 150);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("MUSAAFIR AI  ·  TRAVEL ITINERARY", margin, 40);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(21);
  doc.text(plan.title, margin, 68);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(206, 214, 220);
  doc.text(
    `${plan.destinationName}, ${plan.state} · ${plan.days} days · ${plan.travellers} travellers · ${plan.pace} pace`,
    margin,
    83,
  );

  cursorY = 128;

  // Overview
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text("Overview", margin, cursorY);
  cursorY += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  const overviewLines = doc.splitTextToSize(plan.overview, contentWidth) as string[];
  doc.text(overviewLines, margin, cursorY);
  cursorY += overviewLines.length * 13 + 8;

  doc.setFontSize(9.5);
  doc.text(`Best time to visit: ${plan.bestTime}`, margin, cursorY);
  cursorY += 14;
  doc.text(
    `Recommended stay: ${plan.hotel.name} (${plan.hotel.area}) - ${plan.hotel.tier}, Rs ${plan.hotel.pricePerNight}/night`,
    margin,
    cursorY,
  );
  cursorY += 22;

  // Days
  for (const day of plan.plan) {
    ensureSpace(90);
    doc.setFillColor(247, 243, 236);
    doc.roundedRect(margin, cursorY - 12, contentWidth, 24, 6, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(day.title, margin + 10, cursorY + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(`Stay: ${day.stay.name}`, pageWidth - margin - 10, cursorY + 4, { align: "right" });
    cursorY += 28;

    for (const item of day.schedule) {
      ensureSpace(34);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...ACCENT);
      doc.text(item.time, margin, cursorY);

      doc.setTextColor(...INK);
      doc.setFontSize(9.5);
      const activityLines = doc.splitTextToSize(item.activity, contentWidth * 0.42) as string[];
      doc.text(activityLines, margin + 46, cursorY);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MUTED);
      doc.setFontSize(8.8);
      const detailLines = doc.splitTextToSize(`${item.detail}  ·  ${item.cost}`, contentWidth * 0.44) as string[];
      doc.text(detailLines, margin + 46 + contentWidth * 0.44, cursorY);

      const rows = Math.max(activityLines.length, detailLines.length);
      cursorY += rows * 11.5 + 8;
    }

    ensureSpace(26);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(`Food plan: ${day.meals.join("  |  ")}`, margin, cursorY);
    cursorY += 22;
  }

  // Budget
  ensureSpace(120);
  cursorY += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text("Estimated budget", margin, cursorY);
  cursorY += 16;

  doc.setFontSize(9.5);
  for (const line of plan.budgetBreakdown) {
    ensureSpace(20);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    const label = `${line.label}  (${line.note})`;
    doc.text(doc.splitTextToSize(label, contentWidth * 0.72) as string[], margin, cursorY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...INK);
    doc.text(`Rs ${line.amount.toLocaleString("en-IN")}`, pageWidth - margin, cursorY, { align: "right" });
    cursorY += 15;
  }

  ensureSpace(30);
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.8);
  doc.line(margin, cursorY - 6, pageWidth - margin, cursorY - 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(`Total per person: Rs ${plan.totalPerPerson.toLocaleString("en-IN")}`, margin, cursorY + 8);
  doc.text(`Group total (${plan.travellers}): Rs ${plan.totalForGroup.toLocaleString("en-IN")}`, pageWidth - margin, cursorY + 8, {
    align: "right",
  });
  cursorY += 34;

  // Tips
  if (plan.tips.length) {
    ensureSpace(70);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text("Local tips", margin, cursorY);
    cursorY += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.3);
    for (const tip of plan.tips) {
      ensureSpace(30);
      doc.setTextColor(...ACCENT);
      doc.setFont("helvetica", "bold");
      doc.text(tip.category.toUpperCase(), margin, cursorY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MUTED);
      const lines = doc.splitTextToSize(tip.text, contentWidth - 90) as string[];
      doc.text(lines, margin + 88, cursorY);
      cursorY += lines.length * 12 + 6;
    }
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140, 150, 158);
    doc.text(
      `Generated by Musaafir AI${userName ? ` for ${userName}` : ""} · ${new Date().toLocaleString("en-IN")} · grounded in the destination CONTEXT knowledge base`,
      margin,
      pageHeight - 24,
    );
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 24, { align: "right" });
  }

  const fileName = `musaafir-${plan.destinationSlug}-${plan.days}days.pdf`;
  doc.save(fileName);
  return fileName;
}
