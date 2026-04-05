import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PaymentRecord {
  _id: string;
  from: string;
  to: string;
  amount: number;
  status: string;
  note?: string;
  locationTag?: { label?: string; city?: string };
  createdAt?: string;
  paidAt?: string;
}

interface GroupContext {
  id: string;
  name: string;
  members: Array<{ id: string; name: string; color?: string }>;
}

/**
 * Generates a professional PDF Receipt for a PayMatrix Settlement Transaction.
 * Client-side only.
 */
export function generateTransactionReceipt(payment: PaymentRecord, group: GroupContext) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const primaryColor: [number, number, number] = [99, 102, 241]; // indigo-500
  const secondaryColor: [number, number, number] = [71, 85, 105]; // slate-600
  const successColor: [number, number, number] = [16, 185, 129]; // emerald-500

  const payerName = group.members.find(m => m.id === payment.from)?.name || payment.from;
  const receiverName = group.members.find(m => m.id === payment.to)?.name || payment.to;
  const dateStr = payment.paidAt || payment.createdAt || new Date().toISOString();
  const formattedDate = new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  // --- HEADER SECTION ---
  doc.setFillColor( primaryColor[0], primaryColor[1], primaryColor[2] );
  doc.rect(0, 0, 210, 40, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(255, 255, 255);
  doc.text('PayMatrix', 15, 25);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255, 0.8 as any);
  doc.text('Smart Settlement Optimization', 15, 32);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('TRANSACTION RECEIPT', 210 - 15, 25, { align: 'right' });

  // --- DETAILS BAR ---
  const startY = 60;
  doc.setFontSize(9);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('GROUP NAME', 15, startY);
  doc.text('TRANSACTION REFERENCE', 210 - 15, startY, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(group.name.toUpperCase(), 15, startY + 6);
  doc.setFontSize(9);
  doc.text(payment._id.toUpperCase(), 210 - 15, startY + 6, { align: 'right' });

  // --- SETTLEMENT TABLE ---
  autoTable(doc, {
    startY: startY + 15,
    theme: 'striped',
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    styles: { cellPadding: 5 },
    columnStyles: {
      2: { halign: 'center', fontStyle: 'bold' }
    },
    head: [['FROM', 'TO', 'STATUS']],
    body: [
      [payerName, receiverName, payment.status.toUpperCase()]
    ],
  });

  const tableFinalY = (doc as any).lastAutoTable.finalY || startY + 40;

  // --- AMOUNT BOX ---
  const amountBoxY = tableFinalY + 15;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, amountBoxY, 180, 30, 3, 3, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('Amount Settled Successfully', 20, amountBoxY + 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`INR ${payment.amount.toLocaleString('en-IN')}`, 210 - 20, amountBoxY + 19, { align: 'right' });

  // --- ADDITIONAL INFO ---
  let nextY = amountBoxY + 45;
  doc.setFontSize(10);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.setFont('helvetica', 'normal');
  doc.text('Date & Time:', 15, nextY);
  doc.setTextColor(15, 23, 42);
  doc.text(formattedDate, 45, nextY);

  if (payment.locationTag?.label || payment.locationTag?.city) {
    nextY += 8;
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text('Location:', 15, nextY);
    doc.setTextColor(15, 23, 42);
    const locStr = [payment.locationTag.label, payment.locationTag.city].filter(Boolean).join(', ');
    doc.text(locStr, 45, nextY);
  }

  if (payment.note) {
    nextY += 8;
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text('Notes:', 15, nextY);
    doc.setTextColor(15, 23, 42);
    doc.text(payment.note, 45, nextY);
  }

  // --- SEAL ---
  const sealY = nextY + 20;
  doc.setDrawColor(successColor[0], successColor[1], successColor[2]);
  doc.setLineWidth(1);
  doc.circle(210 - 45, sealY + 20, 18, 'S');
  doc.setFontSize(12);
  doc.setTextColor(successColor[0], successColor[1], successColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('SETTLED', 210 - 45, sealY + 18, { align: 'center', angle: -15 });
  doc.setFontSize(8);
  doc.text('SUCCESSFUL', 210 - 45, sealY + 23, { align: 'center', angle: -15 });

  // --- FOOTER ---
  const footerY = 280;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('This receipt was generated by PayMatrix Algorithm. Payment processed via Razorpay.', 15, footerY);
  doc.text('No physical signature required.', 15, footerY + 4);

  doc.save(`PayMatrix_Receipt_${payment._id.slice(-6)}.pdf`);
}
