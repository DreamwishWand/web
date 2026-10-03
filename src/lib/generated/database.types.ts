export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_deletion_events: {
        Row: {
          account_id: string
          auth_identities_retired: boolean
          completed_at: string | null
          content_purge_after: string | null
          content_purged_at: string | null
          deletion_event_id: string
          operational_scrub_after: string | null
          operational_scrubbed_at: string | null
          private_interactions_removed: boolean
          public_content_hidden: boolean
          public_profile_anonymized: boolean
          requested_at: string
          retention_state: string
        }
        Insert: {
          account_id: string
          auth_identities_retired?: boolean
          completed_at?: string | null
          content_purge_after?: string | null
          content_purged_at?: string | null
          deletion_event_id?: string
          operational_scrub_after?: string | null
          operational_scrubbed_at?: string | null
          private_interactions_removed?: boolean
          public_content_hidden?: boolean
          public_profile_anonymized?: boolean
          requested_at?: string
          retention_state?: string
        }
        Update: {
          account_id?: string
          auth_identities_retired?: boolean
          completed_at?: string | null
          content_purge_after?: string | null
          content_purged_at?: string | null
          deletion_event_id?: string
          operational_scrub_after?: string | null
          operational_scrubbed_at?: string | null
          private_interactions_removed?: boolean
          public_content_hidden?: boolean
          public_profile_anonymized?: boolean
          requested_at?: string
          retention_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_deletion_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
        ]
      }
      account_recovery_cases: {
        Row: {
          account_id: string
          completed_at: string | null
          completed_by_account_id: string | null
          created_at: string
          opened_by_account_id: string
          ready_at: string | null
          reason: string
          recovery_case_id: string
          requested_provider: string
          requested_provider_subject: string
          state: string
          updated_at: string
          verification_method: string | null
          verification_ref: string | null
          verification_state: string
          verified_at: string | null
          verified_by_account_id: string | null
        }
        Insert: {
          account_id: string
          completed_at?: string | null
          completed_by_account_id?: string | null
          created_at?: string
          opened_by_account_id: string
          ready_at?: string | null
          reason: string
          recovery_case_id?: string
          requested_provider: string
          requested_provider_subject: string
          state?: string
          updated_at?: string
          verification_method?: string | null
          verification_ref?: string | null
          verification_state?: string
          verified_at?: string | null
          verified_by_account_id?: string | null
        }
        Update: {
          account_id?: string
          completed_at?: string | null
          completed_by_account_id?: string | null
          created_at?: string
          opened_by_account_id?: string
          ready_at?: string | null
          reason?: string
          recovery_case_id?: string
          requested_provider?: string
          requested_provider_subject?: string
          state?: string
          updated_at?: string
          verification_method?: string | null
          verification_ref?: string | null
          verification_state?: string
          verified_at?: string | null
          verified_by_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_recovery_cases_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "account_recovery_cases_completed_by_account_id_fkey"
            columns: ["completed_by_account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "account_recovery_cases_opened_by_account_id_fkey"
            columns: ["opened_by_account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "account_recovery_cases_verified_by_account_id_fkey"
            columns: ["verified_by_account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
        ]
      }
      account_roles: {
        Row: {
          account_id: string
          created_at: string
          role: string
        }
        Insert: {
          account_id: string
          created_at?: string
          role: string
        }
        Update: {
          account_id?: string
          created_at?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_roles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
        ]
      }
      artifact_blobs: {
        Row: {
          blob_id: string
          byte_size: number
          checksum_sha256: string
          content_type: string
          created_at: string
          owner_account_id: string
          purged_at: string | null
          schema_version: number
          storage_key: string
        }
        Insert: {
          blob_id?: string
          byte_size: number
          checksum_sha256: string
          content_type: string
          created_at?: string
          owner_account_id: string
          purged_at?: string | null
          schema_version: number
          storage_key: string
        }
        Update: {
          blob_id?: string
          byte_size?: number
          checksum_sha256?: string
          content_type?: string
          created_at?: string
          owner_account_id?: string
          purged_at?: string | null
          schema_version?: number
          storage_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "artifact_blobs_owner_account_id_fkey"
            columns: ["owner_account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action_type: string
          actor_account_id: string | null
          audit_event_id: string
          created_at: string
          metadata: Json
          request_correlation_id: string | null
          target_entity_id: string | null
        }
        Insert: {
          action_type: string
          actor_account_id?: string | null
          audit_event_id?: string
          created_at?: string
          metadata?: Json
          request_correlation_id?: string | null
          target_entity_id?: string | null
        }
        Update: {
          action_type?: string
          actor_account_id?: string | null
          audit_event_id?: string
          created_at?: string
          metadata?: Json
          request_correlation_id?: string | null
          target_entity_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_account_id_fkey"
            columns: ["actor_account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "audit_events_target_entity_id_fkey"
            columns: ["target_entity_id"]
            isOneToOne: false
            referencedRelation: "community_entities"
            referencedColumns: ["entity_id"]
          },
        ]
      }
      auth_identities: {
        Row: {
          account_id: string
          auth_identity_id: string
          created_at: string
          identity_state: string
          last_verified_at: string | null
          provider: string
          provider_subject: string
          replaced_by_auth_identity_id: string | null
          retired_at: string | null
          sessions_valid_after: string
        }
        Insert: {
          account_id: string
          auth_identity_id?: string
          created_at?: string
          identity_state?: string
          last_verified_at?: string | null
          provider: string
          provider_subject: string
          replaced_by_auth_identity_id?: string | null
          retired_at?: string | null
          sessions_valid_after?: string
        }
        Update: {
          account_id?: string
          auth_identity_id?: string
          created_at?: string
          identity_state?: string
          last_verified_at?: string | null
          provider?: string
          provider_subject?: string
          replaced_by_auth_identity_id?: string | null
          retired_at?: string | null
          sessions_valid_after?: string
        }
        Relationships: [
          {
            foreignKeyName: "auth_identities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "auth_identities_replaced_by_auth_identity_id_fkey"
            columns: ["replaced_by_auth_identity_id"]
            isOneToOne: false
            referencedRelation: "auth_identities"
            referencedColumns: ["auth_identity_id"]
          },
        ]
      }
      comments: {
        Row: {
          author_account_id: string
          body: string
          comment_id: string
          created_at: string
          creator_profile_id: string
          lifecycle_state: string
          moderation_state: Database["public"]["Enums"]["moderation_state"]
          parent_comment_id: string | null
          row_version: number
          target_entity_id: string
          updated_at: string
        }
        Insert: {
          author_account_id: string
          body: string
          comment_id: string
          created_at?: string
          creator_profile_id: string
          lifecycle_state?: string
          moderation_state?: Database["public"]["Enums"]["moderation_state"]
          parent_comment_id?: string | null
          row_version?: number
          target_entity_id: string
          updated_at?: string
        }
        Update: {
          author_account_id?: string
          body?: string
          comment_id?: string
          created_at?: string
          creator_profile_id?: string
          lifecycle_state?: string
          moderation_state?: Database["public"]["Enums"]["moderation_state"]
          parent_comment_id?: string | null
          row_version?: number
          target_entity_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_account_id_fkey"
            columns: ["author_account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "comments_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: true
            referencedRelation: "community_entities"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "comments_creator_profile_id_fkey"
            columns: ["creator_profile_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["creator_profile_id"]
          },
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["comment_id"]
          },
          {
            foreignKeyName: "comments_target_entity_id_fkey"
            columns: ["target_entity_id"]
            isOneToOne: false
            referencedRelation: "community_entities"
            referencedColumns: ["entity_id"]
          },
        ]
      }
      community_entities: {
        Row: {
          created_at: string
          deleted_at: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["community_entity_type"]
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          entity_id?: string
          entity_type: Database["public"]["Enums"]["community_entity_type"]
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["community_entity_type"]
        }
        Relationships: []
      }
      community_entity_origins: {
        Row: {
          created_at: string
          entity_id: string
          origin_kind: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          origin_kind: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          origin_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_entity_origins_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "community_entities"
            referencedColumns: ["entity_id"]
          },
        ]
      }
      community_work_revisions: {
        Row: {
          created_at: string
          created_by_account_id: string
          revision_id: string
          revision_number: number
          sealed_at: string | null
          shared_metadata: Json
          work_id: string
        }
        Insert: {
          created_at?: string
          created_by_account_id: string
          revision_id?: string
          revision_number: number
          sealed_at?: string | null
          shared_metadata?: Json
          work_id: string
        }
        Update: {
          created_at?: string
          created_by_account_id?: string
          revision_id?: string
          revision_number?: number
          sealed_at?: string | null
          shared_metadata?: Json
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_work_revisions_created_by_account_id_fkey"
            columns: ["created_by_account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "community_work_revisions_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "community_works"
            referencedColumns: ["work_id"]
          },
        ]
      }
      community_works: {
        Row: {
          created_at: string
          creator_profile_id: string
          current_published_revision_id: string | null
          lifecycle_state: Database["public"]["Enums"]["work_lifecycle_state"]
          moderation_state: Database["public"]["Enums"]["moderation_state"]
          owner_account_id: string
          published_at: string | null
          row_version: number
          updated_at: string
          visibility: Database["public"]["Enums"]["visibility_state"]
          work_id: string
          work_type: Database["public"]["Enums"]["work_type"]
        }
        Insert: {
          created_at?: string
          creator_profile_id: string
          current_published_revision_id?: string | null
          lifecycle_state?: Database["public"]["Enums"]["work_lifecycle_state"]
          moderation_state?: Database["public"]["Enums"]["moderation_state"]
          owner_account_id: string
          published_at?: string | null
          row_version?: number
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility_state"]
          work_id: string
          work_type: Database["public"]["Enums"]["work_type"]
        }
        Update: {
          created_at?: string
          creator_profile_id?: string
          current_published_revision_id?: string | null
          lifecycle_state?: Database["public"]["Enums"]["work_lifecycle_state"]
          moderation_state?: Database["public"]["Enums"]["moderation_state"]
          owner_account_id?: string
          published_at?: string | null
          row_version?: number
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility_state"]
          work_id?: string
          work_type?: Database["public"]["Enums"]["work_type"]
        }
        Relationships: [
          {
            foreignKeyName: "community_works_creator_profile_id_fkey"
            columns: ["creator_profile_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["creator_profile_id"]
          },
          {
            foreignKeyName: "community_works_current_published_revision_fk"
            columns: ["current_published_revision_id"]
            isOneToOne: false
            referencedRelation: "community_work_revisions"
            referencedColumns: ["revision_id"]
          },
          {
            foreignKeyName: "community_works_owner_account_id_fkey"
            columns: ["owner_account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "community_works_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: true
            referencedRelation: "community_entities"
            referencedColumns: ["entity_id"]
          },
        ]
      }
      creator_profiles: {
        Row: {
          avatar_media_id: string | null
          bio: string | null
          created_at: string
          creator_profile_id: string
          display_name: string
          handle: string
          handle_normalized: string | null
          moderation_state: Database["public"]["Enums"]["moderation_state"]
          owner_account_id: string
          profile_visibility: Database["public"]["Enums"]["visibility_state"]
          row_version: number
          updated_at: string
        }
        Insert: {
          avatar_media_id?: string | null
          bio?: string | null
          created_at?: string
          creator_profile_id: string
          display_name: string
          handle: string
          handle_normalized?: string | null
          moderation_state?: Database["public"]["Enums"]["moderation_state"]
          owner_account_id: string
          profile_visibility?: Database["public"]["Enums"]["visibility_state"]
          row_version?: number
          updated_at?: string
        }
        Update: {
          avatar_media_id?: string | null
          bio?: string | null
          created_at?: string
          creator_profile_id?: string
          display_name?: string
          handle?: string
          handle_normalized?: string | null
          moderation_state?: Database["public"]["Enums"]["moderation_state"]
          owner_account_id?: string
          profile_visibility?: Database["public"]["Enums"]["visibility_state"]
          row_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_profiles_avatar_media_fk"
            columns: ["avatar_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["media_id"]
          },
          {
            foreignKeyName: "creator_profiles_creator_profile_id_fkey"
            columns: ["creator_profile_id"]
            isOneToOne: true
            referencedRelation: "community_entities"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "creator_profiles_owner_account_id_fkey"
            columns: ["owner_account_id"]
            isOneToOne: true
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
        ]
      }
      ddv_profile_workspaces: {
        Row: {
          account_id: string
          created_at: string
          display_name: string | null
          lifecycle_state: string
          relationship_kind: string
          slot_index: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          display_name?: string | null
          lifecycle_state?: string
          relationship_kind?: string
          slot_index: number
          updated_at?: string
          workspace_id?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          display_name?: string | null
          lifecycle_state?: string
          relationship_kind?: string
          slot_index?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ddv_profile_workspaces_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
        ]
      }
      ddv_profiles: {
        Row: {
          binding_key_hash: string | null
          binding_state: string
          created_at: string
          ddv_profile_id: string
          updated_at: string
        }
        Insert: {
          binding_key_hash?: string | null
          binding_state?: string
          created_at?: string
          ddv_profile_id?: string
          updated_at?: string
        }
        Update: {
          binding_key_hash?: string | null
          binding_state?: string
          created_at?: string
          ddv_profile_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      dreamsnap_challenges: {
        Row: {
          allow_post_formal_browse: boolean
          allow_special_picks: boolean
          challenge_id: string
          challenge_key: string
          closes_at: string
          created_at: string
          description: string | null
          formal_vote_allowance: number
          is_synthetic: boolean
          judging_closes_at: string
          judging_opens_at: string
          lifecycle_state: string
          minimum_height: number | null
          minimum_real_eligible_entries: number
          minimum_width: number | null
          required_aspect_denominator: number | null
          required_aspect_numerator: number | null
          result_algorithm: string | null
          results_at: string
          row_version: number
          special_pick_allowance: number
          submission_closes_at: string
          submission_opens_at: string
          title: string
          updated_at: string
        }
        Insert: {
          allow_post_formal_browse?: boolean
          allow_special_picks?: boolean
          challenge_id?: string
          challenge_key: string
          closes_at: string
          created_at?: string
          description?: string | null
          formal_vote_allowance: number
          is_synthetic?: boolean
          judging_closes_at: string
          judging_opens_at: string
          lifecycle_state?: string
          minimum_height?: number | null
          minimum_real_eligible_entries: number
          minimum_width?: number | null
          required_aspect_denominator?: number | null
          required_aspect_numerator?: number | null
          result_algorithm?: string | null
          results_at: string
          row_version?: number
          special_pick_allowance: number
          submission_closes_at: string
          submission_opens_at: string
          title: string
          updated_at?: string
        }
        Update: {
          allow_post_formal_browse?: boolean
          allow_special_picks?: boolean
          challenge_id?: string
          challenge_key?: string
          closes_at?: string
          created_at?: string
          description?: string | null
          formal_vote_allowance?: number
          is_synthetic?: boolean
          judging_closes_at?: string
          judging_opens_at?: string
          lifecycle_state?: string
          minimum_height?: number | null
          minimum_real_eligible_entries?: number
          minimum_width?: number | null
          required_aspect_denominator?: number | null
          required_aspect_numerator?: number | null
          result_algorithm?: string | null
          results_at?: string
          row_version?: number
          special_pick_allowance?: number
          submission_closes_at?: string
          submission_opens_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      dreamsnap_entries: {
        Row: {
          account_id: string
          challenge_id: string
          eligibility_state: string
          entry_id: string
          entry_revision_id: string
          entry_state: string
          frozen_at: string
          joined_at: string
          managed_under13: boolean
          origin_kind: string
          updated_at: string
          work_id: string
          workspace_id: string | null
        }
        Insert: {
          account_id: string
          challenge_id: string
          eligibility_state?: string
          entry_id?: string
          entry_revision_id: string
          entry_state?: string
          frozen_at?: string
          joined_at?: string
          managed_under13?: boolean
          origin_kind: string
          updated_at?: string
          work_id: string
          workspace_id?: string | null
        }
        Update: {
          account_id?: string
          challenge_id?: string
          eligibility_state?: string
          entry_id?: string
          entry_revision_id?: string
          entry_state?: string
          frozen_at?: string
          joined_at?: string
          managed_under13?: boolean
          origin_kind?: string
          updated_at?: string
          work_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dreamsnap_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "dreamsnap_entries_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "dreamsnap_challenges"
            referencedColumns: ["challenge_id"]
          },
          {
            foreignKeyName: "dreamsnap_entries_entry_revision_id_fkey"
            columns: ["entry_revision_id"]
            isOneToOne: false
            referencedRelation: "dreamsnap_work_revisions"
            referencedColumns: ["revision_id"]
          },
          {
            foreignKeyName: "dreamsnap_entries_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "dreamsnap_works"
            referencedColumns: ["work_id"]
          },
          {
            foreignKeyName: "dreamsnap_entries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "ddv_profile_workspaces"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      dreamsnap_entry_revision_history: {
        Row: {
          binding_id: string
          bound_at: string
          entry_id: string
          revision_id: string
          unbound_at: string | null
        }
        Insert: {
          binding_id?: string
          bound_at?: string
          entry_id: string
          revision_id: string
          unbound_at?: string | null
        }
        Update: {
          binding_id?: string
          bound_at?: string
          entry_id?: string
          revision_id?: string
          unbound_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dreamsnap_entry_revision_history_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "dreamsnap_entries"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "dreamsnap_entry_revision_history_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "dreamsnap_work_revisions"
            referencedColumns: ["revision_id"]
          },
        ]
      }
      dreamsnap_formal_votes: {
        Row: {
          challenge_id: string
          created_at: string
          entry_id: string
          entry_revision_id: string
          voter_account_id: string
          voter_origin_kind: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          entry_id: string
          entry_revision_id: string
          voter_account_id: string
          voter_origin_kind: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          entry_id?: string
          entry_revision_id?: string
          voter_account_id?: string
          voter_origin_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "dreamsnap_formal_votes_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "dreamsnap_challenges"
            referencedColumns: ["challenge_id"]
          },
          {
            foreignKeyName: "dreamsnap_formal_votes_entry_id_challenge_id_fkey"
            columns: ["entry_id", "challenge_id"]
            isOneToOne: false
            referencedRelation: "dreamsnap_entries"
            referencedColumns: ["entry_id", "challenge_id"]
          },
          {
            foreignKeyName: "dreamsnap_formal_votes_entry_revision_id_fkey"
            columns: ["entry_revision_id"]
            isOneToOne: false
            referencedRelation: "dreamsnap_work_revisions"
            referencedColumns: ["revision_id"]
          },
          {
            foreignKeyName: "dreamsnap_formal_votes_voter_account_id_fkey"
            columns: ["voter_account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
        ]
      }
      dreamsnap_gallery_publications: {
        Row: {
          comments_enabled: boolean
          entry_id: string
          publication_state: string
          published_at: string
          revision_id: string
          updated_at: string
          work_id: string
        }
        Insert: {
          comments_enabled?: boolean
          entry_id: string
          publication_state?: string
          published_at?: string
          revision_id: string
          updated_at?: string
          work_id: string
        }
        Update: {
          comments_enabled?: boolean
          entry_id?: string
          publication_state?: string
          published_at?: string
          revision_id?: string
          updated_at?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dreamsnap_gallery_publications_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: true
            referencedRelation: "dreamsnap_entries"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "dreamsnap_gallery_publications_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "dreamsnap_work_revisions"
            referencedColumns: ["revision_id"]
          },
          {
            foreignKeyName: "dreamsnap_gallery_publications_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: true
            referencedRelation: "dreamsnap_works"
            referencedColumns: ["work_id"]
          },
        ]
      }
      dreamsnap_official_result_publication: {
        Row: {
          entry_id: string
          public_fields: string[]
          published_at: string | null
          updated_at: string
        }
        Insert: {
          entry_id: string
          public_fields?: string[]
          published_at?: string | null
          updated_at?: string
        }
        Update: {
          entry_id?: string
          public_fields?: string[]
          published_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dreamsnap_official_result_publication_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: true
            referencedRelation: "dreamsnap_official_results"
            referencedColumns: ["entry_id"]
          },
        ]
      }
      dreamsnap_official_results: {
        Row: {
          account_id: string
          entry_id: string
          moonstones: number | null
          official_payload: Json
          pixel_dust: number | null
          rank: number | null
          recorded_at: string
          score: number | null
          updated_at: string
        }
        Insert: {
          account_id: string
          entry_id: string
          moonstones?: number | null
          official_payload?: Json
          pixel_dust?: number | null
          rank?: number | null
          recorded_at?: string
          score?: number | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          entry_id?: string
          moonstones?: number | null
          official_payload?: Json
          pixel_dust?: number | null
          rank?: number | null
          recorded_at?: string
          score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dreamsnap_official_results_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "dreamsnap_official_results_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: true
            referencedRelation: "dreamsnap_entries"
            referencedColumns: ["entry_id"]
          },
        ]
      }
      dreamsnap_special_picks: {
        Row: {
          account_id: string
          actor_origin_kind: string
          challenge_id: string
          created_at: string
          entry_id: string
          entry_revision_id: string
        }
        Insert: {
          account_id: string
          actor_origin_kind: string
          challenge_id: string
          created_at?: string
          entry_id: string
          entry_revision_id: string
        }
        Update: {
          account_id?: string
          actor_origin_kind?: string
          challenge_id?: string
          created_at?: string
          entry_id?: string
          entry_revision_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dreamsnap_special_picks_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "dreamsnap_special_picks_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "dreamsnap_challenges"
            referencedColumns: ["challenge_id"]
          },
          {
            foreignKeyName: "dreamsnap_special_picks_entry_id_challenge_id_fkey"
            columns: ["entry_id", "challenge_id"]
            isOneToOne: false
            referencedRelation: "dreamsnap_entries"
            referencedColumns: ["entry_id", "challenge_id"]
          },
          {
            foreignKeyName: "dreamsnap_special_picks_entry_revision_id_fkey"
            columns: ["entry_revision_id"]
            isOneToOne: false
            referencedRelation: "dreamsnap_work_revisions"
            referencedColumns: ["revision_id"]
          },
        ]
      }
      dreamsnap_wand_results: {
        Row: {
          challenge_id: string
          entry_id: string
          entry_revision_id: string
          finalized_at: string
          formal_score: number
          placement: number
          result_payload: Json
        }
        Insert: {
          challenge_id: string
          entry_id: string
          entry_revision_id: string
          finalized_at?: string
          formal_score: number
          placement: number
          result_payload?: Json
        }
        Update: {
          challenge_id?: string
          entry_id?: string
          entry_revision_id?: string
          finalized_at?: string
          formal_score?: number
          placement?: number
          result_payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "dreamsnap_wand_results_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "dreamsnap_challenges"
            referencedColumns: ["challenge_id"]
          },
          {
            foreignKeyName: "dreamsnap_wand_results_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: true
            referencedRelation: "dreamsnap_entries"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "dreamsnap_wand_results_entry_revision_id_fkey"
            columns: ["entry_revision_id"]
            isOneToOne: false
            referencedRelation: "dreamsnap_work_revisions"
            referencedColumns: ["revision_id"]
          },
        ]
      }
      dreamsnap_work_revisions: {
        Row: {
          challenge_id: string
          created_at: string
          game_screenshot_attested: boolean
          integrity_checks: Json
          integrity_state: string
          no_external_edits_attested: boolean
          revision_id: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          game_screenshot_attested: boolean
          integrity_checks?: Json
          integrity_state: string
          no_external_edits_attested: boolean
          revision_id: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          game_screenshot_attested?: boolean
          integrity_checks?: Json
          integrity_state?: string
          no_external_edits_attested?: boolean
          revision_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dreamsnap_work_revisions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "dreamsnap_challenges"
            referencedColumns: ["challenge_id"]
          },
          {
            foreignKeyName: "dreamsnap_work_revisions_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: true
            referencedRelation: "community_work_revisions"
            referencedColumns: ["revision_id"]
          },
        ]
      }
      dreamsnap_works: {
        Row: {
          challenge_id: string
          managed_under13: boolean
          registered_at: string
          source_workspace_id: string | null
          updated_at: string
          work_id: string
          workspace_relationship_kind: string
        }
        Insert: {
          challenge_id: string
          managed_under13: boolean
          registered_at?: string
          source_workspace_id?: string | null
          updated_at?: string
          work_id: string
          workspace_relationship_kind: string
        }
        Update: {
          challenge_id?: string
          managed_under13?: boolean
          registered_at?: string
          source_workspace_id?: string | null
          updated_at?: string
          work_id?: string
          workspace_relationship_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "dreamsnap_works_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "dreamsnap_challenges"
            referencedColumns: ["challenge_id"]
          },
          {
            foreignKeyName: "dreamsnap_works_source_workspace_id_fkey"
            columns: ["source_workspace_id"]
            isOneToOne: false
            referencedRelation: "ddv_profile_workspaces"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "dreamsnap_works_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: true
            referencedRelation: "community_works"
            referencedColumns: ["work_id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          creator_profile_id: string
          follower_account_id: string
        }
        Insert: {
          created_at?: string
          creator_profile_id: string
          follower_account_id: string
        }
        Update: {
          created_at?: string
          creator_profile_id?: string
          follower_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_creator_profile_id_fkey"
            columns: ["creator_profile_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["creator_profile_id"]
          },
          {
            foreignKeyName: "follows_follower_account_id_fkey"
            columns: ["follower_account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
        ]
      }
      gallery_revision_items: {
        Row: {
          featured: boolean
          gallery_revision_id: string
          item_id: number
        }
        Insert: {
          featured?: boolean
          gallery_revision_id: string
          item_id: number
        }
        Update: {
          featured?: boolean
          gallery_revision_id?: string
          item_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "gallery_revision_items_gallery_revision_id_fkey"
            columns: ["gallery_revision_id"]
            isOneToOne: false
            referencedRelation: "gallery_work_revisions"
            referencedColumns: ["revision_id"]
          },
        ]
      }
      gallery_revision_presets: {
        Row: {
          gallery_revision_id: string
          preset_revision_id: string
        }
        Insert: {
          gallery_revision_id: string
          preset_revision_id: string
        }
        Update: {
          gallery_revision_id?: string
          preset_revision_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_revision_presets_gallery_revision_id_fkey"
            columns: ["gallery_revision_id"]
            isOneToOne: false
            referencedRelation: "gallery_work_revisions"
            referencedColumns: ["revision_id"]
          },
          {
            foreignKeyName: "gallery_revision_presets_preset_revision_id_fkey"
            columns: ["preset_revision_id"]
            isOneToOne: false
            referencedRelation: "preset_revisions"
            referencedColumns: ["preset_revision_id"]
          },
        ]
      }
      gallery_work_revisions: {
        Row: {
          description: string | null
          metadata: Json
          revision_id: string
          title: string
        }
        Insert: {
          description?: string | null
          metadata?: Json
          revision_id: string
          title: string
        }
        Update: {
          description?: string | null
          metadata?: Json
          revision_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_work_revisions_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: true
            referencedRelation: "community_work_revisions"
            referencedColumns: ["revision_id"]
          },
        ]
      }
      gallery_work_settings: {
        Row: {
          comments_enabled: boolean
          updated_at: string
          work_id: string
        }
        Insert: {
          comments_enabled?: boolean
          updated_at?: string
          work_id: string
        }
        Update: {
          comments_enabled?: boolean
          updated_at?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_work_settings_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: true
            referencedRelation: "gallery_works"
            referencedColumns: ["work_id"]
          },
        ]
      }
      gallery_works: {
        Row: {
          gallery_kind: string
          work_id: string
        }
        Insert: {
          gallery_kind: string
          work_id: string
        }
        Update: {
          gallery_kind?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gallery_works_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: true
            referencedRelation: "community_works"
            referencedColumns: ["work_id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          account_id: string
          command_name: string
          completed_at: string | null
          created_at: string
          idempotency_key: string
          request_hash: string
          response: Json | null
        }
        Insert: {
          account_id: string
          command_name: string
          completed_at?: string | null
          created_at?: string
          idempotency_key: string
          request_hash: string
          response?: Json | null
        }
        Update: {
          account_id?: string
          command_name?: string
          completed_at?: string | null
          created_at?: string
          idempotency_key?: string
          request_hash?: string
          response?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "idempotency_keys_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
        ]
      }
      media_assets: {
        Row: {
          byte_size: number
          checksum_sha256: string
          created_at: string
          height: number | null
          media_id: string
          mime_type: string
          moderation_state: Database["public"]["Enums"]["moderation_state"]
          owner_account_id: string
          processing_state: Database["public"]["Enums"]["media_processing_state"]
          purged_at: string | null
          storage_key: string
          width: number | null
        }
        Insert: {
          byte_size: number
          checksum_sha256: string
          created_at?: string
          height?: number | null
          media_id: string
          mime_type: string
          moderation_state?: Database["public"]["Enums"]["moderation_state"]
          owner_account_id: string
          processing_state?: Database["public"]["Enums"]["media_processing_state"]
          purged_at?: string | null
          storage_key: string
          width?: number | null
        }
        Update: {
          byte_size?: number
          checksum_sha256?: string
          created_at?: string
          height?: number | null
          media_id?: string
          mime_type?: string
          moderation_state?: Database["public"]["Enums"]["moderation_state"]
          owner_account_id?: string
          processing_state?: Database["public"]["Enums"]["media_processing_state"]
          purged_at?: string | null
          storage_key?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: true
            referencedRelation: "community_entities"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "media_assets_owner_account_id_fkey"
            columns: ["owner_account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
        ]
      }
      moderation_actions: {
        Row: {
          action_id: string
          action_type: string
          actor_account_id: string | null
          case_id: string
          created_at: string
          prior_state: Json
          reason: string
          resulting_state: Json
        }
        Insert: {
          action_id?: string
          action_type: string
          actor_account_id?: string | null
          case_id: string
          created_at?: string
          prior_state: Json
          reason: string
          resulting_state: Json
        }
        Update: {
          action_id?: string
          action_type?: string
          actor_account_id?: string | null
          case_id?: string
          created_at?: string
          prior_state?: Json
          reason?: string
          resulting_state?: Json
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_actor_account_id_fkey"
            columns: ["actor_account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "moderation_actions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "moderation_cases"
            referencedColumns: ["case_id"]
          },
        ]
      }
      moderation_case_reports: {
        Row: {
          case_id: string
          report_id: string
        }
        Insert: {
          case_id: string
          report_id: string
        }
        Update: {
          case_id?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_case_reports_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "moderation_cases"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "moderation_case_reports_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: true
            referencedRelation: "reports"
            referencedColumns: ["report_id"]
          },
        ]
      }
      moderation_cases: {
        Row: {
          case_id: string
          created_at: string
          status: string
          target_entity_id: string
          updated_at: string
        }
        Insert: {
          case_id?: string
          created_at?: string
          status?: string
          target_entity_id: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          status?: string
          target_entity_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_cases_target_entity_id_fkey"
            columns: ["target_entity_id"]
            isOneToOne: false
            referencedRelation: "community_entities"
            referencedColumns: ["entity_id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          created_at: string
          delivery_state: string
          notification_event_id: string
          read_at: string | null
          recipient_account_id: string
        }
        Insert: {
          created_at?: string
          delivery_state?: string
          notification_event_id: string
          read_at?: string | null
          recipient_account_id: string
        }
        Update: {
          created_at?: string
          delivery_state?: string
          notification_event_id?: string
          read_at?: string | null
          recipient_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_event_id_fkey"
            columns: ["notification_event_id"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["notification_event_id"]
          },
          {
            foreignKeyName: "notification_deliveries_recipient_account_id_fkey"
            columns: ["recipient_account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
        ]
      }
      notification_events: {
        Row: {
          actor_account_id: string | null
          created_at: string
          event_type: string
          notification_event_id: string
          source_outbox_id: string | null
          target_entity_id: string | null
        }
        Insert: {
          actor_account_id?: string | null
          created_at?: string
          event_type: string
          notification_event_id?: string
          source_outbox_id?: string | null
          target_entity_id?: string | null
        }
        Update: {
          actor_account_id?: string | null
          created_at?: string
          event_type?: string
          notification_event_id?: string
          source_outbox_id?: string | null
          target_entity_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_actor_account_id_fkey"
            columns: ["actor_account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "notification_events_source_outbox_id_fkey"
            columns: ["source_outbox_id"]
            isOneToOne: true
            referencedRelation: "outbox_events"
            referencedColumns: ["outbox_id"]
          },
          {
            foreignKeyName: "notification_events_target_entity_id_fkey"
            columns: ["target_entity_id"]
            isOneToOne: false
            referencedRelation: "community_entities"
            referencedColumns: ["entity_id"]
          },
        ]
      }
      outbox_events: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          attempt_count: number
          created_at: string
          dedupe_key: string | null
          dispatched_at: string | null
          event_type: string
          failed_at: string | null
          last_error: string | null
          next_attempt_at: string
          outbox_id: string
          payload: Json
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          attempt_count?: number
          created_at?: string
          dedupe_key?: string | null
          dispatched_at?: string | null
          event_type: string
          failed_at?: string | null
          last_error?: string | null
          next_attempt_at?: string
          outbox_id?: string
          payload?: Json
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          attempt_count?: number
          created_at?: string
          dedupe_key?: string | null
          dispatched_at?: string | null
          event_type?: string
          failed_at?: string | null
          last_error?: string | null
          next_attempt_at?: string
          outbox_id?: string
          payload?: Json
        }
        Relationships: []
      }
      preset_artifacts: {
        Row: {
          community_work_id: string | null
          created_at: string
          creator_profile_id: string
          owner_account_id: string
          preset_artifact_id: string
          preset_type: string
          updated_at: string
        }
        Insert: {
          community_work_id?: string | null
          created_at?: string
          creator_profile_id: string
          owner_account_id: string
          preset_artifact_id: string
          preset_type: string
          updated_at?: string
        }
        Update: {
          community_work_id?: string | null
          created_at?: string
          creator_profile_id?: string
          owner_account_id?: string
          preset_artifact_id?: string
          preset_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "preset_artifacts_community_work_id_fkey"
            columns: ["community_work_id"]
            isOneToOne: true
            referencedRelation: "community_works"
            referencedColumns: ["work_id"]
          },
          {
            foreignKeyName: "preset_artifacts_creator_profile_id_fkey"
            columns: ["creator_profile_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["creator_profile_id"]
          },
          {
            foreignKeyName: "preset_artifacts_owner_account_id_fkey"
            columns: ["owner_account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "preset_artifacts_preset_artifact_id_fkey"
            columns: ["preset_artifact_id"]
            isOneToOne: true
            referencedRelation: "community_entities"
            referencedColumns: ["entity_id"]
          },
        ]
      }
      preset_revision_publications: {
        Row: {
          preset_revision_id: string
          work_revision_id: string
        }
        Insert: {
          preset_revision_id: string
          work_revision_id: string
        }
        Update: {
          preset_revision_id?: string
          work_revision_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preset_revision_publications_preset_revision_id_fkey"
            columns: ["preset_revision_id"]
            isOneToOne: false
            referencedRelation: "preset_revisions"
            referencedColumns: ["preset_revision_id"]
          },
          {
            foreignKeyName: "preset_revision_publications_work_revision_id_fkey"
            columns: ["work_revision_id"]
            isOneToOne: true
            referencedRelation: "community_work_revisions"
            referencedColumns: ["revision_id"]
          },
        ]
      }
      preset_revisions: {
        Row: {
          artifact_blob_id: string
          created_at: string
          created_by_account_id: string
          metadata: Json
          preset_artifact_id: string
          preset_revision_id: string
          revision_number: number
        }
        Insert: {
          artifact_blob_id: string
          created_at?: string
          created_by_account_id: string
          metadata?: Json
          preset_artifact_id: string
          preset_revision_id?: string
          revision_number: number
        }
        Update: {
          artifact_blob_id?: string
          created_at?: string
          created_by_account_id?: string
          metadata?: Json
          preset_artifact_id?: string
          preset_revision_id?: string
          revision_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "preset_revisions_artifact_blob_id_fkey"
            columns: ["artifact_blob_id"]
            isOneToOne: false
            referencedRelation: "artifact_blobs"
            referencedColumns: ["blob_id"]
          },
          {
            foreignKeyName: "preset_revisions_created_by_account_id_fkey"
            columns: ["created_by_account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "preset_revisions_preset_artifact_id_fkey"
            columns: ["preset_artifact_id"]
            isOneToOne: false
            referencedRelation: "preset_artifacts"
            referencedColumns: ["preset_artifact_id"]
          },
        ]
      }
      qa_answer_utility: {
        Row: {
          account_id: string
          answer_id: string
          updated_at: string
          utility_kind: string
        }
        Insert: {
          account_id: string
          answer_id: string
          updated_at?: string
          utility_kind: string
        }
        Update: {
          account_id?: string
          answer_id?: string
          updated_at?: string
          utility_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_answer_utility_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "qa_answer_utility_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "qa_answers"
            referencedColumns: ["answer_id"]
          },
        ]
      }
      qa_answers: {
        Row: {
          answer_id: string
          created_at: string
          freshness: string
          question_id: string
          updated_at: string
        }
        Insert: {
          answer_id: string
          created_at?: string
          freshness?: string
          question_id: string
          updated_at?: string
        }
        Update: {
          answer_id?: string
          created_at?: string
          freshness?: string
          question_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_answers_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: true
            referencedRelation: "comments"
            referencedColumns: ["comment_id"]
          },
          {
            foreignKeyName: "qa_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "community_works"
            referencedColumns: ["work_id"]
          },
        ]
      }
      qa_question_redirects: {
        Row: {
          created_at: string
          question_id: string
          redirect_kind: string
          target_question_id: string
        }
        Insert: {
          created_at?: string
          question_id: string
          redirect_kind?: string
          target_question_id: string
        }
        Update: {
          created_at?: string
          question_id?: string
          redirect_kind?: string
          target_question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_question_redirects_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "community_works"
            referencedColumns: ["work_id"]
          },
          {
            foreignKeyName: "qa_question_redirects_target_question_id_fkey"
            columns: ["target_question_id"]
            isOneToOne: false
            referencedRelation: "community_works"
            referencedColumns: ["work_id"]
          },
        ]
      }
      qa_question_revisions: {
        Row: {
          body: string
          context_tags: string[]
          game_version: string | null
          platform: string | null
          revision_id: string
          title: string
        }
        Insert: {
          body: string
          context_tags: string[]
          game_version?: string | null
          platform?: string | null
          revision_id: string
          title: string
        }
        Update: {
          body?: string
          context_tags?: string[]
          game_version?: string | null
          platform?: string | null
          revision_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_question_revisions_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: true
            referencedRelation: "community_work_revisions"
            referencedColumns: ["revision_id"]
          },
        ]
      }
      qa_question_state: {
        Row: {
          accepted_answer_id: string | null
          freshness: string
          resolution_state: string
          solution_note: string | null
          updated_at: string
          work_id: string
        }
        Insert: {
          accepted_answer_id?: string | null
          freshness?: string
          resolution_state?: string
          solution_note?: string | null
          updated_at?: string
          work_id: string
        }
        Update: {
          accepted_answer_id?: string | null
          freshness?: string
          resolution_state?: string
          solution_note?: string | null
          updated_at?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_question_state_accepted_answer_id_fkey"
            columns: ["accepted_answer_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["comment_id"]
          },
          {
            foreignKeyName: "qa_question_state_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: true
            referencedRelation: "community_works"
            referencedColumns: ["work_id"]
          },
        ]
      }
      qa_same_here: {
        Row: {
          account_id: string
          created_at: string
          question_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          question_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_same_here_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "qa_same_here_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "community_works"
            referencedColumns: ["work_id"]
          },
        ]
      }
      qa_tip_revisions: {
        Row: {
          body: string
          context_tags: string[]
          game_version: string | null
          platform: string | null
          revision_id: string
          source_answer_id: string | null
          source_question_id: string | null
          title: string
        }
        Insert: {
          body: string
          context_tags: string[]
          game_version?: string | null
          platform?: string | null
          revision_id: string
          source_answer_id?: string | null
          source_question_id?: string | null
          title: string
        }
        Update: {
          body?: string
          context_tags?: string[]
          game_version?: string | null
          platform?: string | null
          revision_id?: string
          source_answer_id?: string | null
          source_question_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_tip_revisions_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: true
            referencedRelation: "community_work_revisions"
            referencedColumns: ["revision_id"]
          },
          {
            foreignKeyName: "qa_tip_revisions_source_answer_id_fkey"
            columns: ["source_answer_id"]
            isOneToOne: false
            referencedRelation: "qa_answers"
            referencedColumns: ["answer_id"]
          },
          {
            foreignKeyName: "qa_tip_revisions_source_question_id_fkey"
            columns: ["source_question_id"]
            isOneToOne: false
            referencedRelation: "community_works"
            referencedColumns: ["work_id"]
          },
        ]
      }
      qa_tip_state: {
        Row: {
          freshness: string
          updated_at: string
          work_id: string
        }
        Insert: {
          freshness?: string
          updated_at?: string
          work_id: string
        }
        Update: {
          freshness?: string
          updated_at?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_tip_state_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: true
            referencedRelation: "community_works"
            referencedColumns: ["work_id"]
          },
        ]
      }
      reactions: {
        Row: {
          account_id: string
          created_at: string
          reaction_kind: string
          target_entity_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          reaction_kind: string
          target_entity_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          reaction_kind?: string
          target_entity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "reactions_target_entity_id_fkey"
            columns: ["target_entity_id"]
            isOneToOne: false
            referencedRelation: "community_entities"
            referencedColumns: ["entity_id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          detail: string | null
          reason_code: string
          report_id: string
          reporter_account_id: string | null
          status: string
          target_entity_id: string
          target_revision_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          reason_code: string
          report_id?: string
          reporter_account_id?: string | null
          status?: string
          target_entity_id: string
          target_revision_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          reason_code?: string
          report_id?: string
          reporter_account_id?: string | null
          status?: string
          target_entity_id?: string
          target_revision_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_account_id_fkey"
            columns: ["reporter_account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "reports_target_entity_id_fkey"
            columns: ["target_entity_id"]
            isOneToOne: false
            referencedRelation: "community_entities"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "reports_target_revision_id_fkey"
            columns: ["target_revision_id"]
            isOneToOne: false
            referencedRelation: "community_work_revisions"
            referencedColumns: ["revision_id"]
          },
        ]
      }
      saved_items: {
        Row: {
          account_id: string
          created_at: string
          target_entity_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          target_entity_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          target_entity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "saved_items_target_entity_id_fkey"
            columns: ["target_entity_id"]
            isOneToOne: false
            referencedRelation: "community_entities"
            referencedColumns: ["entity_id"]
          },
        ]
      }
      search_documents: {
        Row: {
          creator_profile_id: string
          entity_id: string
          facets: Json
          published_at: string
          tags: string[]
          text_content: string
          title: string
          updated_at: string
          work_id: string
          work_type: Database["public"]["Enums"]["work_type"]
        }
        Insert: {
          creator_profile_id: string
          entity_id: string
          facets?: Json
          published_at: string
          tags?: string[]
          text_content?: string
          title?: string
          updated_at?: string
          work_id: string
          work_type: Database["public"]["Enums"]["work_type"]
        }
        Update: {
          creator_profile_id?: string
          entity_id?: string
          facets?: Json
          published_at?: string
          tags?: string[]
          text_content?: string
          title?: string
          updated_at?: string
          work_id?: string
          work_type?: Database["public"]["Enums"]["work_type"]
        }
        Relationships: [
          {
            foreignKeyName: "search_documents_creator_profile_id_fkey"
            columns: ["creator_profile_id"]
            isOneToOne: false
            referencedRelation: "creator_profiles"
            referencedColumns: ["creator_profile_id"]
          },
          {
            foreignKeyName: "search_documents_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "community_entities"
            referencedColumns: ["entity_id"]
          },
          {
            foreignKeyName: "search_documents_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: true
            referencedRelation: "community_works"
            referencedColumns: ["work_id"]
          },
        ]
      }
      wand_account_ddv_profiles: {
        Row: {
          account_id: string
          ddv_profile_id: string
          linked_at: string
          relationship_kind: string
          verification_evidence_ref: string | null
        }
        Insert: {
          account_id: string
          ddv_profile_id: string
          linked_at?: string
          relationship_kind?: string
          verification_evidence_ref?: string | null
        }
        Update: {
          account_id?: string
          ddv_profile_id?: string
          linked_at?: string
          relationship_kind?: string
          verification_evidence_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wand_account_ddv_profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "wand_account_ddv_profiles_ddv_profile_id_fkey"
            columns: ["ddv_profile_id"]
            isOneToOne: true
            referencedRelation: "ddv_profiles"
            referencedColumns: ["ddv_profile_id"]
          },
        ]
      }
      wand_accounts: {
        Row: {
          account_id: string
          created_at: string
          deleted_at: string | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          account_id?: string
          created_at?: string
          deleted_at?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          deleted_at?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: []
      }
      work_revision_media: {
        Row: {
          media_id: string
          ordinal: number
          role: string
          work_revision_id: string
        }
        Insert: {
          media_id: string
          ordinal: number
          role?: string
          work_revision_id: string
        }
        Update: {
          media_id?: string
          ordinal?: number
          role?: string
          work_revision_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_revision_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["media_id"]
          },
          {
            foreignKeyName: "work_revision_media_work_revision_id_fkey"
            columns: ["work_revision_id"]
            isOneToOne: false
            referencedRelation: "community_work_revisions"
            referencedColumns: ["revision_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      community_add_answer_v1: {
        Args: {
          p_auth_subject: string
          p_body: string
          p_creator_profile_id: string
          p_idempotency_key: string
          p_question_id: string
        }
        Returns: Json
      }
      community_add_comment: {
        Args: {
          p_auth_subject: string
          p_body: string
          p_creator_profile_id: string
          p_idempotency_key: string
          p_parent_comment_id: string
          p_target_entity_id: string
        }
        Returns: Json
      }
      community_add_comment_v2: {
        Args: {
          p_auth_subject: string
          p_body: string
          p_creator_profile_id: string
          p_idempotency_key: string
          p_parent_comment_id: string
          p_target_entity_id: string
        }
        Returns: Json
      }
      community_add_comment_v3: {
        Args: {
          p_auth_subject: string
          p_body: string
          p_creator_profile_id: string
          p_idempotency_key: string
          p_parent_comment_id: string
          p_target_entity_id: string
        }
        Returns: Json
      }
      community_add_reaction: {
        Args: {
          p_auth_subject: string
          p_reaction_kind: string
          p_target_entity_id: string
        }
        Returns: Json
      }
      community_admin_ack_operations_alert: {
        Args: {
          p_admin_auth_subject: string
          p_alert_id: string
          p_issued_at_epoch: number
          p_note: string
          p_session_id: string
        }
        Returns: Json
      }
      community_admin_add_retention_hold: {
        Args: {
          p_account_id: string
          p_admin_auth_subject: string
          p_expires_at?: string
          p_hold_type: string
          p_issued_at_epoch: number
          p_reason: string
          p_session_id: string
        }
        Returns: Json
      }
      community_admin_complete_recovery: {
        Args: {
          p_admin_auth_subject: string
          p_completion_reason: string
          p_issued_at_epoch: number
          p_recovery_case_id: string
          p_session_id: string
        }
        Returns: Json
      }
      community_admin_complete_recovery_v2: {
        Args: {
          p_admin_auth_subject: string
          p_completion_reason: string
          p_issued_at_epoch: number
          p_recovery_case_id: string
          p_session_id: string
        }
        Returns: Json
      }
      community_admin_correct_ddv_profile_link_v1: {
        Args: {
          p_account_id: string
          p_admin_auth_subject: string
          p_ddv_profile_id: string
          p_issued_at_epoch: number
          p_reason: string
          p_session_id: string
        }
        Returns: Json
      }
      community_admin_open_recovery_case: {
        Args: {
          p_account_id: string
          p_admin_auth_subject: string
          p_issued_at_epoch: number
          p_new_provider: string
          p_new_provider_subject: string
          p_reason: string
          p_session_id: string
          p_verification_ref?: string
        }
        Returns: Json
      }
      community_admin_open_recovery_case_v2: {
        Args: {
          p_account_id: string
          p_admin_auth_subject: string
          p_issued_at_epoch: number
          p_new_provider: string
          p_new_provider_subject: string
          p_reason: string
          p_session_id: string
          p_verification_method: string
          p_verification_ref: string
        }
        Returns: Json
      }
      community_admin_release_retention_hold: {
        Args: {
          p_admin_auth_subject: string
          p_hold_id: string
          p_issued_at_epoch: number
          p_reason: string
          p_session_id: string
        }
        Returns: Json
      }
      community_admin_retry_operations_escalation: {
        Args: {
          p_admin_auth_subject: string
          p_delivery_id: string
          p_issued_at_epoch: number
          p_reason: string
          p_session_id: string
        }
        Returns: Json
      }
      community_admin_retry_provider_cleanup: {
        Args: {
          p_admin_auth_subject: string
          p_cleanup_job_id: string
          p_issued_at_epoch: number
          p_reason: string
          p_session_id: string
        }
        Returns: Json
      }
      community_admin_retry_retention_job: {
        Args: {
          p_admin_auth_subject: string
          p_issued_at_epoch: number
          p_reason: string
          p_retention_job_id: string
          p_session_id: string
        }
        Returns: Json
      }
      community_admin_verify_recovery_case: {
        Args: {
          p_admin_auth_subject: string
          p_issued_at_epoch: number
          p_recovery_case_id: string
          p_session_id: string
          p_verification_note: string
        }
        Returns: Json
      }
      community_ask_question_v1: {
        Args: {
          p_auth_subject: string
          p_body: string
          p_context_tags: string[]
          p_creator_profile_id: string
          p_game_version?: string
          p_idempotency_key?: string
          p_platform?: string
          p_title: string
        }
        Returns: Json
      }
      community_associate_ddv_identity_v1: {
        Args: {
          p_auth_subject: string
          p_binding_key_hash: string
          p_workspace_id: string
        }
        Returns: Json
      }
      community_authorize_identity_bootstrap: {
        Args: { p_auth_subject: string; p_issued_at_epoch: number }
        Returns: Json
      }
      community_authorize_session: {
        Args: {
          p_auth_subject: string
          p_issued_at_epoch: number
          p_max_age_seconds?: number
        }
        Returns: Json
      }
      community_change_work_visibility: {
        Args: {
          p_auth_subject: string
          p_expected_version: number
          p_idempotency_key: string
          p_visibility: string
          p_work_id: string
        }
        Returns: Json
      }
      community_claim_account_retention_jobs: {
        Args: { p_limit: number; p_lock_token: string }
        Returns: Json
      }
      community_claim_operations_escalations: {
        Args: { p_limit: number; p_lock_token: string }
        Returns: Json
      }
      community_claim_provider_cleanup_jobs: {
        Args: { p_limit: number; p_lock_token: string }
        Returns: Json
      }
      community_complete_account_retention_job: {
        Args: { p_lock_token: string; p_retention_job_id: string }
        Returns: Json
      }
      community_complete_operations_escalation: {
        Args: {
          p_delivery_id: string
          p_http_status: number
          p_lock_token: string
        }
        Returns: Json
      }
      community_complete_provider_cleanup: {
        Args: { p_cleanup_job_id: string; p_lock_token: string }
        Returns: Json
      }
      community_complete_provider_identity_cleanup: {
        Args: { p_cleanup_job_id: string }
        Returns: Json
      }
      community_complete_recovery: {
        Args: {
          p_admin_auth_subject: string
          p_completion_reason: string
          p_recovery_case_id: string
        }
        Returns: Json
      }
      community_consume_account_delete_e2e_nonce: {
        Args: { p_nonce: string }
        Returns: boolean
      }
      community_consume_action_rate_limit: {
        Args: { p_auth_subject: string; p_bucket: string }
        Returns: Json
      }
      community_create_ddv_profile_workspace_v1: {
        Args: { p_auth_subject: string; p_relationship_kind?: string }
        Returns: Json
      }
      community_create_gallery_draft: {
        Args: {
          p_auth_subject: string
          p_creator_profile_id: string
          p_gallery_kind: string
          p_idempotency_key: string
          p_visibility: string
        }
        Returns: Json
      }
      community_create_gallery_work_v1: {
        Args: {
          p_auth_subject: string
          p_creator_profile_id: string
          p_gallery_kind: string
          p_idempotency_key: string
        }
        Returns: Json
      }
      community_create_tip_v1: {
        Args: {
          p_auth_subject: string
          p_body: string
          p_context_tags?: string[]
          p_creator_profile_id: string
          p_game_version?: string
          p_idempotency_key?: string
          p_platform?: string
          p_source_answer_id?: string
          p_source_question_id?: string
          p_title: string
        }
        Returns: Json
      }
      community_delete_ddv_profile_workspace_v1: {
        Args: {
          p_auth_subject: string
          p_confirmation: string
          p_issued_at_epoch: number
          p_session_id: string
          p_workspace_id: string
        }
        Returns: Json
      }
      community_delete_work: {
        Args: {
          p_auth_subject: string
          p_expected_version: number
          p_idempotency_key: string
          p_work_id: string
        }
        Returns: Json
      }
      community_dreamsnap_add_browse_reaction_v1: {
        Args: {
          p_auth_subject: string
          p_challenge_id: string
          p_entry_id: string
          p_reaction_kind: string
        }
        Returns: Json
      }
      community_dreamsnap_cast_formal_vote_v1: {
        Args: {
          p_auth_subject: string
          p_challenge_id: string
          p_entry_id: string
        }
        Returns: Json
      }
      community_dreamsnap_finalize_results_v1: {
        Args: {
          p_challenge_id: string
          p_effective_at?: string
          p_expected_version: number
        }
        Returns: Json
      }
      community_dreamsnap_join_event_v1: {
        Args: {
          p_auth_subject: string
          p_idempotency_key: string
          p_work_id: string
        }
        Returns: Json
      }
      community_dreamsnap_publish_gallery_v1: {
        Args: {
          p_auth_subject: string
          p_comments_enabled?: boolean
          p_entry_id: string
        }
        Returns: Json
      }
      community_dreamsnap_record_official_result_v1: {
        Args: {
          p_auth_subject: string
          p_entry_id: string
          p_moonstones: number
          p_official_payload?: Json
          p_pixel_dust: number
          p_rank: number
          p_score: number
        }
        Returns: Json
      }
      community_dreamsnap_replace_entry_revision_v1: {
        Args: {
          p_auth_subject: string
          p_entry_id: string
          p_revision_id: string
        }
        Returns: Json
      }
      community_dreamsnap_set_official_result_publication_v1: {
        Args: {
          p_auth_subject: string
          p_entry_id: string
          p_public_fields: string[]
        }
        Returns: Json
      }
      community_dreamsnap_special_pick_v1: {
        Args: {
          p_auth_subject: string
          p_challenge_id: string
          p_entry_id: string
        }
        Returns: Json
      }
      community_dreamsnap_transition_challenge_v1: {
        Args: {
          p_challenge_id: string
          p_effective_at?: string
          p_expected_version: number
          p_target_state: string
        }
        Returns: Json
      }
      community_dreamsnap_update_work_revision_v1: {
        Args: {
          p_auth_subject: string
          p_caption: string
          p_expected_version: number
          p_game_screenshot_attested: boolean
          p_idempotency_key: string
          p_media_id: string
          p_no_external_edits_attested: boolean
          p_work_id: string
        }
        Returns: Json
      }
      community_ensure_account_creator: {
        Args: {
          p_auth_subject: string
          p_display_name: string
          p_handle: string
        }
        Returns: Json
      }
      community_fail_account_retention_job: {
        Args: {
          p_error: string
          p_lock_token: string
          p_retention_job_id: string
        }
        Returns: Json
      }
      community_fail_operations_escalation: {
        Args: {
          p_delivery_id: string
          p_error: string
          p_http_status?: number
          p_lock_token: string
        }
        Returns: Json
      }
      community_fail_provider_cleanup: {
        Args: {
          p_cleanup_job_id: string
          p_error: string
          p_lock_token: string
        }
        Returns: Json
      }
      community_fail_provider_identity_cleanup: {
        Args: { p_cleanup_job_id: string; p_error: string }
        Returns: Json
      }
      community_finalize_artifact_blob_purge: {
        Args: { p_blob_id: string; p_expected_storage_key: string }
        Returns: Json
      }
      community_follow_creator: {
        Args: { p_auth_subject: string; p_creator_profile_id: string }
        Returns: Json
      }
      community_gallery_author_remove_comment_v1: {
        Args: {
          p_auth_subject: string
          p_comment_id: string
          p_reason: string
          p_work_id: string
        }
        Returns: Json
      }
      community_gallery_author_remove_comment_v2: {
        Args: {
          p_auth_subject: string
          p_comment_id: string
          p_reason: string
          p_work_id: string
        }
        Returns: Json
      }
      community_get_action_rate_policies: {
        Args: { p_admin_auth_subject: string }
        Returns: Json
      }
      community_get_creator_public_v1: {
        Args: { p_creator_profile_id: string }
        Returns: Json
      }
      community_get_current_dreamsnap_challenge_public_v1: {
        Args: never
        Returns: Json
      }
      community_get_ddv_profile_workspaces_v1: {
        Args: { p_auth_subject: string }
        Returns: Json
      }
      community_get_dead_letter_outbox: {
        Args: { p_auth_subject: string; p_limit?: number }
        Returns: Json
      }
      community_get_dreamsnap_judge_media_storage_v1: {
        Args: { p_auth_subject: string; p_entry_id: string }
        Returns: Json
      }
      community_get_dreamsnap_judge_v1: {
        Args: {
          p_auth_subject: string
          p_challenge_id: string
          p_limit?: number
        }
        Returns: Json
      }
      community_get_dreamsnap_results_public_v1: {
        Args: { p_challenge_id: string }
        Returns: Json
      }
      community_get_gallery_dreamsnap_public_v1: {
        Args: { p_work_id: string }
        Returns: Json
      }
      community_get_gallery_public_v1: {
        Args: { p_work_id: string }
        Returns: Json
      }
      community_get_gallery_v1: {
        Args: { p_auth_subject: string; p_work_id: string }
        Returns: Json
      }
      community_get_linked_ddv_profiles: {
        Args: { p_auth_subject: string }
        Returns: Json
      }
      community_get_me: { Args: { p_auth_subject: string }; Returns: Json }
      community_get_media_storage_key: {
        Args: { p_auth_subject: string; p_media_id: string }
        Returns: Json
      }
      community_get_moderation_cases: {
        Args: {
          p_admin_auth_subject: string
          p_limit?: number
          p_state?: string
        }
        Returns: Json
      }
      community_get_my_dreamsnaps_v1: {
        Args: { p_auth_subject: string; p_limit?: number }
        Returns: Json
      }
      community_get_my_gallery_v1: {
        Args: { p_auth_subject: string; p_limit?: number }
        Returns: Json
      }
      community_get_my_qa_activity_v1: {
        Args: { p_auth_subject: string; p_limit?: number }
        Returns: Json
      }
      community_get_notifications: {
        Args: { p_auth_subject: string; p_limit?: number }
        Returns: Json
      }
      community_get_operations_alerts: {
        Args: {
          p_admin_auth_subject: string
          p_limit?: number
          p_state?: string
        }
        Returns: Json
      }
      community_get_operations_escalation_deliveries: {
        Args: {
          p_admin_auth_subject: string
          p_limit?: number
          p_state?: string
        }
        Returns: Json
      }
      community_get_operations_escalation_destination: {
        Args: never
        Returns: Json
      }
      community_get_preset: {
        Args: { p_auth_subject: string; p_preset_artifact_id: string }
        Returns: Json
      }
      community_get_provider_cleanup_jobs: {
        Args: {
          p_admin_auth_subject: string
          p_limit?: number
          p_state?: string
        }
        Returns: Json
      }
      community_get_public_media_storage_v1: {
        Args: { p_media_id: string }
        Returns: Json
      }
      community_get_public_media_storage_v2: {
        Args: { p_media_id: string }
        Returns: Json
      }
      community_get_question_public_v1: {
        Args: { p_question_id: string }
        Returns: Json
      }
      community_get_question_redirect_public_v1: {
        Args: { p_question_id: string }
        Returns: Json
      }
      community_get_question_v1: {
        Args: { p_auth_subject: string; p_question_id: string }
        Returns: Json
      }
      community_get_recovery_cases: {
        Args: {
          p_admin_auth_subject: string
          p_limit?: number
          p_state?: string
        }
        Returns: Json
      }
      community_get_retention_holds: {
        Args: {
          p_account_id?: string
          p_admin_auth_subject: string
          p_limit?: number
        }
        Returns: Json
      }
      community_get_retention_jobs: {
        Args: {
          p_admin_auth_subject: string
          p_limit?: number
          p_state?: string
        }
        Returns: Json
      }
      community_get_saved: {
        Args: { p_auth_subject: string; p_limit?: number }
        Returns: Json
      }
      community_get_security_policy_summary: {
        Args: { p_admin_auth_subject: string }
        Returns: Json
      }
      community_get_tip_public_v1: { Args: { p_tip_id: string }; Returns: Json }
      community_get_work: {
        Args: { p_auth_subject: string; p_work_id: string }
        Returns: Json
      }
      community_link_ddv_profile_v1: {
        Args: {
          p_auth_subject: string
          p_binding_key_hash: string
          p_issued_at_epoch: number
          p_relationship_kind?: string
          p_session_id: string
        }
        Returns: Json
      }
      community_list_dreamsnap_result_rounds_public_v1: {
        Args: { p_limit?: number }
        Returns: Json
      }
      community_moderate_entity_v4: {
        Args: {
          p_action: string
          p_auth_subject: string
          p_case_id: string
          p_issued_at_epoch: number
          p_reason: string
          p_session_id: string
        }
        Returns: Json
      }
      community_moderate_entity_v5: {
        Args: {
          p_action: string
          p_auth_subject: string
          p_case_id: string
          p_issued_at_epoch: number
          p_reason: string
          p_session_id: string
        }
        Returns: Json
      }
      community_moderate_work: {
        Args: {
          p_action: string
          p_auth_subject: string
          p_case_id: string
          p_reason: string
        }
        Returns: Json
      }
      community_moderate_work_v2: {
        Args: {
          p_action: string
          p_auth_subject: string
          p_case_id: string
          p_issued_at_epoch: number
          p_reason: string
          p_session_id: string
        }
        Returns: Json
      }
      community_moderate_work_v3: {
        Args: {
          p_action: string
          p_auth_subject: string
          p_case_id: string
          p_issued_at_epoch: number
          p_reason: string
          p_session_id: string
        }
        Returns: Json
      }
      community_open_recovery_case: {
        Args: {
          p_account_id: string
          p_admin_auth_subject: string
          p_new_provider: string
          p_new_provider_subject: string
          p_reason: string
          p_verification_ref?: string
        }
        Returns: Json
      }
      community_process_outbox_batch: {
        Args: { p_limit?: number }
        Returns: Json
      }
      community_publish_gallery_v3: {
        Args: {
          p_auth_subject: string
          p_description: string
          p_expected_version: number
          p_idempotency_key: string
          p_media_ids: string[]
          p_preset_revision_ids: string[]
          p_title: string
          p_work_id: string
        }
        Returns: Json
      }
      community_publish_gallery_v4: {
        Args: {
          p_auth_subject: string
          p_description: string
          p_expected_version: number
          p_featured_item_ids?: number[]
          p_idempotency_key?: string
          p_media_ids: string[]
          p_moodboard_snapshot_ref?: string
          p_preset_revision_ids?: string[]
          p_title: string
          p_used_item_ids?: number[]
          p_work_id: string
        }
        Returns: Json
      }
      community_publish_preset_envelope: {
        Args: {
          p_artifact_storage_key: string
          p_auth_subject: string
          p_byte_size: number
          p_checksum_sha256: string
          p_content_type: string
          p_creator_profile_id: string
          p_description: string
          p_idempotency_key: string
          p_metadata: Json
          p_preset_type: string
          p_schema_version: number
          p_title: string
          p_visibility: string
        }
        Returns: Json
      }
      community_purge_expired_ddv_binding_tombstones: {
        Args: never
        Returns: Json
      }
      community_record_account_delete_e2e_result: {
        Args: {
          p_account_id: string
          p_auth_user_id: string
          p_cleanup_job_id: string
          p_error_text: string
          p_run_id: string
          p_wand_delete_ok: boolean
        }
        Returns: undefined
      }
      community_register_dreamsnap_work_v1: {
        Args: {
          p_auth_subject: string
          p_caption: string
          p_challenge_id: string
          p_creator_profile_id: string
          p_game_screenshot_attested: boolean
          p_idempotency_key: string
          p_media_id: string
          p_no_external_edits_attested: boolean
          p_workspace_id: string
        }
        Returns: Json
      }
      community_register_validated_media: {
        Args: {
          p_auth_subject: string
          p_byte_size: number
          p_checksum_sha256: string
          p_height: number
          p_mime_type: string
          p_storage_key: string
          p_width: number
        }
        Returns: Json
      }
      community_remove_outdated_qa_v1: {
        Args: { p_auth_subject: string; p_target_entity_id: string }
        Returns: Json
      }
      community_remove_reaction: {
        Args: {
          p_auth_subject: string
          p_reaction_kind: string
          p_target_entity_id: string
        }
        Returns: Json
      }
      community_report_entity: {
        Args: {
          p_auth_subject: string
          p_detail: string
          p_idempotency_key: string
          p_reason_code: string
          p_target_entity_id: string
        }
        Returns: Json
      }
      community_resolve_question_v1: {
        Args: {
          p_accepted_answer_id?: string
          p_auth_subject: string
          p_question_id: string
          p_solution_note?: string
        }
        Returns: Json
      }
      community_retry_dead_letter_outbox: {
        Args: { p_auth_subject: string; p_outbox_id: string; p_reason: string }
        Returns: Json
      }
      community_revoke_wand_sessions: {
        Args: { p_auth_subject: string }
        Returns: Json
      }
      community_save_entity: {
        Args: { p_auth_subject: string; p_target_entity_id: string }
        Returns: Json
      }
      community_search_gallery_dreamsnaps_public_v1: {
        Args: { p_limit?: number; p_query?: string }
        Returns: Json
      }
      community_search_public: {
        Args: {
          p_before_published_at?: string
          p_before_work_id?: string
          p_creator_profile_id?: string
          p_limit?: number
          p_query?: string
          p_tags?: string[]
          p_work_type?: Database["public"]["Enums"]["work_type"]
        }
        Returns: {
          creator_profile_id: string
          entity_id: string
          facets: Json
          published_at: string
          tags: string[]
          text_content: string
          title: string
          work_id: string
          work_type: Database["public"]["Enums"]["work_type"]
        }[]
      }
      community_search_questions_v1: {
        Args: {
          p_context_tags?: string[]
          p_limit?: number
          p_query?: string
          p_unanswered_only?: boolean
        }
        Returns: {
          answer_count: number
          context_tags: string[]
          creator_profile_id: string
          freshness: string
          game_version: string
          platform: string
          published_at: string
          question_id: string
          resolution_state: string
          same_here_count: number
          text_content: string
          title: string
        }[]
      }
      community_set_answer_utility_v1: {
        Args: {
          p_answer_id: string
          p_auth_subject: string
          p_utility_kind: string
        }
        Returns: Json
      }
      community_set_gallery_comments_enabled_v1: {
        Args: { p_auth_subject: string; p_enabled: boolean; p_work_id: string }
        Returns: Json
      }
      community_set_gallery_comments_enabled_v2: {
        Args: { p_auth_subject: string; p_enabled: boolean; p_work_id: string }
        Returns: Json
      }
      community_set_qa_freshness_v1: {
        Args: {
          p_auth_subject: string
          p_freshness: string
          p_target_entity_id: string
        }
        Returns: Json
      }
      community_set_same_here_v1: {
        Args: {
          p_active: boolean
          p_auth_subject: string
          p_question_id: string
        }
        Returns: Json
      }
      community_tombstone_account: {
        Args: {
          p_auth_subject: string
          p_confirmation: string
          p_issued_at_epoch: number
          p_session_id: string
        }
        Returns: Json
      }
      community_unfollow_creator: {
        Args: { p_auth_subject: string; p_creator_profile_id: string }
        Returns: Json
      }
      community_unlink_ddv_identity_v1: {
        Args: { p_auth_subject: string; p_workspace_id: string }
        Returns: Json
      }
      community_unpublish_work: {
        Args: {
          p_auth_subject: string
          p_expected_version: number
          p_idempotency_key: string
          p_work_id: string
        }
        Returns: Json
      }
      community_unsave_entity: {
        Args: { p_auth_subject: string; p_target_entity_id: string }
        Returns: Json
      }
      community_update_creator_profile: {
        Args: {
          p_auth_subject: string
          p_bio: string
          p_display_name: string
          p_expected_version: number
          p_handle: string
          p_idempotency_key: string
          p_profile_visibility: string
        }
        Returns: Json
      }
      community_update_ddv_profile_workspace_v1: {
        Args: {
          p_auth_subject: string
          p_display_name: string
          p_lifecycle_state: string
          p_workspace_id: string
        }
        Returns: Json
      }
      community_verify_worker_token: {
        Args: { p_token: string; p_worker_name: string }
        Returns: boolean
      }
      community_withdraw_duplicate_question_v1: {
        Args: {
          p_auth_subject: string
          p_question_id: string
          p_target_question_id: string
        }
        Returns: Json
      }
      wep_get_accessible_preset_blob: {
        Args: {
          p_auth_subject: string
          p_preset_artifact_id?: string
          p_preset_revision_id?: string
        }
        Returns: Json
      }
      wep_get_claimed_retention_artifact_blobs: {
        Args: { p_lock_token: string; p_retention_job_id: string }
        Returns: Json
      }
    }
    Enums: {
      account_status: "active" | "restricted" | "suspended" | "deleted"
      community_entity_type:
        | "creator_profile"
        | "community_work"
        | "preset_artifact"
        | "media_asset"
        | "comment"
      media_processing_state:
        | "quarantined"
        | "processing"
        | "ready"
        | "rejected"
      moderation_state: "clear" | "under_review" | "restricted" | "removed"
      visibility_state: "private" | "unlisted" | "public"
      work_lifecycle_state: "draft" | "published" | "unpublished" | "deleted"
      work_type: "gallery" | "preset" | "dreamsnap" | "question" | "tip"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_status: ["active", "restricted", "suspended", "deleted"],
      community_entity_type: [
        "creator_profile",
        "community_work",
        "preset_artifact",
        "media_asset",
        "comment",
      ],
      media_processing_state: [
        "quarantined",
        "processing",
        "ready",
        "rejected",
      ],
      moderation_state: ["clear", "under_review", "restricted", "removed"],
      visibility_state: ["private", "unlisted", "public"],
      work_lifecycle_state: ["draft", "published", "unpublished", "deleted"],
      work_type: ["gallery", "preset", "dreamsnap", "question", "tip"],
    },
  },
} as const
