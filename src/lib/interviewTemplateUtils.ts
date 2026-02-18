import ExcelJS from 'exceljs';
import { InterviewConfigTemplate, QuestionTypeDistribution } from '@/hooks/useInterviewConfiguration';
import { CategoryDifficultyDistribution, getDefaultCategoryDifficulty } from '@/lib/roleBasedDefaults';

// Brand colors
const BRAND_COLORS = {
  primary: 'FF6366F1',      // Indigo
  primaryLight: 'FFE0E7FF', // Light indigo
  secondary: 'FF8B5CF6',    // Purple
  success: 'FF22C55E',      // Green
  warning: 'FFF59E0B',      // Amber
  accent: 'FF0EA5E9',       // Sky blue
  dark: 'FF1E293B',         // Slate dark
  muted: 'FF64748B',        // Slate
  light: 'FFF8FAFC',        // Slate light
  white: 'FFFFFFFF',
};

// Default empty template config
export const getEmptyTemplateConfig = (): InterviewConfigTemplate['config'] => ({
  jobTitle: '',
  jobDescription: '',
  skills: [],
  questionCount: 10,
  questionBankSize: 200,
  timeLimit: 30,
  skillDomain: null,
  questionTypeDistribution: { mcq: 4, scenario: 3, coding: 2, descriptive: 1 },
  categoryDifficultyDistribution: getDefaultCategoryDifficulty(),
  topics: {},
  requiredQuestionRules: [],
  proctoringEnabled: false,
  primaryCloud: null,
  industry: null,
});

// ============= EXCEL TEMPLATE =============

