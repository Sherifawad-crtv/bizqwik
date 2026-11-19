-- Solo owner settings: a one-off drop-in price and her InstaPay QR image.
alter table public.organizations
  add column if not exists dropin_price numeric check (dropin_price is null or dropin_price >= 0),
  add column if not exists instapay_qr text;
