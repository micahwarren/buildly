# Account email configuration — November 5, 2026

Google SMTP is saved in Supabase: smtp.gmail.com, port 465, company support sender/login and display name Site AI. The credential is entered privately in Supabase and is not in source or chat.

The branded confirmation and recovery templates are active. The confirmation subject is Confirm your Site AI account; real ConfirmationURL variables and confirmation security are preserved. Email limits remain 30/hour and a 60-second resend cooldown.

The live Auth logs identified the original sending failure as Gmail SMTP 534 InvalidSecondFactor. The owner replaced the credential and then confirmed that a fresh signup email arrived and its link returned to the installed Site AI app signed in. This is owner-verified confirmation delivery and native authenticated return. It is not an automated inbox test; password-recovery email delivery and broad deliverability remain unverified.

The earlier optional cloud mail-check job did not produce a verified result and its production trigger was removed. No account credits or purchases were created by that check. Gmail's personal-mail SMTP warning still applies; a transactional sender remains preferable when scaling public signup volume.
