-- Tournament formats: add ROUND_ROBIN (league table, everyone plays everyone).
alter type public.tournament_format add value if not exists 'ROUND_ROBIN';
