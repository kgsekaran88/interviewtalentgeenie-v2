#!/usr/bin/env python3
"""
Import Migration Script for IAS Platform
Imports sanitized data into target database with referential integrity validation
"""

import argparse
import json
import sys
from datetime import datetime
from typing import Dict, List
import psycopg2
from psycopg2.extras import RealDictCursor, execute_values

class MigrationImporter:
    def __init__(self, target_db_url: str, dry_run: bool = False):
        self.target_db_url = target_db_url
        self.dry_run = dry_run
        self.import_log = {
            "import_timestamp": datetime.utcnow().isoformat(),
            "dry_run": dry_run,
            "results": {},
            "errors": []
        }
        self.id_mapping = {
            "partners": {},
            "users": {},
            "interviews": {},
            "attempts": {}
        }
    
    def connect_target(self):
        """Connect to target database"""
        try:
            self.conn = psycopg2.connect(self.target_db_url)
            self.cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            print("✅ Connected to target database")
        except Exception as e:
            print(f"❌ Failed to connect to target database: {e}")
            sys.exit(1)
    
    def load_export_data(self, export_file: str) -> Dict:
        """Load export data from file"""
        try:
            with open(export_file, 'r') as f:
                data = json.load(f)
            print(f"✅ Loaded export data from {export_file}")
            return data
        except Exception as e:
            print(f"❌ Failed to load export data: {e}")
            sys.exit(1)
    
    def validate_data(self, data: Dict) -> bool:
        """Validate export data structure and referential integrity"""
        print("\n🔍 Validating export data...")
        
        required_keys = ["partners", "users", "interviews", "attempts"]
        for key in required_keys:
            if key not in data:
                print(f"❌ Missing required key: {key}")
                return False
        
        # Validate referential integrity
        partner_ids = {p['id'] for p in data['partners']}
        user_org_ids = {u['organization_id'] for u in data['users']}
        
        if not user_org_ids.issubset(partner_ids):
            missing = user_org_ids - partner_ids
            print(f"⚠️  Warning: {len(missing)} users reference non-existent partners")
        
        print("✅ Data validation passed")
        return True
    
    def import_partners(self, partners: List[Dict]) -> int:
        """Import partner organizations"""
        print("\n📦 Importing partners...")
        
        if self.dry_run:
            print(f"  🔍 DRY RUN: Would import {len(partners)} partners")
            return len(partners)
        
        imported = 0
        for partner in partners:
            try:
                old_id = partner['id']
                
                self.cursor.execute("""
                    INSERT INTO organizations (
                        name, status, plan_tier, created_at, 
                        contact_email, legacy_id
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    partner['name'],
                    partner.get('status', 'active'),
                    partner.get('plan_tier', 'basic'),
                    partner['created_at'],
                    partner.get('contact_email'),
                    old_id
                ))
                
                new_id = self.cursor.fetchone()['id']
                self.id_mapping['partners'][old_id] = new_id
                imported += 1
                
            except Exception as e:
                self.import_log['errors'].append({
                    "type": "partner_import",
                    "partner_id": partner['id'],
                    "error": str(e)
                })
                print(f"  ⚠️  Failed to import partner {partner['id']}: {e}")
        
        self.conn.commit()
        print(f"  ✓ Imported {imported} partners")
        self.import_log['results']['partners'] = imported
        return imported
    
    def import_users(self, users: List[Dict]) -> int:
        """Import users"""
        print("\n👥 Importing users...")
        
        if self.dry_run:
            print(f"  🔍 DRY RUN: Would import {len(users)} users")
            return len(users)
        
        imported = 0
        for user in users:
            try:
                old_id = user['id']
                old_org_id = user['organization_id']
                new_org_id = self.id_mapping['partners'].get(old_org_id)
                
                if not new_org_id:
                    print(f"  ⚠️  Skipping user {old_id}: organization not found")
                    continue
                
                # First, create auth user (simplified - actual implementation would use Supabase Auth)
                self.cursor.execute("""
                    INSERT INTO profiles (
                        email, full_name, created_at, legacy_id
                    ) VALUES (%s, %s, %s, %s)
                    RETURNING id
                """, (
                    user['email'],
                    user.get('full_name'),
                    user['created_at'],
                    old_id
                ))
                
                new_user_id = self.cursor.fetchone()['id']
                
                # Add organization membership
                self.cursor.execute("""
                    INSERT INTO organization_members (
                        organization_id, user_id, role, status, created_at
                    ) VALUES (%s, %s, %s, %s, %s)
                """, (
                    new_org_id,
                    new_user_id,
                    user.get('role', 'member'),
                    'active',
                    user['created_at']
                ))
                
                self.id_mapping['users'][old_id] = new_user_id
                imported += 1
                
            except Exception as e:
                self.import_log['errors'].append({
                    "type": "user_import",
                    "user_id": user['id'],
                    "error": str(e)
                })
                print(f"  ⚠️  Failed to import user {user['id']}: {e}")
        
        self.conn.commit()
        print(f"  ✓ Imported {imported} users")
        self.import_log['results']['users'] = imported
        return imported
    
    def import_interviews(self, interviews: List[Dict]) -> int:
        """Import interviews"""
        print("\n📝 Importing interviews...")
        
        if self.dry_run:
            print(f"  🔍 DRY RUN: Would import {len(interviews)} interviews")
            return len(interviews)
        
        imported = 0
        for interview in interviews:
            try:
                old_id = interview['id']
                old_creator_id = interview['created_by']
                new_creator_id = self.id_mapping['users'].get(old_creator_id)
                
                if not new_creator_id:
                    print(f"  ⚠️  Skipping interview {old_id}: creator not found")
                    continue
                
                self.cursor.execute("""
                    INSERT INTO interviews (
                        title, status, created_by, created_at,
                        difficulty_level, duration_minutes, legacy_id
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    interview['title'],
                    interview.get('status', 'draft'),
                    new_creator_id,
                    interview['created_at'],
                    interview.get('difficulty_level'),
                    interview.get('duration_minutes'),
                    old_id
                ))
                
                new_id = self.cursor.fetchone()['id']
                self.id_mapping['interviews'][old_id] = new_id
                imported += 1
                
            except Exception as e:
                self.import_log['errors'].append({
                    "type": "interview_import",
                    "interview_id": interview['id'],
                    "error": str(e)
                })
                print(f"  ⚠️  Failed to import interview {interview['id']}: {e}")
        
        self.conn.commit()
        print(f"  ✓ Imported {imported} interviews")
        self.import_log['results']['interviews'] = imported
        return imported
    
    def import_attempts(self, attempts: List[Dict]) -> int:
        """Import interview attempts"""
        print("\n🎯 Importing interview attempts...")
        
        if self.dry_run:
            print(f"  🔍 DRY RUN: Would import {len(attempts)} attempts")
            return len(attempts)
        
        imported = 0
        for attempt in attempts:
            try:
                old_id = attempt['id']
                old_interview_id = attempt['interview_id']
                new_interview_id = self.id_mapping['interviews'].get(old_interview_id)
                
                if not new_interview_id:
                    print(f"  ⚠️  Skipping attempt {old_id}: interview not found")
                    continue
                
                self.cursor.execute("""
                    INSERT INTO interview_attempts (
                        interview_id, candidate_email, candidate_name,
                        status, score, started_at, completed_at, legacy_id
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    new_interview_id,
                    attempt['candidate_email'],
                    attempt.get('candidate_name'),
                    attempt.get('status', 'pending'),
                    attempt.get('score'),
                    attempt['started_at'],
                    attempt.get('completed_at'),
                    old_id
                ))
                
                new_id = self.cursor.fetchone()['id']
                self.id_mapping['attempts'][old_id] = new_id
                imported += 1
                
            except Exception as e:
                self.import_log['errors'].append({
                    "type": "attempt_import",
                    "attempt_id": attempt['id'],
                    "error": str(e)
                })
                print(f"  ⚠️  Failed to import attempt {attempt['id']}: {e}")
        
        self.conn.commit()
        print(f"  ✓ Imported {imported} attempts")
        self.import_log['results']['attempts'] = imported
        return imported
    
    def import_proctoring(self, violations: List[Dict], recordings: List[Dict]) -> int:
        """Import proctoring violations and recording metadata"""
        print("\n🎥 Importing proctoring data...")
        
        if self.dry_run:
            print(f"  🔍 DRY RUN: Would import {len(violations)} violations and {len(recordings)} recordings")
            return len(violations) + len(recordings)
        
        imported_violations = 0
        imported_recordings = 0
        
        # Import violations
        for violation in violations:
            try:
                old_attempt_id = violation['attempt_id']
                new_attempt_id = self.id_mapping['attempts'].get(old_attempt_id)
                
                if not new_attempt_id:
                    continue
                
                self.cursor.execute("""
                    INSERT INTO proctoring_violations (
                        attempt_id, violation_type, severity,
                        timestamp, details
                    ) VALUES (%s, %s, %s, %s, %s)
                """, (
                    new_attempt_id,
                    violation['violation_type'],
                    violation.get('severity', 'medium'),
                    violation['timestamp'],
                    json.dumps(violation.get('details', {}))
                ))
                imported_violations += 1
                
            except Exception as e:
                self.import_log['errors'].append({
                    "type": "violation_import",
                    "violation_id": violation.get('id'),
                    "error": str(e)
                })
        
        # Import recording metadata
        for recording in recordings:
            try:
                old_attempt_id = recording['attempt_id']
                new_attempt_id = self.id_mapping['attempts'].get(old_attempt_id)
                
                if not new_attempt_id:
                    continue
                
                self.cursor.execute("""
                    INSERT INTO proctoring_recordings (
                        attempt_id, recording_url, duration, created_at
                    ) VALUES (%s, %s, %s, %s)
                """, (
                    new_attempt_id,
                    recording['recording_url'],
                    recording.get('duration'),
                    recording['created_at']
                ))
                imported_recordings += 1
                
            except Exception as e:
                self.import_log['errors'].append({
                    "type": "recording_import",
                    "recording": recording,
                    "error": str(e)
                })
        
        self.conn.commit()
        print(f"  ✓ Imported {imported_violations} violations")
        print(f"  ✓ Imported {imported_recordings} recording metadata")
        
        self.import_log['results']['violations'] = imported_violations
        self.import_log['results']['recordings'] = imported_recordings
        
        return imported_violations + imported_recordings
    
    def save_import_log(self, output_file: str):
        """Save import log"""
        with open(output_file, 'w') as f:
            json.dump(self.import_log, f, indent=2)
        print(f"\n✅ Import log saved to {output_file}")
    
    def run_import(self, export_file: str):
        """Run complete import process"""
        data = self.load_export_data(export_file)
        
        if not self.validate_data(data):
            print("❌ Data validation failed. Aborting import.")
            sys.exit(1)
        
        self.connect_target()
        
        print("\n" + "="*60)
        print("  MIGRATION IMPORT")
        print("="*60)
        print(f"Mode: {'DRY RUN' if self.dry_run else 'LIVE IMPORT'}")
        print("="*60)
        
        try:
            # Import in order to maintain referential integrity
            self.import_partners(data['partners'])
            self.import_users(data['users'])
            self.import_interviews(data['interviews'])
            self.import_attempts(data['attempts'])
            self.import_proctoring(
                data.get('proctoring_violations', []),
                data.get('recording_metadata', [])
            )
            
            # Print summary
            print("\n" + "="*60)
            print("  IMPORT SUMMARY")
            print("="*60)
            for key, value in self.import_log['results'].items():
                print(f"  {key.replace('_', ' ').title()}: {value}")
            
            if self.import_log['errors']:
                print(f"\n  ⚠️  Errors: {len(self.import_log['errors'])}")
            
            print("="*60)
            
        except Exception as e:
            print(f"\n❌ Import failed: {e}")
            if not self.dry_run:
                self.conn.rollback()
            raise
        finally:
            self.save_import_log('import_log.json')
            self.cursor.close()
            self.conn.close()

def main():
    parser = argparse.ArgumentParser(description='Import data into IAS Platform target database')
    parser.add_argument('--target-db', required=True, help='Target database connection string')
    parser.add_argument('--export-file', required=True, help='Path to export data file')
    parser.add_argument('--dry-run', action='store_true', help='Run in dry-run mode without importing')
    
    args = parser.parse_args()
    
    importer = MigrationImporter(
        target_db_url=args.target_db,
        dry_run=args.dry_run
    )
    
    importer.run_import(args.export_file)

if __name__ == '__main__':
    main()
