// Source of truth for the /terms page. Mirrors the reviewed Terms &
// Conditions draft (Freelanzo LLC, Dubai UAE) — keep this in sync with the
// legal team's canonical copy rather than editing the two documents apart.

export const TERMS_META = {
  effectiveDate: null, // e.g. "August 19, 2026" — set once finalized
  lastUpdated: null,
};

export const TERMS_SECTIONS = [
  {
    id: "s1",
    title: "Acceptance of Terms",
    blocks: [
      { p: "By registering for an EazeeBooks account or using any part of the Service, you agree to these Terms." },
      { p: "If you use the Service on behalf of a company, business, organization, or other legal entity, you represent and warrant that: (1) you have authority to bind that entity to these Terms; and (2) your acceptance of these Terms is binding on that entity. In such circumstances, “you” and “your” include both you and the entity you represent." },
    ],
  },
  {
    id: "s2",
    title: "Eligibility",
    blocks: [
      { p: "You must be at least 18 years old, or the applicable age of legal majority in your jurisdiction, and legally capable of entering into a binding agreement." },
      { p: "The Service is primarily intended for businesses, professionals, accountants, bookkeepers, and organizations using the Service for business and financial-document processing purposes. You may not use the Service if you are legally prohibited from doing so under applicable law." },
    ],
  },
  {
    id: "s3",
    title: "Description of the Service",
    blocks: [
      { p: "EazeeBooks is a software-as-a-service platform designed to help users process, organize, review, manage, and export business and financial documents. Depending on the features available under your plan, the Service may include:" },
      { ul: [
        "Invoice processing",
        "Supplier invoice and bill processing",
        "Customer invoice management",
        "Receipt and financial-document processing",
        "Bank statement processing",
        "Multi-page document processing",
        "AI/OCR-based data extraction",
        "Client and customer management",
        "Accounting-related records and reports",
        "VAT-related information and reporting tools",
        "Data editing and review",
        "Dashboard and analytics",
        "Document exports",
        "Excel/CSV/PDF exports",
        "Integrations or exports for third-party accounting platforms",
        "Subscription and billing management",
        "Other features introduced by us from time to time",
      ] },
      { p: "Features may vary depending on your subscription plan. We reserve the right to add, modify, suspend, or discontinue features in accordance with these Terms." },
    ],
  },
  {
    id: "s4",
    title: "Account Registration",
    blocks: [
      { p: "Certain features require you to create an account. When registering, you may be required to provide information including your full name, email address, mobile number, country, password, company name, and other information required to operate the account." },
      { p: "You agree that all information provided to us will be accurate, complete, current, and truthful, and you are responsible for updating your account information when it changes." },
      { p: "You must not: create an account using false information; impersonate another person or organization; create an account for an unauthorized person or entity; share your credentials in a manner that compromises account security; or use another person's account without authorization." },
    ],
  },
  {
    id: "s5",
    title: "Account Security",
    blocks: [
      { p: "You are responsible for maintaining the confidentiality and security of your login credentials, and for activity performed through your account unless such activity resulted directly from our failure to meet applicable security obligations." },
      { p: "You must promptly notify us if you believe your account has been accessed without authorization, your password has been compromised, your account credentials have been stolen, or there has been any other security incident affecting your account. We may require you to reset your password or take other security measures where reasonably necessary." },
    ],
  },
  {
    id: "s6",
    title: "Business and Team Accounts",
    blocks: [
      { p: "If EazeeBooks provides team, employee, or multi-user functionality, the account owner is responsible for managing authorized users, assigning appropriate permissions, protecting account credentials, removing users who should no longer have access, and ensuring that all authorized users comply with these Terms." },
      { p: "Actions performed by authorized users under the account may be treated as actions of the account owner or organization." },
    ],
  },
  {
    id: "s7",
    title: "User Responsibilities",
    blocks: [
      { p: "You are solely responsible for your use of the Service and agree to use it lawfully. You are responsible for:" },
      { ol: [
        "The legality and accuracy of documents uploaded to EazeeBooks",
        "Ensuring you have the legal right and necessary permissions to upload and process documents",
        "Ensuring you have appropriate rights, permissions, and lawful bases to process personal or financial information belonging to your customers, suppliers, employees, or other third parties",
        "Reviewing information processed or extracted by the Service",
        "Correcting inaccurate information before relying on it",
        "Maintaining appropriate records and backups",
        "Complying with applicable accounting, tax, VAT, corporate, privacy, and other laws",
        "Ensuring that your use of exported data complies with applicable laws and third-party requirements",
      ] },
    ],
  },
  {
    id: "s8",
    title: "User Content and Uploaded Documents",
    blocks: [
      { p: "“User Content” means any information, documents, files, invoices, bills, receipts, bank statements, images, PDFs, client information, supplier information, line items, notes, financial records, and other content uploaded, entered, generated, or stored by you through the Service. You retain ownership of your User Content." },
      { p: "You represent and warrant that you own or have sufficient rights to use and upload the User Content, that you have obtained any required permissions or consents, that your User Content does not unlawfully infringe the rights of another person or violate applicable law, and that you have the legal authority to instruct us to process such information." },
    ],
  },
  {
    id: "s9",
    title: "Processing of Financial Information",
    blocks: [
      { p: "EazeeBooks provides tools for processing and organizing financial documents. The Service may process information including invoice numbers, dates, supplier and customer details, amounts, tax/VAT information, currency, line items, debit and credit transactions, bank descriptions, account information, and other information contained in uploaded documents." },
      { p: "We do not independently verify the underlying transactions or determine whether the information contained in your documents is legally or financially correct." },
    ],
  },
  {
    id: "s10",
    title: "AI and OCR Processing",
    blocks: [
      { p: "EazeeBooks uses artificial intelligence, machine learning, optical character recognition (“OCR”), and third-party AI technologies to process documents and extract structured information, including invoice numbers, dates, supplier/customer information, amounts, taxes, currency, line items, bank transactions, and descriptions." },
      { p: "Uploaded documents or portions of their content may be transmitted to third-party AI/OCR providers for processing as necessary to provide the Service. Additional information regarding data processing and third-party processors is provided in our Privacy Policy." },
    ],
  },
  {
    id: "s11",
    title: "AI Accuracy Disclaimer",
    blocks: [
      { p: "AI and OCR processing is provided as a convenience and does not guarantee accurate, complete, or error-free results. AI-extracted information may contain errors, omissions, incorrect classifications, incorrect amounts, dates, tax information, party details, or line items." },
      { p: "Extraction accuracy may be affected by document quality, image resolution, handwritten information, formatting, language, layout, tables, scanned documents, missing information, or other factors. You must independently review extracted information against the original document before relying on it." },
    ],
  },
  {
    id: "s12",
    title: "User Review of Extracted Data",
    blocks: [
      { p: "You are solely responsible for reviewing and approving data extracted or generated by EazeeBooks. Before using extracted information for accounting, tax calculations, VAT reporting, financial reporting, payments, collections, business decisions, government filings, regulatory submissions, or import into another accounting system, you must verify the information against the original source document." },
      { p: "EazeeBooks does not guarantee that AI-generated or extracted information is suitable for any particular accounting, tax, financial, or regulatory purpose." },
    ],
  },
  {
    id: "s13",
    title: "Third-Party Integrations and Services",
    blocks: [
      { p: "EazeeBooks may integrate with or provide exports for third-party services, including accounting platforms, payment processors, AI providers, hosting providers, email providers, and other technology providers, such as Stripe, QuickBooks, and Zoho Books." },
      { p: "Third-party services are controlled by their respective providers. We are not responsible for third-party outages, errors, security incidents, data loss, changes to third-party APIs, pricing, or terms, or third-party service availability. Your use of a third-party service may also be subject to that provider's own terms and privacy policy." },
    ],
  },
  {
    id: "s14",
    title: "Exports and Data Transfers",
    blocks: [
      { p: "EazeeBooks may allow you to export information in formats including Excel, CSV, PDF, or formats designed for use with third-party accounting software. You are responsible for reviewing exported information before importing or relying upon it." },
      { p: "Once information is exported from EazeeBooks and transferred to another system, you are responsible for its subsequent use, storage, modification, security, and accuracy. We do not guarantee that a third-party platform will accept or correctly process an exported file." },
    ],
  },
  {
    id: "s15",
    title: "Subscription Plans",
    blocks: [
      { p: "EazeeBooks may provide Free and paid subscription plans. Each plan may have different features, document limits, OCR/AI processing limits, storage limits, client limits, usage quotas, export functionality, and other restrictions. Current plan information and pricing are displayed on the EazeeBooks website or within the Service." },
      { p: "We reserve the right to modify plan features, limits, and pricing in accordance with these Terms." },
    ],
  },
  {
    id: "s16",
    title: "Usage Limits and Quotas",
    blocks: [
      { p: "Your subscription may be subject to usage limits, including the number of documents processed, AI/OCR pages, clients, storage, exports, API usage, or other metered features." },
      { p: "If you reach your applicable limit, we may prevent additional processing, restrict affected functionality, require an upgrade, wait until the usage period resets, or apply another restriction disclosed for your plan. You must not attempt to bypass or circumvent usage limits." },
    ],
  },
  {
    id: "s17",
    title: "Billing and Payments",
    blocks: [
      { p: "Paid subscriptions are billed in advance on a monthly or annual basis, depending on the subscription selected. Prices are displayed in the applicable currency and may be subject to UAE VAT or other applicable taxes." },
      { p: "Payments may be processed through third-party payment providers, including Stripe. We do not store your complete payment-card details where payment processing is handled by the third-party payment processor. By subscribing, you authorize the applicable payment provider to charge your selected payment method for the applicable subscription fees and taxes. You are responsible for maintaining accurate billing and payment information." },
    ],
  },
  {
    id: "s18",
    title: "Automatic Renewal",
    blocks: [
      { p: "Unless cancelled before the renewal date, paid subscriptions may automatically renew for the same billing period — for example, monthly subscriptions renew monthly, and annual subscriptions renew annually." },
      { p: "The applicable renewal price will be the then-current price for your subscription unless otherwise stated. You authorize us or our payment processor to charge your saved payment method for renewal charges." },
    ],
  },
  {
    id: "s19",
    title: "Cancellation",
    blocks: [
      { p: "You may cancel your paid subscription through the available billing settings or by contacting us. Unless otherwise required by applicable law, cancellation will take effect at the end of the current paid billing period, and you will generally retain access to paid features until then." },
      { p: "Cancellation does not create a right to a refund for the unused portion of the billing period." },
    ],
  },
  {
    id: "s20",
    title: "No-Refund Policy",
    blocks: [
      { p: "Except where a refund is required by applicable law, all payments made to EazeeBooks are non-refundable. This includes monthly and annual subscription payments, partial billing periods, unused subscription time, unused document/OCR/storage allowances, downgrades, cancellation during an active billing period, and failure to use the Service.", strong: true },
      { p: "No prorated refunds or credits will be provided unless we are legally required to provide them or expressly agree otherwise in writing. Nothing in this section excludes any mandatory statutory rights that cannot legally be waived." },
    ],
  },
  {
    id: "s21",
    title: "Failed Payments",
    blocks: [
      { p: "If a payment fails, we may attempt to process the payment again, restrict paid features, suspend the account, downgrade the account, or terminate the subscription. You remain responsible for unpaid amounts incurred before suspension or termination." },
    ],
  },
  {
    id: "s22",
    title: "Intellectual Property",
    blocks: [
      { p: "The Service and its underlying technology, software, design, interface, branding, trademarks, content, databases, documentation, and other materials are owned by Freelanzo LLC or its licensors. Except for the limited rights expressly granted under these Terms, no ownership rights are transferred to you." },
      { p: "You may not copy, reverse engineer, modify, create derivative works from, sell, sublicense, extract source code or underlying AI models from, remove proprietary notices from, or use the Service to build a competing product, except where such restriction is prohibited by applicable law." },
    ],
  },
  {
    id: "s23",
    title: "License to Process User Content",
    blocks: [
      { p: "You retain ownership of your User Content. You grant Freelanzo LLC a limited, non-exclusive, worldwide, royalty-free license to host, store, transmit, reproduce, process, and otherwise use your User Content only as reasonably necessary to provide the Service — including processing documents, performing AI/OCR extraction, storing information, generating reports and exports, providing customer support, maintaining security, preventing fraud or abuse, maintaining and improving the Service where permitted by applicable law, and complying with legal obligations." },
      { p: "This license does not transfer ownership of your User Content to Freelanzo LLC." },
    ],
  },
  {
    id: "s24",
    title: "Acceptable Use",
    blocks: [
      { p: "You agree not to use EazeeBooks to:" },
      { ol: [
        "Upload documents you do not have permission to process",
        "Create fraudulent invoices or falsify financial records",
        "Facilitate tax evasion, money laundering, or fraud",
        "Process unlawful financial transactions",
        "Upload malicious software, or attack or interfere with the Service",
        "Attempt unauthorized access or circumvent authentication or usage limits",
        "Scrape the Service, or reverse engineer it, or extract proprietary models or source code",
        "Resell the Service without permission, or abuse APIs",
        "Upload unlawful content",
        "Violate applicable laws or third-party rights",
      ] },
      { p: "We may suspend or terminate accounts that violate these requirements." },
    ],
  },
  {
    id: "s25",
    title: "Service Availability and Maintenance",
    blocks: [
      { p: "We aim to provide reliable and continuous access to EazeeBooks but do not guarantee that the Service will always be available, uninterrupted, error-free, secure, free from bugs, or available at a particular speed or performance level." },
      { p: "The Service may become temporarily unavailable because of scheduled or emergency maintenance, software updates, infrastructure problems, internet failures, cybersecurity incidents, third-party or cloud-provider outages, or circumstances beyond our reasonable control. We will use reasonable efforts to restore affected services where reasonably practicable. Unless expressly stated in a separate written agreement, EazeeBooks does not provide a guaranteed uptime SLA." },
    ],
  },
  {
    id: "s26",
    title: "Security",
    blocks: [
      { p: "We implement reasonable administrative, technical, and organizational measures designed to protect User Content. However, no electronic transmission, internet service, database, or storage system can be guaranteed to be completely secure." },
      { p: "You acknowledge that internet transmission carries inherent risks, that no security system is completely immune from attack, and that you are responsible for maintaining the security of your account credentials. You should immediately notify us if you suspect unauthorized access to your account." },
    ],
  },
  {
    id: "s27",
    title: "Data Backup and Data Loss",
    blocks: [
      { p: "Freelanzo LLC implements reasonable technical and organizational measures designed to protect User Content and support the continued operation of the Service. However, we do not guarantee that User Content will never be lost, deleted, corrupted, damaged, delayed, or made unavailable." },
      { p: "Data loss may occur due to hardware or software failure, human error, cybersecurity incidents, cloud infrastructure or third-party provider failure, internet failure, account actions, security incidents, or events beyond our reasonable control." },
      { p: "You are strongly encouraged to maintain independent copies of important financial and business records and to regularly export important information from EazeeBooks using the Service's built-in export tools. To the maximum extent permitted by applicable law, Freelanzo LLC will not be liable for loss, corruption, deletion, or unavailability of User Content." },
    ],
  },
  {
    id: "s28",
    title: "Financial and Accounting Disclaimer",
    blocks: [
      { p: "EazeeBooks is a software and document-processing platform. The Service does not constitute professional accounting, bookkeeping, auditing, tax, investment, financial, or legal advice." },
      { p: "EazeeBooks does not independently verify financial transactions, audit financial records, guarantee accounting or VAT/tax compliance, determine tax liability, file tax returns on your behalf, or provide professional accounting advice. You remain responsible for your accounting, financial, tax, and regulatory obligations." },
    ],
  },
  {
    id: "s29",
    title: "No Professional Advice",
    blocks: [
      { p: "Information, reports, calculations, summaries, extracted data, or other output generated by EazeeBooks should not be treated as professional accounting, tax, legal, financial, or investment advice. You should consult an appropriately qualified professional where professional advice is required." },
    ],
  },
  {
    id: "s30",
    title: "Disclaimer of Warranties",
    blocks: [
      { p: "TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE.” FREELANZO LLC DISCLAIMS ALL WARRANTIES, REPRESENTATIONS, AND CONDITIONS, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, ACCURACY, AVAILABILITY, AND RELIABILITY.", caps: true },
      { p: "WE DO NOT WARRANT THAT THE SERVICE WILL ALWAYS BE AVAILABLE OR ERROR-FREE; THAT AI/OCR EXTRACTION WILL BE ACCURATE OR COMPLETE; THAT REPORTS OR EXPORTS WILL BE ERROR-FREE OR COMPATIBLE WITH THIRD-PARTY SYSTEMS; THAT DATA WILL NEVER BE LOST; THAT THE SERVICE WILL BE COMPLETELY SECURE; OR THAT THE SERVICE WILL MEET EVERY PARTICULAR BUSINESS OR ACCOUNTING REQUIREMENT.", caps: true },
    ],
  },
  {
    id: "s31",
    title: "Limitation of Liability",
    blocks: [
      { p: "TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, FREELANZO LLC, ITS AFFILIATES, DIRECTORS, OFFICERS, EMPLOYEES, CONTRACTORS, AGENTS, AND SUBPROCESSORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, REVENUE, BUSINESS, OR BUSINESS OPPORTUNITY, LOSS OF DATA, BUSINESS INTERRUPTION, OR LOSS ARISING FROM THIRD-PARTY SERVICES, AI/OCR EXTRACTION, EXPORTS, OR RELIANCE ON UNREVIEWED DATA.", caps: true },
      { p: "OUR TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE TOTAL FEES YOU PAID TO FREELANZO LLC DURING THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR (B) AED 500 (FIVE HUNDRED UAE DIRHAMS).", caps: true },
      { p: "These limitations apply to the maximum extent permitted by applicable law, regardless of the legal theory on which the claim is based. Nothing in these Terms excludes or limits liability that cannot lawfully be excluded or limited under applicable law." },
    ],
  },
  {
    id: "s32",
    title: "Indemnification",
    blocks: [
      { p: "You agree to indemnify, defend, and hold harmless Freelanzo LLC and its directors, officers, employees, contractors, agents, affiliates, and service providers from claims, losses, liabilities, damages, costs, and reasonable legal expenses arising from or relating to: your User Content; your violation of these Terms or applicable law; your violation of another person's rights; your unauthorized or fraudulent use of the Service; or your reliance on AI-extracted or exported information without appropriate review." },
    ],
  },
  {
    id: "s33",
    title: "Account Suspension and Termination",
    blocks: [
      { p: "We may suspend, restrict, or terminate your account if you violate these Terms, fail to pay applicable fees, misuse the Service, engage in fraudulent activity, create security risks, attempt unauthorized access, violate applicable law, or where your use creates a risk to us, other users, or third parties, or where suspension or termination is required by law." },
      { p: "Where reasonably practical, we may provide notice before termination or suspension. However, we may immediately suspend access where necessary to protect the Service, users, third parties, or comply with legal obligations." },
    ],
  },
  {
    id: "s34",
    title: "Effect of Termination",
    blocks: [
      { p: "Upon termination, your right to access the Service may end, paid features may become unavailable, your account may be downgraded or disabled, and you may lose access to certain features. Your User Content will remain subject to our applicable data retention and deletion practices." },
      { p: "You are responsible for exporting any data you need before account termination, subject to the availability of the Service. Sections that by their nature should survive termination will continue to apply, including provisions concerning intellectual property, payment obligations, disclaimers, limitation of liability, indemnification, governing law, and dispute resolution." },
    ],
  },
  {
    id: "s35",
    title: "Data Retention and Deletion",
    blocks: [
      { p: "We retain User Content in accordance with our Privacy Policy and applicable data-retention requirements. Following account termination or deletion, we may retain certain information for legal compliance, tax and accounting requirements, fraud prevention, security, dispute resolution, enforcement of agreements, or other legitimate business purposes." },
      { p: "Where applicable, information will be deleted or anonymized in accordance with our Privacy Policy and retention practices." },
    ],
  },
  {
    id: "s36",
    title: "Changes to the Service",
    blocks: [
      { p: "We may modify, update, suspend, or discontinue any feature of EazeeBooks, including new or removed features, interface changes, changes to usage limits or integrations, changes to subscription plans, and changes to technical infrastructure. We will use reasonable efforts to communicate material changes where appropriate." },
    ],
  },
  {
    id: "s37",
    title: "Changes to These Terms",
    blocks: [
      { p: "We may update these Terms from time to time. When we make material changes, we may provide notice through the EazeeBooks website, email, in-app notifications, or other reasonable communication methods. The updated Terms will become effective on the date stated in the updated Terms." },
      { p: "Your continued use of EazeeBooks after the effective date constitutes acceptance of the updated Terms, to the extent permitted by applicable law." },
    ],
  },
  {
    id: "s38",
    title: "Privacy",
    blocks: [
      { p: "Your use of EazeeBooks is also governed by our Privacy Policy, which explains how we collect, use, store, disclose, and protect personal information and how we use third-party processors. The Privacy Policy forms part of these Terms by reference." },
    ],
  },
  {
    id: "s39",
    title: "Third-Party Providers",
    blocks: [
      { p: "EazeeBooks depends on third-party providers for certain services, which may include cloud hosting, AI/OCR processing, payment processing, email delivery, authentication, analytics, infrastructure, and external accounting integrations." },
      { p: "We are not responsible for failures, outages, changes, or security incidents originating solely from third-party providers, except to the extent liability cannot legally be excluded." },
    ],
  },
  {
    id: "s40",
    title: "Force Majeure",
    blocks: [
      { p: "Freelanzo LLC will not be responsible for delay or failure to perform obligations caused by circumstances beyond our reasonable control, including natural disasters, fire, flood, war, terrorism, government action, internet or telecommunications failures, power failures, cloud infrastructure failures, cybersecurity incidents, third-party service failures, epidemics or pandemics, or other events beyond our reasonable control." },
    ],
  },
  {
    id: "s41",
    title: "Governing Law",
    blocks: [
      { p: "These Terms are governed by the laws of the United Arab Emirates and applicable laws of the Emirate of Dubai. The application of conflict-of-law principles is excluded to the extent permitted by law." },
    ],
  },
  {
    id: "s42",
    title: "Dispute Resolution and Jurisdiction",
    blocks: [
      { p: "Any dispute, claim, or controversy arising out of or relating to these Terms or your use of EazeeBooks shall, to the extent permitted by applicable law, be subject to the jurisdiction of the competent courts of Dubai, United Arab Emirates." },
      { p: "Nothing in this section prevents a party from seeking urgent or interim relief where legally available. Mandatory rights or protections that cannot legally be excluded will remain applicable." },
    ],
  },
  {
    id: "s43",
    title: "Notices",
    blocks: [
      { p: "We may provide notices to you through the email address associated with your account, in-app notifications, the EazeeBooks website, or other reasonable electronic means. You may contact Freelanzo LLC regarding these Terms using the contact information in Section 48." },
    ],
  },
  {
    id: "s44",
    title: "Assignment",
    blocks: [
      { p: "You may not assign or transfer your rights or obligations under these Terms without our prior written consent. Freelanzo LLC may assign or transfer these Terms in connection with a merger, acquisition, corporate restructuring, sale of assets, change of control, or operation of law." },
    ],
  },
  {
    id: "s45",
    title: "Severability",
    blocks: [
      { p: "If any provision of these Terms is determined to be invalid, unlawful, or unenforceable, that provision will be modified or limited to the minimum extent necessary to make it enforceable, and the remaining provisions will remain in full force and effect." },
    ],
  },
  {
    id: "s46",
    title: "No Waiver",
    blocks: [
      { p: "Our failure to enforce any provision of these Terms does not constitute a waiver of our right to enforce that provision in the future. A waiver is effective only if expressly provided by us in writing." },
    ],
  },
  {
    id: "s47",
    title: "Entire Agreement",
    blocks: [
      { p: "These Terms, together with the EazeeBooks Privacy Policy and any applicable subscription, order, or service-specific terms, constitute the entire agreement between you and Freelanzo LLC concerning your use of the Service, and supersede prior agreements or understandings relating to the same subject matter." },
    ],
  },
  {
    id: "s48",
    title: "Contact Information",
    blocks: [
      { p: "Questions, concerns, or notices regarding these Terms may be directed to:" },
      { contact: [
        { k: "Legal entity", v: "Freelanzo LLC" },
        { k: "Product", v: "EazeeBooks" },
        { k: "Email", v: "sales@eazeebooks.com", href: "mailto:sales@eazeebooks.com" },
        { k: "Phone / WhatsApp", v: "+971 56 210 0778", href: "tel:+971562100778" },
        { k: "Country / Emirate", v: "United Arab Emirates — Dubai" },
        { k: "Registered address", v: null, placeholder: "Registered business address to be added" },
      ] },
    ],
  },
  {
    id: "s49",
    title: "Acceptance",
    blocks: [
      { p: "By creating an EazeeBooks account, subscribing to a paid plan, accessing, or using the Service, you acknowledge that: (1) you have read these Terms; (2) you understand these Terms; (3) you agree to be legally bound by these Terms; and (4) you have the authority to enter into these Terms where you are acting on behalf of a business or organization." },
      { signoff: { company: "Freelanzo LLC", location: "EazeeBooks · Dubai, United Arab Emirates" } },
    ],
  },
];