// Helper to parse skills from comma-separated string
function parseSkillsList(skillsStr: string): string[] {
  if (!skillsStr || typeof skillsStr !== 'string') return [];
  return skillsStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

export async function generateExcelTemplate(templateName: string): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TalentGeenie';
  workbook.created = new Date();
  workbook.lastModifiedBy = 'TalentGeenie Interview Platform';

  // ===== Cover Sheet =====
  const coverSheet = workbook.addWorksheet('TalentGeenie', { 
    properties: { tabColor: { argb: BRAND_COLORS.primary } }
  });
  
  coverSheet.columns = [{ width: 60 }, { width: 40 }];
  
  // Brand header
  coverSheet.mergeCells('A1:B3');
  const titleCell = coverSheet.getCell('A1');
  titleCell.value = '🎯 TalentGeenie';
  titleCell.font = { bold: true, size: 28, color: { argb: BRAND_COLORS.white } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_COLORS.primary } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  coverSheet.mergeCells('A4:B4');
  const subtitleCell = coverSheet.getCell('A4');
  subtitleCell.value = 'Interview Configuration Template';
  subtitleCell.font = { bold: true, size: 16, color: { argb: BRAND_COLORS.dark } };
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_COLORS.primaryLight } };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  coverSheet.getRow(4).height = 30;

  coverSheet.addRow([]);
  
  const infoRows = [
    ['Template Name:', templateName || 'Untitled'],
    ['Created:', new Date().toLocaleDateString()],
    ['Version:', '1.0'],
    [''],
    ['📋 HOW TO USE THIS TEMPLATE', ''],
    [''],
    ['1️⃣  Go to "Configuration" sheet and fill in your interview settings'],
    ['2️⃣  Add topics/skills in the "Topics" sheet (optional)'],
    ['3️⃣  Define required rules in the "Required Rules" sheet (optional)'],
    ['4️⃣  Save this file and upload it to TalentGeenie'],
    [''],
    ['💡 TIP: Enable "Enhance with AI" when importing to auto-extract skills'],
  ];
  
  infoRows.forEach((rowData, idx) => {
    const row = coverSheet.addRow(rowData);
    if (idx < 3) {
      row.getCell(1).font = { bold: true, color: { argb: BRAND_COLORS.muted } };
      row.getCell(2).font = { color: { argb: BRAND_COLORS.dark } };
    } else if (rowData[0]?.includes('HOW TO USE')) {
      row.getCell(1).font = { bold: true, size: 14, color: { argb: BRAND_COLORS.primary } };
    } else if (rowData[0]?.match(/^[1-4]️⃣/)) {
      row.getCell(1).font = { size: 11, color: { argb: BRAND_COLORS.dark } };
    } else if (rowData[0]?.includes('TIP')) {
      row.getCell(1).font = { italic: true, color: { argb: BRAND_COLORS.success } };
    }
  });

  // ===== Configuration Sheet =====
  const configSheet = workbook.addWorksheet('Configuration', {
    properties: { tabColor: { argb: BRAND_COLORS.accent } }
  });

  // Set proper column widths - Value column is wider for job description
  configSheet.columns = [
    { header: 'Field', key: 'field', width: 26 },
    { header: 'Value', key: 'value', width: 55 },
    { header: 'Description', key: 'description', width: 45 },
  ];

  // Style header row - ONLY columns A, B, C
  const headerRow = configSheet.getRow(1);
  headerRow.height = 28;
  ['A', 'B', 'C'].forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.font = { bold: true, size: 11, color: { argb: BRAND_COLORS.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_COLORS.primary } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = {
      bottom: { style: 'medium', color: { argb: BRAND_COLORS.primary } }
    };
  });

  const addSectionHeader = (text: string, emoji: string = '') => {
    const row = configSheet.addRow({ field: `${emoji} ${text}`, value: '', description: '' });
    row.height = 24;
    // Only style columns A, B, C
    row.getCell(1).font = { bold: true, size: 11, color: { argb: BRAND_COLORS.primary } };
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_COLORS.primaryLight } };
    row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_COLORS.primaryLight } };
    row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_COLORS.primaryLight } };
    return row;
  };

  const addConfigRow = (field: string, value: any, description: string, isRequired: boolean = false) => {
    const row = configSheet.addRow({ field, value, description });
    row.height = 22;
    // Style individual cells, not entire row
    row.getCell(1).font = isRequired ? { bold: true, color: { argb: BRAND_COLORS.dark } } : { color: { argb: BRAND_COLORS.dark } };
    row.getCell(1).alignment = { vertical: 'middle' };
    row.getCell(2).alignment = { vertical: 'middle', wrapText: true };
    row.getCell(2).font = { color: { argb: BRAND_COLORS.dark } };
    row.getCell(3).font = { italic: true, size: 10, color: { argb: BRAND_COLORS.muted } };
    row.getCell(3).alignment = { vertical: 'middle' };
    // Add subtle border to data cells only
    [1, 2, 3].forEach(colNum => {
      row.getCell(colNum).border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });
    return row;
  };

  const addNoteRow = (text: string) => {
    const row = configSheet.addRow({ field: text, value: '', description: '' });
    row.getCell(1).font = { italic: true, size: 10, color: { argb: BRAND_COLORS.warning } };
    row.height = 18;
    return row;
  };

  // Job Details Section
  addSectionHeader('JOB DETAILS', '💼');
  addConfigRow('Job Title', '', 'e.g., Senior Frontend Developer, Backend Engineer', true);
  const jdRow = addConfigRow('Job Description', '', 'Paste the full job description here', true);
  jdRow.height = 60; // Taller row for job description
  jdRow.getCell(2).alignment = { vertical: 'top', wrapText: true };
  addConfigRow('Skills', '', 'Comma-separated: React, TypeScript, Node.js, AWS', true);
  addConfigRow('Primary Cloud', '', 'AWS | Azure | GCP | Multi-cloud | On-Premise | None');
  addConfigRow('Industry/Domain', '', 'e.g., FinTech, Healthcare, E-commerce, IT Services');
  configSheet.addRow({});

  // Interview Settings Section
  addSectionHeader('INTERVIEW SETTINGS', '⚙️');
  addConfigRow('Template Name', templateName || '', 'A name to identify this configuration');
  addConfigRow('Question Count', 10, 'Number of questions per interview (5-50)', true);
  addConfigRow('Question Bank Size', 200, 'Total questions to generate (50-500)');
  addConfigRow('Time Limit (minutes)', 30, 'Time limit in minutes (0 for no limit)');
  addConfigRow('Skill Domain', 'fullstack', 'frontend | backend | fullstack | database | devops | mobile | data_science | non_technical');
  addConfigRow('Proctoring Enabled', 'No', 'Yes or No - Enable candidate monitoring');
  configSheet.addRow({});

  // Question Type Distribution Section
  addSectionHeader('QUESTION TYPE COUNTS', '📝');
  addNoteRow('⚠️ Total must equal Question Count');
  addConfigRow('MCQ Count', 4, 'Multiple choice questions');
  addConfigRow('Scenario Count', 3, 'Situation-based questions');
  addConfigRow('Coding Count', 2, 'Programming/coding questions');
  addConfigRow('Descriptive Count', 1, 'Open-ended written questions');
  configSheet.addRow({});

  // Difficulty Distribution Sections - using question counts
  const difficultyTypes = [
    { name: 'MCQ', emoji: '🔵', defaults: [1, 2, 1] }, // For 4 MCQs: 1 easy, 2 medium, 1 hard
    { name: 'Scenario', emoji: '🟣', defaults: [1, 1, 1] }, // For 3 scenarios: 1 each
    { name: 'Coding', emoji: '🟠', defaults: [0, 1, 1] }, // For 2 coding: 0 easy, 1 medium, 1 hard
    { name: 'Descriptive', emoji: '🟢', defaults: [0, 1, 0] }, // For 1 descriptive: 1 medium
  ];

  difficultyTypes.forEach(({ name, emoji, defaults }) => {
    addSectionHeader(`${name.toUpperCase()} DIFFICULTY (Count)`, emoji);
    addNoteRow('⚠️ Must match category question count');
    addConfigRow(`${name} Easy`, defaults[0], 'Number of easy questions');
    addConfigRow(`${name} Medium`, defaults[1], 'Number of medium questions');
    addConfigRow(`${name} Hard`, defaults[2], 'Number of hard questions');
    configSheet.addRow({});
  });

  // ===== Topics Sheet =====
  const topicsSheet = workbook.addWorksheet('Topics', {
    properties: { tabColor: { argb: BRAND_COLORS.secondary } }
  });

  topicsSheet.columns = [
    { header: 'Topic/Skill', key: 'topic', width: 35 },
    { header: 'Weightage (%)', key: 'weightage', width: 18 },
    { header: 'Notes', key: 'notes', width: 40 },
  ];

  const topicsHeader = topicsSheet.getRow(1);
  topicsHeader.font = { bold: true, color: { argb: BRAND_COLORS.white } };
  topicsHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_COLORS.secondary } };
  topicsHeader.height = 24;

  // Add instruction row
  const topicInstr = topicsSheet.addRow({ topic: '📌 Add topics below. Total weightage should equal 100%', weightage: '', notes: '' });
  topicInstr.font = { italic: true, color: { argb: BRAND_COLORS.muted } };
  topicsSheet.addRow({});

  // Example topics
  const exampleTopics = [
    { topic: 'React', weightage: 25, notes: 'Hooks, Context, Performance' },
    { topic: 'TypeScript', weightage: 20, notes: 'Types, Generics, Utility types' },
    { topic: 'Node.js', weightage: 15, notes: 'Express, APIs, Middleware' },
    { topic: 'SQL/Database', weightage: 15, notes: 'Queries, Optimization, Design' },
    { topic: 'System Design', weightage: 15, notes: 'Architecture, Scalability' },
    { topic: 'API Design', weightage: 10, notes: 'REST, GraphQL, Best practices' },
  ];
  
  exampleTopics.forEach(t => {
    const row = topicsSheet.addRow(t);
    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(3).font = { italic: true, color: { argb: BRAND_COLORS.muted } };
  });

  // ===== Required Rules Sheet =====
  const rulesSheet = workbook.addWorksheet('Required Rules', {
    properties: { tabColor: { argb: BRAND_COLORS.warning } }
  });

  rulesSheet.columns = [
    { header: 'Question Type', key: 'type', width: 20 },
    { header: 'Difficulty', key: 'difficulty', width: 18 },
    { header: 'Minimum Count', key: 'min', width: 18 },
    { header: 'Notes', key: 'notes', width: 35 },
  ];

  const rulesHeader = rulesSheet.getRow(1);
  rulesHeader.font = { bold: true, color: { argb: BRAND_COLORS.white } };
  rulesHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_COLORS.warning } };
  rulesHeader.height = 24;

  // Add instruction
  const rulesInstr = rulesSheet.addRow({ type: '📌 Optional: Specify minimum required questions', difficulty: '', min: '', notes: '' });
  rulesInstr.font = { italic: true, color: { argb: BRAND_COLORS.muted } };
  
  const validTypes = rulesSheet.addRow({ type: 'Valid types: mcq, scenario, coding, descriptive', difficulty: 'easy, medium, hard', min: '', notes: '' });
  validTypes.font = { italic: true, size: 10, color: { argb: BRAND_COLORS.muted } };
  rulesSheet.addRow({});

  // Example rules
  const exampleRules = [
    { type: 'coding', difficulty: 'hard', min: 1, notes: 'Ensure at least 1 challenging coding question' },
    { type: 'mcq', difficulty: 'medium', min: 2, notes: 'Core knowledge verification' },
  ];
  
  exampleRules.forEach(r => {
    const row = rulesSheet.addRow(r);
    row.getCell(3).alignment = { horizontal: 'center' };
    row.getCell(4).font = { italic: true, color: { argb: BRAND_COLORS.muted } };
  });

  // Generate blob
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}


