import jsPDF from 'jspdf';

interface TableRow {
  cells: string[];
}

interface Table {
  headers: string[];
  rows: TableRow[];
}

/**
 * Export the AWS Migration Plan to a professional PDF document
 */
export async function exportMigrationPlanToPDF(): Promise<{ success: boolean; fileName: string }> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Page setup
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  let yPosition = margin;

  // Colors
  const primaryColor = [102, 126, 234] as [number, number, number]; // #667eea
  const darkGray = [51, 51, 51] as [number, number, number];
  const mediumGray = [100, 100, 100] as [number, number, number];
  const lightGray = [200, 200, 200] as [number, number, number];
  const tableHeaderBg = [240, 240, 240] as [number, number, number];

  // Helper functions
  const addPage = () => {
    pdf.addPage();
    yPosition = margin;
  };

  const checkPageBreak = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - margin - 15) {
      addPage();
      return true;
    }
    return false;
  };

  const drawTitle = (text: string, size: number, color: [number, number, number] = darkGray) => {
    checkPageBreak(15);
    pdf.setFontSize(size);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(text, contentWidth);
    pdf.text(lines, margin, yPosition);
    yPosition += lines.length * (size * 0.4) + 5;
  };

  const drawText = (text: string, size: number = 10, bold: boolean = false) => {
    pdf.setFontSize(size);
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.setTextColor(...darkGray);
    const lines = pdf.splitTextToSize(text, contentWidth);
    
    for (const line of lines) {
      checkPageBreak(6);
      pdf.text(line, margin, yPosition);
      yPosition += 5;
    }
    yPosition += 2;
  };

  const drawTable = (table: Table, colWidths?: number[]) => {
    const cols = table.headers.length;
    const defaultColWidth = contentWidth / cols;
    const widths = colWidths || Array(cols).fill(defaultColWidth);
    const rowHeight = 7;
    const cellPadding = 2;

    // Draw header
    checkPageBreak(rowHeight * 2);
    let xPos = margin;
    
    pdf.setFillColor(...tableHeaderBg);
    pdf.rect(margin, yPosition - 4, contentWidth, rowHeight, 'F');
    
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...darkGray);
    
    table.headers.forEach((header, i) => {
      const cellText = pdf.splitTextToSize(header, widths[i] - cellPadding * 2);
      pdf.text(cellText[0] || '', xPos + cellPadding, yPosition);
      xPos += widths[i];
    });
    
    yPosition += rowHeight;

    // Draw rows
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    
    for (const row of table.rows) {
      checkPageBreak(rowHeight);
      xPos = margin;
      
      // Alternate row background
      if (table.rows.indexOf(row) % 2 === 1) {
        pdf.setFillColor(250, 250, 250);
        pdf.rect(margin, yPosition - 4, contentWidth, rowHeight, 'F');
      }
      
      row.cells.forEach((cell, i) => {
        const cellText = pdf.splitTextToSize(cell, widths[i] - cellPadding * 2);
        pdf.text(cellText[0] || '', xPos + cellPadding, yPosition);
        xPos += widths[i];
      });
      
      yPosition += rowHeight;
    }
    
    yPosition += 5;
  };

  const drawHorizontalLine = () => {
    pdf.setDrawColor(...lightGray);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 5;
  };

  // ============ COVER PAGE ============
  yPosition = 60;
  
  // Logo/Brand
  pdf.setFillColor(...primaryColor);
  pdf.rect(0, 0, pageWidth, 40, 'F');
  pdf.setFontSize(28);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('TalentGeenie', margin, 28);
  
  yPosition = 80;
  drawTitle('AWS Migration', 32, primaryColor);
  drawTitle('Detailed Project Plan', 24, darkGray);
  
  yPosition += 20;
  drawHorizontalLine();
  
  // Document info table
  const docInfoTable: Table = {
    headers: ['Field', 'Value'],
    rows: [
      { cells: ['Version', '1.0'] },
      { cells: ['Created', 'February 2026'] },
      { cells: ['Status', 'Planning Phase'] },
      { cells: ['Total Estimated Hours', '2,012 hours'] },
      { cells: ['Story Points', '503 SP (4 hours = 1 SP)'] },
      { cells: ['Recommended Team Size', '8-10 developers'] },
      { cells: ['Timeline', '17-23 weeks'] },
    ]
  };
  drawTable(docInfoTable, [60, contentWidth - 60]);

  // ============ TABLE OF CONTENTS ============
  addPage();
  drawTitle('Table of Contents', 20, primaryColor);
  yPosition += 5;
  
  const tocItems = [
    '1. Executive Summary',
    '2. Current Platform Inventory',
    '3. Phase 1: Infrastructure Setup (220 hours)',
    '4. Phase 2: Database Migration (356 hours)',
    '5. Phase 3: Authentication & Authorization (112 hours)',
    '6. Phase 4: Backend Services Migration (536 hours)',
    '7. Phase 5: Frontend Migration (392 hours)',
    '8. Phase 6: Testing & QA (260 hours)',
    '9. Phase 7: Deployment & Cutover (136 hours)',
    '10. Risk Assessment',
    '11. Resource Requirements',
    '12. Appendix: Complete Inventory'
  ];
  
  tocItems.forEach((item, i) => {
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...darkGray);
    pdf.text(item, margin + 5, yPosition);
    yPosition += 8;
  });

  // ============ EXECUTIVE SUMMARY ============
  addPage();
  drawTitle('1. Executive Summary', 18, primaryColor);
  drawHorizontalLine();
  
  drawTitle('Current Stack', 14);
  const currentStackTable: Table = {
    headers: ['Layer', 'Current Technology'],
    rows: [
      { cells: ['Frontend', 'React 18.3.1 + Vite + TypeScript'] },
      { cells: ['Styling', 'Tailwind CSS + Shadcn/UI'] },
      { cells: ['Backend', 'Supabase Edge Functions (Deno)'] },
      { cells: ['Database', 'PostgreSQL (Supabase)'] },
      { cells: ['Authentication', 'Supabase Auth'] },
      { cells: ['Storage', 'Supabase Storage'] },
      { cells: ['Realtime', 'Supabase Realtime'] },
    ]
  };
  drawTable(currentStackTable, [50, contentWidth - 50]);

  drawTitle('Target AWS Stack', 14);
  const targetStackTable: Table = {
    headers: ['Layer', 'Target Technology'],
    rows: [
      { cells: ['Frontend', 'S3 + CloudFront'] },
      { cells: ['Backend', 'ECS Fargate / Lambda'] },
      { cells: ['Database', 'RDS PostgreSQL'] },
      { cells: ['Authentication', 'AWS Cognito'] },
      { cells: ['Storage', 'S3'] },
      { cells: ['Realtime', 'API Gateway WebSocket'] },
      { cells: ['CDN', 'CloudFront'] },
      { cells: ['DNS', 'Route 53'] },
    ]
  };
  drawTable(targetStackTable, [50, contentWidth - 50]);

  // ============ PLATFORM INVENTORY ============
  addPage();
  drawTitle('2. Current Platform Inventory', 18, primaryColor);
  drawHorizontalLine();
  
  const inventoryTable: Table = {
    headers: ['Category', 'Count'],
    rows: [
      { cells: ['Database Tables', '122'] },
      { cells: ['RLS Policies', '393'] },
      { cells: ['Database Functions', '121'] },
      { cells: ['Edge Functions', '101'] },
      { cells: ['Frontend Pages', '89'] },
      { cells: ['React Components', '148'] },
      { cells: ['Custom Hooks', '25'] },
      { cells: ['Utility Libraries', '37'] },
      { cells: ['Storage Buckets', '5'] },
      { cells: ['React Contexts', '3'] },
    ]
  };
  drawTable(inventoryTable, [80, contentWidth - 80]);

  // ============ PHASE 1: INFRASTRUCTURE ============
  addPage();
  drawTitle('3. Phase 1: Infrastructure Setup', 18, primaryColor);
  drawText('Phase Duration: 2-3 weeks | Total Hours: 220 (55 SP)', 11, true);
  drawHorizontalLine();

  drawTitle('3.1 AWS Account & Organization Setup (44 hours)', 12);
  const infra1Table: Table = {
    headers: ['Task ID', 'Task', 'Hours', 'SP', 'Complexity'],
    rows: [
      { cells: ['INF-001', 'AWS Organization setup with multi-account strategy', '8', '2', 'Medium'] },
      { cells: ['INF-002', 'IAM policies & roles configuration', '16', '4', 'High'] },
      { cells: ['INF-003', 'Service control policies (SCPs)', '8', '2', 'Medium'] },
      { cells: ['INF-004', 'AWS SSO configuration', '8', '2', 'Medium'] },
      { cells: ['INF-005', 'Cost allocation tags & budgets', '4', '1', 'Low'] },
    ]
  };
  drawTable(infra1Table, [20, 75, 15, 12, 25]);

  drawTitle('3.2 Networking (VPC) (46 hours)', 12);
  const infra2Table: Table = {
    headers: ['Task ID', 'Task', 'Hours', 'SP', 'Complexity'],
    rows: [
      { cells: ['INF-006', 'VPC design & CIDR planning', '8', '2', 'Medium'] },
      { cells: ['INF-007', 'Public/Private subnet config (3 AZs)', '12', '3', 'Medium'] },
      { cells: ['INF-008', 'NAT Gateway configuration', '4', '1', 'Low'] },
      { cells: ['INF-009', 'Internet Gateway setup', '2', '0.5', 'Low'] },
      { cells: ['INF-010', 'Route tables configuration', '4', '1', 'Low'] },
      { cells: ['INF-011', 'VPC Flow Logs', '4', '1', 'Low'] },
      { cells: ['INF-012', 'Security Groups (base templates)', '8', '2', 'Medium'] },
      { cells: ['INF-013', 'Network ACLs', '4', '1', 'Low'] },
    ]
  };
  drawTable(infra2Table, [20, 75, 15, 12, 25]);

  checkPageBreak(60);
  drawTitle('3.3 Compute Infrastructure (40 hours)', 12);
  const infra3Table: Table = {
    headers: ['Task ID', 'Task', 'Hours', 'SP', 'Complexity'],
    rows: [
      { cells: ['INF-014', 'ECS Cluster setup', '8', '2', 'Medium'] },
      { cells: ['INF-015', 'ECR repository configuration', '4', '1', 'Low'] },
      { cells: ['INF-016', 'Application Load Balancer (ALB)', '8', '2', 'Medium'] },
      { cells: ['INF-017', 'Target groups configuration', '4', '1', 'Low'] },
      { cells: ['INF-018', 'Auto-scaling policies', '8', '2', 'Medium'] },
      { cells: ['INF-019', 'Lambda function base setup', '8', '2', 'Medium'] },
    ]
  };
  drawTable(infra3Table, [20, 75, 15, 12, 25]);

  checkPageBreak(60);
  drawTitle('3.4 CI/CD Pipeline (52 hours)', 12);
  const infra4Table: Table = {
    headers: ['Task ID', 'Task', 'Hours', 'SP', 'Complexity'],
    rows: [
      { cells: ['INF-020', 'CodePipeline setup', '12', '3', 'Medium'] },
      { cells: ['INF-021', 'CodeBuild projects (frontend/backend)', '16', '4', 'Medium'] },
      { cells: ['INF-022', 'GitHub Actions integration', '8', '2', 'Medium'] },
      { cells: ['INF-023', 'Deployment stages (dev/staging/prod)', '12', '3', 'Medium'] },
      { cells: ['INF-024', 'Artifact management', '4', '1', 'Low'] },
    ]
  };
  drawTable(infra4Table, [20, 75, 15, 12, 25]);

  checkPageBreak(50);
  drawTitle('3.5 Monitoring & Logging (36 hours)', 12);
  const infra5Table: Table = {
    headers: ['Task ID', 'Task', 'Hours', 'SP', 'Complexity'],
    rows: [
      { cells: ['INF-025', 'CloudWatch Log Groups', '4', '1', 'Low'] },
      { cells: ['INF-026', 'CloudWatch Dashboards', '8', '2', 'Medium'] },
      { cells: ['INF-027', 'CloudWatch Alarms', '8', '2', 'Medium'] },
      { cells: ['INF-028', 'X-Ray tracing setup', '8', '2', 'Medium'] },
      { cells: ['INF-029', 'SNS topics for alerts', '4', '1', 'Low'] },
      { cells: ['INF-030', 'CloudTrail configuration', '4', '1', 'Low'] },
    ]
  };
  drawTable(infra5Table, [20, 75, 15, 12, 25]);

  // ============ PHASE 2: DATABASE ============
  addPage();
  drawTitle('4. Phase 2: Database Migration', 18, primaryColor);
  drawText('Phase Duration: 3-4 weeks | Total Hours: 356 (89 SP)', 11, true);
  drawHorizontalLine();

  drawTitle('4.1 RDS PostgreSQL Setup (36 hours)', 12);
  const db1Table: Table = {
    headers: ['Task ID', 'Task', 'Hours', 'SP', 'Complexity'],
    rows: [
      { cells: ['DB-001', 'RDS instance provisioning (Multi-AZ)', '8', '2', 'Medium'] },
      { cells: ['DB-002', 'Parameter groups configuration', '4', '1', 'Low'] },
      { cells: ['DB-003', 'Subnet groups configuration', '4', '1', 'Low'] },
      { cells: ['DB-004', 'Security group rules', '4', '1', 'Low'] },
      { cells: ['DB-005', 'Backup & retention policies', '4', '1', 'Low'] },
      { cells: ['DB-006', 'Performance Insights setup', '4', '1', 'Low'] },
      { cells: ['DB-007', 'Read replicas configuration', '8', '2', 'Medium'] },
    ]
  };
  drawTable(db1Table, [20, 75, 15, 12, 25]);

  drawTitle('4.2 Schema Migration - 122 Tables', 12);
  drawText('Tables organized by domain with RLS policy count:', 10);
  
  const tableGroupsTable: Table = {
    headers: ['Domain', 'Tables', 'Hours', 'RLS Policies'],
    rows: [
      { cells: ['Authentication & User Management', '12', '31', '43'] },
      { cells: ['Organization & Partner', '8', '23', '23'] },
      { cells: ['Interview System', '12', '41', '60'] },
      { cells: ['Proctoring System', '8', '24', '33'] },
      { cells: ['Certification System', '10', '29', '36'] },
      { cells: ['Learning System', '12', '33', '36'] },
      { cells: ['AI & Model Management', '14', '37', '30'] },
      { cells: ['ATS & Integration', '5', '16', '11'] },
      { cells: ['Notification & Communication', '6', '16', '14'] },
      { cells: ['Payment & Billing', '8', '22', '18'] },
      { cells: ['Documentation & Reports', '7', '16', '16'] },
      { cells: ['System & Configuration', '12', '27', '26'] },
      { cells: ['Testing & QA', '5', '10', '8'] },
      { cells: ['Miscellaneous', '3', '6', '7'] },
    ]
  };
  drawTable(tableGroupsTable, [60, 25, 20, 35]);

  checkPageBreak(60);
  drawTitle('4.3 Database Functions Migration (134 hours)', 12);
  const dbFuncTable: Table = {
    headers: ['Task ID', 'Functions', 'Count', 'Hours', 'Complexity'],
    rows: [
      { cells: ['DB-130', 'Core auth functions', '15', '16', 'High'] },
      { cells: ['DB-131', 'Interview functions', '12', '16', 'High'] },
      { cells: ['DB-132', 'Proctoring functions', '8', '12', 'High'] },
      { cells: ['DB-133', 'Certification functions', '10', '12', 'Medium'] },
      { cells: ['DB-134', 'Organization functions', '8', '10', 'Medium'] },
      { cells: ['DB-135', 'Notification functions', '6', '8', 'Medium'] },
      { cells: ['DB-136', 'Payment functions', '8', '10', 'Medium'] },
      { cells: ['DB-137', 'Utility functions', '20', '16', 'Medium'] },
      { cells: ['DB-138', 'Circuit breaker & rate limiting', '8', '10', 'Medium'] },
      { cells: ['DB-139', 'Audit & security functions', '10', '12', 'Medium'] },
      { cells: ['DB-140', 'ATS integration functions', '6', '8', 'Medium'] },
      { cells: ['DB-141', 'CPI calculation functions', '5', '8', 'High'] },
      { cells: ['DB-142', 'Badge & achievement functions', '5', '6', 'Low'] },
    ]
  };
  drawTable(dbFuncTable, [20, 60, 18, 18, 25]);

  checkPageBreak(50);
  drawTitle('4.4 Data Migration (72 hours)', 12);
  const dataMigTable: Table = {
    headers: ['Task ID', 'Task', 'Hours', 'SP', 'Complexity'],
    rows: [
      { cells: ['DB-143', 'Data extraction scripts', '16', '4', 'High'] },
      { cells: ['DB-144', 'Data transformation logic', '16', '4', 'High'] },
      { cells: ['DB-145', 'Data validation scripts', '12', '3', 'Medium'] },
      { cells: ['DB-146', 'Incremental sync mechanism', '16', '4', 'High'] },
      { cells: ['DB-147', 'Rollback procedures', '12', '3', 'High'] },
    ]
  };
  drawTable(dataMigTable, [20, 75, 15, 12, 25]);

  // ============ PHASE 3: AUTHENTICATION ============
  addPage();
  drawTitle('5. Phase 3: Authentication & Authorization', 18, primaryColor);
  drawText('Phase Duration: 2 weeks | Total Hours: 112 (28 SP)', 11, true);
  drawHorizontalLine();

  drawTitle('5.1 AWS Cognito Setup (48 hours)', 12);
  const auth1Table: Table = {
    headers: ['Task ID', 'Task', 'Hours', 'SP', 'Complexity'],
    rows: [
      { cells: ['AUTH-001', 'User Pool configuration', '8', '2', 'Medium'] },
      { cells: ['AUTH-002', 'Identity Pool setup', '6', '1.5', 'Medium'] },
      { cells: ['AUTH-003', 'App client configuration', '4', '1', 'Low'] },
      { cells: ['AUTH-004', 'Custom attributes for roles', '6', '1.5', 'Medium'] },
      { cells: ['AUTH-005', 'Password policies', '4', '1', 'Low'] },
      { cells: ['AUTH-006', 'MFA configuration', '6', '1.5', 'Medium'] },
      { cells: ['AUTH-007', 'Email verification setup', '6', '1.5', 'Medium'] },
      { cells: ['AUTH-008', 'Social login (OAuth)', '8', '2', 'Medium'] },
    ]
  };
  drawTable(auth1Table, [22, 70, 15, 12, 25]);

  drawTitle('5.2 Custom Auth Flows (44 hours)', 12);
  const auth2Table: Table = {
    headers: ['Task ID', 'Task', 'Hours', 'SP', 'Complexity'],
    rows: [
      { cells: ['AUTH-009', 'Pre-signup Lambda trigger', '8', '2', 'Medium'] },
      { cells: ['AUTH-010', 'Post-confirmation Lambda trigger', '8', '2', 'Medium'] },
      { cells: ['AUTH-011', 'Pre-token generation trigger', '8', '2', 'Medium'] },
      { cells: ['AUTH-012', 'Custom message trigger (emails)', '8', '2', 'Medium'] },
      { cells: ['AUTH-013', 'User migration trigger', '12', '3', 'High'] },
    ]
  };
  drawTable(auth2Table, [22, 70, 15, 12, 25]);

  drawTitle('5.3 Authorization Layer (20 hours)', 12);
  const auth3Table: Table = {
    headers: ['Task ID', 'Task', 'Hours', 'SP', 'Complexity'],
    rows: [
      { cells: ['AUTH-014', 'API Gateway authorizers', '8', '2', 'Medium'] },
      { cells: ['AUTH-015', 'Role-based access middleware', '12', '3', 'High'] },
    ]
  };
  drawTable(auth3Table, [22, 70, 15, 12, 25]);

  // ============ PHASE 4: BACKEND ============
  addPage();
  drawTitle('6. Phase 4: Backend Services Migration', 18, primaryColor);
  drawText('Phase Duration: 4-5 weeks | Total Hours: 536 (134 SP)', 11, true);
  drawHorizontalLine();

  drawTitle('6.1 API Layer Setup (68 hours)', 12);
  const be1Table: Table = {
    headers: ['Task ID', 'Task', 'Hours', 'SP', 'Complexity'],
    rows: [
      { cells: ['BE-001', 'API Gateway REST API setup', '12', '3', 'Medium'] },
      { cells: ['BE-002', 'API Gateway WebSocket API', '16', '4', 'High'] },
      { cells: ['BE-003', 'Request validation schemas', '12', '3', 'Medium'] },
      { cells: ['BE-004', 'Response formatting middleware', '8', '2', 'Medium'] },
      { cells: ['BE-005', 'Error handling middleware', '8', '2', 'Medium'] },
      { cells: ['BE-006', 'Rate limiting (API Gateway)', '8', '2', 'Medium'] },
      { cells: ['BE-007', 'CORS configuration', '4', '1', 'Low'] },
    ]
  };
  drawTable(be1Table, [20, 75, 15, 12, 25]);

  drawTitle('6.2 Edge Functions → Lambda Migration (101 Functions)', 12);
  drawText('Functions by category:', 10);
  
  const funcSummaryTable: Table = {
    headers: ['Category', 'Functions', 'Hours', 'Key Functions'],
    rows: [
      { cells: ['Interview & Question', '18', '88', 'generate-questions, evaluate-interview'] },
      { cells: ['Proctoring', '15', '106', 'init-session, merge-chunks, analyze-video'] },
      { cells: ['Evaluation & Assessment', '10', '78', 'process-queue, calculate-cpi, detect-bias'] },
      { cells: ['Certificate & Learning', '8', '64', 'generate-certificate, parse-resume'] },
      { cells: ['Email & Notification', '12', '64', 'send-email, send-invitations'] },
      { cells: ['Admin & Management', '14', '76', 'admin-user-mgmt, scheduled-jobs'] },
      { cells: ['AI & Health Monitoring', '8', '44', 'ai-health-monitor, scan-features'] },
      { cells: ['Documentation & Content', '10', '70', 'generate-docs, enhance-content'] },
      { cells: ['Testing & Integration', '8', '56', 'run-tests, ats-webhook'] },
    ]
  };
  drawTable(funcSummaryTable, [45, 25, 20, 57]);

  checkPageBreak(50);
  drawTitle('6.3 Storage Migration (48 hours)', 12);
  const storagTable: Table = {
    headers: ['Task ID', 'Task', 'Hours', 'SP', 'Complexity'],
    rows: [
      { cells: ['BE-112', 'S3 bucket setup (5 buckets)', '8', '2', 'Medium'] },
      { cells: ['BE-113', 'Bucket policies & IAM', '8', '2', 'Medium'] },
      { cells: ['BE-114', 'Lifecycle rules', '4', '1', 'Low'] },
      { cells: ['BE-115', 'CORS configuration', '4', '1', 'Low'] },
      { cells: ['BE-116', 'Presigned URL generation service', '8', '2', 'Medium'] },
      { cells: ['BE-117', 'Storage data migration scripts', '16', '4', 'High'] },
    ]
  };
  drawTable(storagTable, [20, 75, 15, 12, 25]);

  // ============ PHASE 5: FRONTEND ============
  addPage();
  drawTitle('7. Phase 5: Frontend Migration', 18, primaryColor);
  drawText('Phase Duration: 3-4 weeks | Total Hours: 392 (98 SP)', 11, true);
  drawHorizontalLine();

  drawTitle('7.1 Build & Deployment Setup (24 hours)', 12);
  const fe1Table: Table = {
    headers: ['Task ID', 'Task', 'Hours', 'SP', 'Complexity'],
    rows: [
      { cells: ['FE-001', 'S3 static hosting setup', '4', '1', 'Low'] },
      { cells: ['FE-002', 'CloudFront distribution', '8', '2', 'Medium'] },
      { cells: ['FE-003', 'Build pipeline configuration', '8', '2', 'Medium'] },
      { cells: ['FE-004', 'Environment configuration', '4', '1', 'Low'] },
    ]
  };
  drawTable(fe1Table, [20, 75, 15, 12, 25]);

  drawTitle('7.2 Auth Integration Refactor (44 hours)', 12);
  const fe2Table: Table = {
    headers: ['Task ID', 'Task', 'Hours', 'SP', 'Complexity'],
    rows: [
      { cells: ['FE-005', 'Replace Supabase Auth with Cognito SDK', '16', '4', 'High'] },
      { cells: ['FE-006', 'AuthContext refactor', '12', '3', 'High'] },
      { cells: ['FE-007', 'Session management refactor', '8', '2', 'Medium'] },
      { cells: ['FE-008', 'Token refresh logic', '8', '2', 'Medium'] },
    ]
  };
  drawTable(fe2Table, [20, 75, 15, 12, 25]);

  drawTitle('7.3 API Client Refactor (80 hours)', 12);
  const fe3Table: Table = {
    headers: ['Task ID', 'Task', 'Hours', 'SP', 'Complexity'],
    rows: [
      { cells: ['FE-009', 'Create REST API client service', '16', '4', 'High'] },
      { cells: ['FE-010', 'Replace Supabase client calls (122 tables)', '40', '10', 'High'] },
      { cells: ['FE-011', 'WebSocket client for realtime', '16', '4', 'High'] },
      { cells: ['FE-012', 'Error handling standardization', '8', '2', 'Medium'] },
    ]
  };
  drawTable(fe3Table, [20, 75, 15, 12, 25]);

  drawTitle('7.4 Pages Migration Summary (89 Pages)', 12);
  const pageSummaryTable: Table = {
    headers: ['Category', 'Pages', 'Hours', 'Key Pages'],
    rows: [
      { cells: ['Authentication', '5', '22', 'Auth, ResetPassword, VerifyEmail'] },
      { cells: ['Dashboard & Landing', '5', '32', 'Dashboard, UnifiedDashboard, Landing'] },
      { cells: ['Interview Management', '12', '76', 'CreateInterview, TakeInterview, Detail'] },
      { cells: ['Proctoring', '4', '24', 'ProctoringDashboard, Settings'] },
      { cells: ['Assessment & Reporting', '6', '40', 'AssessmentReport, AdvancedAnalytics'] },
      { cells: ['Certification', '8', '46', 'TakeCertification, CertificationAdmin'] },
      { cells: ['Learning', '10', '56', 'TakeLearningAssessment, MyLearningPlan'] },
      { cells: ['Organization & Partner', '12', '68', 'PartnerPortal, OrganizationMgmt'] },
      { cells: ['Admin', '12', '80', 'PlatformAdminHub, AIConfiguration'] },
      { cells: ['Settings & Config', '8', '36', 'Settings, Profile, EmailConfiguration'] },
      { cells: ['Documentation', '7', '32', 'DocumentationCenter, ApiDocs'] },
    ]
  };
  drawTable(pageSummaryTable, [50, 18, 18, 60]);

  // ============ PHASE 6: TESTING ============
  addPage();
  drawTitle('8. Phase 6: Testing & QA', 18, primaryColor);
  drawText('Phase Duration: 2-3 weeks | Total Hours: 260 (65 SP)', 11, true);
  drawHorizontalLine();

  drawTitle('8.1 Unit Testing (64 hours)', 12);
  const test1Table: Table = {
    headers: ['Task ID', 'Task', 'Hours', 'SP', 'Complexity'],
    rows: [
      { cells: ['TEST-001', 'Backend service unit tests', '24', '6', 'Medium'] },
      { cells: ['TEST-002', 'Frontend component tests', '24', '6', 'Medium'] },
      { cells: ['TEST-003', 'Database function tests', '16', '4', 'Medium'] },
    ]
  };
  drawTable(test1Table, [22, 70, 15, 12, 25]);

  drawTitle('8.2 Integration Testing (80 hours)', 12);
  const test2Table: Table = {
    headers: ['Task ID', 'Task', 'Hours', 'SP', 'Complexity'],
    rows: [
      { cells: ['TEST-004', 'API endpoint tests', '24', '6', 'Medium'] },
      { cells: ['TEST-005', 'Auth flow integration tests', '16', '4', 'High'] },
      { cells: ['TEST-006', 'Database integration tests', '16', '4', 'Medium'] },
      { cells: ['TEST-007', 'Storage integration tests', '12', '3', 'Medium'] },
      { cells: ['TEST-008', 'WebSocket/Realtime tests', '12', '3', 'High'] },
    ]
  };
  drawTable(test2Table, [22, 70, 15, 12, 25]);

  drawTitle('8.3 E2E Testing (68 hours)', 12);
  const test3Table: Table = {
    headers: ['Task ID', 'Task', 'Hours', 'SP', 'Complexity'],
    rows: [
      { cells: ['TEST-009', 'Interview flow E2E', '16', '4', 'High'] },
      { cells: ['TEST-010', 'Proctoring flow E2E', '20', '5', 'High'] },
      { cells: ['TEST-011', 'Certification flow E2E', '16', '4', 'High'] },
      { cells: ['TEST-012', 'Admin workflows E2E', '16', '4', 'Medium'] },
    ]
  };
  drawTable(test3Table, [22, 70, 15, 12, 25]);

  drawTitle('8.4 Performance & Security (48 hours)', 12);
  const test4Table: Table = {
    headers: ['Task ID', 'Task', 'Hours', 'SP', 'Complexity'],
    rows: [
      { cells: ['TEST-013', 'Load testing', '16', '4', 'High'] },
      { cells: ['TEST-014', 'Security vulnerability scan', '16', '4', 'High'] },
      { cells: ['TEST-015', 'Penetration testing', '16', '4', 'High'] },
    ]
  };
  drawTable(test4Table, [22, 70, 15, 12, 25]);

  // ============ PHASE 7: DEPLOYMENT ============
  addPage();
  drawTitle('9. Phase 7: Deployment & Cutover', 18, primaryColor);
  drawText('Phase Duration: 1-2 weeks | Total Hours: 136 (34 SP)', 11, true);
  drawHorizontalLine();

  drawTitle('9.1 Staging Environment (36 hours)', 12);
  const dep1Table: Table = {
    headers: ['Task ID', 'Task', 'Hours', 'SP', 'Complexity'],
    rows: [
      { cells: ['DEP-001', 'Staging infrastructure deployment', '16', '4', 'High'] },
      { cells: ['DEP-002', 'Staging data migration', '12', '3', 'High'] },
      { cells: ['DEP-003', 'Staging smoke tests', '8', '2', 'Medium'] },
    ]
  };
  drawTable(dep1Table, [22, 70, 15, 12, 25]);

  drawTitle('9.2 Production Environment (36 hours)', 12);
  const dep2Table: Table = {
    headers: ['Task ID', 'Task', 'Hours', 'SP', 'Complexity'],
    rows: [
      { cells: ['DEP-004', 'Production infrastructure deployment', '16', '4', 'High'] },
      { cells: ['DEP-005', 'DNS configuration (Route 53)', '8', '2', 'Medium'] },
      { cells: ['DEP-006', 'SSL certificate setup (ACM)', '4', '1', 'Low'] },
      { cells: ['DEP-007', 'CDN configuration', '8', '2', 'Medium'] },
    ]
  };
  drawTable(dep2Table, [22, 70, 15, 12, 25]);

  drawTitle('9.3 Data Migration & Cutover (32 hours)', 12);
  const dep3Table: Table = {
    headers: ['Task ID', 'Task', 'Hours', 'SP', 'Complexity'],
    rows: [
      { cells: ['DEP-008', 'Final data sync', '12', '3', 'High'] },
      { cells: ['DEP-009', 'DNS cutover', '4', '1', 'Low'] },
      { cells: ['DEP-010', 'Monitoring validation', '8', '2', 'Medium'] },
      { cells: ['DEP-011', 'Rollback plan execution test', '8', '2', 'Medium'] },
    ]
  };
  drawTable(dep3Table, [22, 70, 15, 12, 25]);

  drawTitle('9.4 Post-Deployment (32 hours)', 12);
  const dep4Table: Table = {
    headers: ['Task ID', 'Task', 'Hours', 'SP', 'Complexity'],
    rows: [
      { cells: ['DEP-012', 'Hypercare support (3 days)', '24', '6', 'Medium'] },
      { cells: ['DEP-013', 'Documentation updates', '8', '2', 'Low'] },
    ]
  };
  drawTable(dep4Table, [22, 70, 15, 12, 25]);

  // ============ SUMMARY ============
  addPage();
  drawTitle('10. Summary by Phase', 18, primaryColor);
  drawHorizontalLine();

  const summaryTable: Table = {
    headers: ['Phase', 'Hours', 'Story Points', 'Duration'],
    rows: [
      { cells: ['Phase 1: Infrastructure Setup', '220', '55', '2-3 weeks'] },
      { cells: ['Phase 2: Database Migration', '356', '89', '3-4 weeks'] },
      { cells: ['Phase 3: Authentication', '112', '28', '2 weeks'] },
      { cells: ['Phase 4: Backend Services', '536', '134', '4-5 weeks'] },
      { cells: ['Phase 5: Frontend Migration', '392', '98', '3-4 weeks'] },
      { cells: ['Phase 6: Testing & QA', '260', '65', '2-3 weeks'] },
      { cells: ['Phase 7: Deployment', '136', '34', '1-2 weeks'] },
      { cells: ['TOTAL', '2,012', '503', '17-23 weeks'] },
    ]
  };
  drawTable(summaryTable, [60, 30, 35, 40]);

  // ============ RISK ASSESSMENT ============
  yPosition += 10;
  drawTitle('11. Risk Assessment', 18, primaryColor);
  drawHorizontalLine();

  drawTitle('High Risks', 12);
  const riskTable: Table = {
    headers: ['Risk', 'Impact', 'Probability', 'Mitigation'],
    rows: [
      { cells: ['Proctoring video upload complexity', 'High', 'High', 'Early POC for S3 chunk upload'] },
      { cells: ['AI model integration delays', 'High', 'Medium', 'Use same AI providers, test early'] },
      { cells: ['Data migration data loss', 'Critical', 'Low', 'Multiple backup points'] },
      { cells: ['Performance degradation', 'High', 'Medium', 'Load testing in staging'] },
    ]
  };
  drawTable(riskTable, [55, 20, 25, 50]);

  drawTitle('Medium Risks', 12);
  const riskTable2: Table = {
    headers: ['Risk', 'Impact', 'Probability', 'Mitigation'],
    rows: [
      { cells: ['Auth migration user disruption', 'Medium', 'Medium', 'Parallel login period'] },
      { cells: ['Realtime feature parity', 'Medium', 'Medium', 'WebSocket testing plan'] },
      { cells: ['RLS to app-level security', 'Medium', 'High', 'Comprehensive security review'] },
    ]
  };
  drawTable(riskTable2, [55, 20, 25, 50]);

  // ============ RESOURCES ============
  addPage();
  drawTitle('12. Resource Requirements', 18, primaryColor);
  drawHorizontalLine();

  drawTitle('Recommended Team Composition', 12);
  const teamTable: Table = {
    headers: ['Role', 'Count', 'Responsibilities'],
    rows: [
      { cells: ['Tech Lead / Architect', '1', 'Architecture decisions, code reviews'] },
      { cells: ['Senior Backend Developer', '2', 'Lambda/ECS migration, API development'] },
      { cells: ['Senior Frontend Developer', '2', 'React refactoring, Cognito integration'] },
      { cells: ['DevOps Engineer', '1', 'Infrastructure, CI/CD, monitoring'] },
      { cells: ['Database Engineer', '1', 'RDS setup, data migration'] },
      { cells: ['QA Engineer', '2', 'Testing automation, E2E testing'] },
      { cells: ['Project Manager', '1', 'Coordination, tracking'] },
      { cells: ['TOTAL', '10', ''] },
    ]
  };
  drawTable(teamTable, [55, 20, 75]);

  yPosition += 10;
  drawTitle('AWS Cost Estimate (Monthly)', 12);
  const costTable: Table = {
    headers: ['Service', 'Estimate'],
    rows: [
      { cells: ['ECS Fargate', '$150-300'] },
      { cells: ['RDS PostgreSQL (Multi-AZ)', '$200-400'] },
      { cells: ['S3 Storage', '$50-100'] },
      { cells: ['CloudFront', '$50-100'] },
      { cells: ['Lambda', '$20-50'] },
      { cells: ['Cognito', '$0-50'] },
      { cells: ['Misc (Route 53, SES, etc.)', '$30-50'] },
      { cells: ['TOTAL', '$500-1,050/month'] },
    ]
  };
  drawTable(costTable, [80, 70]);

  // ============ APPENDIX ============
  addPage();
  drawTitle('Appendix: Complete Inventory', 18, primaryColor);
  drawHorizontalLine();

  drawTitle('Edge Functions (101 total)', 12);
  const edgeFunctions = [
    'add-questions, admin-log-analysis, admin-user-management, ai-health-monitor',
    'analyze-proctoring-video, analyze-test-error, analyze-violations, approve-partner-application',
    'approve-questions, ats-webhook, auth-email-hook, auto-close-sessions',
    'auto-evaluate-trigger, auto-fix-issue, batch-regenerate-questions, bulk-approve-questions',
    'calculate-cpi, chatbot-assist, check-assessment-limit, check-file-changes',
    'cleanup-all-except-admins, cleanup-proctoring-chunks, cleanup-stale-proctoring',
    'cleanup-stuck-generations, cleanup-test-data, complete-password-setup, complete-user-signup',
    'confirm-proctoring-upload, create-from-template, delete-interview, delete-organization',
    'detect-bias, enforce-interview-deadlines, enhance-content-with-ai, enhance-email-content',
    'enhance-job-description, evaluate-certification, evaluate-interview, evaluate-learning-assessment',
    'execute-code, extract-skills, fix-pending-invitations, generate-architecture-docs',
    'generate-certificate-pdf, generate-certification-questions, generate-comparative-report',
    'generate-custom-report, generate-documentation-from-code, generate-documentation',
    'generate-invoice, generate-job-description, generate-learning-questions',
    'generate-predictive-analytics, generate-questions, generate-schema, generate-training-plan',
    '... and 50+ more functions'
  ];
  edgeFunctions.forEach(line => {
    drawText(line, 8);
  });

  checkPageBreak(80);
  drawTitle('Storage Buckets (5 total)', 12);
  const buckets = [
    '• candidate-resumes (PDF, DOCX - 10MB limit)',
    '• certificates (Public)',
    '• consent-documents',
    '• documentation',
    '• proctoring-recordings'
  ];
  buckets.forEach(b => drawText(b, 10));

  // ============ ADD PAGE NUMBERS ============
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
    pdf.text(
      'TalentGeenie AWS Migration Plan v1.0',
      margin,
      pageHeight - 8
    );
    pdf.text(
      'February 2026',
      pageWidth - margin,
      pageHeight - 8,
      { align: 'right' }
    );
  }

  // Save PDF
  const fileName = 'TalentGeenie_AWS_Migration_Plan_v1.0.pdf';
  pdf.save(fileName);

  return { success: true, fileName };
}
