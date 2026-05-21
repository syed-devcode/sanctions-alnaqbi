const router = require('express').Router();
const PDFDocument = require('pdfkit');
const { requireAuth } = require('../middleware/auth');

router.post('/', requireAuth, (req, res) => {
  const { query, risk_level, results, searched_at } = req.body;

  if (!query || !results) {
    return res.status(400).json({ error: 'query and results are required' });
  }

  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="sanctions-report-${Date.now()}.pdf"`
  );
  doc.pipe(res);

  // Header
  doc.fontSize(18).font('Helvetica-Bold').text('SANCTIONS SCREENING REPORT', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica').text('Confidential – For Internal Use Only', { align: 'center' });
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);

  // Metadata
  const searchDate = searched_at ? new Date(searched_at) : new Date();
  doc.fontSize(10).font('Helvetica-Bold').text('Search Details', { underline: true });
  doc.moveDown(0.3);
  doc.font('Helvetica')
    .text(`Date/Time:  ${searchDate.toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })} (GST)`)
    .text(`Searched By: ${req.user.email}`)
    .text(`Search Term: ${query}`)
    .text(`Overall Risk: ${riskLabel(risk_level)}`);
  doc.moveDown(0.8);

  // Results table
  doc.fontSize(10).font('Helvetica-Bold').text('Results', { underline: true });
  doc.moveDown(0.3);

  if (!results.length) {
    doc.font('Helvetica').fillColor('green').text('No matches found – CLEAR').fillColor('black');
  } else {
    const cols = { risk: 50, name: 140, alias: 140, source: 60, nationality: 70, dob: 80 };
    const startX = 50;
    let y = doc.y;

    // Table header
    doc.font('Helvetica-Bold').fontSize(9);
    let x = startX;
    doc.text('Risk', x, y, { width: cols.risk }); x += cols.risk;
    doc.text('Primary Name', x, y, { width: cols.name }); x += cols.name;
    doc.text('Matched Alias', x, y, { width: cols.alias }); x += cols.alias;
    doc.text('Source', x, y, { width: cols.source }); x += cols.source;
    doc.text('Nationality', x, y, { width: cols.nationality }); x += cols.nationality;
    doc.text('DOB', x, y, { width: cols.dob });
    doc.moveDown(0.3);
    doc.moveTo(startX, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.2);

    // Table rows
    doc.font('Helvetica').fontSize(8);
    for (const r of results) {
      if (doc.y > 750) { doc.addPage(); }
      y = doc.y;
      x = startX;
      const color = r.risk_level === 'confirmed_match' ? 'red' : '#CC6600';
      doc.fillColor(color).text(riskLabel(r.risk_level), x, y, { width: cols.risk }); x += cols.risk;
      doc.fillColor('black').text(r.primary_name || '-', x, y, { width: cols.name }); x += cols.name;
      doc.text(r.matched_alias || '-', x, y, { width: cols.alias }); x += cols.alias;
      doc.text(r.source || '-', x, y, { width: cols.source }); x += cols.source;
      doc.text(r.nationality || '-', x, y, { width: cols.nationality }); x += cols.nationality;
      doc.text(r.dob || '-', x, y, { width: cols.dob });
      doc.moveDown(0.5);
    }
  }

  // Footer
  doc.moveDown(1);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.3);
  doc.fontSize(8).fillColor('grey')
    .text('This report was generated automatically by the Sanctions Screening System.', { align: 'center' })
    .text('It should be reviewed by a qualified compliance officer before any decision is made.', { align: 'center' });

  doc.end();
});

function riskLabel(level) {
  if (level === 'confirmed_match') return 'CONFIRMED';
  if (level === 'possible_match') return 'POSSIBLE';
  return 'CLEAR';
}

module.exports = router;
