// Public legal pages on the WordPress site (drafts in the shared legal/ folder).
export const TERMS_URL = 'https://talentseek.ca/terms/'
export const PRIVACY_URL = 'https://talentseek.ca/privacy-policy/'

// Marketing-email consent shown at sign-up. The backend records consent only for
// wording it knows, so a change here needs a new version row in a Supabase
// migration (see 014_marketing_consent.sql). Never edit a published version.
export const MARKETING_CONSENT_VERSION = '2026-09-27'
export const MARKETING_CONSENT_TEXT = 'Yes, email me job-search tips, product updates and offers from TalentSeek. I can unsubscribe at any time.'
