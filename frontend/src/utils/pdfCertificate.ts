import { jsPDF } from 'jspdf';
import { Policy, User } from '../types';

export function generateInsuranceCertificate(policy: Policy, user: User | null): void {
  // A4 dimensions: 210mm x 297mm
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Color Palette
  const olivePrimary = [139, 154, 110]; // #8B9A6E
  const darkOlive = [46, 53, 35];      // #2E3523
  const mutedOlive = [90, 102, 68];     // #5A6644
  const sandBg = [247, 242, 235];       // #F7F2EB
  const sandCard = [234, 226, 214];     // #EAE2D6
  const charcoal = [50, 50, 50];

  // 1. Outer Border Frame (Double border)
  doc.setDrawColor(olivePrimary[0], olivePrimary[1], olivePrimary[2]);
  doc.setLineWidth(1.5);
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

  doc.setDrawColor(sandCard[0], sandCard[1], sandCard[2]);
  doc.setLineWidth(0.6);
  doc.rect(11, 11, pageWidth - 22, pageHeight - 22);

  // Decorative corner accents
  doc.setFillColor(olivePrimary[0], olivePrimary[1], olivePrimary[2]);
  doc.circle(11, 11, 2, 'F');
  doc.circle(pageWidth - 11, 11, 2, 'F');
  doc.circle(11, pageHeight - 11, 2, 'F');
  doc.circle(pageWidth - 11, pageHeight - 11, 2, 'F');

  // 2. Top Header Banner
  doc.setFillColor(darkOlive[0], darkOlive[1], darkOlive[2]);
  doc.roundedRect(15, 15, pageWidth - 30, 28, 3, 3, 'F');

  // Header Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('INSUREFLOW INSURANCE GROUP', pageWidth / 2, 26, { align: 'center' });

  doc.setTextColor(olivePrimary[0], olivePrimary[1], olivePrimary[2]);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('OFFICIAL CERTIFICATE OF INSURANCE SCHEDULE', pageWidth / 2, 33, { align: 'center' });

  doc.setTextColor(200, 200, 200);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Group Partner Affinity Coverage • Apex Trust Bank AD&D Protection Plan', pageWidth / 2, 38, { align: 'center' });

  // 3. Policy Number Ribbon
  let y = 50;
  doc.setFillColor(sandBg[0], sandBg[1], sandBg[2]);
  doc.setDrawColor(olivePrimary[0], olivePrimary[1], olivePrimary[2]);
  doc.setLineWidth(0.5);
  doc.roundedRect(15, y, pageWidth - 30, 16, 2, 2, 'FD');

  doc.setTextColor(darkOlive[0], darkOlive[1], darkOlive[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('CERTIFICATE / POLICY NUMBER:', 20, y + 7);

  doc.setTextColor(mutedOlive[0], mutedOlive[1], mutedOlive[2]);
  doc.setFontSize(14);
  doc.text(policy.policyNumber, 85, y + 7.5);

  doc.setFillColor(139, 154, 110);
  doc.roundedRect(pageWidth - 45, y + 3.5, 25, 8, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(policy.status || 'ACTIVE', pageWidth - 32.5, y + 8.5, { align: 'center' });

  // 4. Policyholder & Schedule Information
  y = 72;
  doc.setFillColor(sandCard[0], sandCard[1], sandCard[2]);
  doc.rect(15, y, pageWidth - 30, 7, 'F');
  doc.setTextColor(darkOlive[0], darkOlive[1], darkOlive[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('1. INSURED POLICYHOLDER DETAILS', 18, y + 5);

  y += 11;
  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Valued Customer';
  const email = user?.email || 'N/A';
  const phone = user?.phone || 'N/A';
  const effectiveDate = policy.effectiveDate || new Date().toISOString().split('T')[0];

  const address = policy.addressLine1
    ? `${policy.addressLine1}${policy.addressLine2 ? ', ' + policy.addressLine2 : ''}, ${policy.city || ''}, ${policy.state || ''} ${policy.zipCode || ''}`
    : 'Registered Residential Address on File';

  doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);

  doc.text('Primary Insured:', 18, y);
  doc.setFont('helvetica', 'normal');
  doc.text(fullName, 50, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Effective Date:', 120, y);
  doc.setFont('helvetica', 'normal');
  doc.text(effectiveDate, 150, y);

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Email Address:', 18, y);
  doc.setFont('helvetica', 'normal');
  doc.text(email, 50, y);

  doc.setFont('helvetica', 'bold');
  doc.text('Contact Phone:', 120, y);
  doc.setFont('helvetica', 'normal');
  doc.text(phone, 150, y);

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Mailing Address:', 18, y);
  doc.setFont('helvetica', 'normal');
  doc.text(address, 50, y);

  // 5. Coverage & Underwriting Section
  y += 11;
  doc.setFillColor(sandCard[0], sandCard[1], sandCard[2]);
  doc.rect(15, y, pageWidth - 30, 7, 'F');
  doc.setTextColor(darkOlive[0], darkOlive[1], darkOlive[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('2. COVERAGE BENEFIT & PREMIUM SCHEDULE', 18, y + 5);

  y += 11;
  // Two feature summary cards
  const boxWidth = (pageWidth - 36) / 2;

  // Box A: Cover Sum
  doc.setFillColor(sandBg[0], sandBg[1], sandBg[2]);
  doc.setDrawColor(olivePrimary[0], olivePrimary[1], olivePrimary[2]);
  doc.roundedRect(15, y, boxWidth, 24, 2, 2, 'FD');

  doc.setTextColor(darkOlive[0], darkOlive[1], darkOlive[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('PRINCIPAL SUM COVER BENEFIT', 19, y + 6);

  doc.setTextColor(mutedOlive[0], mutedOlive[1], mutedOlive[2]);
  doc.setFontSize(16);
  doc.text(`$${policy.coverAmount.toLocaleString()} USD`, 19, y + 15);

  doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('24/7 Worldwide Accidental Death & Dismemberment', 19, y + 20);

  // Box B: Monthly Premium
  doc.setFillColor(sandBg[0], sandBg[1], sandBg[2]);
  doc.roundedRect(15 + boxWidth + 6, y, boxWidth, 24, 2, 2, 'FD');

  doc.setTextColor(darkOlive[0], darkOlive[1], darkOlive[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('MONTHLY PREMIUM RATE', 15 + boxWidth + 10, y + 6);

  doc.setTextColor(mutedOlive[0], mutedOlive[1], mutedOlive[2]);
  doc.setFontSize(16);
  doc.text(`$${policy.monthlyPremium.toFixed(2)} / Mo`, 15 + boxWidth + 10, y + 15);

  doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Group Rate: $0.60 per $1,000 of coverage', 15 + boxWidth + 10, y + 20);

  // 6. Beneficiaries Section
  y += 31;
  doc.setFillColor(sandCard[0], sandCard[1], sandCard[2]);
  doc.rect(15, y, pageWidth - 30, 7, 'F');
  doc.setTextColor(darkOlive[0], darkOlive[1], darkOlive[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('3. DESIGNATED BENEFICIARIES ALLOCATION', 18, y + 5);

  y += 10;
  // Table Header
  doc.setFillColor(240, 236, 230);
  doc.rect(15, y, pageWidth - 30, 6, 'F');
  doc.setTextColor(darkOlive[0], darkOlive[1], darkOlive[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('BENEFICIARY NAME', 20, y + 4);
  doc.text('RELATIONSHIP', 85, y + 4);
  doc.text('ALLOCATION SHARE', 145, y + 4);

  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);

  if (policy.beneficiaries && policy.beneficiaries.length > 0) {
    policy.beneficiaries.forEach((b) => {
      doc.text(`${b.firstName} ${b.lastName}`, 20, y);
      doc.text(b.relationship || 'Spouse', 85, y);
      doc.text(`${b.percentage}%`, 145, y);
      y += 5.5;
    });
  } else {
    doc.text('Standard Estate / Legal Heirs as per Law', 20, y);
    doc.text('Estate', 85, y);
    doc.text('100%', 145, y);
    y += 5.5;
  }

  // 7. Terms & Conditions Summary Box
  y += 4;
  doc.setFillColor(sandCard[0], sandCard[1], sandCard[2]);
  doc.rect(15, y, pageWidth - 30, 7, 'F');
  doc.setTextColor(darkOlive[0], darkOlive[1], darkOlive[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('4. POLICY TERMS, VERIFICATION & CONDITIONS', 18, y + 5);

  y += 10;
  doc.setTextColor(70, 70, 70);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const termsText = [
    '• Coverage Scope: Accidental Death & Dismemberment benefits are payable for loss of life, sight, or speech resulting directly from accidental bodily injury.',
    '• Underwriting Eligibility: Issued pursuant to verified customer criteria (ages 18 to 69). Subject to terms of master policy schedule.',
    '• Premium Settlement: Premiums are debited monthly via authorized banking instructions in accordance with partner campaign rate rules.',
    '• Policy Updates: Any modifications to coverage amount, mailing address, or beneficiary shares are validated and preserved in immutable audit records.'
  ];

  termsText.forEach(line => {
    doc.text(line, 18, y);
    y += 4.5;
  });

  // 8. Seal, Signatures & Digital Verification
  y = pageHeight - 48;
  doc.setDrawColor(200, 200, 200);
  doc.line(15, y, pageWidth - 15, y);

  y += 7;
  // Left: Digital Stamp / QR simulation
  doc.setFillColor(darkOlive[0], darkOlive[1], darkOlive[2]);
  doc.roundedRect(18, y, 22, 22, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('OFFICIAL', 29, y + 8, { align: 'center' });
  doc.text('DIGITAL', 29, y + 13, { align: 'center' });
  doc.text('SEAL', 29, y + 18, { align: 'center' });

  // Center: Verification Notice
  doc.setTextColor(charcoal[0], charcoal[1], charcoal[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Digitally Certified by InsureFlow ACT Underwriting Engine', 45, y + 5);
  doc.text(`System Reference Hash: SHA256-${policy.id.substring(0, 16).toUpperCase()}`, 45, y + 10);
  doc.text(`Issued On: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 45, y + 15);
  doc.text('Secure Vault Document Repository • Stored under AWS S3 Encrypted Storage', 45, y + 20);

  // Right: Signature line
  doc.setDrawColor(charcoal[0], charcoal[1], charcoal[2]);
  doc.setLineWidth(0.4);
  doc.line(pageWidth - 65, y + 15, pageWidth - 18, y + 15);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(darkOlive[0], darkOlive[1], darkOlive[2]);
  doc.text('Authorized Underwriter', pageWidth - 41.5, y + 19, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('InsureFlow Underwriting Services', pageWidth - 41.5, y + 23, { align: 'center' });

  // Save the PDF
  doc.save(`InsureFlow_Certificate_${policy.policyNumber}.pdf`);
}
