import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate } from './format.js';

const money = (amount) => new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(amount) || 0);

function addSectionLabel(doc, label, x, y) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text(label.toUpperCase(), x, y);
}

export function downloadInvoicePdf(invoice) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const right = pageWidth - margin;
  const customer = invoice.customer || { name: invoice.customer_name };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(113, 75, 103);
  doc.text('Brightloop Software', margin, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  doc.text('Subscription & billing services | Kochi, Kerala, India', margin, 26);
  doc.text('billing@brightloop.test', margin, 30);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(31, 36, 48);
  doc.text(invoice.status === 'draft' ? 'DRAFT INVOICE' : 'TAX INVOICE', right, 20, { align: 'right' });
  doc.setFontSize(10);
  doc.text(String(invoice.number || ''), right, 26, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(String(invoice.is_overdue ? 'OVERDUE' : invoice.status || '').toUpperCase(), right, 30, { align: 'right' });
  doc.setDrawColor(113, 75, 103);
  doc.setLineWidth(0.7);
  doc.line(margin, 35, right, 35);

  addSectionLabel(doc, 'Bill to', margin, 43);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(31, 36, 48);
  const customerNameLines = doc.splitTextToSize(String(customer.name || '-'), 88);
  doc.text(customerNameLines, margin, 49);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  const customerDetails = [
    customer.company_name,
    customer.billing_address,
    [customer.city, customer.state, customer.country].filter(Boolean).join(', '),
    customer.email,
    customer.phone,
    customer.tax_id ? `GSTIN: ${customer.tax_id}` : '',
  ].filter(Boolean);
  const customerLines = doc.splitTextToSize(customerDetails.join('\n'), 88);
  doc.text(customerLines, margin, 49 + customerNameLines.length * 4 + 2);

  const invoiceDetails = [
    ['Invoice date', formatDate(invoice.invoice_date)],
    ['Due date', formatDate(invoice.due_date)],
    ...(invoice.period_start ? [['Billing period', `${formatDate(invoice.period_start)} - ${formatDate(invoice.period_end)}`]] : []),
    ...(invoice.subscription_number ? [['Subscription', invoice.subscription_number]] : []),
    ...(invoice.plan_name ? [['Plan', invoice.plan_name]] : []),
  ];
  autoTable(doc, {
    startY: 40,
    margin: { left: 111, right: margin },
    tableWidth: pageWidth - margin - 111,
    body: invoiceDetails,
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.2, textColor: [75, 85, 99] },
    columnStyles: { 0: { cellWidth: 27 }, 1: { halign: 'right', textColor: [31, 36, 48] } },
  });

  const itemStart = Math.max(
    75,
    doc.lastAutoTable.finalY + 8,
    51 + customerNameLines.length * 4 + customerLines.length * 4,
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128);
  doc.text('All amounts in INR', margin, itemStart - 3);
  autoTable(doc, {
    startY: itemStart,
    tableWidth: pageWidth - margin * 2,
    head: [['Description', 'Qty', 'Unit price', 'Discount', 'Taxable', 'Taxes', 'Amount']],
    body: (invoice.lines || []).length
      ? invoice.lines.map((line) => [
        line.description || line.product_name || '-',
        String(line.quantity ?? ''),
        money(line.unit_price),
        Number(line.discount_amount) ? `- ${money(line.discount_amount)}` : '-',
        money(line.subtotal),
        (line.taxes || []).map((tax) => tax.name || tax.tax_name).filter(Boolean).join(', ') || '-',
        money(line.total),
      ])
      : [['No line items', '', '', '', '', '', '']],
    theme: 'grid',
    headStyles: { fillColor: [113, 75, 103], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { font: 'helvetica', fontSize: 7, cellPadding: 2.2, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 10, halign: 'right' },
      2: { cellWidth: 20, halign: 'right' },
      3: { cellWidth: 20, halign: 'right' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 35 },
      6: { cellWidth: 27, halign: 'right' },
    },
  });

  const pageBottom = doc.internal.pageSize.getHeight() - 20;
  let summaryY = doc.lastAutoTable.finalY + 8;
  if (summaryY > pageBottom - 50) {
    doc.addPage();
    summaryY = margin;
  }
  const taxRows = (invoice.tax_breakdown || []).map((tax) => [
    tax.name || 'Tax',
    money(tax.base),
    money(tax.amount),
  ]);
  if (taxRows.length) {
    addSectionLabel(doc, 'Tax summary', margin, summaryY + 3);
    autoTable(doc, {
      startY: summaryY + 5,
      margin: { left: margin, right: 100 },
      head: [['Tax', 'Taxable value', 'Tax']],
      body: taxRows,
      theme: 'grid',
      headStyles: { fillColor: [243, 244, 246], textColor: [55, 65, 81] },
      styles: { font: 'helvetica', fontSize: 7, cellPadding: 2 },
    });
    summaryY = Math.max(summaryY, doc.lastAutoTable.finalY);
  }

  const discountRows = (invoice.discounts || []).map((discount) => [
    discount.name || 'Discount',
    `- ${money(discount.amount)}`,
  ]);
  if (discountRows.length) {
    if (summaryY + 18 > pageBottom) {
      doc.addPage();
      summaryY = margin;
    }
    addSectionLabel(doc, 'Discounts', margin, summaryY + 8);
    autoTable(doc, {
      startY: summaryY + 10,
      margin: { left: margin, right: 100 },
      body: discountRows,
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.5, textColor: [75, 85, 99] },
      columnStyles: { 1: { halign: 'right' } },
    });
    summaryY = Math.max(summaryY, doc.lastAutoTable.finalY);
  }

  const balance = invoice.status === 'cancelled'
    ? 0
    : Number(invoice.balance_due ?? (Number(invoice.total_amount) - Number(invoice.amount_paid)));
  const totalRows = [
    ...(Number(invoice.discount_amount) > 0 ? [['Discount', `- ${money(invoice.discount_amount)}`]] : []),
    ['Untaxed amount', money(invoice.untaxed_amount)],
    ['Taxes', money(invoice.tax_amount)],
    ['Total', money(invoice.total_amount)],
    ['Amount paid', money(invoice.amount_paid)],
    ['Balance due', money(balance)],
  ];
  if (summaryY + 50 > pageBottom) {
    doc.addPage();
    summaryY = margin;
  }
  autoTable(doc, {
    startY: summaryY + 5,
    margin: { left: 100, right: margin },
    body: totalRows,
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2, textColor: [31, 36, 48] },
    columnStyles: { 0: { cellWidth: 45 }, 1: { halign: 'right' } },
    didParseCell: (data) => {
      if (data.section === 'body' && ['Total', 'Balance due'].includes(data.row.raw[0])) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(`Brightloop Software | Invoice ${invoice.number}`, margin, 287);
    doc.text(`${page} / ${pageCount}`, right, 287, { align: 'right' });
  }

  const filename = String(invoice.number || invoice.id || 'invoice').replace(/[^a-zA-Z0-9._-]+/g, '-');
  doc.save(`invoice-${filename}.pdf`);
}
