# Marketplace and creator policy

This policy applies to the reference marketplace server in `server/` and is the default for anyone running it. Operators of other servers may set stricter rules.

## What can be listed

Prompts (text instructions for AI models) with a title, summary, optional preview, category, tags, which models they work with, a version number and a price type.

Not allowed: content that is illegal; harassment or hate; sexual content involving minors; instructions for weapons, malware or serious harm; prompts designed to bypass AI providers' usage policies or to extract other people's data; deceptive listings (claims the prompt cannot deliver, fake reviews, impersonation); content copied without the right to share it; spam.

## Creators

- Publish only prompts you wrote or have the right to share. Prompts saved from the marketplace into your library cannot be turned into listings from the Creator Studio picker.
- Previews must describe the prompt, not reproduce it; the publish checklist flags previews that copy most of the prompt.
- Every listing (and every edit of a published listing) is reviewed by a moderator before it is visible. Rejections come with a note; you can change the listing and submit again.
- Analytics shown to creators come only from the server: page views (counted once per visitor per hour), trials started, free acquisitions and reviews. FlowCompanion does not report what people do with a prompt after they have it.
- Free listings may also be shared as `.flowprompt.json` files. Paid listings may not.

## Prices, trials and payments

- **Payments are not implemented.** The reference server answers purchase requests with "Payments are not set up on this marketplace server". FlowCompanion never shows a purchase as completed and never charges anything.
- A creator may offer a **7-day free trial** on a paid listing. Trials are granted and ended by the server; one per account per listing. Before starting, the person sees what happens at the end (access stops, nothing is charged, nothing is bought automatically) and must confirm.
- During a trial the prompt can be used and copied, but not saved to the library.
- Refunds, receipts, taxes and creator payouts do not exist because nothing can be bought. A server that adds payments must add them before enabling purchases.

## Reviews and ratings

- Only people who used a prompt (free acquisition, trial or purchase) can review it, so every review is verified. Creators cannot review their own listings. One review per person per listing (updatable).
- Ratings on bundled and imported prompts are kept on the user's computer and are never shown as public ratings.
- No reviews, ratings, sales figures or download counts are invented anywhere, including in demo data.

## Reports and moderation

- Anyone signed in can report a listing (spam, harmful, copyright, misleading, other). Reports go to the server's moderators, who can dismiss them, mark them reviewed or remove the listing.
- Reports on bundled or imported listings stay on the user's computer and hide that listing for them; they can undo this.
- Moderators are accounts whose email matches `FC_MARKET_ADMIN_EMAIL` on the server.

## Demo content

`--seed-demo` adds three listings from "Sample creator (demo data)", titled "Demo: …" and labelled Demo in the app. They have no reviews or sales.
