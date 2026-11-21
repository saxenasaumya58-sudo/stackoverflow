import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";

export async function createInvoicePdf(invoice, user) {
  const document = new PDFDocument({ size: "A4", margin: 56 });
  const chunks = [];
  const buffer = await new Promise((resolve, reject) => {
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
    document.fontSize(11).fillColor("#66705f").text("COMMONS MEMBERSHIP", {
      characterSpacing: 1,
    });
    document.moveDown(1.5).fillColor("#202620").fontSize(28).text("Invoice");
    document.moveDown(0.5).fontSize(11).text(invoice.invoiceNumber);
    document.moveDown(2).fontSize(12).text(`Billed to: ${user.name}`);
    document.text(user.email);
    document.moveDown(2).fontSize(12).text(`Plan: ${invoice.planName}`);
    document.text(`Invoice date: ${new Date(invoice.date).toLocaleDateString()}`);
    if (invoice.renewalDate)
      document.text(`Renewal date: ${new Date(invoice.renewalDate).toLocaleDateString()}`);
    document.text(`Payment ID: ${invoice.paymentId || "Not available"}`);
    document.moveDown(1.5).fontSize(16).text(`Total paid: INR ${invoice.amount}`);
    document.moveDown(1).fontSize(10).fillColor("#66705f").text("Thank you for supporting the Commons community.");
    document.end();
  });

  const filename = `${invoice.invoiceNumber.replace(/[^A-Za-z0-9_-]/g, "")}.pdf`;
  const directory = path.join(process.cwd(), "private", "invoices");
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, filename), buffer);
  return buffer;
}