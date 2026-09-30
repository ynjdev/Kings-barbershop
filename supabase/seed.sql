-- =====================================================================
-- Kings Barbershop starter data: the services, prices, barbers and hours
-- that are on the website today. Run once, after schema.sql.
-- Change anything later in the admin (Settings tab).
-- =====================================================================

insert into services (id, name, description, price_cents, minutes, sort) values
  ('signature-cut',   'Signature cut',   'Consultation, cut, hot towel, styling', 18000, 45, 1),
  ('skin-fade',       'Skin fade',       'Bald fade, lineup, finish',             20000, 50, 2),
  ('cut-beard',       'Cut & beard',     'Full cut plus beard shape and oil',     26000, 60, 3),
  ('hot-towel-shave', 'Hot towel shave', 'Steam, straight razor, balm',           17000, 40, 4),
  ('beard-trim',      'Beard trim',      'Shape, line, condition',                11000, 25, 5),
  ('kids-cut',        'Kids under 12',   'Cut and lineup',                        12000, 30, 6),
  ('lineup',          'Lineup only',     'Between-cut touch up',                   7000, 15, 7)
on conflict (id) do nothing;

-- barbers two and three are placeholders: rename them in the admin once Jermaine confirms
insert into barbers (name, role, sort)
select v.name, v.role, v.sort from (values ('Jermaine', 'Owner', 1), ('Barber two', 'Senior barber', 2), ('Barber three', 'Barber', 3)) v(name, role, sort)
where not exists (select 1 from barbers);

-- everyone works the shop hours: Mon to Fri 08:00-18:00, Sat 08:00-17:00, Sun 09:00-14:00
insert into working_hours (barber_id, weekday, starts, ends)
select b.id, d.weekday, d.starts, d.ends
  from barbers b,
       (values (1, time '08:00', time '18:00'), (2, '08:00', '18:00'), (3, '08:00', '18:00'), (4, '08:00', '18:00'),
               (5, '08:00', '18:00'), (6, '08:00', '17:00'), (0, '09:00', '14:00')) d(weekday, starts, ends)
on conflict do nothing;
