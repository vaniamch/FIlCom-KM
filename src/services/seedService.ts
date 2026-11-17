import { collection, getDocs, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Category, KnowledgeArticle, DocumentItem, CampusEvent, LessonLearned } from '../types';

export const DIVISION_CATEGORIES: Category[] = [
  {
    id: 'cat_leader',
    name: 'Leader',
    description: 'Strategic vision, executive decision-making, committee alignment, and faculty administration relations.',
    icon: 'Crown',
    slug: 'leader',
    articleCount: 2,
  },
  {
    id: 'cat_secretary',
    name: 'Secretary',
    description: 'Executive meeting minutes, official correspondence, documentation archives, and constitutional records.',
    icon: 'FileText',
    slug: 'secretary',
    articleCount: 2,
  },
  {
    id: 'cat_treasurer',
    name: 'Treasurer',
    description: 'Budget allocations, financial ledgers, tax invoices, reimbursement protocols, and fiscal audit compliance.',
    icon: 'DollarSign',
    slug: 'treasurer',
    articleCount: 2,
  },
  {
    id: 'cat_event_management',
    name: 'Event Management',
    description: 'Event proposals, run-of-shows, stage timelines, room reservations, and operational execution.',
    icon: 'Calendar',
    slug: 'event-management',
    articleCount: 3,
  },
  {
    id: 'cat_public_relations',
    name: 'Public Relations',
    description: 'External guest liaisons, press releases, partner communications, and audience engagement.',
    icon: 'Megaphone',
    slug: 'public-relations',
    articleCount: 2,
  },
  {
    id: 'cat_logistics_equipment',
    name: 'Logistics & Equipment',
    description: 'AV systems, venue setup, equipment loan registry, transportation, and inventory returns.',
    icon: 'Package',
    slug: 'logistics-equipment',
    articleCount: 3,
  },
  {
    id: 'cat_security',
    name: 'Security',
    description: 'Crowd safety protocols, campus police clearance, access badges, and emergency response procedures.',
    icon: 'Shield',
    slug: 'security',
    articleCount: 2,
  },
  {
    id: 'cat_catering',
    name: 'Catering',
    description: 'Food & beverage procurement, attendee dietary restrictions, meal distribution, and refreshment setups.',
    icon: 'Utensils',
    slug: 'catering',
    articleCount: 2,
  },
  {
    id: 'cat_multimedia',
    name: 'Multimedia',
    description: 'Brand asset guidelines, photography, live streaming, graphic design, and video documentation.',
    icon: 'Film',
    slug: 'multimedia',
    articleCount: 2,
  },
  {
    id: 'cat_fundraising',
    name: 'Fundraising',
    description: 'Corporate sponsorship packages, alumni donations, society merchandise sales, and ticket revenues.',
    icon: 'TrendingUp',
    slug: 'fundraising',
    articleCount: 2,
  },
];

function escapePdfText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildValidPdfDataUrl(title: string, lines: string[]): string {
  const safeLines = [title, '', ...lines].slice(0, 26);
  const textCommands = [
    'BT',
    '/F1 13 Tf',
    '50 745 Td',
    `(${escapePdfText(safeLines[0])}) Tj`,
    '/F1 10 Tf',
    ...safeLines.slice(1).map((line) => `0 -18 Td (${escapePdfText(line)}) Tj`),
    'ET',
  ].join('\n');

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${textCommands.length} >>\nstream\n${textCommands}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return `data:application/pdf;base64,${btoa(pdf)}`;
}

