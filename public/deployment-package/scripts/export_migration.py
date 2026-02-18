#!/usr/bin/env python3
"""
Export Migration Script for IAS Platform
Exports data from source database with PII masking and sanitization options
"""

import argparse
import json
import hashlib
import sys
from datetime import datetime
from typing import Dict, List, Any
import psycopg2
from psycopg2.extras import RealDictCursor

class MigrationExporter:
    def __init__(self, source_db_url: str, dry_run: bool = False, mask_pii: bool = True):
        self.source_db_url = source_db_url
        self.dry_run = dry_run
        self.mask_pii = mask_pii
        self.manifest = {
            "export_timestamp": datetime.utcnow().isoformat(),
            "dry_run": dry_run,
            "mask_pii": mask_pii,
            "statistics": {}
        }
        
    def connect_source(self):
        """Connect to source database"""
        try:
            self.conn = psycopg2.connect(self.source_db_url)
            self.cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            print("✅ Connected to source database")
        except Exception as e:
            print(f"❌ Failed to connect to source database: {e}")
            sys.exit(1)
    
    def mask_email(self, email: str) -> str:
        """Mask email address while preserving domain"""
        if not email or not self.mask_pii:
            return email
        
        local, domain = email.split('@')
        hashed = hashlib.sha256(local.encode()).hexdigest()[:12]
        return f"masked_{hashed}@{domain}"
    
    def mask_name(self, name: str) -> str:
        """Mask personal name"""
        if not name or not self.mask_pii:
            return name
        
        return f"User_{hashlib.sha256(name.encode()).hexdigest()[:8]}"
    
    def export_partners(self, partner_ids: List[str] = None) -> List[Dict]:
        """Export partner organizations"""
        print("\n📦 Exporting partners...")
        
        query = "SELECT * FROM organizations WHERE status = 'active'"
        params = []
        
        if partner_ids and partner_ids != ["all"]:
            placeholders = ','.join(['%s'] * len(partner_ids))
            query += f" AND id IN ({placeholders})"
            params = partner_ids
        
        self.cursor.execute(query, params)
        partners = self.cursor.fetchall()
        
        for partner in partners:
            # Mask sensitive fields
            if self.mask_pii:
                partner['name'] = self.mask_name(partner.get('name', ''))
                partner['contact_email'] = self.mask_email(partner.get('contact_email', ''))
                partner['contact_phone'] = '***MASKED***'
        
        self.manifest['statistics']['partners'] = len(partners)
        print(f"  ✓ Exported {len(partners)} partners")
        
        return partners
    
    def export_users(self, partner_ids: List[str] = None) -> List[Dict]:
        """Export users associated with partners"""
        print("\n👥 Exporting users...")
        
        query = """
            SELECT u.*, om.organization_id, om.role
            FROM profiles u
            JOIN organization_members om ON u.id = om.user_id
            WHERE om.status = 'active'
        """
        params = []
        
        if partner_ids and partner_ids != ["all"]:
            placeholders = ','.join(['%s'] * len(partner_ids))
            query += f" AND om.organization_id IN ({placeholders})"
            params = partner_ids
        
        self.cursor.execute(query, params)
        users = self.cursor.fetchall()
        
        for user in users:
            if self.mask_pii:
                user['email'] = self.mask_email(user.get('email', ''))
                user['full_name'] = self.mask_name(user.get('full_name', ''))
                user['phone'] = '***MASKED***'
        
        self.manifest['statistics']['users'] = len(users)
        print(f"  ✓ Exported {len(users)} users")
        
        return users
    
    def export_interviews(self, partner_ids: List[str] = None, max_count: int = None) -> List[Dict]:
        """Export interviews"""
        print("\n📝 Exporting interviews...")
        
        query = """
            SELECT i.*, o.id as organization_id
            FROM interviews i
            JOIN organizations o ON i.created_by IN (
                SELECT user_id FROM organization_members WHERE organization_id = o.id
            )
        """
        params = []
        
        if partner_ids and partner_ids != ["all"]:
            placeholders = ','.join(['%s'] * len(partner_ids))
            query += f" WHERE o.id IN ({placeholders})"
            params = partner_ids
        
        if max_count:
            query += f" LIMIT {max_count}"
        
        self.cursor.execute(query, params)
        interviews = self.cursor.fetchall()
        
        for interview in interviews:
            if self.mask_pii:
                interview['title'] = f"Interview_{hashlib.sha256(str(interview['id']).encode()).hexdigest()[:8]}"
                interview['job_description'] = '***MASKED***'
        
        self.manifest['statistics']['interviews'] = len(interviews)
        print(f"  ✓ Exported {len(interviews)} interviews")
        
        return interviews
    
    def export_attempts(self, interview_ids: List[str]) -> List[Dict]:
        """Export interview attempts"""
        print("\n🎯 Exporting interview attempts...")
        
        if not interview_ids:
            return []
        
        placeholders = ','.join(['%s'] * len(interview_ids))
        query = f"""
            SELECT * FROM interview_attempts
            WHERE interview_id IN ({placeholders})
        """
        
        self.cursor.execute(query, interview_ids)
        attempts = self.cursor.fetchall()
        
        for attempt in attempts:
            if self.mask_pii:
                attempt['candidate_email'] = self.mask_email(attempt.get('candidate_email', ''))
                attempt['candidate_name'] = self.mask_name(attempt.get('candidate_name', ''))
        
        self.manifest['statistics']['attempts'] = len(attempts)
        print(f"  ✓ Exported {len(attempts)} attempts")
        
        return attempts
    
    def export_proctoring_data(self, attempt_ids: List[str], include_recordings: bool = False) -> Dict:
        """Export proctoring violations and recording metadata"""
        print("\n🎥 Exporting proctoring data...")
        
        if not attempt_ids:
            return {"violations": [], "recordings": []}
        
        # Export violations
        placeholders = ','.join(['%s'] * len(attempt_ids))
        query = f"""
            SELECT * FROM proctoring_violations
            WHERE attempt_id IN ({placeholders})
        """
        
        self.cursor.execute(query, attempt_ids)
        violations = self.cursor.fetchall()
        
        # Export recording metadata (not actual files)
        recordings = []
        if include_recordings:
            query = f"""
                SELECT attempt_id, recording_url, duration, created_at
                FROM proctoring_recordings
                WHERE attempt_id IN ({placeholders})
            """
            self.cursor.execute(query, attempt_ids)
            recordings = self.cursor.fetchall()
            
            # Don't include full URLs in export
            for rec in recordings:
                rec['recording_url'] = f"s3://recordings/{rec['attempt_id']}.mp4"
        
        self.manifest['statistics']['violations'] = len(violations)
        self.manifest['statistics']['recordings_metadata'] = len(recordings)
        print(f"  ✓ Exported {len(violations)} violations")
        print(f"  ✓ Exported {len(recordings)} recording metadata entries")
        
        return {
            "violations": violations,
            "recordings": recordings
        }
    
    def save_export(self, data: Dict, output_file: str):
        """Save exported data to file"""
        if self.dry_run:
            print(f"\n🔍 DRY RUN: Would save to {output_file}")
            print(f"   Total size estimate: {sys.getsizeof(json.dumps(data)) / 1024:.2f} KB")
            return
        
        with open(output_file, 'w') as f:
            json.dump(data, f, indent=2, default=str)
        
        print(f"\n✅ Export saved to {output_file}")
        print(f"   File size: {sys.getsizeof(json.dumps(data)) / 1024:.2f} KB")
    
    def save_manifest(self, output_file: str):
        """Save export manifest"""
        if self.dry_run:
            print(f"\n🔍 DRY RUN: Would save manifest to {output_file}")
            return
        
        with open(output_file, 'w') as f:
            json.dump(self.manifest, f, indent=2)
        
        print(f"✅ Manifest saved to {output_file}")
    
    def run_export(self, 
                   partner_ids: List[str] = None,
                   max_interviews: int = None,
                   include_recordings: bool = False,
                   output_file: str = "export_data.json"):
        """Run complete export process"""
        self.connect_source()
        
        print("\n" + "="*60)
        print("  MIGRATION EXPORT")
        print("="*60)
        print(f"Mode: {'DRY RUN' if self.dry_run else 'LIVE EXPORT'}")
        print(f"PII Masking: {'ENABLED' if self.mask_pii else 'DISABLED'}")
        print("="*60)
        
        # Export partners
        partners = self.export_partners(partner_ids)
        exported_partner_ids = [p['id'] for p in partners]
        
        # Export users
        users = self.export_users(exported_partner_ids)
        
        # Export interviews
        interviews = self.export_interviews(exported_partner_ids, max_interviews)
        interview_ids = [i['id'] for i in interviews]
        
        # Export attempts
        attempts = self.export_attempts(interview_ids)
        attempt_ids = [a['id'] for a in attempts]
        
        # Export proctoring data
        proctoring = self.export_proctoring_data(attempt_ids, include_recordings)
        
        # Compile export data
        export_data = {
            "metadata": {
                "export_timestamp": self.manifest["export_timestamp"],
                "source": "IAS Platform",
                "version": "1.0.0"
            },
            "partners": partners,
            "users": users,
            "interviews": interviews,
            "attempts": attempts,
            "proctoring_violations": proctoring["violations"],
            "recording_metadata": proctoring["recordings"]
        }
        
        # Save export
        self.save_export(export_data, output_file)
        self.save_manifest(output_file.replace('.json', '_manifest.json'))
        
        # Print summary
        print("\n" + "="*60)
        print("  EXPORT SUMMARY")
        print("="*60)
        for key, value in self.manifest['statistics'].items():
            print(f"  {key.replace('_', ' ').title()}: {value}")
        print("="*60)
        
        self.cursor.close()
        self.conn.close()

def main():
    parser = argparse.ArgumentParser(description='Export data from IAS Platform for migration')
    parser.add_argument('--source-db', required=True, help='Source database connection string')
    parser.add_argument('--partners', nargs='+', default=['all'], help='Partner IDs to export (or "all")')
    parser.add_argument('--max-interviews', type=int, help='Maximum number of interviews to export')
    parser.add_argument('--include-recordings', action='store_true', help='Include recording metadata')
    parser.add_argument('--mask-pii', action='store_true', default=True, help='Mask PII (default: True)')
    parser.add_argument('--no-mask-pii', dest='mask_pii', action='store_false', help='Disable PII masking')
    parser.add_argument('--dry-run', action='store_true', help='Run in dry-run mode without saving')
    parser.add_argument('--output', default='export_data.json', help='Output file path')
    
    args = parser.parse_args()
    
    exporter = MigrationExporter(
        source_db_url=args.source_db,
        dry_run=args.dry_run,
        mask_pii=args.mask_pii
    )
    
    exporter.run_export(
        partner_ids=args.partners,
        max_interviews=args.max_interviews,
        include_recordings=args.include_recordings,
        output_file=args.output
    )

if __name__ == '__main__':
    main()
