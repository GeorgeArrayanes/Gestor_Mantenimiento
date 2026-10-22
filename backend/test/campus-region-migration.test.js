import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { newDb } from 'pg-mem';
import { CAMPUS_REGION_IDS } from '../../shared/campus-regions.mjs';
import { projectRoot } from '../src/config.js';

describe('migración de bloques individuales', () => {
  it('amplía un catálogo existente sin mover los vínculos antiguos y admite exactamente el catálogo compartido', async () => {
    // Disposable memory only. Build the old schema first, then migrate populated
    // spaces, rather than merely testing a new empty database with final rules.
    const memory = newDb();
    const adapter = memory.adapters.createPg();
    const pool = new adapter.Pool();
    try {
      for (const file of ['001_init.sql', '002_super_admin.sql', '003_maintenance.sql', '004_directory_images.sql', '005_campus_regions.sql']) {
        let sql = await fs.readFile(path.join(projectRoot, 'database', 'migrations', file), 'utf8');
        if (file === '003_maintenance.sql') sql = sql.replace('UNIQUE(name,zone)', 'CONSTRAINT maintenance_spaces_name_zone_key UNIQUE(name,zone)');
        await pool.query(sql);
      }
      await pool.query("INSERT INTO maintenance_spaces(name,zone,campus_region_id) VALUES('Sala anterior','Piso 1','bloques-salones'),('Sala sin asignar','Piso 1',NULL)");
      const before = (await pool.query('SELECT * FROM maintenance_spaces ORDER BY id')).rows;
      await expect(pool.query("INSERT INTO maintenance_spaces(name,zone,campus_region_id) VALUES('Sala aún no permitida','Piso 1','bloque-1')")).rejects.toThrow();

      await pool.query(await fs.readFile(path.join(projectRoot, 'database', 'migrations', '006_individual_campus_blocks.sql'), 'utf8'));
      const after = (await pool.query('SELECT * FROM maintenance_spaces ORDER BY id')).rows;
      expect(after).toEqual(before);
      expect(after.map(row => row.campus_region_id)).toEqual(['bloques-salones', null]);

      for (const regionId of CAMPUS_REGION_IDS) {
        await pool.query('INSERT INTO maintenance_spaces(name,zone,campus_region_id) VALUES($1,$2,$3)', ['Sala repetida entre edificios', 'Piso 1', regionId]);
      }
      await expect(pool.query("INSERT INTO maintenance_spaces(name,zone,campus_region_id) VALUES('Sala no permitida','Piso 1','bloque-5')")).rejects.toThrow();
      await expect(pool.query("INSERT INTO maintenance_spaces(name,zone,campus_region_id) VALUES('Sala repetida entre edificios','Piso 1','bloque-1')")).rejects.toMatchObject({ code: '23505' });
      await expect(pool.query("INSERT INTO maintenance_spaces(name,zone,campus_region_id) VALUES('Sala sin asignar','Piso 1',NULL)")).rejects.toMatchObject({ code: '23505' });
    } finally { await pool.end(); }
  });
});
