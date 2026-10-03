create index if not exists community_action_rate_windows_bucket_idx
  on private.community_action_rate_windows(bucket,window_start);
