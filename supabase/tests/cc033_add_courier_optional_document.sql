begin;

create extension if not exists pgtap with schema extensions;
set local search_path to public, extensions;

select plan(1);

select has_function(
  'public',
  'add_courier_optional_document',
  array['jsonb'],
  'CC-033 expone add_courier_optional_document(jsonb)'
);

select * from finish();
rollback;
