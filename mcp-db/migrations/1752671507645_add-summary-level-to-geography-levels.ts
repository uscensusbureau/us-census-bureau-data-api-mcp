import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns('geography_levels', {
    //Summary Levels are codes that define geographic hiearchies for each level. 
    summary_level: { type: 'string', unique: true, null: false },
    parent_summary_level: { type: 'string' }
  });

  pgm.createIndex('geography_levels', 'summary_level');
  pgm.createIndex('geography_levels', 'parent_summary_level');
};

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns('geography_levels', 'summary_level');
  pgm.dropColumns('geography_levels', 'parent_summary_level');
};