// ============= PARSE EXCEL =============

export async function parseExcelTemplate(file: File): Promise<InterviewConfigTemplate> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const configSheet = workbook.getWorksheet('Configuration');
  if (!configSheet) throw new Error('Configuration sheet not found');

  const config: Record<string, any> = {};
  
  configSheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      const field = row.getCell(1).value?.toString() || '';
      const value = row.getCell(2).value;
      config[field] = value;
    }
  });

  // Parse topics
  const topicsSheet = workbook.getWorksheet('Topics');
  const topics: Record<string, number> = {};
  if (topicsSheet) {
    topicsSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const topic = row.getCell(1).value?.toString();
        const weightage = Number(row.getCell(2).value) || 0;
        if (topic) topics[topic] = weightage;
      }
    });
  }

  // Parse required rules with type validation
  const validTypes = ['mcq', 'descriptive', 'scenario', 'coding'];
  const validDifficulties = ['easy', 'medium', 'hard'];
  const rulesSheet = workbook.getWorksheet('Required Rules');
  const rules: Array<{ type: 'mcq' | 'descriptive' | 'scenario' | 'coding'; difficulty: 'easy' | 'medium' | 'hard'; min: number }> = [];
  if (rulesSheet) {
    rulesSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const typeRaw = row.getCell(1).value?.toString()?.toLowerCase()?.trim();
        const difficultyRaw = row.getCell(2).value?.toString()?.toLowerCase()?.trim();
        const min = Number(row.getCell(3).value) || 0;
        
        // Validate and cast types
        if (typeRaw && difficultyRaw && min > 0 && 
            validTypes.includes(typeRaw) && validDifficulties.includes(difficultyRaw)) {
          rules.push({ 
            type: typeRaw as 'mcq' | 'descriptive' | 'scenario' | 'coding', 
            difficulty: difficultyRaw as 'easy' | 'medium' | 'hard', 
            min 
          });
        }
      }
    });
  }

  return {
    version: '1.0',
    name: config['Template Name'] || 'Imported Template',
    createdAt: new Date().toISOString(),
    config: {
      jobTitle: config['Job Title'] || '',
      jobDescription: config['Job Description'] || '',
      skills: parseSkillsList(config['Skills'] || ''),
      questionCount: Number(config['Question Count']) || 10,
      questionBankSize: Number(config['Question Bank Size']) || 200,
      timeLimit: Number(config['Time Limit (minutes)']) || 30,
      skillDomain: config['Skill Domain'] || null,
      questionTypeDistribution: {
        mcq: Number(config['MCQ Count']) || 0,
        scenario: Number(config['Scenario Count']) || 0,
        coding: Number(config['Coding Count']) || 0,
        descriptive: Number(config['Descriptive Count']) || 0,
      },
      categoryDifficultyDistribution: {
        mcq: {
          easy: Number(config['MCQ Easy']) || 0,
          medium: Number(config['MCQ Medium']) || 0,
          hard: Number(config['MCQ Hard']) || 0,
        },
        scenario: {
          easy: Number(config['Scenario Easy']) || 0,
          medium: Number(config['Scenario Medium']) || 0,
          hard: Number(config['Scenario Hard']) || 0,
        },
        coding: {
          easy: Number(config['Coding Easy']) || 0,
          medium: Number(config['Coding Medium']) || 0,
          hard: Number(config['Coding Hard']) || 0,
        },
        descriptive: {
          easy: Number(config['Descriptive Easy']) || 0,
          medium: Number(config['Descriptive Medium']) || 0,
          hard: Number(config['Descriptive Hard']) || 0,
        },
      },
      topics,
      requiredQuestionRules: rules,
      proctoringEnabled: config['Proctoring Enabled']?.toString().toLowerCase() === 'yes',
      // Parse cloud and industry/domain for interview creation context
      primaryCloud: config['Primary Cloud'] || null,
      industry: config['Industry/Domain'] || null,
    },
  };
}


// ============= DOWNLOAD HELPERS =============

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
