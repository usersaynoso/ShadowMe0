import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createSchemaBackup() {
  console.log('📝 Creating schema backup from schema.ts file...');
  
  try {
    // Read schema.ts file
    const schemaPath = path.resolve(__dirname, 'shared/schema.ts');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    
    // Output file path
    const outputFilePath = path.resolve(__dirname, 'DATABASE.sql');
    
    // Parse the schema to extract table definitions
    const tableDefinitions = extractTableDefinitions(schemaContent);
    const enumDefinitions = extractEnumDefinitions(schemaContent);
    
    // Create SQL script
    let sqlScript = `-- Shadow Me Database Schema Backup
-- Generated on: ${new Date().toISOString()}
-- Generated from: shared/schema.ts
-- 
-- This file contains the database schema derived from the application's schema.ts file.
-- Note: This is a simplified schema backup and may not include all database objects.

BEGIN;

-- Enum Types
${enumDefinitions.join('\n\n')}

-- Tables
${tableDefinitions.join('\n\n')}

-- Note: Indexes, constraints, and data are not included in this simplified backup.

COMMIT;
`;
    
    // Write to file
    fs.writeFileSync(outputFilePath, sqlScript);
    
    console.log(`✅ Schema backup created successfully at: ${outputFilePath}`);
  } catch (error) {
    console.error('❌ Failed to create schema backup:', error);
    process.exit(1);
  }
}

function extractEnumDefinitions(schemaContent) {
  const enumDefs = [];
  
  // Match enum definitions 
  // Example: export const userTypeEnum = pgEnum('user_type_enum', ['user', 'moderator', 'manager', 'admin']);
  const enumRegex = /export const (\w+) = pgEnum\('([^']+)', \[([^\]]+)\]\);/g;
  let match;
  
  while ((match = enumRegex.exec(schemaContent)) !== null) {
    const enumName = match[2];
    const values = match[3].split(',').map(v => 
      v.trim().replace(/'/g, '').replace(/"/g, '')
    );
    
    enumDefs.push(`CREATE TYPE "${enumName}" AS ENUM (${values.map(v => `'${v}'`).join(', ')});`);
  }
  
  return enumDefs;
}

function extractTableDefinitions(schemaContent) {
  const tableDefs = [];
  
  // Match table definitions
  // Example: export const users = pgTable('users', { ... });
  const tableRegex = /export const (\w+) = pgTable\('([^']+)', \{([^}]+)\}\);/g;
  let match;
  
  while ((match = tableRegex.exec(schemaContent)) !== null) {
    const tableName = match[2];
    const columnsContent = match[3];
    
    // Parse columns
    const columns = parseColumns(columnsContent);
    
    // Create SQL for this table
    const tableSQL = `CREATE TABLE "${tableName}" (
  ${columns.join(',\n  ')}
);`;
    
    tableDefs.push(tableSQL);
  }
  
  return tableDefs;
}

function parseColumns(columnsContent) {
  const columns = [];
  const lines = columnsContent.split('\n');
  
  for (const line of lines) {
    // Skip empty lines or lines without column definitions
    if (!line.trim() || !line.includes(':')) continue;
    
    // Example: user_id: uuid("user_id").primaryKey().notNull().defaultRandom(),
    let [colName, colDef] = line.split(':').map(s => s.trim());
    
    // Remove trailing comma
    colDef = colDef.replace(/,$/, '');
    
    // Determine data type
    let sqlType = "TEXT"; // Default
    let constraints = [];
    
    if (colDef.includes('uuid(')) {
      sqlType = 'UUID';
      if (colDef.includes('.primaryKey()')) {
        constraints.push('PRIMARY KEY');
      }
      if (colDef.includes('.notNull()')) {
        constraints.push('NOT NULL');
      }
      if (colDef.includes('.defaultRandom()')) {
        constraints.push('DEFAULT gen_random_uuid()');
      }
    } else if (colDef.includes('text(')) {
      sqlType = 'TEXT';
      if (colDef.includes('.notNull()')) {
        constraints.push('NOT NULL');
      }
    } else if (colDef.includes('integer(')) {
      sqlType = 'INTEGER';
      if (colDef.includes('.notNull()')) {
        constraints.push('NOT NULL');
      }
    } else if (colDef.includes('boolean(')) {
      sqlType = 'BOOLEAN';
      if (colDef.includes('.notNull()')) {
        constraints.push('NOT NULL');
      }
      if (colDef.includes('.default(')) {
        // Try to extract default value
        const defaultMatch = colDef.match(/\.default\(([^)]+)\)/);
        if (defaultMatch) {
          const defaultValue = defaultMatch[1].trim();
          constraints.push(`DEFAULT ${defaultValue}`);
        }
      }
    } else if (colDef.includes('timestamp(')) {
      sqlType = 'TIMESTAMP WITH TIME ZONE';
      if (colDef.includes('.notNull()')) {
        constraints.push('NOT NULL');
      }
      if (colDef.includes('.defaultNow()')) {
        constraints.push('DEFAULT CURRENT_TIMESTAMP');
      }
    } else if (colDef.includes('pgEnum(')) {
      // Try to extract enum type name
      const enumMatch = colDef.match(/pgEnum\(['"]([^'"]+)['"]/);
      if (enumMatch) {
        sqlType = enumMatch[1];
      }
      
      if (colDef.includes('.notNull()')) {
        constraints.push('NOT NULL');
      }
    }
    
    // Handle arrays
    if (colDef.includes('.array()')) {
      sqlType += '[]';
    }
    
    columns.push(`"${colName}" ${sqlType}${constraints.length ? ' ' + constraints.join(' ') : ''}`);
  }
  
  return columns;
}

createSchemaBackup();