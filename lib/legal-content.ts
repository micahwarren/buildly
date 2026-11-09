export const legal = {
  privacy: [
    {
      heading: false,
      text: "Last updated November 9, 2026. Site AI: Visualize & DIY is operated by Nom Apps LLC. Privacy contact: support@nomappsllc.com.",
    },
    {
      heading: true,
      text: "Information you provide",
    },
    {
      heading: false,
      text: "We collect your account email and identifier, and profile information supplied by Apple or Google when present. We store the photos, project descriptions, optional measurements, inspiration/material images, generated designs and plans you choose to save. An optional profile photo is also linked to your account. We record the version and time of your terms acceptance, your acknowledgement that you are 18 or older, and your AI-processing choices. We do not ask for your date of birth; an acknowledgement is not identity or age verification. Upload only images you have permission to use; avoid sensitive documents and unnecessary personal information.",
    },
    {
      heading: true,
      text: "AI processing and your permission",
    },
    {
      heading: false,
      text: "With your permission, selected photos and project descriptions are sent to the AI providers identified in the app before generation. The current service identifies Google Gemini for designs and plans. If another provider is enabled, we identify it before sending new requests and apply the relevant consent requirement. AI providers process content under their applicable terms and settings; this notice does not promise that their retention or training rules are identical.",
    },
    {
      heading: false,
      text: "You can turn AI processing off in Settings to stop new requests. A request already submitted may continue. Your projects are private to your account; they are not posted to a public gallery. Processing by our service providers is still necessary to deliver the features you request.",
    },
    {
      heading: true,
      text: "AI output and project risks",
    },
    {
      heading: false,
      text: "AI-generated images, plans, material lists, measurements and cost estimates can be inaccurate, incomplete or unsuitable for your property. Relying on incorrect output can cause injury, property damage, wasted purchases, delays or budget overruns. Verify the output and obtain qualified professional advice before hazardous or regulated work. Our Terms & Conditions explain responsibility for project decisions and the limits of liability to the extent permitted by law. These limits do not remove your privacy rights or our duties under data-protection law.",
    },
    {
      heading: true,
      text: "Services that process your data",
    },
    {
      heading: false,
      text: "Supabase handles accounts and private file/project storage. Vercel hosts our website and runs the app APIs. Apple and Google handle their sign-in services. The disclosed AI provider processes generation inputs and outputs. Apple and RevenueCat handle purchase verification. These providers may process data in the United States or other countries where they operate. Contact us if you need more information about a provider before using the service.",
    },
    {
      heading: false,
      text: "Supabase and Google Workspace/Gmail, our configured email-delivery service, process your email address and confirmation/reset links to send account-access messages. These messages are for account access and security, not marketing.",
    },
    {
      heading: true,
      text: "Google sign-in",
    },
    {
      heading: false,
      text: "If you choose Google sign-in, Google's native sign-in software declares name, email, phone number, approximate location, user and device identifiers, usage data and other account/technical data. Its declared purposes include sign-in and its own analytics. Site AI uses the returned identity/profile to sign you in. We do not ask for your phone number or request GPS permission. Google's processing follows its own privacy terms.",
    },
    {
      heading: true,
      text: "Purchases and RevenueCat",
    },
    {
      heading: false,
      text: "Apple processes payments. RevenueCat receives the account identifier, account email and purchase/transaction information needed to verify purchases and support your account, along with technical app/device information. We store verified receipts and token balances linked to your account. We do not receive your payment-card number. We do not send project photos or descriptions to RevenueCat.",
    },
    {
      heading: true,
      text: "Free starter projects and abuse prevention",
    },
    {
      heading: false,
      text: "For the free starter offer on supported iPhones and iPads, Apple DeviceCheck supplies a temporary device token so our server can check and mark whether that device has used the offer. We send that token to Apple for this check and do not save the readable token in our database. Apple maintains the device-level offer flag. We also store keyed, one-way fingerprints of your account and verified sign-in identities, including a normalized email address, to prevent repeated claims. These are limited security records, not advertising identifiers or project content.",
    },
    {
      heading: false,
      text: "The offer flag and one-way claim records may remain after account deletion or app reinstallation to prevent the same starter offer being claimed again. The account link in the claim record is cleared when the account is deleted. These fingerprints are pseudonymous security data; they are not a promise of complete anonymity. Contact support if you believe an eligibility check is incorrect.",
    },
    {
      heading: true,
      text: "Background projects and optional notifications",
    },
    {
      heading: false,
      text: "After you tap Create project or Apply changes, our server stores the submitted photos and instructions in a private work queue so generation can continue when you close the app. We automatically retry eligible interrupted requests and finish the plan for the saved design without charging another token or revision. Queue inputs are cleared when processing succeeds or stops; saved projects remain in your account until you delete them. Turning off AI processing stops new requests and further retry attempts after the server checks your choice; work already submitted to a provider may finish.",
    },
    {
      heading: false,
      text: "If you enable project notifications, we collect your app push token, platform and account identifier to send a project-ready alert. Expo's push service and Apple Push Notification service or Firebase Cloud Messaging process the push token, generic notification text and account/job/project identifiers used to open your own saved result. We do not include your project photos, description or project title in the notification. You can disable alerts in device settings. Signing out disables this installation's registration when the service can be reached; deleting your account removes its saved push registrations and delivery records. Notifications are optional and not required for projects to finish.",
    },
    {
      heading: true,
      text: "Diagnostics and device storage",
    },
    {
      heading: false,
      text: "Our hosting provider supplies a coarse country signal derived from the network request so we can limit AI services to supported regions. We do not request GPS permission or add this country signal to your project or work-queue record. Hosting-provider technical logs remain subject to its own applicable settings and retention rules.",
    },
    {
      heading: false,
      text: "We use request identifiers, status, duration and model-usage records for operation, recovery, security and troubleshooting. Share error reports is optional and off by default. If enabled, it sends the app release, platform and a one-way error fingerprint linked to your account, rather than readable error text or your photos. Eligible optional reports are removed after up to 30 days by the cleanup service. This switch controls Site AI reports; it does not disable Google sign-in processing or its declared analytics.",
    },
    {
      heading: false,
      text: "Your device stores a sign-in session and may keep unfinished project drafts in private app storage. Drafts are account-scoped and cleared on logout/account deletion. A minimal deletion-in-progress marker may remain locally until a deletion request finishes. Device or cloud backups, if enabled, follow their own retention settings. We do not use advertising trackers or sell your personal information.",
    },
    {
      heading: true,
      text: "Deleting projects and your account",
    },
    {
      heading: false,
      text: "Delete a project from My projects to remove it and its private photos. If file cleanup fails, the service retries it; Settings shows pending photo cleanup when action is available. To delete your account, open Settings → Delete my account. Confirm with your password or the same Apple/Google account, then type DELETE.",
    },
    {
      heading: false,
      text: "Account deletion removes the account, saved projects, private files and unused token balance, and removes its RevenueCat customer profile. If provider cleanup cannot complete, deletion is not reported as finished; retry it in the app or contact support. For accounts linked to Sign in with Apple, we request revocation of Apple’s authorization before completing deletion. Apple may retain purchase records under its own legal and financial obligations. Deletion does not cancel an Apple order or automatically request a refund.",
    },
    {
      heading: false,
      text: "Saved projects remain until deleted. We retain one-way purchase and account fingerprints to prevent the same Apple transaction from granting tokens again, including after account deletion. These limited fraud-prevention records contain no readable account ID, transaction reference, email, profile or project content. Minimal operational records and provider records may remain where needed for security, legal or financial obligations. Copies in backups, where configured, expire under their retention settings rather than being erased instantly. We do not promise an unverified universal backup-retention period.",
    },
    {
      heading: true,
      text: "Project exports",
    },
    {
      heading: false,
      text: "When you choose Export project, the app prepares a file containing that selected project, including its photos, design, plan, materials and progress. The file is shared or saved only through the destination you choose; we do not create a public download link. Temporary sharing files are removed after the share flow finishes when cleanup succeeds. Copies you intentionally save or send outside Site AI are controlled by you and the destination service, and account deletion cannot remove those outside copies. Select another saved revision to export that version. Contact support for other account-data requests or help with an export.",
    },
    {
      heading: true,
      text: "Your choices and privacy requests",
    },
    {
      heading: false,
      text: "Use Settings to change AI permission and optional reporting, update your profile photo, or delete your account. Contact support@nomappsllc.com for access, correction, deletion assistance or other privacy requests. We may verify account ownership before acting. Rights and complaint options depend on where you live; this policy does not remove rights provided by applicable law.",
    },
    {
      heading: true,
      text: "Children and policy updates",
    },
    {
      heading: false,
      text: "Site AI is intended for adults 18 or older. Do not create an account, submit content or make purchases if you are under 18. We do not knowingly collect children’s personal information; contact us if you believe a minor provided information so we can investigate and remove it. We will update this notice when practices change. Material changes will be described in the app or through an appropriate notice before they apply to new processing.",
    },
  ],
  refunds: [
    {
      heading: false,
      text: "Last updated November 7, 2026. This Refund Policy covers Site AI: Visualize & DIY, operated by Nom Apps LLC. Contact: support@nomappsllc.com.",
    },
    {
      heading: true,
      text: "Request a refund from Apple",
    },
    {
      heading: false,
      text: "Apple processes all purchases made in the iPhone and iPad app. To request a refund, visit https://reportaproblem.apple.com, sign in with the Apple Account used for the purchase, select the purchase and follow Apple’s instructions. Apple determines eligibility under its policies and applicable law; we cannot promise approval or an automatic refund.",
    },
    {
      heading: true,
      text: "Missing tokens or duplicate charges",
    },
    {
      heading: false,
      text: "If Apple confirms a purchase but your tokens are missing, reopen Project tokens while signed into the same Site AI account. Do not buy again to recover that purchase. If the balance is still wrong, contact support@nomappsllc.com with the purchase date and Apple transaction reference. Do not send payment-card details or your Apple password. Apple can help with duplicate or unrecognized charges.",
    },
    {
      heading: true,
      text: "If generation fails",
    },
    {
      heading: false,
      text: "A failed request before its design image is saved releases the reserved token or design revision. Once the image is saved, its token or revision is used while we complete the matching materials and plan. Recovering that plan does not use another token or revision. Check the saved project before starting a new one.",
    },
    {
      heading: false,
      text: "If we cannot deliver a complete paid project, contact support so we can investigate and help complete the service. You can request a refund through Apple. AI designs and estimates can be inaccurate and need verification; that disclosure does not remove your rights when the service is faulty or not delivered as required by law.",
    },
    {
      heading: true,
      text: "What happens after a refund",
    },
    {
      heading: false,
      text: "A refunded pack removes its unused tokens. Projects funded by that pack cannot use further paid design revisions, but saved results remain readable. Restoring purchases does not turn used tokens into new unused tokens.",
    },
    {
      heading: true,
      text: "Unused tokens and account deletion",
    },
    {
      heading: false,
      text: "Tokens are one-time purchases, do not expire and are not a subscription. Deleting a project, deleting your Site AI account or uninstalling the app does not automatically request a refund from Apple. Account deletion removes the unused balance; contact us about a purchase problem before deleting the account where possible.",
    },
    {
      heading: true,
      text: "Complimentary tokens",
    },
    {
      heading: false,
      text: "A free starter or support token is not an Apple purchase, has no cash value and cannot be refunded for money. The same generation-failure and plan-recovery rules apply. This does not affect rights relating to an actual paid purchase or mandatory consumer remedies.",
    },
    {
      heading: true,
      text: "Your consumer rights",
    },
    {
      heading: false,
      text: "This policy does not limit refund rights, consumer guarantees or other remedies that applicable law does not allow us to exclude. Refund eligibility and available remedies can depend on where you live. Contact support@nomappsllc.com if you need help finding the right process.",
    },
  ],
  terms: [
    {
      heading: false,
      text: "Last updated November 9, 2026. These terms cover Site AI: Visualize & DIY, operated by Nom Apps LLC. Support: support@nomappsllc.com. These updated terms apply after you accept them; they do not retroactively replace an earlier agreement or remove rights relating to an earlier purchase.",
    },
    {
      heading: true,
      text: "App license",
    },
    {
      heading: false,
      text: "The iOS app is licensed under Apple’s Standard End User License Agreement: https://www.apple.com/legal/internet-services/itunes/appstore/dev/stdeula/. These Site AI terms describe our project-generation service and purchases; they do not replace Apple’s app license or mandatory rights under applicable law.",
    },
    {
      heading: true,
      text: "Using Site AI",
    },
    {
      heading: false,
      text: "Site AI provides AI design concepts and project-planning guidance. You must be at least 18 and legally able to agree to these terms to use the service, generate projects or buy tokens. Permission from a parent or guardian does not replace this minimum age. You must acknowledge adult eligibility before new generation, starter claims or token purchases. Existing account data remains accessible for viewing or deletion. Keep your sign-in details secure.",
    },
    {
      heading: true,
      text: "AI designs, plans and safety",
    },
    {
      heading: false,
      text: "Site AI provides AI-generated visual concepts, planning suggestions, material lists and preliminary estimates. Images, plans, quantities, measurements and product recommendations may be wrong, incomplete, inconsistent or unsuitable for your property. An image is not a measured site survey, proof of feasibility or a safe construction specification. Site AI does not provide certified engineering drawings, permits, inspections or professional approval.",
    },
    {
      heading: false,
      text: "You are responsible for your project decisions and for independently checking the output before buying materials or starting work. Verify actual measurements, site conditions, materials, quantities, product compatibility, manufacturer instructions, local rules and necessary permits. Review every question, check and stop condition. Do not rely on Site AI as the sole basis for construction or safety decisions.",
    },
    {
      heading: false,
      text: "Structural or load-bearing work, decks and guards, stairs, electrical, gas, plumbing, excavation and other regulated or hazardous work require the appropriate qualified professional and any required design, permit or inspection. Do not start or continue such work while specifications or safety conditions remain unresolved. An AI image or plan is not permission to carry out unsafe work.",
    },
    {
      heading: false,
      text: "Budgets, prices, quantities and timelines are estimates, not live retailer quotes, guaranteed totals or promises that a project will stay within budget. Actual costs can increase because of incorrect quantities, omitted materials, unsuitable products, hidden conditions, local prices, waste, rework, delays or additional professional services. Labor, taxes, shipping, delivery, rentals, permits and other items are excluded unless expressly included. Confirm supplier prices and the complete scope, and plan for contingency costs before committing money.",
    },
    {
      heading: true,
      text: "Project tokens and payment",
    },
    {
      heading: false,
      text: "The app is free to download. One-time packs contain 1, 2 or 4 project tokens. One token starts one project with an AI design, materials and plan, plus up to three successful design revisions. There is no subscription. Packs can be purchased repeatedly; unused tokens add to the same account and do not expire. Apple shows the local price and currency before you confirm payment.",
    },
    {
      heading: false,
      text: "A request that fails before its design is saved releases its reserved token or revision. Once the design is saved, it uses that token/revision while the service attempts to finish its matching plan. Plan-only recovery does not use another token or design revision. Check the existing request before repeating interrupted work.",
    },
    {
      heading: true,
      text: "Your first project free",
    },
    {
      heading: false,
      text: "Eligible new accounts on supported iPhones and iPads can claim one free starter token for one project, including its design, materials, plan and up to three design revisions. No purchase or subscription is required for this token. The offer is limited to one per verified sign-in identity and supported device; creating another account, changing an email or reinstalling does not renew the offer. Apple DeviceCheck and limited one-way identity records enforce eligibility. A one-time launch token is also added to accounts existing at the launch-grant cutoff. Complimentary tokens do not expire, cannot be transferred or exchanged for cash, and are removed with the account. Contact support if the check fails or you need help completing your free project.",
    },
    {
      heading: true,
      text: "Purchase problems and refunds",
    },
    {
      heading: false,
      text: "If a purchase or plan is missing, open Project tokens to check your balance, or contact support@nomappsllc.com so we can investigate and help complete the service. Apple handles App Store payment/refund requests under its rules. If a complete paid project cannot be delivered, contact us for help and use Apple’s refund process where appropriate. Our Refund Policy explains missing purchases and failed projects in more detail. These terms do not exclude mandatory consumer remedies.",
    },
    {
      heading: false,
      text: "A refunded pack removes its unused tokens and cannot fund further revisions of projects created with its tokens. Used tokens do not become new unused tokens when purchases are restored. Saved projects remain readable without buying again. Deleting an account removes its unused token balance and does not automatically request an Apple refund.",
    },
    {
      heading: true,
      text: "Your photos, ideas and outputs",
    },
    {
      heading: false,
      text: "You retain your rights in the content you upload. You give Nom Apps LLC and the disclosed processors the permission needed to process and store it to provide your requested features. Do not upload content you are not entitled to use or that infringes someone else’s rights. We do not claim that AI outputs are exclusive, copyrightable or free of third-party rights; check those issues before commercial use.",
    },
    {
      heading: true,
      text: "Acceptable use and availability",
    },
    {
      heading: false,
      text: "Do not use the service unlawfully, attempt to access another account, bypass purchase/security/request limits or submit abusive material. We may restrict use that threatens the service or others. Requests depend on third-party availability and may be limited for capacity or abuse prevention. An unfinished local draft is not a promise that work was received or saved by the server.",
    },
    {
      heading: false,
      text: "When using Gemini-powered features, you must also comply with the applicable Google APIs Terms of Service (https://developers.google.com/terms), Gemini API Additional Terms (https://aistudio.google.com/docs/terms), and Generative AI Prohibited Use Policy (https://policies.google.com/terms/generative-ai/use-policy). Do not request prohibited uses or attempt to bypass provider safety controls. These requirements do not authorize a use that Google prohibits.",
    },
    {
      heading: true,
      text: "Responsibility and limits of liability",
    },
    {
      heading: false,
      text: "To the fullest extent permitted by applicable law, Site AI is provided without a guarantee of accurate or error-free output, fitness for a particular project, safe or code-compliant construction, uninterrupted availability, completion dates or budget results.",
    },
    {
      heading: false,
      text: "To the fullest extent permitted by applicable law, Nom Apps LLC is not liable for losses, costs or harm arising from reliance on inaccurate, incomplete or unsuitable AI-generated images, plans, measurements, instructions, material quantities or estimates. This includes personal injury, property damage, financial loss, wasted materials, replacement or rework costs, delays and budget overruns, but only to the extent such liability may lawfully be excluded or limited.",
    },
    {
      heading: false,
      text: "These limits do not exclude or limit liability that the law does not allow us to exclude or limit, including applicable liability for death or personal injury caused by negligence, fraud, intentional misconduct or gross negligence. They do not remove mandatory consumer guarantees, refund remedies, privacy rights or other non-waivable protections. The limits apply only to the extent permitted in your jurisdiction.",
    },
    {
      heading: false,
      text: "We will notify you appropriately of material changes and seek acceptance where required before applying revised terms to your future use. Your acceptance record identifies the version you accepted; publishing a new policy does not itself mean you accepted new terms.",
    },
    {
      heading: true,
      text: "Deletion and support",
    },
    {
      heading: false,
      text: "Delete projects from My projects and request permanent account deletion in Settings. Account deletion requires ownership confirmation and removes the private account content and RevenueCat customer profile as described in the Privacy Policy. Contact support@nomappsllc.com for purchase issues, privacy requests, unsafe or incorrect output, or other questions.",
    },
  ],
} as const;
