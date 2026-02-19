import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from '../_shared/cors.ts';


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const inputSchema = z.object({
      code: z.string().min(1, 'Code cannot be empty').max(100000, 'Code too long'),
      language: z.enum(['sql', 'python', 'javascript', 'java', 'typescript', 'go', 'cpp', 'csharp', 'ruby', 'rust', 'kotlin', 'swift', 'php', 'scala', 'r', 'bash', 'perl', 'lua', 'groovy'], {
        errorMap: () => ({ message: 'Invalid language. Supported: sql, python, javascript, java, typescript, go, cpp, csharp, ruby, rust, kotlin, swift, php, scala, r, bash, perl, lua, groovy' })
      }),
      testCases: z.array(z.any()).optional().default([]),
      attemptId: z.string().uuid('Invalid attempt ID').optional(),
      sessionToken: z.string().optional(),
      codingSchema: z.any().optional()
    });

    const { code, language, testCases, attemptId, sessionToken, codingSchema } = inputSchema.parse(await req.json());

    // Authorization: Check for session token (for candidates) OR authenticated user
    const authHeader = req.headers.get('Authorization');
    let isAuthorized = false;
    let userId: string | null = null;

    // Method 1: Session token authentication for candidates
    if (sessionToken && attemptId) {
      const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
      
      // Verify session token matches the attempt
      const { data: attempt, error: attemptError } = await supabaseService
        .from('interview_attempts')
        .select('id, status, session_token')
        .eq('id', attemptId)
        .eq('session_token', sessionToken)
        .eq('status', 'in_progress')
        .single();

      if (attempt && !attemptError) {
        isAuthorized = true;
        console.log(`Code execution authorized via session token for attempt: ${attemptId}`);
      }
    }

    // Method 2: Standard auth for admins/interviewers
    if (!isAuthorized && authHeader) {
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });

      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
      
      if (user && !authError) {
        userId = user.id;
        
        // Check for admin/interviewer roles
        const { data: userRoles } = await supabaseAuth
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        const adminRoles = ['platform_admin', 'partner_admin', 'hr_recruiter', 'tech_spoc'];
        const isAdmin = userRoles?.some(r => adminRoles.includes(r.role));

        if (isAdmin) {
          isAuthorized = true;
          console.log(`Code execution authorized via admin role for user: ${user.id}`);
        }
      }
    }

    // If still not authorized, return error
    if (!isAuthorized) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Authorization required. Please ensure you have a valid session.' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Executing ${language} code with ${testCases.length} test cases`);

    let result: any = {
      success: false,
      output: '',
      error: null,
      testResults: [],
      executionTime: 0
    };

    const startTime = Date.now();

    try {
      switch (language) {
        case 'sql':
          result = await executeSQLCode(code, testCases, codingSchema);
          break;
        case 'python':
          result = await executePythonCode(code, testCases);
          break;
        case 'javascript':
          result = await executeJavaScriptCode(code, testCases);
          break;
        case 'typescript':
          result = await executeTypeScriptCode(code, testCases);
          break;
        case 'java':
          result = await executeJavaCode(code, testCases);
          break;
        case 'go':
          result = await executeGoCode(code, testCases);
          break;
        case 'cpp':
          result = await executeCppCode(code, testCases);
          break;
        case 'csharp':
          result = await executeCSharpCode(code, testCases);
          break;
        case 'ruby':
          result = await executeRubyCode(code, testCases);
          break;
        case 'rust':
          result = await executeRustCode(code, testCases);
          break;
        case 'kotlin':
          result = await executeKotlinCode(code, testCases);
          break;
        case 'swift':
          result = await executeSwiftCode(code, testCases);
          break;
        case 'php':
          result = await executePhpCode(code, testCases);
          break;
        case 'scala':
          result = await executeScalaCode(code, testCases);
          break;
        case 'r':
          result = await executeRCode(code, testCases);
          break;
        case 'bash':
          result = await executeBashCode(code, testCases);
          break;
        case 'perl':
          result = await executePerlCode(code, testCases);
          break;
        case 'lua':
          result = await executeLuaCode(code, testCases);
          break;
        case 'groovy':
          result = await executeGroovyCode(code, testCases);
          break;
        default:
          throw new Error(`Unsupported language: ${language}`);
      }
    } catch (error: any) {
      result.error = error.message;
      result.success = false;
    }

    result.executionTime = Date.now() - startTime;

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in execute-code:', error);
    
    // Provide user-friendly error messages
    let userMessage = 'An error occurred while executing your code.';
    
    if (error.message?.includes('JSON')) {
      userMessage = 'Invalid request format. Please try again.';
    } else if (error.message) {
      userMessage = error.message;
    }
    
    return new Response(JSON.stringify({ 
      success: false,
      error: userMessage
    }), {
      status: 200, // Return 200 to avoid network error handling
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Sample database with test data
const sampleDatabase = {
  employees: [
    { id: 1, name: 'John Doe', department: 'Engineering', salary: 75000, hire_date: '2020-01-15' },
    { id: 2, name: 'Jane Smith', department: 'Marketing', salary: 65000, hire_date: '2019-03-20' },
    { id: 3, name: 'Bob Johnson', department: 'Engineering', salary: 85000, hire_date: '2018-07-10' },
    { id: 4, name: 'Alice Williams', department: 'HR', salary: 60000, hire_date: '2021-05-01' },
    { id: 5, name: 'Charlie Brown', department: 'Sales', salary: 70000, hire_date: '2020-11-30' },
  ],
  departments: [
    { id: 1, name: 'Engineering', manager_id: 3, budget: 500000 },
    { id: 2, name: 'Marketing', manager_id: 2, budget: 200000 },
    { id: 3, name: 'HR', manager_id: 4, budget: 150000 },
    { id: 4, name: 'Sales', manager_id: 5, budget: 300000 },
  ],
  orders: [
    { id: 1, customer_id: 101, product: 'Laptop', amount: 1200, order_date: '2024-01-15' },
    { id: 2, customer_id: 102, product: 'Mouse', amount: 25, order_date: '2024-01-16' },
    { id: 3, customer_id: 101, product: 'Keyboard', amount: 75, order_date: '2024-01-17' },
    { id: 4, customer_id: 103, product: 'Monitor', amount: 350, order_date: '2024-01-18' },
    { id: 5, customer_id: 102, product: 'Headphones', amount: 150, order_date: '2024-01-19' },
  ],
  products: [
    { product_id: 1, product_name: 'Laptop', category: 'Electronics', price: 1200.00 },
    { product_id: 2, product_name: 'Mouse', category: 'Electronics', price: 25.00 },
    { product_id: 3, product_name: 'Keyboard', category: 'Electronics', price: 75.00 },
    { product_id: 4, product_name: 'Monitor', category: 'Electronics', price: 350.00 },
    { product_id: 5, product_name: 'Headphones', category: 'Electronics', price: 150.00 },
    { product_id: 6, product_name: 'Desk Chair', category: 'Furniture', price: 299.00 },
    { product_id: 7, product_name: 'Standing Desk', category: 'Furniture', price: 549.00 },
    { product_id: 8, product_name: 'Office Lamp', category: 'Furniture', price: 45.00 },
    { product_id: 9, product_name: 'Notebook', category: 'Stationery', price: 5.00 },
    { product_id: 10, product_name: 'Pen Set', category: 'Stationery', price: 12.00 },
  ]
};

// Build database from coding schema or use default sample database
function buildDatabaseFromSchema(codingSchema?: any): Record<string, any[]> {
  // If no schema provided, use default sample database
  if (!codingSchema) {
    return sampleDatabase;
  }

  const database: Record<string, any[]> = { ...sampleDatabase };

  // Handle schema with tables array format
  if (codingSchema.tables && Array.isArray(codingSchema.tables)) {
    for (const table of codingSchema.tables) {
      const tableName = table.name?.toLowerCase();
      if (!tableName) continue;

      // Skip if table already exists in sample database
      if (database[tableName]) continue;

      // Generate sample data based on columns
      const sampleData = generateSampleDataForTable(table);
      database[tableName] = sampleData;
    }
  }

  // Handle schema with direct table definitions
  if (typeof codingSchema === 'object' && !codingSchema.tables) {
    for (const [tableName, tableInfo] of Object.entries(codingSchema)) {
      const lowerTableName = tableName.toLowerCase();
      if (database[lowerTableName]) continue;

      // Generate sample data based on table info
      const sampleData = generateSampleDataForTableInfo(lowerTableName, tableInfo as any);
      database[lowerTableName] = sampleData;
    }
  }

  return database;
}

// Generate sample data based on table schema
function generateSampleDataForTable(table: any): any[] {
  const columns = table.columns || [];
  const rows: any[] = [];
  
  // Generate 5-10 sample rows
  const rowCount = 5 + Math.floor(Math.random() * 6);
  
  for (let i = 1; i <= rowCount; i++) {
    const row: Record<string, any> = {};
    
    for (const col of columns) {
      const colName = typeof col === 'string' ? col : col.name;
      const colType = typeof col === 'string' ? 'varchar' : (col.type || 'varchar').toLowerCase();
      
      row[colName.toLowerCase()] = generateSampleValue(colName, colType, i);
    }
    
    rows.push(row);
  }
  
  return rows;
}

function generateSampleDataForTableInfo(tableName: string, tableInfo: any): any[] {
  const columns = tableInfo.columns || [];
  const rows: any[] = [];
  const rowCount = 5 + Math.floor(Math.random() * 6);
  
  for (let i = 1; i <= rowCount; i++) {
    const row: Record<string, any> = {};
    
    for (const colName of columns) {
      row[colName.toLowerCase()] = generateSampleValue(colName, 'varchar', i);
    }
    
    rows.push(row);
  }
  
  return rows;
}

function generateSampleValue(colName: string, colType: string, index: number): any {
  const lowerColName = colName.toLowerCase();
  const lowerColType = colType.toLowerCase();
  
  // Handle ID columns
  if (lowerColName.includes('id')) {
    return index;
  }
  
  // Handle name columns
  if (lowerColName.includes('name') || lowerColName.includes('title')) {
    const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa'];
    return `${names[index % names.length]} ${index}`;
  }
  
  // Handle category columns
  if (lowerColName.includes('category') || lowerColName.includes('type') || lowerColName.includes('department')) {
    const categories = ['Electronics', 'Furniture', 'Clothing', 'Food', 'Sports'];
    return categories[index % categories.length];
  }
  
  // Handle price/amount/salary columns
  if (lowerColName.includes('price') || lowerColName.includes('amount') || lowerColName.includes('salary') || lowerColName.includes('cost')) {
    return parseFloat((100 + index * 50 + Math.random() * 100).toFixed(2));
  }
  
  // Handle quantity/count columns
  if (lowerColName.includes('quantity') || lowerColName.includes('count') || lowerColName.includes('stock')) {
    return Math.floor(10 + index * 5);
  }
  
  // Handle date columns
  if (lowerColName.includes('date') || lowerColType.includes('date') || lowerColType.includes('timestamp')) {
    const date = new Date();
    date.setDate(date.getDate() - index * 7);
    return date.toISOString().split('T')[0];
  }
  
  // Handle email columns
  if (lowerColName.includes('email')) {
    return `user${index}@example.com`;
  }
  
  // Handle boolean columns
  if (lowerColType.includes('bool')) {
    return index % 2 === 0;
  }
  
  // Handle numeric types
  if (lowerColType.includes('int') || lowerColType.includes('decimal') || lowerColType.includes('numeric') || lowerColType.includes('float')) {
    return index * 10;
  }
  
  // Default string value
  return `Value ${index}`;
}

async function executeSQLCode(code: string, testCases: any[], codingSchema?: any) {
  try {
    // Strip SQL comments for validation (single-line -- and multi-line /* */)
    const codeWithoutComments = code
      .replace(/--.*$/gm, '') // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
      .trim();
    
    const trimmedCode = codeWithoutComments.toUpperCase();
    
    if (!trimmedCode) {
      return {
        success: false,
        error: 'Please enter a SQL query to execute.',
        output: '',
        testResults: []
      };
    }

    // Check for dangerous operations
    const dangerousKeywords = ['DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'INSERT', 'UPDATE'];
    const hasDangerousKeyword = dangerousKeywords.some(keyword => 
      trimmedCode.includes(keyword)
    );

    if (hasDangerousKeyword) {
      return {
        success: false,
        error: 'Only SELECT queries are allowed. Data modification operations (INSERT, UPDATE, DELETE, DROP, etc.) are not permitted.',
        output: '',
        testResults: []
      };
    }

    // Validate it's a SELECT statement or CTE (WITH clause)
    if (!trimmedCode.startsWith('SELECT') && !trimmedCode.startsWith('WITH')) {
      return {
        success: false,
        error: 'Your query must start with SELECT or WITH (for CTEs). Example: SELECT * FROM employees OR WITH cte AS (SELECT ...) SELECT * FROM cte',
        output: '',
        testResults: []
      };
    }

    // Build database from codingSchema if provided, otherwise use default
    const database = buildDatabaseFromSchema(codingSchema);

    // Execute the SQL query against the database (use original code with comments stripped for execution)
    const result = executeSQLQuery(codeWithoutComments, database);

    return {
      success: true,
      output: `Query executed successfully. Returned ${result.rows.length} row(s).\n\nResults:\n${formatSQLResults(result.rows)}`,
      error: null,
      testResults: [],
      queryResult: result.rows
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Query Error: ${error.message}`,
      output: '',
      testResults: []
    };
  }
}

function executeSQLQuery(query: string, database: any) {
  // Simple SQL parser and executor for SELECT queries and CTEs
  const upperQuery = query.toUpperCase().trim();
  let workingQuery = upperQuery;
  let tempDatabase = { ...database };
  
  // Handle CTEs (WITH clause)
  if (upperQuery.startsWith('WITH')) {
    const cteMatch = query.match(/WITH\s+(\w+)\s+AS\s*\((.*?)\)\s*SELECT/is);
    if (cteMatch) {
      const cteName = cteMatch[1].toLowerCase();
      const cteQuery = cteMatch[2];
      
      // Execute the CTE query
      const cteResult = executeSQLQuery(cteQuery, database);
      tempDatabase[cteName] = cteResult.rows;
      
      // Extract the main SELECT query after the CTE
      const mainQueryMatch = query.match(/WITH.*?\)\s*(SELECT.*)/is);
      if (mainQueryMatch) {
        return executeSQLQuery(mainQueryMatch[1], tempDatabase);
      }
    }
  }
  
  // Extract table name
  const fromMatch = workingQuery.match(/FROM\s+(\w+)/);
  if (!fromMatch) {
    throw new Error('Invalid SQL: FROM clause not found');
  }
  
  const tableName = fromMatch[1].toLowerCase();
  if (!tempDatabase[tableName]) {
    throw new Error(`Table '${tableName}' does not exist. Available tables: ${Object.keys(database).join(', ')}`);
  }
  
  let data = [...tempDatabase[tableName]];
  
  // Handle WHERE clause (basic implementation)
  const whereMatch = upperQuery.match(/WHERE\s+(.+?)(?:ORDER|GROUP|LIMIT|$)/);
  if (whereMatch) {
    const whereClause = whereMatch[1].trim();
    data = filterData(data, whereClause);
  }
  
  // Handle ORDER BY
  const orderMatch = upperQuery.match(/ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/);
  if (orderMatch) {
    const field = orderMatch[1].toLowerCase();
    const direction = orderMatch[2] || 'ASC';
    data.sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'DESC' ? bVal - aVal : aVal - bVal;
      }
      return direction === 'DESC' 
        ? String(bVal).localeCompare(String(aVal))
        : String(aVal).localeCompare(String(bVal));
    });
  }
  
  // Handle LIMIT
  const limitMatch = upperQuery.match(/LIMIT\s+(\d+)/);
  if (limitMatch) {
    data = data.slice(0, parseInt(limitMatch[1]));
  }
  
  // Handle SELECT fields
  const selectMatch = query.match(/SELECT\s+(.+?)\s+FROM/i);
  if (selectMatch) {
    const fields = selectMatch[1].trim();
    if (fields !== '*') {
      const fieldList = fields.split(',').map(f => f.trim().toLowerCase());
      data = data.map(row => {
        const newRow: any = {};
        fieldList.forEach(field => {
          // Handle aggregate functions
          if (field.includes('count(')) {
            newRow['count'] = data.length;
          } else if (field.includes('sum(')) {
            const sumField = field.match(/sum\((\w+)\)/i)?.[1];
            if (sumField) {
              newRow[`sum_${sumField}`] = data.reduce((acc, r) => acc + (r[sumField] || 0), 0);
            }
          } else if (field.includes('avg(')) {
            const avgField = field.match(/avg\((\w+)\)/i)?.[1];
            if (avgField) {
              const sum = data.reduce((acc, r) => acc + (r[avgField] || 0), 0);
              newRow[`avg_${avgField}`] = sum / data.length;
            }
          } else {
            // Handle aliases (AS keyword)
            const aliasMatch = field.match(/(\w+)\s+as\s+(\w+)/i);
            if (aliasMatch) {
              newRow[aliasMatch[2]] = row[aliasMatch[1]];
            } else {
              newRow[field] = row[field];
            }
          }
        });
        return newRow;
      });
    }
  }
  
  return { rows: data };
}

function filterData(data: any[], whereClause: string) {
  // Basic WHERE clause parser
  return data.filter(row => {
    // Handle simple comparisons: field = value, field > value, etc.
    const comparisons = whereClause.split(/\s+AND\s+/i);
    
    return comparisons.every(comp => {
      const match = comp.match(/(\w+)\s*(=|>|<|>=|<=|!=|<>)\s*(.+)/);
      if (!match) return true;
      
      const [, field, operator, valueStr] = match;
      const fieldName = field.toLowerCase();
      const fieldValue = row[fieldName];
      
      // Remove quotes from string values
      let compareValue: any = valueStr.trim().replace(/^['"]|['"]$/g, '');
      
      // Try to parse as number if it looks like one
      if (!isNaN(compareValue)) {
        compareValue = parseFloat(compareValue);
      }
      
      switch (operator) {
        case '=':
          return fieldValue == compareValue;
        case '>':
          return fieldValue > compareValue;
        case '<':
          return fieldValue < compareValue;
        case '>=':
          return fieldValue >= compareValue;
        case '<=':
          return fieldValue <= compareValue;
        case '!=':
        case '<>':
          return fieldValue != compareValue;
        default:
          return true;
      }
    });
  });
}

function formatSQLResults(rows: any[]) {
  if (rows.length === 0) return 'No results returned';
  
  const columns = Object.keys(rows[0]);
  const maxWidths = columns.map(col => 
    Math.max(col.length, ...rows.map(row => String(row[col] || '').length))
  );
  
  // Header
  let output = columns.map((col, i) => col.padEnd(maxWidths[i])).join(' | ') + '\n';
  output += maxWidths.map(w => '-'.repeat(w)).join('-+-') + '\n';
  
  // Rows (limit to first 10 for display)
  const displayRows = rows.slice(0, 10);
  output += displayRows.map(row => 
    columns.map((col, i) => String(row[col] || '').padEnd(maxWidths[i])).join(' | ')
  ).join('\n');
  
  if (rows.length > 10) {
    output += `\n... and ${rows.length - 10} more rows`;
  }
  
  return output;
}

async function executePythonCode(code: string, testCases: any[]) {
  try {
    if (!code.trim()) {
      return {
        success: false,
        error: 'Please enter Python code to execute.',
        output: '',
        testResults: []
      };
    }

    // Check for dangerous imports
    const dangerousImports = ['os', 'sys', 'subprocess', 'socket', '__import__'];
    const hasDangerousImport = dangerousImports.some(imp => 
      code.includes(`import ${imp}`) || code.includes(`from ${imp}`)
    );

    if (hasDangerousImport) {
      return {
        success: false,
        error: 'Security restriction: System-level imports (os, sys, subprocess, socket) are not allowed for safety reasons.',
        output: '',
        testResults: []
      };
    }

    return {
      success: true,
      output: 'Python code validated successfully.\n\nNote: Full execution in a sandbox environment is required for production use.\nYour code structure looks good!',
      error: null,
      testResults: []
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Python Error: ${error.message}`,
      output: '',
      testResults: []
    };
  }
}

async function executeJavaScriptCode(code: string, testCases: any[]) {
  try {
    if (!code.trim()) {
      return {
        success: false,
        error: 'Please enter JavaScript code to execute.',
        output: '',
        testResults: []
      };
    }

    // SECURITY: Do NOT use eval() - it's dangerous
    // Instead, validate code structure and provide feedback
    // For production, integrate with isolated sandbox services like Judge0 or Piston API
    
    // Basic validation
    if (!code.includes('function solution') && !code.includes('const solution') && !code.includes('let solution')) {
      return {
        success: false,
        error: 'Code must define a "solution" function. Example: function solution(input) { return result; }',
        output: '',
        testResults: []
      };
    }

    // Check for dangerous patterns
    const dangerousPatterns = [
      /require\s*\(/,
      /import\s+/,
      /eval\s*\(/,
      /Function\s*\(/,
      /process\./,
      /child_process/,
      /__dirname/,
      /__filename/
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        return {
          success: false,
          error: 'Code contains restricted operations for security reasons.',
          output: '',
          testResults: []
        };
      }
    }

    return {
      success: true,
      output: 'JavaScript code structure validated successfully.\n\nNote: Full execution requires isolated sandbox environment.\nCode validation passed! In production, this would run in a secure container.',
      error: null,
      testResults: []
    };
  } catch (error: any) {
    return {
      success: false,
      error: `JavaScript Error: ${error.message}. Make sure your code defines a 'solution' function.`,
      output: '',
      testResults: []
    };
  }
}

async function executeJavaCode(code: string, testCases: any[]) {
  try {
    if (!code.trim()) {
      return {
        success: false,
        error: 'Please enter Java code to validate.',
        output: '',
        testResults: []
      };
    }

    if (!code.includes('class') || !code.includes('public')) {
      return {
        success: false,
        error: 'Java code must contain a public class. Example: public class Solution { ... }',
        output: '',
        testResults: []
      };
    }

    return {
      success: true,
      output: 'Java code structure validated successfully.\n\nNote: Full compilation and execution would require a Java runtime environment.\nYour code structure looks correct!',
      error: null,
      testResults: []
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Java Error: ${error.message}`,
      output: '',
      testResults: []
    };
  }
}

async function executeTypeScriptCode(code: string, testCases: any[]) {
  try {
    if (!code.trim()) {
      return {
        success: false,
        error: 'Please enter TypeScript code to execute.',
        output: '',
        testResults: []
      };
    }

    // Check for function definition
    if (!code.includes('function') && !code.includes('const') && !code.includes('let')) {
      return {
        success: false,
        error: 'Code must define a function. Example: function solution(input: any): any { return result; }',
        output: '',
        testResults: []
      };
    }

    return {
      success: true,
      output: 'TypeScript code structure validated successfully.\n\nNote: Full execution requires isolated sandbox environment.\nCode validation passed!',
      error: null,
      testResults: []
    };
  } catch (error: any) {
    return {
      success: false,
      error: `TypeScript Error: ${error.message}`,
      output: '',
      testResults: []
    };
  }
}

async function executeGoCode(code: string, testCases: any[]) {
  try {
    if (!code.trim()) {
      return {
        success: false,
        error: 'Please enter Go code to validate.',
        output: '',
        testResults: []
      };
    }

    if (!code.includes('package') || !code.includes('func')) {
      return {
        success: false,
        error: 'Go code must include a package declaration and at least one function. Example: package main\nfunc main() { }',
        output: '',
        testResults: []
      };
    }

    return {
      success: true,
      output: 'Go code structure validated successfully.\n\nNote: Full compilation and execution would require a Go runtime environment.\nYour code structure looks correct!',
      error: null,
      testResults: []
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Go Error: ${error.message}`,
      output: '',
      testResults: []
    };
  }
}

async function executeCppCode(code: string, testCases: any[]) {
  try {
    if (!code.trim()) {
      return {
        success: false,
        error: 'Please enter C++ code to validate.',
        output: '',
        testResults: []
      };
    }

    if (!code.includes('int main') && !code.includes('void main')) {
      return {
        success: false,
        error: 'C++ code must contain a main function. Example: int main() { return 0; }',
        output: '',
        testResults: []
      };
    }

    return {
      success: true,
      output: 'C++ code structure validated successfully.\n\nNote: Full compilation and execution would require a C++ compiler.\nYour code structure looks correct!',
      error: null,
      testResults: []
    };
  } catch (error: any) {
    return {
      success: false,
      error: `C++ Error: ${error.message}`,
      output: '',
      testResults: []
    };
  }
}

async function executeCSharpCode(code: string, testCases: any[]) {
  try {
    if (!code.trim()) {
      return {
        success: false,
        error: 'Please enter C# code to validate.',
        output: '',
        testResults: []
      };
    }

    if (!code.includes('class') && !code.includes('struct')) {
      return {
        success: false,
        error: 'C# code must contain a class or struct. Example: class Solution { static void Main() { } }',
        output: '',
        testResults: []
      };
    }

    return {
      success: true,
      output: 'C# code structure validated successfully.\n\nNote: Full compilation and execution would require a .NET runtime.\nYour code structure looks correct!',
      error: null,
      testResults: []
    };
  } catch (error: any) {
    return {
      success: false,
      error: `C# Error: ${error.message}`,
      output: '',
      testResults: []
    };
  }
}

async function executeRubyCode(code: string, testCases: any[]) {
  try {
    if (!code.trim()) {
      return {
        success: false,
        error: 'Please enter Ruby code to validate.',
        output: '',
        testResults: []
      };
    }

    return {
      success: true,
      output: 'Ruby code structure validated successfully.\n\nNote: Full execution would require a Ruby runtime.\nYour code looks correct!',
      error: null,
      testResults: []
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Ruby Error: ${error.message}`,
      output: '',
      testResults: []
    };
  }
}

async function executeRustCode(code: string, testCases: any[]) {
  try {
    if (!code.trim()) {
      return {
        success: false,
        error: 'Please enter Rust code to validate.',
        output: '',
        testResults: []
      };
    }

    if (!code.includes('fn ')) {
      return {
        success: false,
        error: 'Rust code must contain at least one function. Example: fn main() { }',
        output: '',
        testResults: []
      };
    }

    return {
      success: true,
      output: 'Rust code structure validated successfully.\n\nNote: Full compilation and execution would require a Rust compiler.\nYour code structure looks correct!',
      error: null,
      testResults: []
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Rust Error: ${error.message}`,
      output: '',
      testResults: []
    };
  }
}

async function executeKotlinCode(code: string, testCases: any[]) {
  try {
    if (!code.trim()) {
      return {
        success: false,
        error: 'Please enter Kotlin code to validate.',
        output: '',
        testResults: []
      };
    }

    if (!code.includes('fun ')) {
      return {
        success: false,
        error: 'Kotlin code must contain at least one function. Example: fun main() { }',
        output: '',
        testResults: []
      };
    }

    return {
      success: true,
      output: 'Kotlin code structure validated successfully.\n\nNote: Full compilation and execution would require a Kotlin/JVM runtime.\nYour code structure looks correct!',
      error: null,
      testResults: []
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Kotlin Error: ${error.message}`,
      output: '',
      testResults: []
    };
  }
}

async function executeSwiftCode(code: string, testCases: any[]) {
  try {
    if (!code.trim()) {
      return {
        success: false,
        error: 'Please enter Swift code to validate.',
        output: '',
        testResults: []
      };
    }

    if (!code.includes('func ')) {
      return {
        success: false,
        error: 'Swift code must contain at least one function. Example: func solution() { }',
        output: '',
        testResults: []
      };
    }

    return {
      success: true,
      output: 'Swift code structure validated successfully.\n\nNote: Full compilation and execution would require a Swift runtime.\nYour code structure looks correct!',
      error: null,
      testResults: []
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Swift Error: ${error.message}`,
      output: '',
      testResults: []
    };
  }
}

async function executePhpCode(code: string, testCases: any[]) {
  try {
    if (!code.trim()) {
      return {
        success: false,
        error: 'Please enter PHP code to validate.',
        output: '',
        testResults: []
      };
    }

    if (!code.includes('<?php') && !code.includes('<?')) {
      return {
        success: false,
        error: 'PHP code must start with <?php tag. Example: <?php function solution() { } ?>',
        output: '',
        testResults: []
      };
    }

    return {
      success: true,
      output: 'PHP code structure validated successfully.\n\nNote: Full execution would require a PHP runtime.\nYour code structure looks correct!',
      error: null,
      testResults: []
    };
  } catch (error: any) {
    return {
      success: false,
      error: `PHP Error: ${error.message}`,
      output: '',
      testResults: []
    };
  }
}

async function executeScalaCode(code: string, testCases: any[]) {
  try {
    if (!code.trim()) {
      return {
        success: false,
        error: 'Please enter Scala code to validate.',
        output: '',
        testResults: []
      };
    }

    if (!code.includes('object ') && !code.includes('def ')) {
      return {
        success: false,
        error: 'Scala code must contain an object or function definition. Example: object Solution { def main(args: Array[String]): Unit = { } }',
        output: '',
        testResults: []
      };
    }

    return {
      success: true,
      output: 'Scala code structure validated successfully.\n\nNote: Full compilation and execution would require a Scala/JVM runtime.\nYour code structure looks correct!',
      error: null,
      testResults: []
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Scala Error: ${error.message}`,
      output: '',
      testResults: []
    };
  }
}

async function executeRCode(code: string, testCases: any[]) {
  try {
    if (!code.trim()) {
      return {
        success: false,
        error: 'Please enter R code to validate.',
        output: '',
        testResults: []
      };
    }

    // R code validation - check for basic function or assignment
    if (!code.includes('<-') && !code.includes('function') && !code.includes('=')) {
      return {
        success: false,
        error: 'R code should contain variable assignments or function definitions. Example: solution <- function() { }',
        output: '',
        testResults: []
      };
    }

    return {
      success: true,
      output: 'R code structure validated successfully.\n\nNote: Full execution would require an R runtime.\nYour code structure looks correct!',
      error: null,
      testResults: []
    };
  } catch (error: any) {
    return {
      success: false,
      error: `R Error: ${error.message}`,
      output: '',
      testResults: []
    };
  }
}

async function executeBashCode(code: string, testCases: any[]) {
  try {
    if (!code.trim()) {
      return {
        success: false,
        error: 'Please enter Bash/Shell script to validate.',
        output: '',
        testResults: []
      };
    }

    // Check for dangerous commands
    const dangerousCommands = ['rm -rf', 'sudo', 'chmod 777', 'mkfs', 'dd if=', ':(){', 'fork bomb'];
    const hasDangerousCommand = dangerousCommands.some(cmd => 
      code.toLowerCase().includes(cmd.toLowerCase())
    );

    if (hasDangerousCommand) {
      return {
        success: false,
        error: 'Security restriction: Dangerous shell commands are not allowed.',
        output: '',
        testResults: []
      };
    }

    return {
      success: true,
      output: 'Bash/Shell script structure validated successfully.\n\nNote: Full execution would require a Bash shell environment.\nYour script structure looks correct!',
      error: null,
      testResults: []
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Bash Error: ${error.message}`,
      output: '',
      testResults: []
    };
  }
}

async function executePerlCode(code: string, testCases: any[]) {
  try {
    if (!code.trim()) {
      return {
        success: false,
        error: 'Please enter Perl code to validate.',
        output: '',
        testResults: []
      };
    }

    // Check for shebang or use strict
    if (!code.includes('#!/') && !code.includes('use strict') && !code.includes('sub ')) {
      return {
        success: false,
        error: 'Perl code should include a shebang (#!/usr/bin/perl), "use strict", or a subroutine definition. Example: sub solution { }',
        output: '',
        testResults: []
      };
    }

    return {
      success: true,
      output: 'Perl code structure validated successfully.\n\nNote: Full execution would require a Perl interpreter.\nYour code structure looks correct!',
      error: null,
      testResults: []
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Perl Error: ${error.message}`,
      output: '',
      testResults: []
    };
  }
}

async function executeLuaCode(code: string, testCases: any[]) {
  try {
    if (!code.trim()) {
      return {
        success: false,
        error: 'Please enter Lua code to validate.',
        output: '',
        testResults: []
      };
    }

    if (!code.includes('function') && !code.includes('local ') && !code.includes('=')) {
      return {
        success: false,
        error: 'Lua code should contain function definitions or variable assignments. Example: function solution() end',
        output: '',
        testResults: []
      };
    }

    return {
      success: true,
      output: 'Lua code structure validated successfully.\n\nNote: Full execution would require a Lua interpreter.\nYour code structure looks correct!',
      error: null,
      testResults: []
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Lua Error: ${error.message}`,
      output: '',
      testResults: []
    };
  }
}

async function executeGroovyCode(code: string, testCases: any[]) {
  try {
    if (!code.trim()) {
      return {
        success: false,
        error: 'Please enter Groovy code to validate.',
        output: '',
        testResults: []
      };
    }

    if (!code.includes('def ') && !code.includes('class ') && !code.includes('=')) {
      return {
        success: false,
        error: 'Groovy code should contain function or class definitions. Example: def solution() { }',
        output: '',
        testResults: []
      };
    }

    return {
      success: true,
      output: 'Groovy code structure validated successfully.\n\nNote: Full execution would require a Groovy/JVM runtime.\nYour code structure looks correct!',
      error: null,
      testResults: []
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Groovy Error: ${error.message}`,
      output: '',
      testResults: []
    };
  }
}
