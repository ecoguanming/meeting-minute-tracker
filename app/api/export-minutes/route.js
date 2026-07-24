import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { auth } from "@/auth";

function safeFilename(title) {
  return (title || "minutes").replace(/[^a-z0-9]+/gi, "-");
}

async function buildDocx(title, date, minutesText) {
  const paragraphs = [
    new Paragraph({ text: title || "Meeting Minutes", heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: date || "", italics: true })] }),
    new Paragraph({ text: "" }),
  ];
  (minutesText || "").split("\n").forEach((line) => {
    paragraphs.push(new Paragraph({ children: [new TextRun(line)] }));
  });

  const doc = new Document({ sections: [{ children: paragraphs }] });
  return Packer.toBuffer(doc);
}

async function buildPdf(title, date, minutesText) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const margin = 50;
  const maxWidth = pageWidth - margin * 2;
  const bodySize = 11;
  const lineHeight = 15;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function newPage() {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  }

  function wrapLine(text, size, useFont) {
    const words = text.split(" ");
    const lines = [];
    let current = "";
    words.forEach((word) => {
      const trial = current ? `${current} ${word}` : word;
      if (useFont.widthOfTextAtSize(trial, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = trial;
      }
    });
    if (current) lines.push(current);
    return lines.length ? lines : [""];
  }

  function drawText(text, { size = bodySize, useFont = font, gap = lineHeight } = {}) {
    const rawLines = text.split("\n");
    rawLines.forEach((rawLine) => {
      const wrapped = wrapLine(rawLine, size, useFont);
      wrapped.forEach((line) => {
        if (y < margin) newPage();
        page.drawText(line, { x: margin, y, size, font: useFont, color: rgb(0.1, 0.1, 0.1) });
        y -= gap;
      });
    });
  }

  drawText(title || "Meeting Minutes", { size: 18, useFont: boldFont, gap: 24 });
  if (date) drawText(date, { size: 11, gap: 20 });
  drawText(minutesText || "", { size: bodySize, gap: lineHeight });

  return Buffer.from(await pdf.save());
}

export async function POST(request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const { format, title, date, minutesText } = body;

  if (!minutesText || !minutesText.trim()) {
    return Response.json({ error: "No minutes text to export." }, { status: 400 });
  }
  if (format !== "docx" && format !== "pdf") {
    return Response.json({ error: `Unknown format "${format}"` }, { status: 400 });
  }

  try {
    const filename = `${safeFilename(title)}.${format}`;
    if (format === "docx") {
      const buf = await buildDocx(title, date, minutesText);
      return new Response(buf, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    const buf = await buildPdf(title, date, minutesText);
    return new Response(buf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
