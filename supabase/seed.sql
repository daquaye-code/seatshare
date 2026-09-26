-- PLACEHOLDER corridors, pickup points and fares. Replace with real ones in the admin panel.
with c as (
  insert into public.corridors (name, destination, fare_ghs) values
    ('Kasoa to Head Office', 'Head Office', 30),
    ('Madina to Head Office', 'Head Office', 25),
    ('Tema to Head Office', 'Head Office', 30)
  returning id, name
)
insert into public.pickup_points (corridor_id, name, seq)
select c.id, p.name, p.seq from c join (values
  ('Kasoa to Head Office', 'Kasoa Old Barrier', 1),
  ('Kasoa to Head Office', 'Weija Junction', 2),
  ('Kasoa to Head Office', 'Mallam Junction', 3),
  ('Kasoa to Head Office', 'Kaneshie', 4),
  ('Madina to Head Office', 'Madina Market', 1),
  ('Madina to Head Office', 'Atomic Junction', 2),
  ('Madina to Head Office', 'Okponglo', 3),
  ('Madina to Head Office', '37 Military Hospital', 4),
  ('Tema to Head Office', 'Tema Community 1', 1),
  ('Tema to Head Office', 'Spintex Junction', 2),
  ('Tema to Head Office', 'Tetteh Quarshie', 3)
) as p(corridor, name, seq) on p.corridor = c.name;

-- After you have signed in to the app once, make yourself admin:
-- update public.profiles set role = 'admin', status = 'active' where email = 'you@example.com';
