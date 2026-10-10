import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { httpError } from '../utils/maintenance.js';

const TIME_ZONE = 'America/Bogota';
const STATUS_LABELS = { PENDING: 'Sin asignar', ASSIGNED: 'Asignada', CLOSED: 'Cerrada' };
const PRIORITY_LABELS = { ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja' };
const PROBLEM_LABELS = {
  ELECTRICIDAD: 'Electricidad', PLOMERIA: 'Plomería', CARPINTERIA: 'Carpintería',
  PINTURA: 'Pintura', INFRAESTRUCTURA: 'Infraestructura', ILUMINACION: 'Iluminación',
  MOBILIARIO: 'Mobiliario', EQUIPOS: 'Equipos', CERRAJERIA: 'Cerrajería', OTRO: 'Otro',
};

function validDateParts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) throw httpError(400, 'Selecciona una fecha válida para el reporte.');
  const parts = match.slice(1).map(Number);
  const [year, month, day] = parts;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (year < 2000 || year > 2100 || probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw httpError(400, 'Selecciona una fecha válida para el reporte.');
  }
  return parts;
}

function capitalize(value) { return value.charAt(0).toLocaleUpperCase('es') + value.slice(1); }

export function reportWindow(period, value) {
  if (!['day', 'month', 'year'].includes(period)) throw httpError(400, 'Selecciona un periodo válido para el reporte.');
  const [year, month, day] = validDateParts(value);
  let start;
  let end;
  let label;
  let suffix;
  if (period === 'day') {
    start = new Date(Date.UTC(year, month - 1, day, 5));
    end = new Date(Date.UTC(year, month - 1, day + 1, 5));
    label = capitalize(new Intl.DateTimeFormat('es-CO', { timeZone: TIME_ZONE, dateStyle: 'long' }).format(start));
    suffix = value;
  } else if (period === 'month') {
    start = new Date(Date.UTC(year, month - 1, 1, 5));
    end = new Date(Date.UTC(year, month, 1, 5));
    label = capitalize(new Intl.DateTimeFormat('es-CO', { timeZone: TIME_ZONE, month: 'long', year: 'numeric' }).format(start));
    suffix = value.slice(0, 7);
  } else {
    start = new Date(Date.UTC(year, 0, 1, 5));
    end = new Date(Date.UTC(year + 1, 0, 1, 5));
    label = `Año ${year}`;
    suffix = String(year);
  }
  return { start, end, label, suffix };
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-CO', { timeZone: TIME_ZONE, dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function displayRows(incidents) {
  return incidents.map((incident) => ({
    code: incident.code || `#${incident.id}`,
    createdAt: formatDateTime(incident.created_at),
    status: STATUS_LABELS[incident.status] || incident.status,
    priority: PRIORITY_LABELS[incident.priority] || incident.priority,
    problem: PROBLEM_LABELS[incident.problem_type] || incident.problem_type,
    space: incident.space_name || incident.space_name_snapshot || '—',
    zone: incident.space_zone || incident.space_zone_snapshot || '—',
    assignee: incident.assigned_person_name || incident.assigned_person_name_snapshot || 'Sin responsable',
    description: String(incident.description || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim(),
    closedAt: formatDateTime(incident.closed_at),
  }));
}

function summary(incidents) {
  return incidents.reduce((counts, incident) => {
    counts.total += 1;
    if (incident.status === 'PENDING') counts.unassigned += 1;
    if (incident.status === 'ASSIGNED') counts.assigned += 1;
    if (incident.status === 'CLOSED') counts.closed += 1;
    return counts;
  }, { total: 0, unassigned: 0, assigned: 0, closed: 0 });
}

export async function createExcelReport(incidents, periodLabel) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Gestor Mantenimiento';
  workbook.created = new Date();
  workbook.subject = `Incidencias · ${periodLabel}`;
  const sheet = workbook.addWorksheet('Incidencias', { views: [{ state: 'frozen', ySplit: 6 }] });
  sheet.properties.defaultRowHeight = 20;
  sheet.columns = [
    { key: 'code', width: 18 }, { key: 'createdAt', width: 22 }, { key: 'status', width: 16 },
    { key: 'priority', width: 12 }, { key: 'problem', width: 20 }, { key: 'space', width: 24 },
    { key: 'zone', width: 20 }, { key: 'assignee', width: 24 }, { key: 'description', width: 52 },
    { key: 'closedAt', width: 22 },
  ];
  sheet.mergeCells('A1:J1');
  const title = sheet.getCell('A1');
  title.value = 'GESTOR MANTENIMIENTO · REPORTE DE INCIDENCIAS';
  title.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 16 };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF07595C' } };
  title.alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 34;
  sheet.mergeCells('A2:J2');
  sheet.getCell('A2').value = `${periodLabel} · Generado el ${formatDateTime(new Date())}`;
  sheet.getCell('A2').font = { color: { argb: 'FF526E65' }, italic: true };
  const counts = summary(incidents);
  sheet.mergeCells('A4:B4'); sheet.getCell('A4').value = `Total: ${counts.total}`;
  sheet.mergeCells('C4:D4'); sheet.getCell('C4').value = `Sin asignar: ${counts.unassigned}`;
  sheet.mergeCells('E4:F4'); sheet.getCell('E4').value = `Asignadas: ${counts.assigned}`;
  sheet.mergeCells('G4:H4'); sheet.getCell('G4').value = `Cerradas: ${counts.closed}`;
  for (const address of ['A4', 'C4', 'E4', 'G4']) {
    const cell = sheet.getCell(address);
    cell.font = { bold: true, color: { argb: 'FF21483F' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF2EB' } };
    cell.alignment = { vertical: 'middle' };
  }
  sheet.getRow(4).height = 26;
  const header = sheet.getRow(6);
  header.values = ['Código', 'Fecha de registro', 'Estado', 'Prioridad', 'Tipo', 'Espacio', 'Zona / bloque', 'Responsable', 'Descripción', 'Fecha de cierre'];
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173F3A' } };
  header.alignment = { vertical: 'middle' };
  header.height = 28;
  for (const item of displayRows(incidents)) {
    const row = sheet.addRow([item.code, item.createdAt, item.status, item.priority, item.problem, item.space, item.zone, item.assignee, item.description, item.closedAt]);
    row.alignment = { vertical: 'top', wrapText: true };
    row.height = Math.min(72, Math.max(22, Math.ceil(item.description.length / 48) * 15));
    row.eachCell((cell) => { cell.border = { bottom: { style: 'hair', color: { argb: 'FFDDE7E0' } } }; });
  }
  sheet.autoFilter = { from: 'A6', to: `J${Math.max(6, sheet.rowCount)}` };
  sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function createPdfReport(incidents, periodLabel) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margins: { top: 36, right: 36, bottom: 40, left: 36 }, bufferPages: true, info: { Title: `Reporte de incidencias · ${periodLabel}`, Author: 'Gestor Mantenimiento' } });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const completed = new Promise((resolve, reject) => { doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
  const counts = summary(incidents);
  const columns = [
    ['Código', 'code', 70], ['Fecha', 'createdAt', 78], ['Estado', 'status', 64], ['Prioridad', 'priority', 50],
    ['Tipo', 'problem', 80], ['Espacio', 'space', 105], ['Responsable', 'assignee', 100], ['Descripción', 'description', 190],
  ];
  const tableX = 36;
  const bottom = 548;
  function heading() {
    doc.rect(0, 0, doc.page.width, 73).fill('#07595c');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18).text('GESTOR MANTENIMIENTO', 36, 24);
    doc.font('Helvetica').fontSize(9).text('Reporte de incidencias · Gimnasio Los Arrayanes', 36, 48);
    doc.fillColor('#163c39').font('Helvetica-Bold').fontSize(12).text(periodLabel, 36, 84);
    doc.fillColor('#60766e').font('Helvetica').fontSize(8).text(`Total ${counts.total}   |   Sin asignar ${counts.unassigned}   |   Asignadas ${counts.assigned}   |   Cerradas ${counts.closed}`, 36, 102);
  }
  function tableHeader(y) {
    let x = tableX;
    doc.rect(tableX, y, columns.reduce((sum, column) => sum + column[2], 0), 24).fill('#173f3a');
    for (const [label, , width] of columns) {
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7.2).text(label, x + 5, y + 8, { width: width - 10, ellipsis: true });
      x += width;
    }
    return y + 24;
  }
  heading();
  let y = tableHeader(122);
  const rows = displayRows(incidents);
  if (!rows.length) {
    doc.fillColor('#60766e').font('Helvetica').fontSize(11).text('No se registraron incidencias durante este periodo.', tableX, y + 24);
  } else {
    rows.forEach((item, index) => {
      const values = columns.map(([, key]) => key === 'description' ? item[key].slice(0, 360) : item[key]);
      const textHeight = Math.max(...values.map((value, columnIndex) => doc.font('Helvetica').fontSize(7.2).heightOfString(String(value), { width: columns[columnIndex][2] - 10 })));
      const height = Math.min(58, Math.max(28, textHeight + 10));
      if (y + height > bottom) { doc.addPage(); heading(); y = tableHeader(122); }
      const rowWidth = columns.reduce((sum, column) => sum + column[2], 0);
      doc.rect(tableX, y, rowWidth, height).fill(index % 2 ? '#f5f8f5' : '#ffffff').strokeColor('#dce6df').lineWidth(0.35).stroke();
      let x = tableX;
      values.forEach((value, columnIndex) => {
        const width = columns[columnIndex][2];
        doc.fillColor('#24473e').font('Helvetica').fontSize(7.2).text(String(value), x + 5, y + 6, { width: width - 10, height: height - 10, ellipsis: true });
        x += width;
      });
      y += height;
    });
  }
  const range = doc.bufferedPageRange();
  for (let page = range.start; page < range.start + range.count; page += 1) {
    doc.switchToPage(page);
    doc.fillColor('#71827c').font('Helvetica').fontSize(7).text(`Generado el ${formatDateTime(new Date())}`, 36, 568, { width: 300 });
    doc.text(`Página ${page - range.start + 1} de ${range.count}`, 650, 568, { width: 155, align: 'right' });
  }
  doc.end();
  return completed;
}
