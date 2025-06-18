import PDFDocument from 'pdfkit';

export const generatePdf = (inv) => new Promise((resolve) => {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const bufs = [];
  
  doc.on('data', d => bufs.push(d));
  doc.on('end', () => resolve(Buffer.concat(bufs)));

  // Header
  doc.fontSize(20).text('INVOICE', { align: 'right' });
  doc.moveDown();
  
  // Date
  doc.fontSize(12).text(`Date: ${new Date().toLocaleDateString()}`);
  doc.moveDown();
  
  // Client Info
  doc.text(`Bill To: ${inv.client}`);
  doc.text(inv.address);
  doc.moveDown();
  
  // Description
  doc.text('Description:');
  doc.text(inv.description);
  doc.moveDown();
  
  // Summary
  if (inv.summary) {
    doc.text(`Summary: ${inv.summary}`);
    doc.moveDown();
  }
  
  // Total
  doc.fontSize(16).text(`Total: $${inv.price}`, { align: 'right' });
  
  doc.end();
}); 