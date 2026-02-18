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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_feed: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          organization_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          organization_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_feed_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_chat_context: {
        Row: {
          context_key: string
          context_type: string
          context_value: string
          created_at: string
          expires_at: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          context_key: string
          context_type: string
          context_value: string
          created_at?: string
          expires_at?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          context_key?: string
          context_type?: string
          context_value?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_saved_queries: {
        Row: {
          category: string | null
          created_at: string
          id: string
          is_favorite: boolean | null
          last_used_at: string | null
          query_text: string
          title: string
          updated_at: string
          usage_count: number | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          is_favorite?: boolean | null
          last_used_at?: string | null
          query_text: string
          title: string
          updated_at?: string
          usage_count?: number | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          is_favorite?: boolean | null
          last_used_at?: string | null
          query_text?: string
          title?: string
          updated_at?: string
          usage_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      ai_coach_sessions: {
        Row: {
          attempt_id: string | null
          candidate_email: string
          created_at: string | null
          hints_provided: Json | null
          hints_used: number | null
          id: string
          improvement_score: number | null
          interview_id: string | null
          questions_asked: number | null
          total_interaction_time: number | null
        }
        Insert: {
          attempt_id?: string | null
          candidate_email: string
          created_at?: string | null
          hints_provided?: Json | null
          hints_used?: number | null
          id?: string
          improvement_score?: number | null
          interview_id?: string | null
          questions_asked?: number | null
          total_interaction_time?: number | null
        }
        Update: {
          attempt_id?: string | null
          candidate_email?: string
          created_at?: string | null
          hints_provided?: Json | null
          hints_used?: number | null
          id?: string
          improvement_score?: number | null
          interview_id?: string | null
          questions_asked?: number | null
          total_interaction_time?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_coach_sessions_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "interview_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_coach_sessions_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_feature_alerts: {
        Row: {
          alert_type: string
          created_at: string
          feature_name: string
          id: string
          message: string
          notified_admins: string[] | null
          resolved_at: string | null
          severity: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          feature_name: string
          id?: string
          message: string
          notified_admins?: string[] | null
          resolved_at?: string | null
          severity: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          feature_name?: string
          id?: string
          message?: string
          notified_admins?: string[] | null
          resolved_at?: string | null
          severity?: string
        }
        Relationships: []
      }
      ai_feature_configurations: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string
          fallback_enabled: boolean | null
          fallback_provider_id: string | null
          feature_name: string
          id: string
          is_enabled: boolean | null
          last_used_at: string | null
          primary_provider_id: string | null
          retry_attempts: number | null
          timeout_seconds: number | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name: string
          fallback_enabled?: boolean | null
          fallback_provider_id?: string | null
          feature_name: string
          id?: string
          is_enabled?: boolean | null
          last_used_at?: string | null
          primary_provider_id?: string | null
          retry_attempts?: number | null
          timeout_seconds?: number | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string
          fallback_enabled?: boolean | null
          fallback_provider_id?: string | null
          feature_name?: string
          id?: string
          is_enabled?: boolean | null
          last_used_at?: string | null
          primary_provider_id?: string | null
          retry_attempts?: number | null
          timeout_seconds?: number | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_feature_configurations_fallback_provider_id_fkey"
            columns: ["fallback_provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_feature_configurations_primary_provider_id_fkey"
            columns: ["primary_provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_feature_health: {
        Row: {
          auto_retry_enabled: boolean | null
          average_latency_ms: number | null
          consecutive_failures: number | null
          created_at: string | null
          current_model: string
          edge_function: string
          failed_requests: number | null
          fallback_enabled: boolean | null
          fallback_model: string | null
          feature_id: string
          feature_name: string
          id: string
          is_enabled: boolean | null
          last_check_at: string | null
          last_error_at: string | null
          last_error_message: string | null
          last_success_at: string | null
          max_retry_attempts: number | null
          status: string
          successful_requests: number | null
          total_requests: number | null
          updated_at: string | null
        }
        Insert: {
          auto_retry_enabled?: boolean | null
          average_latency_ms?: number | null
          consecutive_failures?: number | null
          created_at?: string | null
          current_model?: string
          edge_function: string
          failed_requests?: number | null
          fallback_enabled?: boolean | null
          fallback_model?: string | null
          feature_id: string
          feature_name: string
          id?: string
          is_enabled?: boolean | null
          last_check_at?: string | null
          last_error_at?: string | null
          last_error_message?: string | null
          last_success_at?: string | null
          max_retry_attempts?: number | null
          status?: string
          successful_requests?: number | null
          total_requests?: number | null
          updated_at?: string | null
        }
        Update: {
          auto_retry_enabled?: boolean | null
          average_latency_ms?: number | null
          consecutive_failures?: number | null
          created_at?: string | null
          current_model?: string
          edge_function?: string
          failed_requests?: number | null
          fallback_enabled?: boolean | null
          fallback_model?: string | null
          feature_id?: string
          feature_name?: string
          id?: string
          is_enabled?: boolean | null
          last_check_at?: string | null
          last_error_at?: string | null
          last_error_message?: string | null
          last_success_at?: string | null
          max_retry_attempts?: number | null
          status?: string
          successful_requests?: number | null
          total_requests?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_health_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string | null
          feature_id: string
          id: string
          is_acknowledged: boolean | null
          message: string
          resolved_at: string | null
          severity: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string | null
          feature_id: string
          id?: string
          is_acknowledged?: boolean | null
          message: string
          resolved_at?: string | null
          severity: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string | null
          feature_id?: string
          id?: string
          is_acknowledged?: boolean | null
          message?: string
          resolved_at?: string | null
          severity?: string
        }
        Relationships: []
      }
      ai_health_checks: {
        Row: {
          check_type: string
          created_at: string | null
          error_message: string | null
          feature_id: string
          id: string
          metadata: Json | null
          response_time_ms: number | null
          status: string
        }
        Insert: {
          check_type: string
          created_at?: string | null
          error_message?: string | null
          feature_id: string
          id?: string
          metadata?: Json | null
          response_time_ms?: number | null
          status: string
        }
        Update: {
          check_type?: string
          created_at?: string | null
          error_message?: string | null
          feature_id?: string
          id?: string
          metadata?: Json | null
          response_time_ms?: number | null
          status?: string
        }
        Relationships: []
      }
      ai_health_monitoring: {
        Row: {
          checked_at: string
          created_at: string
          edge_function: string
          error_message: string | null
          feature_name: string
          id: string
          response_time_ms: number | null
          status: string
        }
        Insert: {
          checked_at?: string
          created_at?: string
          edge_function: string
          error_message?: string | null
          feature_name: string
          id?: string
          response_time_ms?: number | null
          status: string
        }
        Update: {
          checked_at?: string
          created_at?: string
          edge_function?: string
          error_message?: string | null
          feature_name?: string
          id?: string
          response_time_ms?: number | null
          status?: string
        }
        Relationships: []
      }
      ai_model_configurations: {
        Row: {
          ab_test_model: string | null
          ab_test_split_percentage: number | null
          created_at: string
          edge_function: string
          enabled: boolean | null
          fallback_model: string | null
          feature_name: string
          id: string
          is_ab_testing: boolean | null
          max_retries: number | null
          primary_model: string
          retry_delay_ms: number | null
          timeout_ms: number | null
          updated_at: string
        }
        Insert: {
          ab_test_model?: string | null
          ab_test_split_percentage?: number | null
          created_at?: string
          edge_function: string
          enabled?: boolean | null
          fallback_model?: string | null
          feature_name: string
          id?: string
          is_ab_testing?: boolean | null
          max_retries?: number | null
          primary_model: string
          retry_delay_ms?: number | null
          timeout_ms?: number | null
          updated_at?: string
        }
        Update: {
          ab_test_model?: string | null
          ab_test_split_percentage?: number | null
          created_at?: string
          edge_function?: string
          enabled?: boolean | null
          fallback_model?: string | null
          feature_name?: string
          id?: string
          is_ab_testing?: boolean | null
          max_retries?: number | null
          primary_model?: string
          retry_delay_ms?: number | null
          timeout_ms?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_model_performance: {
        Row: {
          average_latency_ms: number | null
          average_quality_score: number | null
          cost_per_request_cents: number | null
          created_at: string | null
          feature_id: string
          id: string
          is_active_test: boolean | null
          model_name: string
          successful_requests: number | null
          test_period_end: string | null
          test_period_start: string
          total_requests: number | null
          updated_at: string | null
        }
        Insert: {
          average_latency_ms?: number | null
          average_quality_score?: number | null
          cost_per_request_cents?: number | null
          created_at?: string | null
          feature_id: string
          id?: string
          is_active_test?: boolean | null
          model_name: string
          successful_requests?: number | null
          test_period_end?: string | null
          test_period_start: string
          total_requests?: number | null
          updated_at?: string | null
        }
        Update: {
          average_latency_ms?: number | null
          average_quality_score?: number | null
          cost_per_request_cents?: number | null
          created_at?: string | null
          feature_id?: string
          id?: string
          is_active_test?: boolean | null
          model_name?: string
          successful_requests?: number | null
          test_period_end?: string | null
          test_period_start?: string
          total_requests?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_provider_credentials: {
        Row: {
          api_key_encrypted: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          last_tested_at: string | null
          model_preference: string | null
          provider_id: string
          rate_limit_per_minute: number | null
          test_error: string | null
          test_status: string | null
          updated_at: string | null
        }
        Insert: {
          api_key_encrypted: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_tested_at?: string | null
          model_preference?: string | null
          provider_id: string
          rate_limit_per_minute?: number | null
          test_error?: string | null
          test_status?: string | null
          updated_at?: string | null
        }
        Update: {
          api_key_encrypted?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_tested_at?: string | null
          model_preference?: string | null
          provider_id?: string
          rate_limit_per_minute?: number | null
          test_error?: string | null
          test_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_provider_credentials_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_providers: {
        Row: {
          base_url: string
          created_at: string | null
          description: string | null
          display_name: string
          id: string
          is_active: boolean | null
          name: string
          provider_type: string
          supported_models: Json
          updated_at: string | null
        }
        Insert: {
          base_url: string
          created_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean | null
          name: string
          provider_type: string
          supported_models?: Json
          updated_at?: string | null
        }
        Update: {
          base_url?: string
          created_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean | null
          name?: string
          provider_type?: string
          supported_models?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          fallback_used: boolean | null
          feature_name: string
          id: string
          interview_id: string | null
          latency_ms: number | null
          model_used: string | null
          organization_id: string | null
          provider_id: string | null
          request_tokens: number | null
          response_tokens: number | null
          success: boolean
          total_cost_cents: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          fallback_used?: boolean | null
          feature_name: string
          id?: string
          interview_id?: string | null
          latency_ms?: number | null
          model_used?: string | null
          organization_id?: string | null
          provider_id?: string | null
          request_tokens?: number | null
          response_tokens?: number | null
          success: boolean
          total_cost_cents?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          fallback_used?: boolean | null
          feature_name?: string
          id?: string
          interview_id?: string | null
          latency_ms?: number | null
          model_used?: string | null
          organization_id?: string | null
          provider_id?: string | null
          request_tokens?: number | null
          response_tokens?: number | null
          success?: boolean
          total_cost_cents?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_snapshots: {
        Row: {
          avg_cpi_score: number | null
          avg_time_to_hire: number | null
          created_at: string | null
          hiring_rate: number | null
          id: string
          metrics: Json | null
          organization_id: string | null
          snapshot_date: string
          top_performing_roles: string[] | null
          total_candidates: number | null
          total_interviews: number | null
        }
        Insert: {
          avg_cpi_score?: number | null
          avg_time_to_hire?: number | null
          created_at?: string | null
          hiring_rate?: number | null
          id?: string
          metrics?: Json | null
          organization_id?: string | null
          snapshot_date: string
          top_performing_roles?: string[] | null
          total_candidates?: number | null
          total_interviews?: number | null
        }
        Update: {
          avg_cpi_score?: number | null
          avg_time_to_hire?: number | null
          created_at?: string | null
          hiring_rate?: number | null
          id?: string
          metrics?: Json | null
          organization_id?: string | null
          snapshot_date?: string
          top_performing_roles?: string[] | null
          total_candidates?: number | null
          total_interviews?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_workflows: {
        Row: {
          approval_chain: Json
          comments: string | null
          created_at: string | null
          current_approver: string | null
          deadline: string | null
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          priority: string | null
          status: string
          updated_at: string | null
          workflow_stage: string
        }
        Insert: {
          approval_chain: Json
          comments?: string | null
          created_at?: string | null
          current_approver?: string | null
          deadline?: string | null
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          priority?: string | null
          status?: string
          updated_at?: string | null
          workflow_stage: string
        }
        Update: {
          approval_chain?: Json
          comments?: string | null
          created_at?: string | null
          current_approver?: string | null
          deadline?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          priority?: string | null
          status?: string
          updated_at?: string | null
          workflow_stage?: string
        }
        Relationships: []
      }
      architecture_documents: {
        Row: {
          analyzed_files: string[] | null
          created_at: string | null
          description: string | null
          diagram_type: string
          display_order: number | null
          file_hashes: Json | null
          id: string
          last_generated_at: string | null
          mermaid_code: string
          needs_refresh: boolean | null
          section: string
          title: string
          updated_at: string | null
        }
        Insert: {
          analyzed_files?: string[] | null
          created_at?: string | null
          description?: string | null
          diagram_type: string
          display_order?: number | null
          file_hashes?: Json | null
          id?: string
          last_generated_at?: string | null
          mermaid_code: string
          needs_refresh?: boolean | null
          section: string
          title: string
          updated_at?: string | null
        }
        Update: {
          analyzed_files?: string[] | null
          created_at?: string | null
          description?: string | null
          diagram_type?: string
          display_order?: number | null
          file_hashes?: Json | null
          id?: string
          last_generated_at?: string | null
          mermaid_code?: string
          needs_refresh?: boolean | null
          section?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      assessments: {
        Row: {
          attempt_id: string
          created_at: string | null
          detailed_analysis: string | null
          hiring_decision: string
          id: string
          organization_id: string | null
          overall_score: number
          question_scores: Json | null
          strengths: string[] | null
          topic_scores: Json | null
          weaknesses: string[] | null
        }
        Insert: {
          attempt_id: string
          created_at?: string | null
          detailed_analysis?: string | null
          hiring_decision: string
          id?: string
          organization_id?: string | null
          overall_score: number
          question_scores?: Json | null
          strengths?: string[] | null
          topic_scores?: Json | null
          weaknesses?: string[] | null
        }
        Update: {
          attempt_id?: string
          created_at?: string | null
          detailed_analysis?: string | null
          hiring_decision?: string
          id?: string
          organization_id?: string | null
          overall_score?: number
          question_scores?: Json | null
          strengths?: string[] | null
          topic_scores?: Json | null
          weaknesses?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "assessments_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "interview_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_candidates: {
        Row: {
          applied_position: string | null
          ats_status: string | null
          attempt_id: string | null
          created_at: string | null
          current_company: string | null
          current_position: string | null
          education: Json | null
          email: string
          experience_years: number | null
          external_id: string
          full_name: string
          id: string
          integration_id: string
          interview_id: string | null
          phone: string | null
          resume_parsed: Json | null
          resume_url: string | null
          skills: Json | null
          source: string | null
          synced_at: string | null
        }
        Insert: {
          applied_position?: string | null
          ats_status?: string | null
          attempt_id?: string | null
          created_at?: string | null
          current_company?: string | null
          current_position?: string | null
          education?: Json | null
          email: string
          experience_years?: number | null
          external_id: string
          full_name: string
          id?: string
          integration_id: string
          interview_id?: string | null
          phone?: string | null
          resume_parsed?: Json | null
          resume_url?: string | null
          skills?: Json | null
          source?: string | null
          synced_at?: string | null
        }
        Update: {
          applied_position?: string | null
          ats_status?: string | null
          attempt_id?: string | null
          created_at?: string | null
          current_company?: string | null
          current_position?: string | null
          education?: Json | null
          email?: string
          experience_years?: number | null
          external_id?: string
          full_name?: string
          id?: string
          integration_id?: string
          interview_id?: string | null
          phone?: string | null
          resume_parsed?: Json | null
          resume_url?: string | null
          skills?: Json | null
          source?: string | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_candidates_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "interview_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_candidates_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "ats_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ats_candidates_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_integrations: {
        Row: {
          api_key_encrypted: string | null
          ats_provider: string
          config: Json | null
          created_at: string | null
          id: string
          last_sync_at: string | null
          organization_id: string
          status: string
          sync_enabled: boolean | null
          sync_frequency: number | null
          updated_at: string | null
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          ats_provider: string
          config?: Json | null
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          organization_id: string
          status?: string
          sync_enabled?: boolean | null
          sync_frequency?: number | null
          updated_at?: string | null
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          ats_provider?: string
          config?: Json | null
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          organization_id?: string
          status?: string
          sync_enabled?: boolean | null
          sync_frequency?: number | null
          updated_at?: string | null
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ats_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ats_sync_logs: {
        Row: {
          candidates_failed: number | null
          candidates_synced: number | null
          completed_at: string | null
          details: Json | null
          error_message: string | null
          id: string
          integration_id: string
          started_at: string | null
          status: string
          sync_type: string
        }
        Insert: {
          candidates_failed?: number | null
          candidates_synced?: number | null
          completed_at?: string | null
          details?: Json | null
          error_message?: string | null
          id?: string
          integration_id: string
          started_at?: string | null
          status: string
          sync_type: string
        }
        Update: {
          candidates_failed?: number | null
          candidates_synced?: number | null
          completed_at?: string | null
          details?: Json | null
          error_message?: string | null
          id?: string
          integration_id?: string
          started_at?: string | null
          status?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ats_sync_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "ats_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      attempt_questions: {
        Row: {
          attempt_id: string
          created_at: string
          display_order: number
          id: string
          question_id: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          display_order: number
          id?: string
          question_id: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          display_order?: number
          id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempt_questions_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "interview_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bias_detection_results: {
        Row: {
          analysis_model: string
          assessment_id: string
          attempt_id: string
          bias_indicators: Json | null
          bias_score: number
          created_at: string | null
          cultural_bias: Json | null
          id: string
          language_bias: Json | null
          recommendations: string[] | null
          technical_bias: Json | null
        }
        Insert: {
          analysis_model: string
          assessment_id: string
          attempt_id: string
          bias_indicators?: Json | null
          bias_score?: number
          created_at?: string | null
          cultural_bias?: Json | null
          id?: string
          language_bias?: Json | null
          recommendations?: string[] | null
          technical_bias?: Json | null
        }
        Update: {
          analysis_model?: string
          assessment_id?: string
          attempt_id?: string
          bias_indicators?: Json | null
          bias_score?: number
          created_at?: string | null
          cultural_bias?: Json | null
          id?: string
          language_bias?: Json | null
          recommendations?: string[] | null
          technical_bias?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "bias_detection_results_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bias_detection_results_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "interview_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_performance_index: {
        Row: {
          attempt_id: string
          candidate_email: string
          candidate_name: string
          created_at: string
          easy_correct: number | null
          easy_total: number | null
          hard_correct: number | null
          hard_total: number | null
          hiring_recommendation: string
          id: string
          integrity_score: number
          interview_id: string
          medium_correct: number | null
          medium_total: number | null
          overall_cpi: number
          problem_solving_score: number
          technical_score: number
          top_skills: string[] | null
          topic_scores: Json | null
          updated_at: string
          violations_detected: number | null
          weak_skills: string[] | null
        }
        Insert: {
          attempt_id: string
          candidate_email: string
          candidate_name: string
          created_at?: string
          easy_correct?: number | null
          easy_total?: number | null
          hard_correct?: number | null
          hard_total?: number | null
          hiring_recommendation: string
          id?: string
          integrity_score?: number
          interview_id: string
          medium_correct?: number | null
          medium_total?: number | null
          overall_cpi?: number
          problem_solving_score?: number
          technical_score?: number
          top_skills?: string[] | null
          topic_scores?: Json | null
          updated_at?: string
          violations_detected?: number | null
          weak_skills?: string[] | null
        }
        Update: {
          attempt_id?: string
          candidate_email?: string
          candidate_name?: string
          created_at?: string
          easy_correct?: number | null
          easy_total?: number | null
          hard_correct?: number | null
          hard_total?: number | null
          hiring_recommendation?: string
          id?: string
          integrity_score?: number
          interview_id?: string
          medium_correct?: number | null
          medium_total?: number | null
          overall_cpi?: number
          problem_solving_score?: number
          technical_score?: number
          top_skills?: string[] | null
          topic_scores?: Json | null
          updated_at?: string
          violations_detected?: number | null
          weak_skills?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_performance_index_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "interview_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_performance_index_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_badges: {
        Row: {
          badge_type: string
          category: string | null
          color: string
          created_at: string | null
          description: string
          icon_name: string
          id: string
          name: string
          requirements: Json
        }
        Insert: {
          badge_type: string
          category?: string | null
          color: string
          created_at?: string | null
          description: string
          icon_name: string
          id?: string
          name: string
          requirements: Json
        }
        Update: {
          badge_type?: string
          category?: string | null
          color?: string
          created_at?: string | null
          description?: string
          icon_name?: string
          id?: string
          name?: string
          requirements?: Json
        }
        Relationships: []
      }
      certificates: {
        Row: {
          attempt_id: string
          certificate_number: string
          certification_topic_id: string
          created_at: string | null
          expires_at: string
          id: string
          integrity_score: number
          is_revoked: boolean | null
          issued_at: string | null
          pdf_url: string | null
          revoked_at: string | null
          revoked_reason: string | null
          score: number
          user_id: string
          verification_code: string
        }
        Insert: {
          attempt_id: string
          certificate_number: string
          certification_topic_id: string
          created_at?: string | null
          expires_at: string
          id?: string
          integrity_score: number
          is_revoked?: boolean | null
          issued_at?: string | null
          pdf_url?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          score: number
          user_id: string
          verification_code: string
        }
        Update: {
          attempt_id?: string
          certificate_number?: string
          certification_topic_id?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          integrity_score?: number
          is_revoked?: boolean | null
          issued_at?: string | null
          pdf_url?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          score?: number
          user_id?: string
          verification_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "learning_assessment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_certification_topic_id_fkey"
            columns: ["certification_topic_id"]
            isOneToOne: false
            referencedRelation: "certification_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      certification_assessments: {
        Row: {
          certification_topic_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          min_integrity_score: number
          passing_score: number
          proctoring_settings: Json
          published_at: string | null
          status: string | null
          time_limit: number
          title: string
          updated_at: string | null
        }
        Insert: {
          certification_topic_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          min_integrity_score?: number
          passing_score: number
          proctoring_settings?: Json
          published_at?: string | null
          status?: string | null
          time_limit: number
          title: string
          updated_at?: string | null
        }
        Update: {
          certification_topic_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          min_integrity_score?: number
          passing_score?: number
          proctoring_settings?: Json
          published_at?: string | null
          status?: string | null
          time_limit?: number
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certification_assessments_certification_topic_id_fkey"
            columns: ["certification_topic_id"]
            isOneToOne: false
            referencedRelation: "certification_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      certification_attempts: {
        Row: {
          answers: Json | null
          certification_assessment_id: string | null
          created_at: string | null
          generated_questions: Json | null
          id: string
          integrity_score: number | null
          passed: boolean | null
          proctoring_session_id: string | null
          score: number | null
          status: string | null
          submitted_at: string | null
          time_taken: number | null
          updated_at: string | null
          user_id: string | null
          violation_summary: Json | null
        }
        Insert: {
          answers?: Json | null
          certification_assessment_id?: string | null
          created_at?: string | null
          generated_questions?: Json | null
          id?: string
          integrity_score?: number | null
          passed?: boolean | null
          proctoring_session_id?: string | null
          score?: number | null
          status?: string | null
          submitted_at?: string | null
          time_taken?: number | null
          updated_at?: string | null
          user_id?: string | null
          violation_summary?: Json | null
        }
        Update: {
          answers?: Json | null
          certification_assessment_id?: string | null
          created_at?: string | null
          generated_questions?: Json | null
          id?: string
          integrity_score?: number | null
          passed?: boolean | null
          proctoring_session_id?: string | null
          score?: number | null
          status?: string | null
          submitted_at?: string | null
          time_taken?: number | null
          updated_at?: string | null
          user_id?: string | null
          violation_summary?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "certification_attempts_certification_assessment_id_fkey"
            columns: ["certification_assessment_id"]
            isOneToOne: false
            referencedRelation: "certification_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certification_attempts_proctoring_session_id_fkey"
            columns: ["proctoring_session_id"]
            isOneToOne: false
            referencedRelation: "proctoring_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      certification_global_config: {
        Row: {
          config: Json
          created_at: string | null
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          config?: Json
          created_at?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          config?: Json
          created_at?: string | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      certification_topics: {
        Row: {
          category: string
          certificate_validity_days: number
          created_at: string | null
          description: string | null
          difficulty_level: string
          display_name: string
          id: string
          is_active: boolean | null
          name: string
          passing_score: number
          provider: string
          recommended_experience: string | null
          required_questions: number
          syllabus_topics: Json | null
          updated_at: string | null
        }
        Insert: {
          category: string
          certificate_validity_days?: number
          created_at?: string | null
          description?: string | null
          difficulty_level: string
          display_name: string
          id?: string
          is_active?: boolean | null
          name: string
          passing_score?: number
          provider?: string
          recommended_experience?: string | null
          required_questions?: number
          syllabus_topics?: Json | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          certificate_validity_days?: number
          created_at?: string | null
          description?: string | null
          difficulty_level?: string
          display_name?: string
          id?: string
          is_active?: boolean | null
          name?: string
          passing_score?: number
          provider?: string
          recommended_experience?: string | null
          required_questions?: number
          syllabus_topics?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      chatbot_knowledge: {
        Row: {
          answer: string
          category: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          priority: number | null
          question: string
          role_specific: string[] | null
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          answer: string
          category: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          question: string
          role_specific?: string[] | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          question?: string
          role_specific?: string[] | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      chunk_upload_logs: {
        Row: {
          attempt_id: string | null
          chunk_index: number
          chunk_size_bytes: number | null
          chunk_type: string
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          retry_count: number | null
          session_id: string | null
          status: string
          storage_path: string | null
          upload_completed_at: string | null
          upload_started_at: string | null
        }
        Insert: {
          attempt_id?: string | null
          chunk_index: number
          chunk_size_bytes?: number | null
          chunk_type: string
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          retry_count?: number | null
          session_id?: string | null
          status?: string
          storage_path?: string | null
          upload_completed_at?: string | null
          upload_started_at?: string | null
        }
        Update: {
          attempt_id?: string | null
          chunk_index?: number
          chunk_size_bytes?: number | null
          chunk_type?: string
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          retry_count?: number | null
          session_id?: string | null
          status?: string
          storage_path?: string | null
          upload_completed_at?: string | null
          upload_started_at?: string | null
        }
        Relationships: []
      }
      circuit_breaker_state: {
        Row: {
          created_at: string
          failure_count: number
          failure_threshold: number
          half_open_at: string | null
          id: string
          last_failure_at: string | null
          last_success_at: string | null
          opened_at: string | null
          service_name: string
          state: string
          success_count: number
          success_threshold: number
          timeout_seconds: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          failure_count?: number
          failure_threshold?: number
          half_open_at?: string | null
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          opened_at?: string | null
          service_name: string
          state?: string
          success_count?: number
          success_threshold?: number
          timeout_seconds?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          failure_count?: number
          failure_threshold?: number
          half_open_at?: string | null
          id?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          opened_at?: string | null
          service_name?: string
          state?: string
          success_count?: number
          success_threshold?: number
          timeout_seconds?: number
          updated_at?: string
        }
        Relationships: []
      }
      collaboration_threads: {
        Row: {
          attachments: Json | null
          author_id: string | null
          content: string
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          is_resolved: boolean | null
          mentions: string[] | null
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          attachments?: Json | null
          author_id?: string | null
          content: string
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          is_resolved?: boolean | null
          mentions?: string[] | null
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          attachments?: Json | null
          author_id?: string | null
          content?: string
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          is_resolved?: boolean | null
          mentions?: string[] | null
          parent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collaboration_threads_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "collaboration_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      comparative_analytics: {
        Row: {
          comparison_type: string
          created_at: string | null
          entities: Json
          id: string
          insights: Json
          metrics: Json
          organization_id: string | null
          period_end: string
          period_start: string
          visualization_data: Json | null
        }
        Insert: {
          comparison_type: string
          created_at?: string | null
          entities: Json
          id?: string
          insights: Json
          metrics: Json
          organization_id?: string | null
          period_end: string
          period_start: string
          visualization_data?: Json | null
        }
        Update: {
          comparison_type?: string
          created_at?: string | null
          entities?: Json
          id?: string
          insights?: Json
          metrics?: Json
          organization_id?: string | null
          period_end?: string
          period_start?: string
          visualization_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "comparative_analytics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_records: {
        Row: {
          candidate_email: string
          candidate_name: string
          consent_given: boolean
          consent_text: string
          consent_type: string
          id: string
          interview_id: string | null
          ip_address: string | null
          recorded_at: string | null
          user_agent: string | null
        }
        Insert: {
          candidate_email: string
          candidate_name: string
          consent_given: boolean
          consent_text: string
          consent_type: string
          id?: string
          interview_id?: string | null
          ip_address?: string | null
          recorded_at?: string | null
          user_agent?: string | null
        }
        Update: {
          candidate_email?: string
          candidate_name?: string
          consent_given?: boolean
          consent_text?: string
          consent_type?: string
          id?: string
          interview_id?: string | null
          ip_address?: string | null
          recorded_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_execution_logs: {
        Row: {
          created_at: string | null
          duration_ms: number | null
          error_details: Json | null
          error_message: string | null
          execution_completed_at: string | null
          execution_started_at: string | null
          id: string
          job_name: string
          job_schedule: string | null
          metadata: Json | null
          records_affected: number | null
          records_processed: number | null
          status: string
        }
        Insert: {
          created_at?: string | null
          duration_ms?: number | null
          error_details?: Json | null
          error_message?: string | null
          execution_completed_at?: string | null
          execution_started_at?: string | null
          id?: string
          job_name: string
          job_schedule?: string | null
          metadata?: Json | null
          records_affected?: number | null
          records_processed?: number | null
          status?: string
        }
        Update: {
          created_at?: string | null
          duration_ms?: number | null
          error_details?: Json | null
          error_message?: string | null
          execution_completed_at?: string | null
          execution_started_at?: string | null
          id?: string
          job_name?: string
          job_schedule?: string | null
          metadata?: Json | null
          records_affected?: number | null
          records_processed?: number | null
          status?: string
        }
        Relationships: []
      }
      custom_roles: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string | null
          permissions: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id?: string | null
          permissions?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string | null
          permissions?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      data_deletion_requests: {
        Row: {
          candidate_email: string
          candidate_name: string | null
          data_export_url: string | null
          id: string
          notes: string | null
          processed_at: string | null
          processed_by: string | null
          request_type: string
          requested_at: string | null
          status: string
        }
        Insert: {
          candidate_email: string
          candidate_name?: string | null
          data_export_url?: string | null
          id?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          request_type: string
          requested_at?: string | null
          status?: string
        }
        Update: {
          candidate_email?: string
          candidate_name?: string | null
          data_export_url?: string | null
          id?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          request_type?: string
          requested_at?: string | null
          status?: string
        }
        Relationships: []
      }
      data_retention_policies: {
        Row: {
          auto_delete_enabled: boolean | null
          created_at: string | null
          data_type: string
          id: string
          last_cleanup_at: string | null
          organization_id: string | null
          retention_days: number
          updated_at: string | null
        }
        Insert: {
          auto_delete_enabled?: boolean | null
          created_at?: string | null
          data_type: string
          id?: string
          last_cleanup_at?: string | null
          organization_id?: string | null
          retention_days: number
          updated_at?: string | null
        }
        Update: {
          auto_delete_enabled?: boolean | null
          created_at?: string | null
          data_type?: string
          id?: string
          last_cleanup_at?: string | null
          organization_id?: string | null
          retention_days?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_retention_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documentation: {
        Row: {
          category: string
          created_at: string | null
          created_by: string | null
          description: string | null
          file_path: string
          id: string
          title: string
          updated_at: string | null
          version: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          file_path: string
          id?: string
          title: string
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          file_path?: string
          id?: string
          title?: string
          updated_at?: string | null
          version?: string | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          last_resend_at: string | null
          message_id: string | null
          metadata: Json | null
          organization_id: string | null
          provider: string | null
          recipient_email: string
          recipient_name: string | null
          resend_count: number
          sent: boolean
          sent_at: string | null
          subject: string | null
          template: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          last_resend_at?: string | null
          message_id?: string | null
          metadata?: Json | null
          organization_id?: string | null
          provider?: string | null
          recipient_email: string
          recipient_name?: string | null
          resend_count?: number
          sent?: boolean
          sent_at?: string | null
          subject?: string | null
          template: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          last_resend_at?: string | null
          message_id?: string | null
          metadata?: Json | null
          organization_id?: string | null
          provider?: string | null
          recipient_email?: string
          recipient_name?: string | null
          resend_count?: number
          sent?: boolean
          sent_at?: string | null
          subject?: string | null
          template?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          available_variables: string[] | null
          created_at: string | null
          created_by: string | null
          description: string | null
          html_content: string
          id: string
          is_active: boolean | null
          organization_id: string | null
          subject: string
          template_key: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          available_variables?: string[] | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          html_content: string
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          subject: string
          template_key: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          available_variables?: string[] | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          html_content?: string
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          subject?: string
          template_key?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_verification_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          token: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          token: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      evaluation_queue: {
        Row: {
          attempt_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          include_video_analysis: boolean | null
          max_retries: number | null
          priority: number | null
          requested_by: string | null
          retry_count: number | null
          started_at: string | null
          status: string
        }
        Insert: {
          attempt_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          include_video_analysis?: boolean | null
          max_retries?: number | null
          priority?: number | null
          requested_by?: string | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
        }
        Update: {
          attempt_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          include_video_analysis?: boolean | null
          max_retries?: number | null
          priority?: number | null
          requested_by?: string | null
          retry_count?: number | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_queue_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "interview_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_queue_logs: {
        Row: {
          action: string
          attempt_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          processing_time_ms: number | null
          queue_item_id: string | null
          queue_position: number | null
          retry_attempt: number | null
        }
        Insert: {
          action: string
          attempt_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          processing_time_ms?: number | null
          queue_item_id?: string | null
          queue_position?: number | null
          retry_attempt?: number | null
        }
        Update: {
          action?: string
          attempt_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          processing_time_ms?: number | null
          queue_item_id?: string | null
          queue_position?: number | null
          retry_attempt?: number | null
        }
        Relationships: []
      }
      export_job_logs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          duration_ms: number | null
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          file_size_bytes: number | null
          id: string
          job_type: string
          metadata: Json | null
          organization_id: string | null
          output_url: string | null
          started_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          job_type: string
          metadata?: Json | null
          organization_id?: string | null
          output_url?: string | null
          started_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          file_size_bytes?: number | null
          id?: string
          job_type?: string
          metadata?: Json | null
          organization_id?: string | null
          output_url?: string | null
          started_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      failed_jobs: {
        Row: {
          attempt_count: number
          correlation_id: string | null
          created_at: string
          error_code: string | null
          error_message: string
          error_stack: string | null
          id: string
          job_id: string | null
          job_type: string
          last_attempted_at: string
          max_attempts: number
          next_retry_at: string | null
          organization_id: string | null
          payload: Json
          recovered_at: string | null
          source_function: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempt_count?: number
          correlation_id?: string | null
          created_at?: string
          error_code?: string | null
          error_message: string
          error_stack?: string | null
          id?: string
          job_id?: string | null
          job_type: string
          last_attempted_at?: string
          max_attempts?: number
          next_retry_at?: string | null
          organization_id?: string | null
          payload: Json
          recovered_at?: string | null
          source_function?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempt_count?: number
          correlation_id?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string
          error_stack?: string | null
          id?: string
          job_id?: string | null
          job_type?: string
          last_attempted_at?: string
          max_attempts?: number
          next_retry_at?: string | null
          organization_id?: string | null
          payload?: Json
          recovered_at?: string | null
          source_function?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "failed_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_reports: {
        Row: {
          created_at: string | null
          file_url: string | null
          format: string | null
          generated_by: string | null
          id: string
          organization_id: string | null
          period_end: string
          period_start: string
          report_data: Json
          status: string | null
          template_id: string | null
        }
        Insert: {
          created_at?: string | null
          file_url?: string | null
          format?: string | null
          generated_by?: string | null
          id?: string
          organization_id?: string | null
          period_end: string
          period_start: string
          report_data: Json
          status?: string | null
          template_id?: string | null
        }
        Update: {
          created_at?: string | null
          file_url?: string | null
          format?: string | null
          generated_by?: string | null
          id?: string
          organization_id?: string | null
          period_end?: string
          period_start?: string
          report_data?: Json
          status?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_reports_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          completed_at: string | null
          created_at: string
          expires_at: string
          id: string
          key: string
          operation_type: string
          request_hash: string | null
          resource_id: string | null
          response: Json | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          key: string
          operation_type: string
          request_hash?: string | null
          resource_id?: string | null
          response?: Json | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          key?: string
          operation_type?: string
          request_hash?: string | null
          resource_id?: string | null
          response?: Json | null
          status?: string
        }
        Relationships: []
      }
      interview_attempts: {
        Row: {
          answers: Json
          candidate_email: string
          candidate_name: string
          created_at: string | null
          deadline_at: string | null
          id: string
          interview_id: string
          invitation_id: string | null
          session_token: string | null
          started_at: string | null
          status: string | null
          submitted_at: string | null
          time_taken: number | null
        }
        Insert: {
          answers?: Json
          candidate_email: string
          candidate_name: string
          created_at?: string | null
          deadline_at?: string | null
          id?: string
          interview_id: string
          invitation_id?: string | null
          session_token?: string | null
          started_at?: string | null
          status?: string | null
          submitted_at?: string | null
          time_taken?: number | null
        }
        Update: {
          answers?: Json
          candidate_email?: string
          candidate_name?: string
          created_at?: string | null
          deadline_at?: string | null
          id?: string
          interview_id?: string
          invitation_id?: string | null
          session_token?: string | null
          started_at?: string | null
          status?: string | null
          submitted_at?: string | null
          time_taken?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_attempts_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_attempts_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "interview_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_invitations: {
        Row: {
          accessed_at: string | null
          candidate_email: string
          candidate_name: string | null
          candidate_phone: string | null
          candidate_timezone: string | null
          completed_at: string | null
          created_at: string | null
          deleted_at: string | null
          email_sent: boolean | null
          email_sent_at: string | null
          expires_at: string
          first_name: string | null
          id: string
          interview_id: string
          last_name: string | null
          last_reminder_at: string | null
          max_reminders_reached: boolean | null
          metadata: Json | null
          reminder_count: number | null
          resume_url: string | null
          sent_by: string | null
          share_token: string
          status: string
          updated_at: string | null
        }
        Insert: {
          accessed_at?: string | null
          candidate_email: string
          candidate_name?: string | null
          candidate_phone?: string | null
          candidate_timezone?: string | null
          completed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          expires_at?: string
          first_name?: string | null
          id?: string
          interview_id: string
          last_name?: string | null
          last_reminder_at?: string | null
          max_reminders_reached?: boolean | null
          metadata?: Json | null
          reminder_count?: number | null
          resume_url?: string | null
          sent_by?: string | null
          share_token: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          accessed_at?: string | null
          candidate_email?: string
          candidate_name?: string | null
          candidate_phone?: string | null
          candidate_timezone?: string | null
          completed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email_sent?: boolean | null
          email_sent_at?: string | null
          expires_at?: string
          first_name?: string | null
          id?: string
          interview_id?: string
          last_name?: string | null
          last_reminder_at?: string | null
          max_reminders_reached?: boolean | null
          metadata?: Json | null
          reminder_count?: number | null
          resume_url?: string | null
          sent_by?: string | null
          share_token?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_invitations_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_operation_logs: {
        Row: {
          attempt_id: string | null
          candidate_email: string | null
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_code: string | null
          error_details: Json | null
          error_message: string | null
          id: string
          interview_id: string | null
          invitation_id: string | null
          metadata: Json | null
          operation: string
          session_id: string | null
          started_at: string
          status: string
          user_id: string | null
        }
        Insert: {
          attempt_id?: string | null
          candidate_email?: string | null
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          interview_id?: string | null
          invitation_id?: string | null
          metadata?: Json | null
          operation: string
          session_id?: string | null
          started_at?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          attempt_id?: string | null
          candidate_email?: string | null
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_code?: string | null
          error_details?: Json | null
          error_message?: string | null
          id?: string
          interview_id?: string | null
          invitation_id?: string | null
          metadata?: Json | null
          operation?: string
          session_id?: string | null
          started_at?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_operation_logs_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "interview_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_operation_logs_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_operation_logs_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "interview_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_operation_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "proctoring_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_panel_members: {
        Row: {
          added_at: string | null
          added_by: string
          id: string
          interview_id: string
          role: string
          user_id: string
        }
        Insert: {
          added_at?: string | null
          added_by: string
          id?: string
          interview_id: string
          role?: string
          user_id: string
        }
        Update: {
          added_at?: string | null
          added_by?: string
          id?: string
          interview_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_panel_members_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_schedules: {
        Row: {
          calendar_event_id: string | null
          candidate_email: string
          candidate_name: string
          created_at: string | null
          created_by: string | null
          id: string
          interview_id: string
          meeting_link: string | null
          notes: string | null
          reminder_sent: boolean | null
          reminder_sent_at: string | null
          scheduled_end: string
          scheduled_start: string
          status: string
          timezone: string
          updated_at: string | null
        }
        Insert: {
          calendar_event_id?: string | null
          candidate_email: string
          candidate_name: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          interview_id: string
          meeting_link?: string | null
          notes?: string | null
          reminder_sent?: boolean | null
          reminder_sent_at?: string | null
          scheduled_end: string
          scheduled_start: string
          status?: string
          timezone?: string
          updated_at?: string | null
        }
        Update: {
          calendar_event_id?: string | null
          candidate_email?: string
          candidate_name?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          interview_id?: string
          meeting_link?: string | null
          notes?: string | null
          reminder_sent?: boolean | null
          reminder_sent_at?: string | null
          scheduled_end?: string
          scheduled_start?: string
          status?: string
          timezone?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_schedules_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_templates: {
        Row: {
          avg_rating: number | null
          category: string
          created_at: string | null
          created_by: string | null
          description: string | null
          difficulty_distribution: Json
          id: string
          is_active: boolean | null
          is_public: boolean | null
          name: string
          organization_id: string | null
          question_distribution: Json
          recommended_time_limit: number
          role_type: string
          seniority_level: string
          tags: string[] | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          avg_rating?: number | null
          category: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty_distribution: Json
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          name: string
          organization_id?: string | null
          question_distribution: Json
          recommended_time_limit: number
          role_type: string
          seniority_level: string
          tags?: string[] | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          avg_rating?: number | null
          category?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty_distribution?: Json
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          name?: string
          organization_id?: string | null
          question_distribution?: Json
          recommended_time_limit?: number
          role_type?: string
          seniority_level?: string
          tags?: string[] | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          category_difficulty_distribution: Json | null
          coding_schema: Json | null
          coding_topic_distribution: Json | null
          created_at: string | null
          creator_id: string | null
          deleted_at: string | null
          difficulty_distribution: Json | null
          experience_level: string | null
          extracted_skills: string[] | null
          generation_error: string | null
          generation_status: string | null
          id: string
          job_description: string
          last_reviewed_at: string | null
          last_reviewed_by: string | null
          min_years_experience: number | null
          organization_id: string | null
          proctoring_enabled: boolean | null
          proctoring_settings: Json | null
          proctoring_settings_id: string | null
          question_bank_size: number | null
          question_count: number
          question_type_distribution: Json | null
          questions_approved_at: string | null
          questions_status: string | null
          required_question_rules: Json | null
          review_feedback: string | null
          review_notes: string | null
          review_requested_at: string | null
          share_link: string | null
          skill_domain: string | null
          slug: string | null
          status: string | null
          tech_spoc_reviewer_id: string | null
          time_limit: number | null
          title: string
          topic_distribution: Json | null
          updated_at: string | null
          version: number
        }
        Insert: {
          category_difficulty_distribution?: Json | null
          coding_schema?: Json | null
          coding_topic_distribution?: Json | null
          created_at?: string | null
          creator_id?: string | null
          deleted_at?: string | null
          difficulty_distribution?: Json | null
          experience_level?: string | null
          extracted_skills?: string[] | null
          generation_error?: string | null
          generation_status?: string | null
          id?: string
          job_description: string
          last_reviewed_at?: string | null
          last_reviewed_by?: string | null
          min_years_experience?: number | null
          organization_id?: string | null
          proctoring_enabled?: boolean | null
          proctoring_settings?: Json | null
          proctoring_settings_id?: string | null
          question_bank_size?: number | null
          question_count?: number
          question_type_distribution?: Json | null
          questions_approved_at?: string | null
          questions_status?: string | null
          required_question_rules?: Json | null
          review_feedback?: string | null
          review_notes?: string | null
          review_requested_at?: string | null
          share_link?: string | null
          skill_domain?: string | null
          slug?: string | null
          status?: string | null
          tech_spoc_reviewer_id?: string | null
          time_limit?: number | null
          title: string
          topic_distribution?: Json | null
          updated_at?: string | null
          version?: number
        }
        Update: {
          category_difficulty_distribution?: Json | null
          coding_schema?: Json | null
          coding_topic_distribution?: Json | null
          created_at?: string | null
          creator_id?: string | null
          deleted_at?: string | null
          difficulty_distribution?: Json | null
          experience_level?: string | null
          extracted_skills?: string[] | null
          generation_error?: string | null
          generation_status?: string | null
          id?: string
          job_description?: string
          last_reviewed_at?: string | null
          last_reviewed_by?: string | null
          min_years_experience?: number | null
          organization_id?: string | null
          proctoring_enabled?: boolean | null
          proctoring_settings?: Json | null
          proctoring_settings_id?: string | null
          question_bank_size?: number | null
          question_count?: number
          question_type_distribution?: Json | null
          questions_approved_at?: string | null
          questions_status?: string | null
          required_question_rules?: Json | null
          review_feedback?: string | null
          review_notes?: string | null
          review_requested_at?: string | null
          share_link?: string | null
          skill_domain?: string | null
          slug?: string | null
          status?: string | null
          tech_spoc_reviewer_id?: string | null
          time_limit?: number | null
          title?: string
          topic_distribution?: Json | null
          updated_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "interviews_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_proctoring_settings_id_fkey"
            columns: ["proctoring_settings_id"]
            isOneToOne: false
            referencedRelation: "proctoring_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_cents: number
          applied_promotion_id: string | null
          created_at: string
          currency: string
          due_date: string
          id: string
          idempotency_key: string | null
          invoice_number: string
          line_items: Json
          notes: string | null
          organization_id: string
          paid_at: string | null
          payment_method: string | null
          period_end: string
          period_start: string
          status: string
          subscription_id: string
          tax_cents: number
          total_cents: number
          updated_at: string
          usage_details: Json
        }
        Insert: {
          amount_cents?: number
          applied_promotion_id?: string | null
          created_at?: string
          currency?: string
          due_date: string
          id?: string
          idempotency_key?: string | null
          invoice_number: string
          line_items?: Json
          notes?: string | null
          organization_id: string
          paid_at?: string | null
          payment_method?: string | null
          period_end: string
          period_start: string
          status?: string
          subscription_id: string
          tax_cents?: number
          total_cents?: number
          updated_at?: string
          usage_details?: Json
        }
        Update: {
          amount_cents?: number
          applied_promotion_id?: string | null
          created_at?: string
          currency?: string
          due_date?: string
          id?: string
          idempotency_key?: string | null
          invoice_number?: string
          line_items?: Json
          notes?: string | null
          organization_id?: string
          paid_at?: string | null
          payment_method?: string | null
          period_end?: string
          period_start?: string
          status?: string
          subscription_id?: string
          tax_cents?: number
          total_cents?: number
          updated_at?: string
          usage_details?: Json
        }
        Relationships: [
          {
            foreignKeyName: "invoices_applied_promotion_id_fkey"
            columns: ["applied_promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "organization_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_assessment_attempts: {
        Row: {
          answers: Json
          assessment_id: string
          created_at: string
          id: string
          score: number | null
          status: string
          submitted_at: string | null
          time_taken: number | null
          user_id: string
        }
        Insert: {
          answers?: Json
          assessment_id: string
          created_at?: string
          id?: string
          score?: number | null
          status?: string
          submitted_at?: string | null
          time_taken?: number | null
          user_id: string
        }
        Update: {
          answers?: Json
          assessment_id?: string
          created_at?: string
          id?: string
          score?: number | null
          status?: string
          submitted_at?: string | null
          time_taken?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_assessment_attempts_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "learning_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_assessment_feedback: {
        Row: {
          attempt_id: string
          created_at: string
          detailed_analysis: string | null
          difficulty_scores: Json | null
          id: string
          improvement_areas: string[] | null
          overall_score: number
          percentage: number
          question_feedback: Json | null
          strengths: string[] | null
          topic_scores: Json | null
          weaknesses: string[] | null
        }
        Insert: {
          attempt_id: string
          created_at?: string
          detailed_analysis?: string | null
          difficulty_scores?: Json | null
          id?: string
          improvement_areas?: string[] | null
          overall_score: number
          percentage: number
          question_feedback?: Json | null
          strengths?: string[] | null
          topic_scores?: Json | null
          weaknesses?: string[] | null
        }
        Update: {
          attempt_id?: string
          created_at?: string
          detailed_analysis?: string | null
          difficulty_scores?: Json | null
          id?: string
          improvement_areas?: string[] | null
          overall_score?: number
          percentage?: number
          question_feedback?: Json | null
          strengths?: string[] | null
          topic_scores?: Json | null
          weaknesses?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_assessment_feedback_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "learning_assessment_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_assessment_questions: {
        Row: {
          assessment_id: string
          correct_answer: string | null
          created_at: string
          difficulty: string
          explanation: string | null
          hints: string | null
          id: string
          options: Json | null
          order_index: number
          question_text: string
          question_type: string
          topic: string
        }
        Insert: {
          assessment_id: string
          correct_answer?: string | null
          created_at?: string
          difficulty: string
          explanation?: string | null
          hints?: string | null
          id?: string
          options?: Json | null
          order_index?: number
          question_text: string
          question_type: string
          topic: string
        }
        Update: {
          assessment_id?: string
          correct_answer?: string | null
          created_at?: string
          difficulty?: string
          explanation?: string | null
          hints?: string | null
          id?: string
          options?: Json | null
          order_index?: number
          question_text?: string
          question_type?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_assessment_questions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "learning_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_assessment_usage: {
        Row: {
          assessment_id: string
          created_at: string
          id: string
          subscription_id: string | null
          usage_date: string
          user_id: string
          was_free: boolean
          was_paid: boolean
        }
        Insert: {
          assessment_id: string
          created_at?: string
          id?: string
          subscription_id?: string | null
          usage_date?: string
          user_id: string
          was_free?: boolean
          was_paid?: boolean
        }
        Update: {
          assessment_id?: string
          created_at?: string
          id?: string
          subscription_id?: string | null
          usage_date?: string
          user_id?: string
          was_free?: boolean
          was_paid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "learning_assessment_usage_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "learning_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_assessment_usage_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "learning_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_assessments: {
        Row: {
          allow_multiple_persons: boolean | null
          certification_topic_id: string | null
          created_at: string
          difficulty_distribution: Json
          id: string
          is_certification: boolean | null
          max_look_aways: number | null
          max_tab_switches: number | null
          min_integrity_score: number | null
          mode: string
          proctoring_enabled: boolean | null
          proctoring_settings: Json | null
          question_count: number
          question_type_distribution: Json
          status: string
          time_limit: number | null
          title: string
          topic_description: string
          training_topic_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_multiple_persons?: boolean | null
          certification_topic_id?: string | null
          created_at?: string
          difficulty_distribution?: Json
          id?: string
          is_certification?: boolean | null
          max_look_aways?: number | null
          max_tab_switches?: number | null
          min_integrity_score?: number | null
          mode?: string
          proctoring_enabled?: boolean | null
          proctoring_settings?: Json | null
          question_count?: number
          question_type_distribution?: Json
          status?: string
          time_limit?: number | null
          title: string
          topic_description: string
          training_topic_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_multiple_persons?: boolean | null
          certification_topic_id?: string | null
          created_at?: string
          difficulty_distribution?: Json
          id?: string
          is_certification?: boolean | null
          max_look_aways?: number | null
          max_tab_switches?: number | null
          min_integrity_score?: number | null
          mode?: string
          proctoring_enabled?: boolean | null
          proctoring_settings?: Json | null
          question_count?: number
          question_type_distribution?: Json
          status?: string
          time_limit?: number | null
          title?: string
          topic_description?: string
          training_topic_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_assessments_certification_topic_id_fkey"
            columns: ["certification_topic_id"]
            isOneToOne: false
            referencedRelation: "certification_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_assessments_training_topic_id_fkey"
            columns: ["training_topic_id"]
            isOneToOne: false
            referencedRelation: "training_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_materials: {
        Row: {
          created_at: string
          description: string | null
          id: string
          material_type: string
          order_index: number
          title: string
          training_topic_id: string
          url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          material_type: string
          order_index?: number
          title: string
          training_topic_id: string
          url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          material_type?: string
          order_index?: number
          title?: string
          training_topic_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_materials_training_topic_id_fkey"
            columns: ["training_topic_id"]
            isOneToOne: false
            referencedRelation: "training_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_payments: {
        Row: {
          amount_cents: number
          assessment_id: string | null
          created_at: string
          currency: string
          id: string
          payment_method: string
          paypal_transaction_id: string | null
          status: string
          stripe_payment_id: string | null
          subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          assessment_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          payment_method: string
          paypal_transaction_id?: string | null
          status?: string
          stripe_payment_id?: string | null
          subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          assessment_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          payment_method?: string
          paypal_transaction_id?: string | null
          status?: string
          stripe_payment_id?: string | null
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_payments_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "learning_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "learning_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_plans: {
        Row: {
          billing_period: string
          created_at: string
          description: string | null
          display_order: number
          features: Json | null
          id: string
          is_active: boolean
          max_ai_usage: number
          max_assessments: number
          max_certifications: number
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          billing_period?: string
          created_at?: string
          description?: string | null
          display_order?: number
          features?: Json | null
          id?: string
          is_active?: boolean
          max_ai_usage?: number
          max_assessments?: number
          max_certifications?: number
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          billing_period?: string
          created_at?: string
          description?: string | null
          display_order?: number
          features?: Json | null
          id?: string
          is_active?: boolean
          max_ai_usage?: number
          max_assessments?: number
          max_certifications?: number
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      learning_subscriptions: {
        Row: {
          amount_spent_cents: number
          created_at: string
          expires_at: string
          id: string
          is_unlimited: boolean
          plan_id: string | null
          plan_type: string
          started_at: string
          status: string
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_spent_cents?: number
          created_at?: string
          expires_at: string
          id?: string
          is_unlimited?: boolean
          plan_id?: string | null
          plan_type: string
          started_at?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_spent_cents?: number
          created_at?: string
          expires_at?: string
          id?: string
          is_unlimited?: boolean
          plan_id?: string | null
          plan_type?: string
          started_at?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "learning_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      live_stream_signals: {
        Row: {
          created_at: string
          id: string
          processed_at: string | null
          proctoring_session_id: string
          sender_id: string
          sender_type: string
          signal_data: Json
          signal_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          processed_at?: string | null
          proctoring_session_id: string
          sender_id: string
          sender_type: string
          signal_data: Json
          signal_type: string
        }
        Update: {
          created_at?: string
          id?: string
          processed_at?: string | null
          proctoring_session_id?: string
          sender_id?: string
          sender_type?: string
          signal_data?: Json
          signal_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_stream_signals_proctoring_session_id_fkey"
            columns: ["proctoring_session_id"]
            isOneToOne: false
            referencedRelation: "proctoring_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      merge_operation_logs: {
        Row: {
          chunks_count: number | null
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          merge_completed_at: string | null
          merge_started_at: string | null
          merge_type: string
          output_path: string | null
          session_id: string | null
          status: string
          total_size_bytes: number | null
        }
        Insert: {
          chunks_count?: number | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          merge_completed_at?: string | null
          merge_started_at?: string | null
          merge_type: string
          output_path?: string | null
          session_id?: string | null
          status?: string
          total_size_bytes?: number | null
        }
        Update: {
          chunks_count?: number | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          merge_completed_at?: string | null
          merge_started_at?: string | null
          merge_type?: string
          output_path?: string | null
          session_id?: string | null
          status?: string
          total_size_bytes?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          metadata: Json | null
          organization_id: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          metadata?: Json | null
          organization_id?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          metadata?: Json | null
          organization_id?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          created_interview: boolean | null
          id: string
          shared_interview: boolean | null
          updated_at: string
          user_id: string
          viewed_dashboard: boolean | null
          viewed_report: boolean | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_interview?: boolean | null
          id?: string
          shared_interview?: boolean | null
          updated_at?: string
          user_id: string
          viewed_dashboard?: boolean | null
          viewed_report?: boolean | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_interview?: boolean | null
          id?: string
          shared_interview?: boolean | null
          updated_at?: string
          user_id?: string
          viewed_dashboard?: boolean | null
          viewed_report?: boolean | null
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          created_at: string | null
          id: string
          invited_by: string | null
          joined_at: string | null
          organization_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          organization_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          organization_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_subscriptions: {
        Row: {
          ai_usage_used: number | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          interviews_used: number | null
          organization_id: string
          plan_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          ai_usage_used?: number | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          interviews_used?: number | null
          organization_id: string
          plan_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          ai_usage_used?: number | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          interviews_used?: number | null
          organization_id?: string
          plan_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          business_address: string | null
          business_phone: string | null
          business_registration_number: string | null
          contact_email: string | null
          country: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          id: string
          industry: string | null
          legal_business_name: string | null
          name: string
          size: string | null
          slug: string
          status: string
          tax_id: string | null
          updated_at: string | null
          verification_status: string
          version: number
          website: string | null
          year_established: number | null
        }
        Insert: {
          business_address?: string | null
          business_phone?: string | null
          business_registration_number?: string | null
          contact_email?: string | null
          country?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          legal_business_name?: string | null
          name: string
          size?: string | null
          slug: string
          status?: string
          tax_id?: string | null
          updated_at?: string | null
          verification_status?: string
          version?: number
          website?: string | null
          year_established?: number | null
        }
        Update: {
          business_address?: string | null
          business_phone?: string | null
          business_registration_number?: string | null
          contact_email?: string | null
          country?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          legal_business_name?: string | null
          name?: string
          size?: string | null
          slug?: string
          status?: string
          tax_id?: string | null
          updated_at?: string | null
          verification_status?: string
          version?: number
          website?: string | null
          year_established?: number | null
        }
        Relationships: []
      }
      panel_consensus: {
        Row: {
          agreement_level: string | null
          attempt_id: string
          consensus_score: number
          decided_at: string | null
          decided_by: string | null
          discussion_summary: string | null
          final_decision: string
          id: string
          total_reviewers: number
        }
        Insert: {
          agreement_level?: string | null
          attempt_id: string
          consensus_score: number
          decided_at?: string | null
          decided_by?: string | null
          discussion_summary?: string | null
          final_decision: string
          id?: string
          total_reviewers: number
        }
        Update: {
          agreement_level?: string | null
          attempt_id?: string
          consensus_score?: number
          decided_at?: string | null
          decided_by?: string | null
          discussion_summary?: string | null
          final_decision?: string
          id?: string
          total_reviewers?: number
        }
        Relationships: [
          {
            foreignKeyName: "panel_consensus_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "interview_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      panel_evaluations: {
        Row: {
          attempt_id: string
          concerns: string[] | null
          cultural_feedback: string | null
          detailed_notes: string | null
          evaluation_date: string | null
          hiring_recommendation: string
          id: string
          overall_score: number
          reviewer_id: string
          status: string | null
          strengths: string[] | null
          technical_feedback: string | null
        }
        Insert: {
          attempt_id: string
          concerns?: string[] | null
          cultural_feedback?: string | null
          detailed_notes?: string | null
          evaluation_date?: string | null
          hiring_recommendation: string
          id?: string
          overall_score: number
          reviewer_id: string
          status?: string | null
          strengths?: string[] | null
          technical_feedback?: string | null
        }
        Update: {
          attempt_id?: string
          concerns?: string[] | null
          cultural_feedback?: string | null
          detailed_notes?: string | null
          evaluation_date?: string | null
          hiring_recommendation?: string
          id?: string
          overall_score?: number
          reviewer_id?: string
          status?: string | null
          strengths?: string[] | null
          technical_feedback?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "panel_evaluations_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "interview_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_applications: {
        Row: {
          applicant_user_id: string
          company_size: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string | null
          id: string
          industry: string | null
          organization_id: string | null
          organization_name: string
          organization_size: string | null
          rejection_reason: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selected_plan_id: string | null
          status: string
          use_case: string | null
          website: string | null
        }
        Insert: {
          applicant_user_id: string
          company_size?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          industry?: string | null
          organization_id?: string | null
          organization_name: string
          organization_size?: string | null
          rejection_reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selected_plan_id?: string | null
          status?: string
          use_case?: string | null
          website?: string | null
        }
        Update: {
          applicant_user_id?: string
          company_size?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          industry?: string | null
          organization_id?: string | null
          organization_name?: string
          organization_size?: string | null
          rejection_reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selected_plan_id?: string | null
          status?: string
          use_case?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_applications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_applications_selected_plan_id_fkey"
            columns: ["selected_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      password_setup_invitations: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string
          id: string
          metadata: Json | null
          organization_id: string | null
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at: string
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "password_setup_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateways: {
        Row: {
          config: Json | null
          created_at: string | null
          description: string | null
          display_name: string
          gateway_name: string
          id: string
          is_enabled: boolean | null
          is_test_mode: boolean | null
          live_public_key_encrypted: string | null
          live_secret_key_encrypted: string | null
          supported_currencies: string[] | null
          test_public_key_encrypted: string | null
          test_secret_key_encrypted: string | null
          updated_at: string | null
          updated_by: string | null
          webhook_secret_encrypted: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          description?: string | null
          display_name: string
          gateway_name: string
          id?: string
          is_enabled?: boolean | null
          is_test_mode?: boolean | null
          live_public_key_encrypted?: string | null
          live_secret_key_encrypted?: string | null
          supported_currencies?: string[] | null
          test_public_key_encrypted?: string | null
          test_secret_key_encrypted?: string | null
          updated_at?: string | null
          updated_by?: string | null
          webhook_secret_encrypted?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          description?: string | null
          display_name?: string
          gateway_name?: string
          id?: string
          is_enabled?: boolean | null
          is_test_mode?: boolean | null
          live_public_key_encrypted?: string | null
          live_secret_key_encrypted?: string | null
          supported_currencies?: string[] | null
          test_public_key_encrypted?: string | null
          test_secret_key_encrypted?: string | null
          updated_at?: string | null
          updated_by?: string | null
          webhook_secret_encrypted?: string | null
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          card_brand: string | null
          card_exp_month: number | null
          card_exp_year: number | null
          card_last4: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          organization_id: string
          stripe_customer_id: string
          stripe_payment_method_id: string
          updated_at: string | null
        }
        Insert: {
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          organization_id: string
          stripe_customer_id: string
          stripe_payment_method_id: string
          updated_at?: string | null
        }
        Update: {
          card_brand?: string | null
          card_exp_month?: number | null
          card_exp_year?: number | null
          card_last4?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          organization_id?: string
          stripe_customer_id?: string
          stripe_payment_method_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount_cents: number
          created_at: string | null
          currency: string | null
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          invoice_id: string | null
          organization_id: string
          payment_method_id: string | null
          receipt_url: string | null
          status: string
          stripe_charge_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string | null
          currency?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          invoice_id?: string | null
          organization_id: string
          payment_method_id?: string | null
          receipt_url?: string | null
          status: string
          stripe_charge_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string | null
          currency?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          invoice_id?: string | null
          organization_id?: string
          payment_method_id?: string | null
          receipt_url?: string | null
          status?: string
          stripe_charge_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_configurations: {
        Row: {
          category: string
          created_at: string | null
          data_type: string
          description: string | null
          id: string
          is_sensitive: boolean | null
          key: string
          updated_at: string | null
          validation_rules: Json | null
          value: string
        }
        Insert: {
          category: string
          created_at?: string | null
          data_type?: string
          description?: string | null
          id?: string
          is_sensitive?: boolean | null
          key: string
          updated_at?: string | null
          validation_rules?: Json | null
          value: string
        }
        Update: {
          category?: string
          created_at?: string | null
          data_type?: string
          description?: string | null
          id?: string
          is_sensitive?: boolean | null
          key?: string
          updated_at?: string | null
          validation_rules?: Json | null
          value?: string
        }
        Relationships: []
      }
      platform_documentation: {
        Row: {
          category: string
          content: string
          created_at: string
          created_by: string | null
          file_hashes: Json | null
          generation_prompt: string | null
          id: string
          is_ai_generated: boolean | null
          last_generated_at: string | null
          needs_regeneration: boolean | null
          prompt_used: string | null
          source_files: Json | null
          status: string
          title: string
          updated_at: string
          version_number: number | null
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          created_by?: string | null
          file_hashes?: Json | null
          generation_prompt?: string | null
          id?: string
          is_ai_generated?: boolean | null
          last_generated_at?: string | null
          needs_regeneration?: boolean | null
          prompt_used?: string | null
          source_files?: Json | null
          status?: string
          title: string
          updated_at?: string
          version_number?: number | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string | null
          file_hashes?: Json | null
          generation_prompt?: string | null
          id?: string
          is_ai_generated?: boolean | null
          last_generated_at?: string | null
          needs_regeneration?: boolean | null
          prompt_used?: string | null
          source_files?: Json | null
          status?: string
          title?: string
          updated_at?: string
          version_number?: number | null
        }
        Relationships: []
      }
      platform_documentation_versions: {
        Row: {
          category: string
          changes_summary: string | null
          content: string
          created_at: string
          created_by: string
          document_id: string
          id: string
          title: string
          version_number: number
        }
        Insert: {
          category: string
          changes_summary?: string | null
          content: string
          created_at?: string
          created_by: string
          document_id: string
          id?: string
          title: string
          version_number: number
        }
        Update: {
          category?: string
          changes_summary?: string | null
          content?: string
          created_at?: string
          created_by?: string
          document_id?: string
          id?: string
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "platform_documentation_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "platform_documentation"
            referencedColumns: ["id"]
          },
        ]
      }
      predictive_analytics: {
        Row: {
          accuracy_metrics: Json | null
          analysis_period: unknown
          created_at: string | null
          feature_importance: Json | null
          id: string
          model_type: string
          model_version: string
          organization_id: string | null
          predictions: Json
          recommendations: Json | null
        }
        Insert: {
          accuracy_metrics?: Json | null
          analysis_period: unknown
          created_at?: string | null
          feature_importance?: Json | null
          id?: string
          model_type: string
          model_version: string
          organization_id?: string | null
          predictions: Json
          recommendations?: Json | null
        }
        Update: {
          accuracy_metrics?: Json | null
          analysis_period?: unknown
          created_at?: string | null
          feature_importance?: Json | null
          id?: string
          model_type?: string
          model_version?: string
          organization_id?: string | null
          predictions?: Json
          recommendations?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "predictive_analytics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      preinterview_check_logs: {
        Row: {
          browser_info: Json | null
          camera_error: string | null
          camera_status: string
          candidate_email: string
          candidate_name: string | null
          completed_at: string | null
          created_at: string
          id: string
          interview_id: string | null
          invitation_id: string | null
          lighting_error: string | null
          lighting_status: string
          microphone_error: string | null
          microphone_status: string
          network_error: string | null
          network_speed_mbps: number | null
          network_status: string
          person_visible_error: string | null
          person_visible_status: string
          screen_share_attempted: boolean | null
          screen_share_error: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          browser_info?: Json | null
          camera_error?: string | null
          camera_status?: string
          candidate_email: string
          candidate_name?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          interview_id?: string | null
          invitation_id?: string | null
          lighting_error?: string | null
          lighting_status?: string
          microphone_error?: string | null
          microphone_status?: string
          network_error?: string | null
          network_speed_mbps?: number | null
          network_status?: string
          person_visible_error?: string | null
          person_visible_status?: string
          screen_share_attempted?: boolean | null
          screen_share_error?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          browser_info?: Json | null
          camera_error?: string | null
          camera_status?: string
          candidate_email?: string
          candidate_name?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          interview_id?: string | null
          invitation_id?: string | null
          lighting_error?: string | null
          lighting_status?: string
          microphone_error?: string | null
          microphone_status?: string
          network_error?: string | null
          network_speed_mbps?: number | null
          network_status?: string
          person_visible_error?: string | null
          person_visible_status?: string
          screen_share_attempted?: boolean | null
          screen_share_error?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preinterview_check_logs_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preinterview_check_logs_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "interview_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      proctoring_sessions: {
        Row: {
          audio_transcription: string | null
          camera_check_passed: boolean | null
          certification_attempt_id: string | null
          consent_given: boolean | null
          consent_timestamp: string | null
          copy_attempt_count: number | null
          created_at: string
          detailed_violations: Json | null
          ended_at: string | null
          eye_movement_violations: Json | null
          facial_analysis_results: Json | null
          flagged_for_review: boolean | null
          id: string
          ignored_violations: Json | null
          integrity_score: number | null
          interview_attempt_id: string | null
          learning_attempt_id: string | null
          lighting_check_passed: boolean | null
          live_stream_active: boolean | null
          look_away_count: number | null
          microphone_check_passed: boolean | null
          multiple_person_detections: number | null
          multiple_voice_detections: number | null
          organization_id: string | null
          periodic_screenshot_timestamps: number[] | null
          periodic_screenshots: string[] | null
          review_status: string | null
          reviewer_notes: string | null
          screen_periodic_screenshot_timestamps: number[] | null
          screen_periodic_screenshots: string[] | null
          screen_recording_url: string | null
          screen_share_check_passed: boolean | null
          tab_switch_count: number | null
          updated_at: string
          upload_completed_at: string | null
          upload_diagnostics: Json | null
          upload_error: string | null
          upload_started_at: string | null
          upload_status: string | null
          video_recording_url: string | null
          violations: Json | null
        }
        Insert: {
          audio_transcription?: string | null
          camera_check_passed?: boolean | null
          certification_attempt_id?: string | null
          consent_given?: boolean | null
          consent_timestamp?: string | null
          copy_attempt_count?: number | null
          created_at?: string
          detailed_violations?: Json | null
          ended_at?: string | null
          eye_movement_violations?: Json | null
          facial_analysis_results?: Json | null
          flagged_for_review?: boolean | null
          id?: string
          ignored_violations?: Json | null
          integrity_score?: number | null
          interview_attempt_id?: string | null
          learning_attempt_id?: string | null
          lighting_check_passed?: boolean | null
          live_stream_active?: boolean | null
          look_away_count?: number | null
          microphone_check_passed?: boolean | null
          multiple_person_detections?: number | null
          multiple_voice_detections?: number | null
          organization_id?: string | null
          periodic_screenshot_timestamps?: number[] | null
          periodic_screenshots?: string[] | null
          review_status?: string | null
          reviewer_notes?: string | null
          screen_periodic_screenshot_timestamps?: number[] | null
          screen_periodic_screenshots?: string[] | null
          screen_recording_url?: string | null
          screen_share_check_passed?: boolean | null
          tab_switch_count?: number | null
          updated_at?: string
          upload_completed_at?: string | null
          upload_diagnostics?: Json | null
          upload_error?: string | null
          upload_started_at?: string | null
          upload_status?: string | null
          video_recording_url?: string | null
          violations?: Json | null
        }
        Update: {
          audio_transcription?: string | null
          camera_check_passed?: boolean | null
          certification_attempt_id?: string | null
          consent_given?: boolean | null
          consent_timestamp?: string | null
          copy_attempt_count?: number | null
          created_at?: string
          detailed_violations?: Json | null
          ended_at?: string | null
          eye_movement_violations?: Json | null
          facial_analysis_results?: Json | null
          flagged_for_review?: boolean | null
          id?: string
          ignored_violations?: Json | null
          integrity_score?: number | null
          interview_attempt_id?: string | null
          learning_attempt_id?: string | null
          lighting_check_passed?: boolean | null
          live_stream_active?: boolean | null
          look_away_count?: number | null
          microphone_check_passed?: boolean | null
          multiple_person_detections?: number | null
          multiple_voice_detections?: number | null
          organization_id?: string | null
          periodic_screenshot_timestamps?: number[] | null
          periodic_screenshots?: string[] | null
          review_status?: string | null
          reviewer_notes?: string | null
          screen_periodic_screenshot_timestamps?: number[] | null
          screen_periodic_screenshots?: string[] | null
          screen_recording_url?: string | null
          screen_share_check_passed?: boolean | null
          tab_switch_count?: number | null
          updated_at?: string
          upload_completed_at?: string | null
          upload_diagnostics?: Json | null
          upload_error?: string | null
          upload_started_at?: string | null
          upload_status?: string | null
          video_recording_url?: string | null
          violations?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "proctoring_sessions_interview_attempt_id_fkey"
            columns: ["interview_attempt_id"]
            isOneToOne: false
            referencedRelation: "interview_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proctoring_sessions_learning_attempt_id_fkey"
            columns: ["learning_attempt_id"]
            isOneToOne: false
            referencedRelation: "learning_assessment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proctoring_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      proctoring_settings: {
        Row: {
          audio_anomaly_threshold: number | null
          background_noise_threshold: number | null
          created_at: string
          enable_eye_tracking: boolean | null
          enable_face_detection: boolean | null
          enable_object_detection: boolean | null
          enable_screen_content_analysis: boolean | null
          enable_screen_recording: boolean | null
          enable_tab_switching: boolean | null
          enable_voice_analysis: boolean | null
          enabled_audio_playback: boolean | null
          enabled_background_changed: boolean | null
          enabled_clothing_changed: boolean | null
          enabled_copy_attempt: boolean | null
          enabled_different_person_detected: boolean | null
          enabled_external_conversation: boolean | null
          enabled_eye_gaze_off_screen: boolean | null
          enabled_face_at_edge: boolean | null
          enabled_face_occluded: boolean | null
          enabled_headphones_detected: boolean | null
          enabled_identity_verification_uncertain: boolean | null
          enabled_looking_away: boolean | null
          enabled_multiple_monitors: boolean | null
          enabled_multiple_speakers: boolean | null
          enabled_multiple_voices: boolean | null
          enabled_no_person_in_frame: boolean | null
          enabled_phone_detected: boolean | null
          enabled_poor_lighting: boolean | null
          enabled_print_screen: boolean | null
          enabled_reading_pattern: boolean | null
          enabled_suspicious_background_objects: boolean | null
          enabled_suspicious_screen_content: boolean | null
          enabled_suspicious_typing: boolean | null
          enabled_tab_switch: boolean | null
          enabled_virtual_machine: boolean | null
          eye_movement_threshold_seconds: number | null
          high_severity_penalty: number | null
          id: string
          interview_type: string | null
          look_away_threshold_seconds: number | null
          low_severity_penalty: number | null
          medium_severity_penalty: number | null
          min_passing_score: number | null
          multiple_persons_threshold: number | null
          organization_id: string | null
          score_audio_playback: number | null
          score_background_changed: number | null
          score_clothing_changed: number | null
          score_copy_attempt: number | null
          score_different_person_detected: number | null
          score_external_conversation: number | null
          score_eye_gaze_off_screen: number | null
          score_face_at_edge: number | null
          score_face_occluded: number | null
          score_headphones_detected: number | null
          score_identity_verification_uncertain: number | null
          score_looking_away: number | null
          score_multiple_monitors: number | null
          score_multiple_speakers: number | null
          score_multiple_voices: number | null
          score_no_person_in_frame: number | null
          score_phone_detected: number | null
          score_poor_lighting: number | null
          score_print_screen: number | null
          score_reading_pattern: number | null
          score_suspicious_background_objects: number | null
          score_suspicious_screen_content: number | null
          score_suspicious_typing: number | null
          score_tab_switch: number | null
          score_virtual_machine: number | null
          tab_switch_max_count: number | null
          updated_at: string
          violation_base_penalty: number | null
        }
        Insert: {
          audio_anomaly_threshold?: number | null
          background_noise_threshold?: number | null
          created_at?: string
          enable_eye_tracking?: boolean | null
          enable_face_detection?: boolean | null
          enable_object_detection?: boolean | null
          enable_screen_content_analysis?: boolean | null
          enable_screen_recording?: boolean | null
          enable_tab_switching?: boolean | null
          enable_voice_analysis?: boolean | null
          enabled_audio_playback?: boolean | null
          enabled_background_changed?: boolean | null
          enabled_clothing_changed?: boolean | null
          enabled_copy_attempt?: boolean | null
          enabled_different_person_detected?: boolean | null
          enabled_external_conversation?: boolean | null
          enabled_eye_gaze_off_screen?: boolean | null
          enabled_face_at_edge?: boolean | null
          enabled_face_occluded?: boolean | null
          enabled_headphones_detected?: boolean | null
          enabled_identity_verification_uncertain?: boolean | null
          enabled_looking_away?: boolean | null
          enabled_multiple_monitors?: boolean | null
          enabled_multiple_speakers?: boolean | null
          enabled_multiple_voices?: boolean | null
          enabled_no_person_in_frame?: boolean | null
          enabled_phone_detected?: boolean | null
          enabled_poor_lighting?: boolean | null
          enabled_print_screen?: boolean | null
          enabled_reading_pattern?: boolean | null
          enabled_suspicious_background_objects?: boolean | null
          enabled_suspicious_screen_content?: boolean | null
          enabled_suspicious_typing?: boolean | null
          enabled_tab_switch?: boolean | null
          enabled_virtual_machine?: boolean | null
          eye_movement_threshold_seconds?: number | null
          high_severity_penalty?: number | null
          id?: string
          interview_type?: string | null
          look_away_threshold_seconds?: number | null
          low_severity_penalty?: number | null
          medium_severity_penalty?: number | null
          min_passing_score?: number | null
          multiple_persons_threshold?: number | null
          organization_id?: string | null
          score_audio_playback?: number | null
          score_background_changed?: number | null
          score_clothing_changed?: number | null
          score_copy_attempt?: number | null
          score_different_person_detected?: number | null
          score_external_conversation?: number | null
          score_eye_gaze_off_screen?: number | null
          score_face_at_edge?: number | null
          score_face_occluded?: number | null
          score_headphones_detected?: number | null
          score_identity_verification_uncertain?: number | null
          score_looking_away?: number | null
          score_multiple_monitors?: number | null
          score_multiple_speakers?: number | null
          score_multiple_voices?: number | null
          score_no_person_in_frame?: number | null
          score_phone_detected?: number | null
          score_poor_lighting?: number | null
          score_print_screen?: number | null
          score_reading_pattern?: number | null
          score_suspicious_background_objects?: number | null
          score_suspicious_screen_content?: number | null
          score_suspicious_typing?: number | null
          score_tab_switch?: number | null
          score_virtual_machine?: number | null
          tab_switch_max_count?: number | null
          updated_at?: string
          violation_base_penalty?: number | null
        }
        Update: {
          audio_anomaly_threshold?: number | null
          background_noise_threshold?: number | null
          created_at?: string
          enable_eye_tracking?: boolean | null
          enable_face_detection?: boolean | null
          enable_object_detection?: boolean | null
          enable_screen_content_analysis?: boolean | null
          enable_screen_recording?: boolean | null
          enable_tab_switching?: boolean | null
          enable_voice_analysis?: boolean | null
          enabled_audio_playback?: boolean | null
          enabled_background_changed?: boolean | null
          enabled_clothing_changed?: boolean | null
          enabled_copy_attempt?: boolean | null
          enabled_different_person_detected?: boolean | null
          enabled_external_conversation?: boolean | null
          enabled_eye_gaze_off_screen?: boolean | null
          enabled_face_at_edge?: boolean | null
          enabled_face_occluded?: boolean | null
          enabled_headphones_detected?: boolean | null
          enabled_identity_verification_uncertain?: boolean | null
          enabled_looking_away?: boolean | null
          enabled_multiple_monitors?: boolean | null
          enabled_multiple_speakers?: boolean | null
          enabled_multiple_voices?: boolean | null
          enabled_no_person_in_frame?: boolean | null
          enabled_phone_detected?: boolean | null
          enabled_poor_lighting?: boolean | null
          enabled_print_screen?: boolean | null
          enabled_reading_pattern?: boolean | null
          enabled_suspicious_background_objects?: boolean | null
          enabled_suspicious_screen_content?: boolean | null
          enabled_suspicious_typing?: boolean | null
          enabled_tab_switch?: boolean | null
          enabled_virtual_machine?: boolean | null
          eye_movement_threshold_seconds?: number | null
          high_severity_penalty?: number | null
          id?: string
          interview_type?: string | null
          look_away_threshold_seconds?: number | null
          low_severity_penalty?: number | null
          medium_severity_penalty?: number | null
          min_passing_score?: number | null
          multiple_persons_threshold?: number | null
          organization_id?: string | null
          score_audio_playback?: number | null
          score_background_changed?: number | null
          score_clothing_changed?: number | null
          score_copy_attempt?: number | null
          score_different_person_detected?: number | null
          score_external_conversation?: number | null
          score_eye_gaze_off_screen?: number | null
          score_face_at_edge?: number | null
          score_face_occluded?: number | null
          score_headphones_detected?: number | null
          score_identity_verification_uncertain?: number | null
          score_looking_away?: number | null
          score_multiple_monitors?: number | null
          score_multiple_speakers?: number | null
          score_multiple_voices?: number | null
          score_no_person_in_frame?: number | null
          score_phone_detected?: number | null
          score_poor_lighting?: number | null
          score_print_screen?: number | null
          score_reading_pattern?: number | null
          score_suspicious_background_objects?: number | null
          score_suspicious_screen_content?: number | null
          score_suspicious_typing?: number | null
          score_tab_switch?: number | null
          score_virtual_machine?: number | null
          tab_switch_max_count?: number | null
          updated_at?: string
          violation_base_penalty?: number | null
        }
        Relationships: []
      }
      proctoring_violations: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          ignored_at: string | null
          ignored_by: string | null
          ignored_reason: string | null
          is_ignored: boolean | null
          metadata: Json | null
          screenshot_url: string | null
          session_id: string
          severity: string
          timestamp: string
          violation_type: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          ignored_at?: string | null
          ignored_by?: string | null
          ignored_reason?: string | null
          is_ignored?: boolean | null
          metadata?: Json | null
          screenshot_url?: string | null
          session_id: string
          severity?: string
          timestamp?: string
          violation_type: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          ignored_at?: string | null
          ignored_by?: string | null
          ignored_reason?: string | null
          is_ignored?: boolean | null
          metadata?: Json | null
          screenshot_url?: string | null
          session_id?: string
          severity?: string
          timestamp?: string
          violation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "proctoring_violations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "proctoring_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          email_verified: boolean | null
          full_name: string | null
          id: string
          version: number
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          email_verified?: boolean | null
          full_name?: string | null
          id: string
          version?: number
        }
        Update: {
          created_at?: string | null
          email?: string | null
          email_verified?: boolean | null
          full_name?: string | null
          id?: string
          version?: number
        }
        Relationships: []
      }
      promotion_applicable_orgs: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          promotion_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          promotion_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          promotion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_applicable_orgs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_applicable_orgs_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_applicable_plans: {
        Row: {
          created_at: string | null
          id: string
          plan_id: string
          promotion_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          plan_id: string
          promotion_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          plan_id?: string
          promotion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_applicable_plans_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_applicable_plans_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_usages: {
        Row: {
          applied_at: string | null
          discount_applied_cents: number
          final_amount_cents: number
          id: string
          organization_id: string
          original_amount_cents: number
          promotion_id: string
          subscription_id: string | null
        }
        Insert: {
          applied_at?: string | null
          discount_applied_cents: number
          final_amount_cents: number
          id?: string
          organization_id: string
          original_amount_cents: number
          promotion_id: string
          subscription_id?: string | null
        }
        Update: {
          applied_at?: string | null
          discount_applied_cents?: number
          final_amount_cents?: number
          id?: string
          organization_id?: string
          original_amount_cents?: number
          promotion_id?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promotion_usages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_usages_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_usages_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "organization_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          code: string | null
          created_at: string | null
          created_by: string | null
          current_uses: number | null
          description: string | null
          discount_percent: number
          first_period_discount_percent: number | null
          first_period_type: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          max_uses_per_org: number | null
          name: string
          promotion_type: string
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          discount_percent?: number
          first_period_discount_percent?: number | null
          first_period_type?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          max_uses_per_org?: number | null
          name: string
          promotion_type: string
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          discount_percent?: number
          first_period_discount_percent?: number | null
          first_period_type?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          max_uses_per_org?: number | null
          name?: string
          promotion_type?: string
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      question_generation_logs: {
        Row: {
          completed_at: string | null
          completion_tokens: number | null
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          generation_type: string
          id: string
          interview_id: string | null
          metadata: Json | null
          model_used: string | null
          prompt_tokens: number | null
          questions_generated: number | null
          questions_requested: number | null
          started_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          completion_tokens?: number | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          generation_type: string
          id?: string
          interview_id?: string | null
          metadata?: Json | null
          model_used?: string | null
          prompt_tokens?: number | null
          questions_generated?: number | null
          questions_requested?: number | null
          started_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          completion_tokens?: number | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          generation_type?: string
          id?: string
          interview_id?: string | null
          metadata?: Json | null
          model_used?: string | null
          prompt_tokens?: number | null
          questions_generated?: number | null
          questions_requested?: number | null
          started_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      questions: {
        Row: {
          allowed_languages: string[] | null
          coding_schema: Json | null
          correct_answer: string | null
          created_at: string | null
          deleted_at: string | null
          difficulty: string
          id: string
          interview_id: string
          options: Json | null
          order_index: number
          organization_id: string | null
          question_text: string
          question_type: string | null
          selection_count: number | null
          topic: string
          used_in_attempts: Json | null
          version: number
        }
        Insert: {
          allowed_languages?: string[] | null
          coding_schema?: Json | null
          correct_answer?: string | null
          created_at?: string | null
          deleted_at?: string | null
          difficulty: string
          id?: string
          interview_id: string
          options?: Json | null
          order_index: number
          organization_id?: string | null
          question_text: string
          question_type?: string | null
          selection_count?: number | null
          topic: string
          used_in_attempts?: Json | null
          version?: number
        }
        Update: {
          allowed_languages?: string[] | null
          coding_schema?: Json | null
          correct_answer?: string | null
          created_at?: string | null
          deleted_at?: string | null
          difficulty?: string
          id?: string
          interview_id?: string
          options?: Json | null
          order_index?: number
          organization_id?: string | null
          question_text?: string
          question_type?: string | null
          selection_count?: number | null
          topic?: string
          used_in_attempts?: Json | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "questions_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_buckets: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          identifier: string
          max_requests: number
          request_count: number
          window_seconds: number
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          identifier: string
          max_requests?: number
          request_count?: number
          window_seconds?: number
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          identifier?: string
          max_requests?: number
          request_count?: number
          window_seconds?: number
          window_start?: string
        }
        Relationships: []
      }
      realtime_connection_logs: {
        Row: {
          channel_name: string | null
          connection_duration_ms: number | null
          created_at: string | null
          error_message: string | null
          event_type: string
          id: string
          metadata: Json | null
          reconnect_attempt: number | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          channel_name?: string | null
          connection_duration_ms?: number | null
          created_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          reconnect_attempt?: number | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          channel_name?: string | null
          connection_duration_ms?: number | null
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          reconnect_attempt?: number | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      report_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          filters: Json | null
          grouping: string[] | null
          id: string
          is_public: boolean | null
          metrics: string[]
          name: string
          organization_id: string | null
          recipients: string[] | null
          report_type: string
          schedule: string | null
          updated_at: string | null
          visualization_config: Json | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          filters?: Json | null
          grouping?: string[] | null
          id?: string
          is_public?: boolean | null
          metrics: string[]
          name: string
          organization_id?: string | null
          recipients?: string[] | null
          report_type: string
          schedule?: string | null
          updated_at?: string | null
          visualization_config?: Json | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          filters?: Json | null
          grouping?: string[] | null
          id?: string
          is_public?: boolean | null
          metrics?: string[]
          name?: string
          organization_id?: string | null
          recipients?: string[] | null
          report_type?: string
          schedule?: string | null
          updated_at?: string | null
          visualization_config?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "report_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      resume_parsing_results: {
        Row: {
          candidate_email: string
          candidate_name: string
          confidence_score: number | null
          created_at: string | null
          education_level: string | null
          experience_years: number | null
          extracted_skills: string[] | null
          id: string
          parsed_data: Json
          parsing_model: string
          resume_text: string | null
          suggested_questions: Json | null
        }
        Insert: {
          candidate_email: string
          candidate_name: string
          confidence_score?: number | null
          created_at?: string | null
          education_level?: string | null
          experience_years?: number | null
          extracted_skills?: string[] | null
          id?: string
          parsed_data: Json
          parsing_model: string
          resume_text?: string | null
          suggested_questions?: Json | null
        }
        Update: {
          candidate_email?: string
          candidate_name?: string
          confidence_score?: number | null
          created_at?: string | null
          education_level?: string | null
          experience_years?: number | null
          extracted_skills?: string[] | null
          id?: string
          parsed_data?: Json
          parsing_model?: string
          resume_text?: string | null
          suggested_questions?: Json | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          action_description: string | null
          action_name: string
          allowed_roles: Database["public"]["Enums"]["app_role"][]
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          action_description?: string | null
          action_name: string
          allowed_roles?: Database["public"]["Enums"]["app_role"][]
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          action_description?: string | null
          action_name?: string
          allowed_roles?: Database["public"]["Enums"]["app_role"][]
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      security_event_logs: {
        Row: {
          action_attempted: string | null
          created_at: string | null
          details: Json | null
          event_type: string
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action_attempted?: string | null
          created_at?: string | null
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action_attempted?: string | null
          created_at?: string | null
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string | null
          details: Json | null
          event_type: string
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          severity: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      storage_operation_logs: {
        Row: {
          bucket_name: string
          bytes_freed: number | null
          created_at: string | null
          error_message: string | null
          file_path: string | null
          file_size_bytes: number | null
          files_affected: number | null
          id: string
          metadata: Json | null
          operation: string
          status: string
          triggered_by: string | null
          user_id: string | null
        }
        Insert: {
          bucket_name: string
          bytes_freed?: number | null
          created_at?: string | null
          error_message?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          files_affected?: number | null
          id?: string
          metadata?: Json | null
          operation: string
          status?: string
          triggered_by?: string | null
          user_id?: string | null
        }
        Update: {
          bucket_name?: string
          bytes_freed?: number | null
          created_at?: string | null
          error_message?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          files_affected?: number | null
          id?: string
          metadata?: Json | null
          operation?: string
          status?: string
          triggered_by?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          annual_discount_percent: number
          billing_period: string
          created_at: string | null
          currency: string
          description: string | null
          display_order: number
          features: Json | null
          id: string
          included_interviews: number | null
          included_invitations: number | null
          is_active: boolean | null
          max_ai_usage: number
          max_interviews: number
          max_users: number
          minimum_monthly: number | null
          name: string
          overage_price_per_interview: number | null
          overage_price_per_invitation: number | null
          plan_type: string
          price_amount: number
          price_per_completed_interview: number | null
          price_per_interview: number | null
          price_per_invitation: number | null
          pricing_model: string
          pricing_notes: string | null
          updated_at: string | null
        }
        Insert: {
          annual_discount_percent?: number
          billing_period?: string
          created_at?: string | null
          currency?: string
          description?: string | null
          display_order?: number
          features?: Json | null
          id?: string
          included_interviews?: number | null
          included_invitations?: number | null
          is_active?: boolean | null
          max_ai_usage?: number
          max_interviews?: number
          max_users?: number
          minimum_monthly?: number | null
          name: string
          overage_price_per_interview?: number | null
          overage_price_per_invitation?: number | null
          plan_type: string
          price_amount?: number
          price_per_completed_interview?: number | null
          price_per_interview?: number | null
          price_per_invitation?: number | null
          pricing_model?: string
          pricing_notes?: string | null
          updated_at?: string | null
        }
        Update: {
          annual_discount_percent?: number
          billing_period?: string
          created_at?: string | null
          currency?: string
          description?: string | null
          display_order?: number
          features?: Json | null
          id?: string
          included_interviews?: number | null
          included_invitations?: number | null
          is_active?: boolean | null
          max_ai_usage?: number
          max_interviews?: number
          max_users?: number
          minimum_monthly?: number | null
          name?: string
          overage_price_per_interview?: number | null
          overage_price_per_invitation?: number | null
          plan_type?: string
          price_amount?: number
          price_per_completed_interview?: number | null
          price_per_interview?: number | null
          price_per_invitation?: number | null
          pricing_model?: string
          pricing_notes?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      system_config: {
        Row: {
          created_at: string | null
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      test_results: {
        Row: {
          created_at: string | null
          details: Json | null
          error_message: string | null
          execution_time_ms: number | null
          fix_recommendation: string | null
          id: string
          run_id: string
          severity: string | null
          status: string
          test_category: string
          test_name: string
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          execution_time_ms?: number | null
          fix_recommendation?: string | null
          id?: string
          run_id: string
          severity?: string | null
          status: string
          test_category: string
          test_name: string
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          error_message?: string | null
          execution_time_ms?: number | null
          fix_recommendation?: string | null
          id?: string
          run_id?: string
          severity?: string | null
          status?: string
          test_category?: string
          test_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "test_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      test_runs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          execution_time_ms: number | null
          failed_tests: number | null
          id: string
          initiated_by: string | null
          passed_tests: number | null
          started_at: string | null
          status: string
          suite_id: string | null
          summary: string | null
          total_tests: number | null
          warnings: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          execution_time_ms?: number | null
          failed_tests?: number | null
          id?: string
          initiated_by?: string | null
          passed_tests?: number | null
          started_at?: string | null
          status?: string
          suite_id?: string | null
          summary?: string | null
          total_tests?: number | null
          warnings?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          execution_time_ms?: number | null
          failed_tests?: number | null
          id?: string
          initiated_by?: string | null
          passed_tests?: number | null
          started_at?: string | null
          status?: string
          suite_id?: string | null
          summary?: string | null
          total_tests?: number | null
          warnings?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "test_runs_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "test_suites"
            referencedColumns: ["id"]
          },
        ]
      }
      test_suites: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          enabled: boolean | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      training_plans: {
        Row: {
          created_at: string
          created_by: string | null
          difficulty_level: string
          estimated_duration: number | null
          id: string
          is_active: boolean
          role_description: string | null
          role_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          difficulty_level?: string
          estimated_duration?: number | null
          id?: string
          is_active?: boolean
          role_description?: string | null
          role_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          difficulty_level?: string
          estimated_duration?: number | null
          id?: string
          is_active?: boolean
          role_description?: string | null
          role_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      training_topics: {
        Row: {
          created_at: string
          difficulty_level: string
          estimated_duration: number | null
          id: string
          order_index: number
          subtopic: string | null
          topic_name: string
          training_plan_id: string
        }
        Insert: {
          created_at?: string
          difficulty_level?: string
          estimated_duration?: number | null
          id?: string
          order_index?: number
          subtopic?: string | null
          topic_name: string
          training_plan_id: string
        }
        Update: {
          created_at?: string
          difficulty_level?: string
          estimated_duration?: number | null
          id?: string
          order_index?: number
          subtopic?: string | null
          topic_name?: string
          training_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_topics_training_plan_id_fkey"
            columns: ["training_plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_tracking: {
        Row: {
          active_users: number | null
          ai_tokens_used: number | null
          created_at: string | null
          id: string
          interviews_conducted: number | null
          organization_id: string
          period_end: string
          period_start: string
          updated_at: string | null
        }
        Insert: {
          active_users?: number | null
          ai_tokens_used?: number | null
          created_at?: string | null
          id?: string
          interviews_conducted?: number | null
          organization_id: string
          period_end: string
          period_start: string
          updated_at?: string | null
        }
        Update: {
          active_users?: number | null
          ai_tokens_used?: number | null
          created_at?: string | null
          id?: string
          interviews_conducted?: number | null
          organization_id?: string
          period_end?: string
          period_start?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_tracking_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          certificate_ids: string[] | null
          earned_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          certificate_ids?: string[] | null
          earned_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          certificate_ids?: string[] | null
          earned_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "certificate_badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_custom_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          custom_role_id: string
          id: string
          organization_id: string | null
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          custom_role_id: string
          id?: string
          organization_id?: string | null
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          custom_role_id?: string
          id?: string
          organization_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_custom_roles_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_custom_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_portal_preferences: {
        Row: {
          card_order: string[]
          created_at: string
          hidden_cards: string[] | null
          id: string
          portal_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          card_order?: string[]
          created_at?: string
          hidden_cards?: string[] | null
          id?: string
          portal_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          card_order?: string[]
          created_at?: string
          hidden_cards?: string[] | null
          id?: string
          portal_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          created_by_role: string | null
          id: string
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_by_role?: string | null
          id?: string
          organization_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_by_role?: string | null
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_session_logs: {
        Row: {
          created_at: string | null
          device_info: Json | null
          event_type: string
          failure_reason: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          session_duration_ms: number | null
          success: boolean | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          device_info?: Json | null
          event_type: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          session_duration_ms?: number | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          device_info?: Json | null
          event_type?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          session_duration_ms?: number | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_topic_progress: {
        Row: {
          assessments_completed: number
          best_score: number | null
          completed_at: string | null
          id: string
          last_accessed_at: string | null
          materials_completed: number
          status: string
          total_materials: number
          training_topic_id: string
          user_id: string
        }
        Insert: {
          assessments_completed?: number
          best_score?: number | null
          completed_at?: string | null
          id?: string
          last_accessed_at?: string | null
          materials_completed?: number
          status?: string
          total_materials?: number
          training_topic_id: string
          user_id: string
        }
        Update: {
          assessments_completed?: number
          best_score?: number | null
          completed_at?: string | null
          id?: string
          last_accessed_at?: string | null
          materials_completed?: number
          status?: string
          total_materials?: number
          training_topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_topic_progress_training_topic_id_fkey"
            columns: ["training_topic_id"]
            isOneToOne: false
            referencedRelation: "training_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_training_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          progress_percentage: number
          status: string
          training_plan_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          progress_percentage?: number
          status?: string
          training_plan_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          progress_percentage?: number
          status?: string
          training_plan_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_training_assignments_training_plan_id_fkey"
            columns: ["training_plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acquire_idempotency_lock: {
        Args: {
          p_key: string
          p_operation_type: string
          p_request_hash?: string
        }
        Returns: {
          acquired: boolean
          existing_resource_id: string
          existing_response: Json
          lock_id: string
        }[]
      }
      approve_partner_application_tx: {
        Args: { p_application_id: string; p_reviewer_id: string }
        Returns: Json
      }
      auto_close_expired_proctoring_sessions: { Args: never; Returns: number }
      calculate_cpi_score: {
        Args: {
          p_integrity_score?: number
          p_problem_solving_score: number
          p_technical_score: number
        }
        Returns: number
      }
      calculate_integrity_from_violations:
        | {
            Args: { p_ignored_violations?: Json; p_violations: Json }
            Returns: number
          }
        | {
            Args: {
              p_ignored_violations?: Json
              p_organization_id?: string
              p_violations: Json
            }
            Returns: number
          }
      can_access_interview: {
        Args: { interview_uuid: string; user_id: string }
        Returns: boolean
      }
      can_access_org_data: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      can_user_retake_certification: {
        Args: { p_certification_topic_id: string; p_user_id: string }
        Returns: boolean
      }
      can_view_interview_attempts: {
        Args: { attempt_id: string }
        Returns: boolean
      }
      check_and_award_badges: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      check_architecture_docs_status: { Args: never; Returns: Json }
      check_circuit_breaker: {
        Args: { p_service_name: string }
        Returns: {
          can_attempt: boolean
          current_state: string
          is_open: boolean
        }[]
      }
      check_daily_free_assessment_limit: {
        Args: { p_user_id: string }
        Returns: {
          can_take_free: boolean
          free_count: number
          free_limit: number
        }[]
      }
      check_rate_limit: {
        Args: {
          p_endpoint: string
          p_identifier: string
          p_max_requests?: number
          p_window_seconds?: number
        }
        Returns: {
          allowed: boolean
          remaining: number
          reset_at: string
        }[]
      }
      check_rls_enabled: { Args: { table_name: string }; Returns: boolean }
      check_user_exists: { Args: { user_email: string }; Returns: boolean }
      cleanup_expired_idempotency_keys: { Args: never; Returns: number }
      cleanup_old_proctoring_recordings: { Args: never; Returns: undefined }
      cleanup_rate_limit_buckets: { Args: never; Returns: number }
      complete_idempotency: {
        Args: {
          p_lock_id: string
          p_resource_id: string
          p_response: Json
          p_success?: boolean
        }
        Returns: undefined
      }
      create_interview_attempt: {
        Args: {
          p_candidate_email: string
          p_candidate_name: string
          p_interview_id: string
        }
        Returns: {
          attempt_id: string
          error_message: string
          is_resumed: boolean
          session_token: string
          success: boolean
        }[]
      }
      create_interview_attempt_with_invitation: {
        Args: {
          p_candidate_email: string
          p_candidate_name: string
          p_invitation_id: string
        }
        Returns: {
          attempt_id: string
          error_message: string
          is_resumed: boolean
          session_token: string
          success: boolean
        }[]
      }
      create_notification: {
        Args: {
          p_link?: string
          p_message: string
          p_metadata?: Json
          p_organization_id: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      decrypt_api_key: { Args: { encrypted_key: string }; Returns: string }
      delete_interview_tx: { Args: { p_interview_id: string }; Returns: Json }
      delete_organization_tx: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      delete_user_cascade_tx:
        | {
            Args: { p_admin_user_id: string; p_user_id: string }
            Returns: Json
          }
        | {
            Args: { p_elevate_admins?: boolean; p_user_id: string }
            Returns: Json
          }
      encrypt_api_key: { Args: { api_key: string }; Returns: string }
      enqueue_failed_job: {
        Args: {
          p_correlation_id?: string
          p_error_message: string
          p_error_stack?: string
          p_job_id: string
          p_job_type: string
          p_max_attempts?: number
          p_organization_id?: string
          p_payload: Json
          p_source_function?: string
          p_user_id?: string
        }
        Returns: string
      }
      execute_data_retention_cleanup: { Args: never; Returns: Json }
      finalize_proctored_submission: {
        Args: { p_session_token: string }
        Returns: {
          attempt_id: string
          success: boolean
        }[]
      }
      flag_stuck_upload_attempts: {
        Args: never
        Returns: {
          attempt_ids: string[]
          attempts_flagged: number
        }[]
      }
      generate_certificate_number: { Args: never; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      generate_invoice_tx:
        | {
            Args: {
              p_amount_cents: number
              p_line_items: Json
              p_notes?: string
              p_organization_id: string
              p_period_end: string
              p_period_start: string
              p_promotion_id?: string
              p_subscription_id: string
              p_tax_cents?: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_amount_cents: number
              p_idempotency_key?: string
              p_line_items: Json
              p_notes?: string
              p_organization_id: string
              p_period_end: string
              p_period_start: string
              p_promotion_id?: string
              p_subscription_id: string
              p_tax_cents?: number
            }
            Returns: Json
          }
      generate_session_token: { Args: never; Returns: string }
      generate_share_token: { Args: never; Returns: string }
      generate_slug: { Args: { input_text: string }; Returns: string }
      generate_verification_code: { Args: never; Returns: string }
      get_active_learning_subscription: {
        Args: { p_user_id: string }
        Returns: {
          amount_spent_cents: number
          expires_at: string
          is_unlimited: boolean
          plan_type: string
          subscription_id: string
        }[]
      }
      get_assessment_questions_for_attempt: {
        Args: { p_attempt_id: string }
        Returns: {
          assessment_id: string
          difficulty: string
          hints: string
          id: string
          options: Json
          order_index: number
          question_text: string
          question_type: string
          topic: string
        }[]
      }
      get_attempt_by_session: {
        Args: { token: string }
        Returns: {
          answers: Json
          candidate_email: string
          candidate_name: string
          created_at: string | null
          deadline_at: string | null
          id: string
          interview_id: string
          invitation_id: string | null
          session_token: string | null
          started_at: string | null
          status: string | null
          submitted_at: string | null
          time_taken: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "interview_attempts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_cron_jobs: {
        Args: never
        Returns: {
          active: boolean
          command: string
          jobid: number
          jobname: string
          schedule: string
        }[]
      }
      get_custom_role_permissions: {
        Args: { _org_id?: string; _user_id: string }
        Returns: Json
      }
      get_failed_job_stats: {
        Args: never
        Returns: {
          abandoned_count: number
          failed_count: number
          job_type: string
          recovered_count: number
          retrying_count: number
          total_count: number
        }[]
      }
      get_interview_for_candidate: {
        Args: { share_link_param: string }
        Returns: {
          id: string
          job_description_preview: string
          proctoring_enabled: boolean
          proctoring_settings: Json
          question_count: number
          share_link: string
          status: string
          time_limit: number
          title: string
        }[]
      }
      get_questions_for_attempt: {
        Args: { p_attempt_id: string }
        Returns: {
          created_at: string
          difficulty: string
          id: string
          interview_id: string
          options: Json
          order_index: number
          question_text: string
          question_type: string
          topic: string
        }[]
      }
      get_random_questions_for_attempt: {
        Args: {
          attempt_uuid: string
          interview_uuid: string
          num_questions: number
        }
        Returns: {
          created_at: string
          difficulty: string
          id: string
          interview_id: string
          options: Json
          order_index: number
          question_text: string
          topic: string
        }[]
      }
      get_retryable_jobs: {
        Args: { p_limit?: number }
        Returns: {
          attempt_count: number
          correlation_id: string
          id: string
          job_id: string
          job_type: string
          max_attempts: number
          payload: Json
          source_function: string
        }[]
      }
      get_tech_spocs_for_org: {
        Args: { _org_id: string }
        Returns: {
          email: string
          full_name: string
          is_global: boolean
          user_id: string
        }[]
      }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_action_permission: {
        Args: { _action_name: string; _user_id: string }
        Returns: boolean
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_any_role_with_hierarchy: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_custom_role: {
        Args: { _org_id?: string; _role_name: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_in_org: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_interview_usage: {
        Args: { org_id: string }
        Returns: undefined
      }
      increment_question_selection_counts: {
        Args: { question_ids: string[] }
        Returns: undefined
      }
      is_global_tech_spoc: { Args: { _user_id: string }; Returns: boolean }
      is_payment_enabled: {
        Args: { p_gateway_name?: string }
        Returns: {
          enabled: boolean
          gateway_name: string
          has_keys: boolean
          is_test_mode: boolean
        }[]
      }
      is_role_org_scoped: {
        Args: { check_role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      mark_architecture_docs_outdated: {
        Args: { file_patterns: string[] }
        Returns: number
      }
      mark_job_recovered: { Args: { p_job_id: string }; Returns: undefined }
      mark_job_retry_failed: {
        Args: { p_error_message: string; p_job_id: string }
        Returns: undefined
      }
      mark_job_retrying: { Args: { p_job_id: string }; Returns: undefined }
      optimistic_update: {
        Args: {
          p_expected_version: number
          p_id: string
          p_table_name: string
          p_updates: Json
        }
        Returns: {
          error_message: string
          new_version: number
          success: boolean
        }[]
      }
      prepare_question_regeneration_tx: {
        Args: { p_interview_id: string }
        Returns: Json
      }
      recalculate_all_cpi: {
        Args: never
        Returns: {
          attempt_id: string
          candidate_name: string
          new_cpi: number
          new_integrity: number
          new_recommendation: string
          old_cpi: number
          old_integrity: number
          old_recommendation: string
          total_violations: number
        }[]
      }
      record_circuit_failure: {
        Args: { p_service_name: string }
        Returns: undefined
      }
      record_circuit_success: {
        Args: { p_service_name: string }
        Returns: undefined
      }
      save_certification_evaluation_tx: {
        Args: {
          p_attempt_id: string
          p_integrity_score: number
          p_passed: boolean
          p_score: number
          p_time_taken: number
          p_violation_summary?: Json
        }
        Returns: Json
      }
      save_interview_evaluation_tx:
        | {
            Args: {
              p_attempt_id: string
              p_candidate_email: string
              p_candidate_name: string
              p_detailed_analysis: string
              p_hiring_decision: string
              p_integrity_score: number
              p_overall_score: number
              p_problem_solving_score: number
              p_strengths: string[]
              p_technical_score: number
              p_top_skills: string[]
              p_topic_scores: Json
              p_violations_detected?: number
              p_weak_skills: string[]
              p_weaknesses: string[]
            }
            Returns: Json
          }
        | {
            Args: {
              p_attempt_id: string
              p_candidate_email: string
              p_candidate_name: string
              p_detailed_analysis: string
              p_hiring_decision: string
              p_integrity_score: number
              p_overall_score: number
              p_problem_solving_score: number
              p_question_scores?: Json
              p_strengths: string[]
              p_technical_score: number
              p_top_skills: string[]
              p_topic_scores: Json
              p_violations_detected?: number
              p_weak_skills: string[]
              p_weaknesses: string[]
            }
            Returns: Json
          }
      set_cron_job_status: {
        Args: { p_active: boolean; p_jobname: string }
        Returns: undefined
      }
      setup_user_tx: {
        Args: {
          p_email: string
          p_full_name: string
          p_organization_id?: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: Json
      }
      soft_delete: {
        Args: { p_id: string; p_table_name: string }
        Returns: boolean
      }
      soft_restore: {
        Args: { p_id: string; p_table_name: string }
        Returns: boolean
      }
      terminate_attempt_with_session: {
        Args: { attempt_answers: string; seconds_taken: number; token: string }
        Returns: boolean
      }
      toggle_violation_ignored: {
        Args: {
          p_ignore: boolean
          p_session_id: string
          p_violation_id: string
        }
        Returns: {
          new_hiring_decision: string
          new_integrity_score: number
          success: boolean
        }[]
      }
      trigger_pending_merge_recovery: { Args: never; Returns: undefined }
      update_attempt_with_session: {
        Args: { attempt_answers: Json; seconds_taken: number; token: string }
        Returns: {
          attempt_id: string
          success: boolean
        }[]
      }
      update_cron_schedule: {
        Args: { p_jobname: string; p_schedule: string }
        Returns: undefined
      }
      user_is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      user_is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      verify_certificate_by_code: {
        Args: { p_verification_code: string }
        Returns: {
          candidate_name: string
          category: string
          certificate_number: string
          certification_name: string
          difficulty_level: string
          expires_at: string
          integrity_score: number
          is_revoked: boolean
          issued_at: string
          revoked_reason: string
          score: number
          verification_code: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "hr"
        | "interviewer"
        | "contributor"
        | "candidate"
        | "guest"
        | "platform_admin"
        | "partner_admin"
        | "hr_recruiter"
        | "ta_creator"
        | "billing_contact"
        | "tech_spoc"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: [
        "admin",
        "hr",
        "interviewer",
        "contributor",
        "candidate",
        "guest",
        "platform_admin",
        "partner_admin",
        "hr_recruiter",
        "ta_creator",
        "billing_contact",
        "tech_spoc",
      ],
    },
  },
} as const
