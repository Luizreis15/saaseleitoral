-- Seed das 7 cidades do ABC
INSERT INTO public.op_cities (name, state, active)
VALUES
  ('Santo André', 'SP', TRUE),
  ('São Bernardo do Campo', 'SP', TRUE),
  ('São Caetano do Sul', 'SP', TRUE),
  ('Diadema', 'SP', TRUE),
  ('Mauá', 'SP', TRUE),
  ('Ribeirão Pires', 'SP', TRUE),
  ('Rio Grande da Serra', 'SP', TRUE)
ON CONFLICT (name) DO NOTHING;
