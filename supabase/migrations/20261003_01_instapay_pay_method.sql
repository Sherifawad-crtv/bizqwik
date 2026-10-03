-- InstaPay (bank transfer) joins cash / card / wallet as a way to pay for a sale.
-- Additive: widens three CHECK constraints; no data changes.
alter table public.group_plans drop constraint if exists group_plans_pay_method_check;
alter table public.group_plans add constraint group_plans_pay_method_check check (pay_method in ('cash','card','instapay','wallet'));

alter table public.package_instances drop constraint if exists package_instances_pay_method_check;
alter table public.package_instances add constraint package_instances_pay_method_check check (pay_method in ('cash','card','instapay','wallet'));

alter table public.drop_ins drop constraint if exists drop_ins_pay_method_check;
alter table public.drop_ins add constraint drop_ins_pay_method_check check (pay_method in ('cash','card','instapay','wallet'));
