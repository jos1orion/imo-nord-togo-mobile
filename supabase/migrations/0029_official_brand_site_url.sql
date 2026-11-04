begin;

update public.app_settings
set
  value = jsonb_set(
    value,
    '{official_website_url}',
    to_jsonb('https://imo-prestige.netlify.app'::text),
    true
  ),
  description = 'URLs configurables du site officiel Imo Prestige et du partenaire Netlife',
  updated_at = now()
where key = 'external_links'
  and value->>'official_website_url' = 'https://imo-nord-togo-mobile.vercel.app';

commit;
