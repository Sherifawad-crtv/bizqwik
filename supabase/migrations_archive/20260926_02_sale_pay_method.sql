-- Record how PT packages and drop-ins were paid, so revenue can leave out
-- wallet-paid sales (wallet credit isn't new money). Existing rows stay null
-- (paid at the desk before this was tracked).
alter table public.package_instances add column if not exists pay_method text check (pay_method in ('cash','card','wallet'));
alter table public.drop_ins add column if not exists pay_method text check (pay_method in ('cash','card','wallet'));
-- Class drop-ins paid from the wallet are knowable from their roster seat.
update public.drop_ins d set pay_method = 'wallet' from public.class_bookings b where b.drop_in_id = d.id and b.pay_method = 'wallet';
