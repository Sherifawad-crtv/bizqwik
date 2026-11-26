-- A desk drop-in for a specific class session writes both a drop_ins row (the
-- sale) and a class_bookings row (the roster seat). Linking them keeps revenue
-- from counting the same payment twice.
alter table class_bookings add column drop_in_id uuid references drop_ins(id) on delete set null;
create index class_bookings_drop_in_idx on class_bookings(drop_in_id);
alter table drop_ins add column class_id uuid references classes(id) on delete set null;
create index drop_ins_class_idx on drop_ins(class_id);
