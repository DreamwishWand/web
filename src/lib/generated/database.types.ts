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
          last_verified_at: string | null
          provider: string
          provider_subject: string
        }
        Insert: {
          account_id: string
          auth_identity_id?: string
          created_at?: string
          last_verified_at?: string | null
          provider: string
          provider_subject: string
        }
        Update: {
          account_id?: string
          auth_identity_id?: string
          created_at?: string
          last_verified_at?: string | null
          provider?: string
          provider_subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "auth_identities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "wand_accounts"
            referencedColumns: ["account_id"]
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
          actor_account_id: string
          case_id: string
          created_at: string
          prior_state: Json
          reason: string
          resulting_state: Json
        }
        Insert: {
          action_id?: string
          action_type: string
          actor_account_id: string
          case_id: string
          created_at?: string
          prior_state: Json
          reason: string
          resulting_state: Json
        }
        Update: {
          action_id?: string
          action_type?: string
          actor_account_id?: string
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
          reporter_account_id: string
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
          reporter_account_id: string
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
          reporter_account_id?: string
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
          verification_evidence_ref: string | null
        }
        Insert: {
          account_id: string
          ddv_profile_id: string
          linked_at?: string
          verification_evidence_ref?: string | null
        }
        Update: {
          account_id?: string
          ddv_profile_id?: string
          linked_at?: string
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
      community_add_reaction: {
        Args: {
          p_auth_subject: string
          p_reaction_kind: string
          p_target_entity_id: string
        }
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
      community_ensure_account_creator: {
        Args: {
          p_auth_subject: string
          p_display_name: string
          p_handle: string
        }
        Returns: Json
      }
      community_follow_creator: {
        Args: { p_auth_subject: string; p_creator_profile_id: string }
        Returns: Json
      }
      community_get_me: { Args: { p_auth_subject: string }; Returns: Json }
      community_get_media_storage_key: {
        Args: { p_auth_subject: string; p_media_id: string }
        Returns: Json
      }
      community_get_notifications: {
        Args: { p_auth_subject: string; p_limit?: number }
        Returns: Json
      }
      community_get_preset: {
        Args: { p_auth_subject: string; p_preset_artifact_id: string }
        Returns: Json
      }
      community_get_saved: {
        Args: { p_auth_subject: string; p_limit?: number }
        Returns: Json
      }
      community_get_work: {
        Args: { p_auth_subject: string; p_work_id: string }
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
      community_process_outbox_batch: {
        Args: { p_limit?: number }
        Returns: Json
      }
      community_publish_gallery: {
        Args: {
          p_auth_subject: string
          p_description: string
          p_expected_version: number
          p_idempotency_key: string
          p_title: string
          p_work_id: string
        }
        Returns: Json
      }
      community_publish_gallery_v2: {
        Args: {
          p_auth_subject: string
          p_description: string
          p_expected_version: number
          p_idempotency_key: string
          p_media_ids: string[]
          p_title: string
          p_work_id: string
        }
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
      community_save_entity: {
        Args: { p_auth_subject: string; p_target_entity_id: string }
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
