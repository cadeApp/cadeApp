create index delivery_requests_published_cursor_idx
  on public.delivery_requests (created_at desc, id desc)
  where status = 'published';

create index offers_request_created_cursor_idx
  on public.offers (request_id, created_at desc, id desc);