function buildUtf8DataUrl(mime: string, content: string): string {
  const bytes = new TextEncoder().encode(content);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function getRealSeedAttachments() {
  const agmPdf = buildValidPdfDataUrl('FilKom Day Committee - AGM Election Ballot Template', [
    'Document Code: SEC-AGM-2026 | Division: Secretary',
    '1. Quorum Verification: At least 50% + 1 active members present.',
    '2. Executive Nominations: President, Vice President, Secretary, Treasurer.',
    '3. Secret Ballot Counter Sign-off: Observer 1 & Observer 2.',
    '4. Certification: Outgoing Chair & Faculty Advisor signature required.',
  ]);

  const budgetCsv = buildUtf8DataUrl(
    'text/csv',
    [
      'Item Code,Division,Expense Category,Description,Qty,Unit Cost (IDR),Total (IDR),Approval Status',
      'BUD-001,Event Management,Venue & Stage,Main Auditorium Sound & Lighting Rider,1,4500000,4500000,Approved',
      'BUD-002,Catering,Refreshments,Committee & Guest Meal Boxes (Halal/Veg),180,35000,6300000,Approved',
      'BUD-003,Multimedia,Production,Banners Lanyards and Stage Backdrop Print,1,2200000,2200000,Pending Review',
      'BUD-004,Security,Safety,Wristbands and Medical Kit Supplies,1,850000,850000,Approved',
    ].join('\n')
  );

  const handoverPdf = buildValidPdfDataUrl('Committee Handover Protocol & Executive Asset Checklist', [
    'Division: Leader | FilCom Knowledge Hub Institutional Archive',
    'Week 1: Joint shadowing session between outgoing and incoming chairs.',
    'Week 2: Transfer of social media, domain, and cloud repository credentials.',
    'Week 3: Student Affairs Dean introduction & fiscal ledger verification.',
    'Week 4: Final inventory sign-off for AV equipment and physical assets.',
  ]);

  const brandPdf = buildValidPdfDataUrl('Official Brand Identity & Social Media Graphic Kit', [
    'Division: Multimedia | FilKom Day Committee Brand Standards',
    'Primary Palette: Navy (#0B132B), Indigo (#1D4ED8), Sky (#38BDF8)',
    'Typography: Plus Jakarta Sans (Display & Body), JetBrains Mono (Codes)',
    'Instagram Feed: 1080x1350px (4:5) | Live Stream: 1080p60 at 6000 kbps CBR',
  ]);

  const timelineRtf = buildUtf8DataUrl(
    'application/msword',
    `{\\rtf1\\ansi\\deff0
{\\b FilKom Day Committee - Event Timeline & Run-of-Show Master Sheet 2026}\\par
Division: Event Management\\par\\par
07:00 - 08:00 | Venue Gate Open, AV Soundcheck, Security Briefing\\par
08:00 - 09:00 | Participant Registration & Wristband Verification\\par
09:00 - 09:30 | Opening Ceremony & Dean Keynote Remarks\\par
09:30 - 12:00 | Main Program Session & Technical Showcase\\par
12:00 - 13:00 | Catering Distribution & Networking Break\\par
13:00 - 16:30 | Finals, Judging Panel & Awarding Ceremony\\par
16:30 - 17:30 | Equipment Return Checklist & Venue Inspection\\par
}`
  );

  return {
    agmPdf,
    budgetCsv,
    handoverPdf,
    brandPdf,
    timelineRtf,
  };
}

async function repairLegacyPlaceholderUrls() {
  const assets = getRealSeedAttachments();

  const docRepairs: Record<string, Partial<DocumentItem>> = {
    doc_budget_template: {
      fileUrl: assets.budgetCsv,
      fileName: '2026_Event_Budget_Template.csv',
      fileType: 'csv',
      fileSize: assets.budgetCsv.length,
    },
    doc_handover_checklist: {
      fileUrl: assets.handoverPdf,
      fileName: 'Handover_Protocol_Checklist.pdf',
      fileType: 'pdf',
      fileSize: assets.handoverPdf.length,
    },
    doc_brand_assets: {
      fileUrl: assets.brandPdf,
      fileName: 'Brand_Identity_Guidelines.pdf',
      fileType: 'pdf',
      fileSize: assets.brandPdf.length,
    },
    doc_event_timeline: {
      fileUrl: assets.timelineRtf,
      fileName: 'Event_Timeline_2026.doc',
      fileType: 'doc',
      fileSize: assets.timelineRtf.length,
    },
  };

  for (const [docId, patch] of Object.entries(docRepairs)) {
    try {
      const ref = doc(db, 'documents', docId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as DocumentItem;
        if (data.fileUrl?.includes('campus-hub.edu')) {
          await updateDoc(ref, patch);
        }
      }
    } catch {
      // Non-blocking repair
    }
  }

  const artRepairs: Record<string, Partial<KnowledgeArticle>> = {
    art_agm_sop: {
      sopNumber: 'SOP-01',
      department: 'Secretary',
      knowledgeType: 'SOP',
      reviewer: 'Vice Chair',
      approver: 'Executive Chair',
      approvedBy: 'Executive Board',
      revisionNumber: '1.0',
      attachments: [
        {
          name: 'AGM_Election_Ballot_Template.pdf',
          url: assets.agmPdf,
          size: assets.agmPdf.length,
          type: 'pdf',
        },
      ],
    },
    art_budget_sop: {
      sopNumber: 'SOP-02',
      department: 'Treasurer',
      knowledgeType: 'SOP',
      reviewer: 'General Secretary',
      approver: 'Faculty Advisor',
      approvedBy: 'Executive Board',
      revisionNumber: '1.0',
      attachments: [
        {
          name: 'Budget_Requisition_Form_2026.csv',
          url: assets.budgetCsv,
          size: assets.budgetCsv.length,
          type: 'csv',
        },
      ],
    },
    art_security_protocol: {
      sopNumber: 'SOP-03',
      department: 'Security',
      knowledgeType: 'SOP',
      reviewer: 'Event Management Lead',
      approver: 'Executive Chair',
      approvedBy: 'Executive Board',
      revisionNumber: '1.0',
    },
  };

  for (const [artId, patch] of Object.entries(artRepairs)) {
    try {
      const ref = doc(db, 'knowledge', artId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as KnowledgeArticle;
        const hasPlaceholder = data.attachments?.some((a) =>
          a.url?.includes('campus-hub.edu')
        );
        if (hasPlaceholder || !data.sopNumber) {
          await updateDoc(ref, patch);
        }
      }
    } catch {
      // Non-blocking repair
    }
  }
}

async function migrateLegacyOwnershipRecords(defaultOwnerUid: string) {
  const collectionsToMigrate = ['knowledge', 'documents', 'events', 'lessons_learned'];
  for (const colName of collectionsToMigrate) {
    try {
      const snap = await getDocs(collection(db, colName));
      for (const docSnap of snap.docs) {
        const data = docSnap.data() as Record<string, any>;
        if (!data.createdBy) {
          await updateDoc(doc(db, colName, docSnap.id), {
            createdBy: data.authorId || defaultOwnerUid,
          }).catch(() => {});
        }
      }
    } catch {
      // Non-blocking migration
    }
  }
}

export async function checkAndSeedDatabase(
  authorId: string,
  authorName: string,
  isAdmin: boolean = false
) {
  if (!isAdmin) {
    // Only administrators can initialize categories or migrate legacy database records
    return;
  }

  try {
    // 1. Ensure all 10 Division Categories exist in Firestore
    for (const cat of DIVISION_CATEGORIES) {
      const catRef = doc(db, 'categories', cat.id);
      const snap = await getDoc(catRef);
      if (!snap.exists()) {
        await setDoc(catRef, {
          ...cat,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // 2. Check if knowledge articles exist
    const artSnap = await getDocs(collection(db, 'knowledge'));
    if (!artSnap.empty) {
      await repairLegacyPlaceholderUrls();
      await migrateLegacyOwnershipRecords(authorId);
      return;
    }

    console.log('Seeding initial campus institutional knowledge records across 10 divisions...');
    const assets = getRealSeedAttachments();

    // 3. Initial Articles & SOPs mapped across divisions
    const articles: KnowledgeArticle[] = [
      {
        id: 'art_agm_sop',
        title: 'SOP-01: Annual General Meeting (AGM) Procedure & Voting Rules',
        sopNumber: 'SOP-01',
        categoryId: 'cat_secretary',
        categoryName: 'Secretary',
        department: 'Secretary',
        knowledgeType: 'SOP',
        summary: 'Standard operating procedure for convening the Annual General Meeting, establishing a quorum, and administering executive elections.',
        purpose: 'Ensure transparent, constitutional execution of the Annual General Meeting and executive leadership elections.',
        scope: 'Applies to all registered committee members, Executive Board, and neutral election observers.',
        responsibilities: 'General Secretary issues notice and certifies minutes; Treasurer presents fiscal report; Observers verify ballots.',
        references: 'FilKom Student Organization Constitution Art. IV; Election Code 2026.',
        reviewer: 'Vice Chair',
        approver: 'Executive Chair',
        approvedBy: authorName,
        approvedAt: '2026-09-25T10:00:00.000Z',
        effectiveDate: '2026-10-01',
        reviewDate: '2027-09-01',
        revisionNumber: '1.0',
        content: `### Purpose & Scope
This Standard Operating Procedure defines the mandatory steps required to convene, execute, and validate proceedings during the Student Organization's Annual General Meeting (AGM).

### Quorum Requirements
1. A valid quorum consists of at least 50% plus one of all registered active members.
2. In the absence of a quorum within 30 minutes of the scheduled call to order, the session chair may adjourn or conduct informal informational briefings only.

### Step-by-Step Procedure
1. **Notice Period**: Issue official meeting notice and agenda at least 14 days prior to all registered members via email.
2. **Nomination Slate**: Open executive nominations 10 days before the AGM. Nominations close 72 hours prior to the ballot.
3. **Financial Statement Presentation**: The Treasurer must present the audited fiscal year report including balance sheets and expense allocations.
4. **Secret Ballot Voting**: For all contested executive positions, votes are cast via verified ballot.
5. **Minute Ratification**: The General Secretary drafts official meeting minutes to be certified by the outgoing President and posted within 5 calendar days.`,
        tags: ['SOP', 'Elections', 'Secretary', 'Constitution'],
        createdBy: authorId,
        authorId,
        authorName,
        status: 'published',
        viewsCount: 142,
        bookmarkCount: 18,
        isSOP: true,
        targetCommittee: 'Secretary',
        sopSteps: [
          { step: 1, title: 'Notice Period', detail: 'Issue formal notification 14 calendar days prior with attached agenda.', pic: 'General Secretary', notes: 'Attach provisional agenda & quorum list' },
          { step: 2, title: 'Nomination Slate', detail: 'Accept candidate nominations up to 72 hours before the election window.', pic: 'Election Committee', notes: 'Verify candidate GPA & active membership' },
          { step: 3, title: 'Audited Financial Report', detail: 'Treasurer presents fiscal balance sheet and asset disclosures.', pic: 'Treasurer', notes: 'Provide printed summary sheets' },
          { step: 4, title: 'Ballot Execution', detail: 'Conduct confidential vote counting supervised by two neutral observers.', pic: 'Neutral Observers', notes: 'Record tally in Ballot Template' },
          { step: 5, title: 'Minute Certification', detail: 'Sign and publish certified minutes to the central repository within 5 days.', pic: 'General Secretary', notes: 'Upload signed PDF to Document Repository' },
        ],
        attachments: [
          { name: 'AGM_Election_Ballot_Template.pdf', url: assets.agmPdf, size: assets.agmPdf.length, type: 'pdf' },
        ],
        createdAt: '2026-09-15T09:00:00.000Z',
        updatedAt: '2026-10-01T14:20:00.000Z',
      },
      {
        id: 'art_budget_sop',
        title: 'SOP-02: Organization Event Budget Requisition & Reimbursement Protocol',
        sopNumber: 'SOP-02',
        categoryId: 'cat_treasurer',
        categoryName: 'Treasurer',
        department: 'Treasurer',
        knowledgeType: 'SOP',
        summary: 'Standardized workflows for budget proposals, purchase approvals, tax invoices, and reimbursements.',
        purpose: 'Maintain fiscal accountability and timely reimbursement for all FilKom Day Committee divisions.',
        scope: 'All division heads and committee members submitting requisitions or expense claims.',
        responsibilities: 'Division Leads submit proposals 3 weeks early; Treasurer audits receipts; Faculty Advisor approves contracts > $500.',
        references: 'University Student Affairs Financial Compliance Manual 2026.',
        reviewer: 'General Secretary',
        approver: 'Faculty Advisor',
        approvedBy: authorName,
        approvedAt: '2026-10-05T12:00:00.000Z',
        effectiveDate: '2026-10-12',
        reviewDate: '2027-10-12',
        revisionNumber: '1.0',
        content: `### Financial Stewardship Principles
All campus events must maintain complete fiscal transparency. No committee member may authorize unbudgeted expenses above $100 without prior written consent from the Treasurer.

### Key Deadlines
- **Budget Request Submission**: Minimum 3 weeks before event date.
- **Invoice & Receipt Submission**: Within 7 business days following event conclusion.
- **Reimbursement Processing**: Transferred on bi-weekly payment cycles.

### Rules for Valid Receipts
- Official merchant receipts must detail itemized purchases, unit costs, and tax breakdown.
- Credit card slips without itemized lists are non-reimbursable.
- Meals and catering must include attendee headcount and sign-in sheets.`,
        tags: ['SOP', 'Treasurer', 'Budgeting', 'Reimbursements'],
        createdBy: authorId,
        authorId,
        authorName,
        status: 'published',
        viewsCount: 215,
        bookmarkCount: 29,
        isSOP: true,
        targetCommittee: 'Treasurer',
        sopSteps: [
          { step: 1, title: 'Requisition Formulation', detail: 'Complete spreadsheet template with projected vendor line items.', pic: 'Division Head', notes: 'Include 2 vendor quotes for purchases > $250' },
          { step: 2, title: 'Treasurer Review', detail: 'Treasurer verifies funds availability and budget code eligibility.', pic: 'Treasurer', notes: 'Cross-check Q4 allocation ledger' },
          { step: 3, title: 'Faculty Advisor Sign-off', detail: 'Obtain university student affairs approval for contracts exceeding $500.', pic: 'Executive Chair', notes: 'Submit at least 14 days prior' },
          { step: 4, title: 'Receipt Collection', detail: 'Scan all physical tax invoices and upload to Document Repository.', pic: 'Division Treasurer', notes: 'Upload within 7 business days post-event' },
        ],
        attachments: [
          { name: 'Budget_Requisition_Form_2026.csv', url: assets.budgetCsv, size: assets.budgetCsv.length, type: 'csv' },
        ],
        createdAt: '2026-09-18T11:00:00.000Z',
        updatedAt: '2026-10-12T16:30:00.000Z',
      },
      {
        id: 'art_leadership_handover',
        title: 'Leadership Transition & Committee Alignment Playbook',
        categoryId: 'cat_leader',
        categoryName: 'Leader',
        department: 'Leader',
        knowledgeType: 'Guide',
        summary: 'Strategic handbook for outgoing and incoming division chairs to maintain continuity and project momentum.',
        content: `### Executive Leadership Principles
A successful student committee is built on psychological safety, clarity of mission, and rigorous institutional memory.

### Annual Transition Milestones
1. **Week 1 Post-Election**: Joint Shadowing Meeting between outgoing and incoming chairs.
2. **Week 2**: Password & Account Registry transfer (Social Media, Domain hosting, Storage drives).
3. **Week 3**: University Administration introductions with Student Affairs Dean.
4. **Week 4**: Final sign-off on the physical and digital inventory.`,
        tags: ['Leader', 'Handover', 'Strategy', 'Governance'],
        createdBy: authorId,
        authorId,
        authorName,
        status: 'published',
        viewsCount: 380,
        bookmarkCount: 45,
        isSOP: false,
        createdAt: '2026-08-20T10:00:00.000Z',
        updatedAt: '2026-09-28T18:15:00.000Z',
      },
      {
        id: 'art_venue_booking_guide',
        title: 'Event Management: Campus Auditorium & Stage Run-of-Show Protocol',
        categoryId: 'cat_event_management',
        categoryName: 'Event Management',
        department: 'Event Management',
        knowledgeType: 'Guide',
        summary: 'Detailed run-of-show orchestration, stage cues, sound checks, and university facility coordination.',
        content: `### Stage Management Protocol
Executing major events requires strict synchronization between the MC, stage managers, AV team, and keynote speakers.

### Space Classification
- **Standard Lecture Halls (Capacity 50-120)**: Bookable 7 days in advance through student portal.
- **Main Campus Auditorium (Capacity 600)**: Requires 30-day advance application with technical rider.
- **Outdoor Quad & Amphitheater**: Requires security permit, electrical grounding clearance, and decibel check approval.`,
        tags: ['Event Management', 'Stage', 'Run-of-Show', 'Logistics'],
        createdBy: authorId,
        authorId,
        authorName,
        status: 'published',
        viewsCount: 198,
        bookmarkCount: 22,
        isSOP: false,
        createdAt: '2026-09-02T13:45:00.000Z',
        updatedAt: '2026-10-05T09:10:00.000Z',
      },
      {
        id: 'art_sponsorship_guide',
        title: 'Fundraising & Corporate Sponsorship Pitch Deck Guidelines',
        categoryId: 'cat_fundraising',
        categoryName: 'Fundraising',
        department: 'Fundraising',
        knowledgeType: 'Best Practice',
        summary: 'How to pitch external corporate partners, structure sponsorship tiers, and deliver promised activation value.',
        content: `### Corporate Outreach Strategy
Campus student organizations offer companies direct recruitment access and brand affinity. Pitch decks must articulate demographic value rather than asking for charitable donations.

### Sponsorship Tiers Blueprint
1. **Title Sponsor ($3,000+)**: Keynote address, booth at entrance, logo on all lanyards and digital banners.
2. **Gold Partner ($1,500)**: Workshop session slot, main stage recognition, recruitment desk.
3. **Silver Supporter ($750)**: Promotional flyers in attendee packs, website logo listing.`,
        tags: ['Fundraising', 'Sponsorship', 'Finance', 'Partnerships'],
        createdBy: authorId,
        authorId,
        authorName,
        status: 'published',
        viewsCount: 167,
        bookmarkCount: 31,
        isSOP: false,
        createdAt: '2026-09-10T14:30:00.000Z',
        updatedAt: '2026-10-18T11:00:00.000Z',
      },
      {
        id: 'art_security_protocol',
        title: 'SOP-03: Campus Event Safety, Access Badging & Crowd Management',
        sopNumber: 'SOP-03',
        categoryId: 'cat_security',
        categoryName: 'Security',
        department: 'Security',
        knowledgeType: 'SOP',
        summary: 'Security division procedures for perimeter control, guest wristband verification, and emergency medical response.',
        purpose: 'Protect all event participants, speakers, and campus facilities during FilKom Day activities.',
        scope: 'All indoor auditorium and outdoor quad events hosted by the committee.',
        responsibilities: 'Security Lead coordinates campus police clearance, gate marshals, and medical standby.',
        references: 'Campus Safety Clearance Guidelines 2026.',
        reviewer: 'Event Management Lead',
        approver: 'Executive Chair',
        approvedBy: authorName,
        approvedAt: '2026-10-06T09:00:00.000Z',
        effectiveDate: '2026-10-08',
        reviewDate: '2027-10-08',
        revisionNumber: '1.0',
        content: `### Security Invariants
Safety is paramount in any campus gathering. The Security Division coordinates with campus security police and emergency medical services.

### Entry Checkpoints
1. Ticket QR scanning and wristband affixing at all main gates.
2. Bag inspection protocols for unauthorized glassware or hazardous objects.
3. Dedicated emergency exit lanes kept unobstructed at all times.`,
        tags: ['SOP', 'Security', 'Crowd Safety', 'Emergency'],
        createdBy: authorId,
        authorId,
        authorName,
        status: 'published',
        viewsCount: 154,
        bookmarkCount: 19,
        isSOP: true,
        targetCommittee: 'Security',
        sopSteps: [
          { step: 1, title: 'Campus Security Notification', detail: 'File security clearance form 14 days prior.', pic: 'Security Lead', notes: 'Attach expected headcount' },
          { step: 2, title: 'Perimeter Check', detail: 'Inspect all fire doors and ensure emergency exits are unchained.', pic: 'Gate Marshals', notes: 'Complete 60 mins before doors open' },
          { step: 3, title: 'Wristband Protocol', detail: 'Color-code VIP, attendee, and staff wristbands.', pic: 'Registration & Security', notes: 'Verify QR code before banding' },
        ],
        createdAt: '2026-09-20T10:00:00.000Z',
        updatedAt: '2026-10-08T12:00:00.000Z',
      },
      {
        id: 'art_catering_guidelines',
        title: 'Catering Division: Vendor Selection & Dietary Requirement Protocols',
        categoryId: 'cat_catering',
        categoryName: 'Catering',
        department: 'Catering',
        knowledgeType: 'Policy',
        summary: 'Standard procedures for halal, vegetarian, vegan, and allergen-safe meals across campus events.',
        content: `### Catering Protocols
Food quality and hygiene reflect directly on our student organization's reputation.

### Dietary Management Checklist
- Collect dietary needs through registration forms.
- Label lunch boxes with explicit dietary seals (Halal, Vegetarian, Gluten-Free).
- Keep a 10% contingency buffer for walk-in VIP guests.`,
        tags: ['Catering', 'Logistics', 'Dietary', 'Food Safety'],
        createdBy: authorId,
        authorId,
        authorName,
        status: 'published',
        viewsCount: 130,
        bookmarkCount: 14,
        isSOP: false,
        createdAt: '2026-09-22T08:00:00.000Z',
        updatedAt: '2026-10-09T15:00:00.000Z',
      },
      {
        id: 'art_multimedia_brand',
        title: 'Multimedia: Brand Identity, Live Stream Setup & Asset Specs',
        categoryId: 'cat_multimedia',
        categoryName: 'Multimedia',
        department: 'Multimedia',
        knowledgeType: 'Reference',
        summary: 'Resolution standards, color hex palettes, typography pairings, and OBS live stream bitrate parameters.',
        content: `### Creative Standards
All external visual assets must adhere to university brand guidelines.

### Technical Specifications
- **Instagram Feed**: 1080x1350px (4:5 vertical)
- **YouTube Live Stream**: 1080p60 at 6,000 kbps CBR
- **Primary Palette**: Navy Blue (#0B132B), Periwinkle (#6366F1), Soft Lavender (#E0E7FF)`,
        tags: ['Multimedia', 'Brand', 'Design', 'Live Streaming'],
        createdBy: authorId,
        authorId,
        authorName,
        status: 'published',
        viewsCount: 220,
        bookmarkCount: 38,
        isSOP: false,
        createdAt: '2026-09-05T12:00:00.000Z',
        updatedAt: '2026-10-15T18:00:00.000Z',
      },
    ];

    for (const art of articles) {
      await setDoc(doc(db, 'knowledge', art.id), art);
    }

    // 4. Initial Documents (with real downloadable/previewable payloads)
    const documents: DocumentItem[] = [
      {
        id: 'doc_budget_template',
        title: '2026 Standard Event Budget Requisition Template',
        description: 'Structured CSV budget sheet template for committee expense proposals and line-item tracking.',
        categoryId: 'cat_treasurer',
        categoryName: 'Treasurer',
        fileUrl: assets.budgetCsv,
        fileName: '2026_Event_Budget_Template.csv',
        fileSize: assets.budgetCsv.length,
        fileType: 'csv',
        createdBy: authorId,
        authorId,
        authorName,
        downloadsCount: 84,
        createdAt: '2026-09-01T10:00:00.000Z',
      },
      {
        id: 'doc_handover_checklist',
        title: 'Committee Handover Protocol & Executive Asset Checklist',
        description: 'Official PDF checklist detailing accounts, assets, bank authorizations, and archives.',
        categoryId: 'cat_leader',
        categoryName: 'Leader',
        fileUrl: assets.handoverPdf,
        fileName: 'Handover_Protocol_Checklist.pdf',
        fileSize: assets.handoverPdf.length,
        fileType: 'pdf',
        createdBy: authorId,
        authorId,
        authorName,
        downloadsCount: 132,
        createdAt: '2026-08-25T11:30:00.000Z',
      },
      {
        id: 'doc_brand_assets',
        title: 'Official Brand Identity & Social Media Graphic Kit',
        description: 'Official PDF guide detailing typography pairings, color HEX codes, and template dimensions.',
        categoryId: 'cat_multimedia',
        categoryName: 'Multimedia',
        fileUrl: assets.brandPdf,
        fileName: 'Brand_Identity_Guidelines.pdf',
        fileSize: assets.brandPdf.length,
        fileType: 'pdf',
        createdBy: authorId,
        authorId,
        authorName,
        downloadsCount: 95,
        createdAt: '2026-09-05T08:20:00.000Z',
      },
      {
        id: 'doc_event_timeline',
        title: 'Event Timeline & Run-of-Show Master Sheet 2026',
        description: 'Structured minute-by-minute timeline document for committee events.',
        categoryId: 'cat_event_management',
        categoryName: 'Event Management',
        fileUrl: assets.timelineRtf,
        fileName: 'Event_Timeline_2026.doc',
        fileSize: assets.timelineRtf.length,
        fileType: 'doc',
        createdBy: authorId,
        authorId,
        authorName,
        downloadsCount: 110,
        createdAt: '2026-09-12T15:00:00.000Z',
      },
    ];

    for (const document of documents) {
      await setDoc(doc(db, 'documents', document.id), document);
    }

    // 5. Initial Events
    const events: CampusEvent[] = [
      {
        id: 'evt_techfest_2026',
        title: 'Kedabar 2026 - Main Event Preparation',
        description: 'Comprehensive coordination meeting and dry-run with all division leads for the annual campus conference.',
        date: '2026-11-20',
        academicYear: '2026/2027',
        committee: 'Event Management',
        outcomes: 'Run-of-show approved; technical riders confirmed with auditorium staff.',
        evaluation: 'Schedule rehearsal earlier to avoid sound check conflicts with ongoing classes.',
        createdBy: authorId,
        authorId,
        authorName,
        createdAt: '2026-10-28T16:00:00.000Z',
      },
      {
        id: 'evt_committee_gathering',
        title: 'All-Division Committee Gathering & Midterm Review',
        description: 'Gathering of all 10 divisions to review Q4 milestones, celebrate achievements, and align on upcoming campus events.',
        date: '2026-11-25',
        academicYear: '2026/2027',
        committee: 'Leader',
        outcomes: 'Division reports submitted; 100% attendance across committee heads.',
        evaluation: 'Icebreaker session helped cross-division collaboration significantly.',
        createdBy: authorId,
        authorId,
        authorName,
        createdAt: '2026-10-30T10:00:00.000Z',
      },
    ];

    for (const evt of events) {
      await setDoc(doc(db, 'events', evt.id), evt);
    }

    // 6. Initial Lessons
    const lessons: LessonLearned[] = [
      {
        id: 'lsn_wifi_power',
        activityTitle: 'Main Auditorium Power Overload during Hackathon',
        categoryId: 'cat_logistics_equipment',
        categoryName: 'Logistics & Equipment',
        challenges: 'Circuit breaker tripped when 80 laptops and high-power sound amplifiers were plugged into one outlet loop.',
        solutions: 'Campus facility electricians deployed heavy-duty 3-phase power distribution boxes with dedicated breakers.',
        recommendations: 'Always reserve external distro boxes 3 weeks in advance for large technical events.',
        impactLevel: 'high',
        createdBy: authorId,
        authorId,
        authorName,
        createdAt: '2026-10-29T11:00:00.000Z',
      },
      {
        id: 'lsn_catering_dietary',
        activityTitle: 'Dietary Mismatch during Leadership Gala',
        categoryId: 'cat_catering',
        categoryName: 'Catering',
        challenges: '14 vegetarian and halal attendees were left without allocated meals because dietary preferences were not confirmed.',
        solutions: 'Emergency order placed with nearby certified vendor; Treasurer covered immediate receipt under contingency budget.',
        recommendations: 'Add mandatory dietary requirement checkboxes to the registration form and color-code badges.',
        impactLevel: 'medium',
        createdBy: authorId,
        authorId,
        authorName,
        createdAt: '2026-10-15T14:20:00.000Z',
      },
    ];

    for (const lsn of lessons) {
      await setDoc(doc(db, 'lessons_learned', lsn.id), lsn);
    }

    console.log('Database successfully initialized with 10 division categories and authentic records.');
  } catch (error) {
    console.error('Error seeding initial data:', error);
  }
}
