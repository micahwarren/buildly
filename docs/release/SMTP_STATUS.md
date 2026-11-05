# Account email configuration — November 5, 2026

Google SMTP is now saved in Supabase: smtp.gmail.com, port 465, company support sender/login and display name Site AI. The password was entered privately in Supabase and is not in source or chat.

The confirmation subject is **Confirm your Site AI account**. Recovery uses **Reset your Site AI password**. The prepared branded HTML templates were activated and read back; each preserves all three real `{{ .ConfirmationURL }}` expressions. The configured limit is 30 messages/hour and the resend cooldown is 60 seconds. Google/provider quotas also apply.

**Delivery and native account return are not yet verified.** The cloud delivery check could not start because deployment API requests timed out, and direct access to the Auth host is unavailable from this execution environment. Its one-time trigger was removed. No successful signup/resend/reset delivery is claimed. The opt-in check remains available for a later controlled service test; it creates only an isolated company-inbox fixture, grants no credits and removes that fixture afterward.

Next: in TestFlight 37, use a fresh email address to create an account, verify sender/subject/inbox arrival, and open the real link on that phone. Check automatic authenticated app return, then password recovery. Do not share passwords, confirmation URLs or verification tokens in chat. Gmail's SMTP provider warning remains relevant; a dedicated transactional service is recommended for public-launch deliverability.
