export const legal = {
  privacy: [
    {
      heading: false,
      text: "Last updated October 29, 2026. Buildly is provided by Nom Apps LLC. Contact support@nomappsllc.com for privacy and support requests.",
    },
    { heading: true, text: "Information you provide" },
    {
      heading: false,
      text: "We use your email address to manage your account. We store the project descriptions, photos, reference images, material preferences and generated designs you save. Do not upload images you do not have permission to use or sensitive personal documents.",
    },
    { heading: true, text: "AI processing" },
    {
      heading: false,
      text: "With your permission, your selected photos and descriptions are sent to the AI services identified in the app before generation. Google Gemini provides planning and may generate images; OpenAI may generate images when configured. These services process your content under their own applicable terms. AI output can be inaccurate. You can withdraw permission for future requests in Settings. Requests already submitted may continue processing.",
    },
    { heading: true, text: "Accounts, storage and diagnostics" },
    {
      heading: false,
      text: "Supabase provides account and private project storage. Our hosting provider processes service requests. We use limited operational records, such as request identifiers, status, duration and model token counts, to provide the service and investigate failures. If you enable minimal error reporting in Settings, we also receive a report linked to your account containing the app version, platform and a one-way error fingerprint. Those reports are retained for up to 30 days. Routine application logs should not contain your photos, passwords or full project descriptions. Buildly does not sell personal information or use advertising trackers.",
    },
    { heading: true, text: "Device storage" },
    {
      heading: false,
      text: "Your phone stores an account session securely and may save unfinished project drafts in the app’s private storage. Drafts are associated with your account and are cleared when you log out or delete your account. Removing the app removes its local app data, subject to your device’s backup settings.",
    },
    { heading: true, text: "Retention and deletion" },
    {
      heading: false,
      text: "Saved projects remain until you delete them or your account. Project deletion removes the project and its private photos; a failed cleanup is retried when deletion is retried. Use Settings → Delete my account to request permanent deletion of your account, projects and private project photos. This requires password confirmation. Backups may retain data until their normal retention period expires. Providers may retain limited records where required for legal or operational purposes.",
    },
    {
      heading: false,
      text: "For access, correction, deletion assistance or other privacy questions, contact support@nomappsllc.com. We will update this notice when our data practices change.",
    },
  ],
  terms: [
    {
      heading: false,
      text: "Last updated October 29, 2026. These terms apply to Buildly, provided by Nom Apps LLC. Contact support@nomappsllc.com for assistance.",
    },
    { heading: true, text: "What Buildly provides" },
    {
      heading: false,
      text: "Buildly generates design concepts, suggested measurements, estimated materials and planning guidance. AI-generated images, instructions, quantities and costs may contain errors. A photograph cannot establish hidden structure, actual dimensions, product specifications or code compliance.",
    },
    { heading: true, text: "Before buying or building" },
    {
      heading: false,
      text: "Verify measurements and material quantities on site. Resolve the plan’s questions, checks and stop conditions before proceeding. Obtain qualified professional help for structural, electrical, gas, plumbing and other regulated or hazardous work. Buildly does not provide certified engineering drawings, permits, inspections or a guarantee of structural safety.",
    },
    {
      heading: false,
      text: "Estimated costs are reference allowances, not live retailer quotes. Unconfirmed quantities or prices may be excluded from a partial estimate. Labor, tax, delivery, rentals and permits are excluded unless explicitly included. Check product instructions and applicable local requirements.",
    },
    { heading: true, text: "Your account and content" },
    {
      heading: false,
      text: "Keep your account credentials private. Upload only content you are entitled to use. You retain your rights to your content and authorize Buildly and its identified service providers to process it to deliver the requested features. Do not use the service for unlawful purposes or attempt to bypass access controls or request limits.",
    },
    { heading: true, text: "Service availability" },
    {
      heading: false,
      text: "Generation may take several minutes and depends on third-party services. Availability and output quality are not guaranteed. Request limits may apply. Check request history before repeating interrupted work. Saved drafts do not guarantee recovery of work that was never received or completed by the server.",
    },
    { heading: true, text: "Deleting your data and getting help" },
    {
      heading: false,
      text: "You can delete projects or your account in the app. Account deletion is permanent. Contact support@nomappsllc.com for help or to report incorrect output. These terms do not limit rights that cannot legally be excluded under applicable consumer law.",
    },
  ],
} as const;
