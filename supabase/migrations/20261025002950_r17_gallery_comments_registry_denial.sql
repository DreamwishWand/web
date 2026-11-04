update private.community_writer_routes_r16
set enrollment_state='FAIL_CLOSED',
    limitation='R17 terminal denial: direct legacy Gallery v1 and v2 Gallery branch rejected; DreamSnaps v2 under13 unchanged'
where writer_key='gallery-comments-legacy';
