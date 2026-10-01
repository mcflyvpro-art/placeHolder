import 'server-only';

function req(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Variable d'environnement manquante : ${name}`);
  return v;
}

const opt = (name: string) => process.env[name]?.trim() || null;

export const env = {
  get supabaseUrl() { return req('SUPABASE_URL'); },
  get supabaseService() { return req('SUPABASE_SERVICE_ROLE_KEY'); },
  get appUrl() { return opt('APP_URL') ?? 'http://localhost:3000'; },
  get googleKey() { return opt('GOOGLE_PLACES_KEY'); },
  get pagespeedKey() { return opt('PAGESPEED_KEY'); },
  get githubToken() { return opt('GITHUB_TOKEN'); },
  get githubOwner() { return opt('GITHUB_OWNER') ?? 'mcflyvpro-art'; },
  get githubTemplate() { return opt('GITHUB_TEMPLATE_REPO') ?? 'placeholder-site-template'; },
  get cloudflareToken() { return opt('CLOUDFLARE_API_TOKEN'); },
  get cloudflareAccount() { return opt('CLOUDFLARE_ACCOUNT_ID'); },
  get porkbunKey() { return opt('PORKBUN_API_KEY'); },
  get porkbunSecret() { return opt('PORKBUN_SECRET_KEY'); },
  get stripeKey() { return opt('STRIPE_SECRET_KEY'); },
  get stripeWebhookSecret() { return opt('STRIPE_WEBHOOK_SECRET'); },
  get siteWebhookSecret() { return opt('SITE_WEBHOOK_SECRET'); },
  get turnstileSecret() { return opt('TURNSTILE_SECRET_KEY'); },
  get smtpUser() { return opt('SMTP_USER'); },
  get smtpPass() { return opt('SMTP_PASS'); },
  get cronSecret() { return opt('CRON_SECRET'); },
};

/** Intégrations configurées — l'UI masque ou désactive ce qui manque. */
export function integrations() {
  return {
    google: !!env.googleKey,
    github: !!env.githubToken,
    cloudflare: !!(env.cloudflareToken && env.cloudflareAccount),
    porkbun: !!(env.porkbunKey && env.porkbunSecret),
    stripe: !!env.stripeKey,
    smtp: !!(env.smtpUser && env.smtpPass),
  };
}
