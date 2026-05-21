const router = require('express').Router();
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth');

// ── Page geometry ─────────────────────────────────────────────────────────────
const MARGIN      = 50;
const PAGE_W      = 595.28;
const PAGE_H      = 841.89;
const CONTENT_W   = PAGE_W - MARGIN * 2;          // 495.28 pt
const FOOTER_H    = 58;
const SAFE_BOTTOM = PAGE_H - MARGIN - FOOTER_H;   // last y content may reach

// Column widths — must sum to CONTENT_W (495)
const COL = {
  risk:        62,
  name:       112,
  alias:      100,
  allAliases:  82,
  source:      31,
  nationality: 60,
  dob:         48,
};
// 62+112+100+82+31+60+48 = 495 ✓

// ── Helpers ───────────────────────────────────────────────────────────────────
function riskLabel(level) {
  if (level === 'confirmed_match') return 'CONFIRMED';
  if (level === 'possible_match')  return 'POSSIBLE';
  return 'CLEAR';
}

function riskColor(level) {
  if (level === 'confirmed_match') return '#CC0000';
  if (level === 'possible_match')  return '#B35900';
  return '#1a7a1a';
}

// Strip characters outside Helvetica's supported range (printable ASCII +
// Latin-1 Supplement).  Arabic, CJK, and other Unicode blocks have no glyphs
// in the built-in PDF fonts and render as garbage.
function cleanText(val) {
  if (val === null || val === undefined) return '—';
  const cleaned = String(val)
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')  // keep printable ASCII + Latin-1
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || '—';
}

function aliasesToText(aliases) {
  if (!aliases || !aliases.length) return '—';
  return aliases
    .map(a => cleanText(typeof a === 'string' ? a : a.alias_name))
    .filter(s => s && s !== '—')
    .join(', ') || '—';
}

// ── Route ────────────────────────────────────────────────────────────────────
router.post('/', requireAuth, (req, res) => {
  const { query, risk_level, results, searched_at } = req.body;
  if (!query || !results) {
    return res.status(400).json({ error: 'query and results are required' });
  }

  const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="sanctions-report-${Date.now()}.pdf"`);
  doc.pipe(res);

  let pageNum = 1;

  // ── Footer — drawn at absolute position, never affects doc.y for content ──
  function drawFooter() {
    const fy = PAGE_H - MARGIN - FOOTER_H + 4;
    doc.save();
    doc.moveTo(MARGIN, fy).lineTo(PAGE_W - MARGIN, fy)
       .strokeColor('#bbbbbb').lineWidth(0.5).stroke();
    doc.fontSize(7).fillColor('#888888')
       .text(
         'This report was generated automatically by the Sanctions Screening System. ' +
         'It should be reviewed by a qualified compliance officer before any decision is made.',
         MARGIN, fy + 7, { width: CONTENT_W, align: 'center' }
       )
       .text(
         '© 2026 Al Naqbi & Partners. All rights reserved.',
         MARGIN, fy + 18, { width: CONTENT_W, align: 'center' }
       )
       .text(
         `Page ${pageNum}`,
         MARGIN, fy + 29, { width: CONTENT_W, align: 'center' }
       );
    doc.restore();
    // restore() resets graphics state but not doc.y — reset explicitly
    doc.fillColor('black').strokeColor('black').lineWidth(1);
  }

  function addPage() {
    drawFooter();
    doc.addPage();
    pageNum++;
  }

  function needsNewPage(requiredHeight) {
    return doc.y + requiredHeight > SAFE_BOTTOM;
  }

  // ── Logo (try backend/assets first, then local frontend path) ─────────────
  const logoCandidates = [
    path.join(__dirname, '../../assets/alnaqbi_logo.png'),
    path.join(__dirname, '../../../frontend/src/assets/alnaqbi_logo.png'),
  ];
  const logoPath = logoCandidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });

  // ── HEADER ────────────────────────────────────────────────────────────────
  if (logoPath) {
    doc.image(logoPath, { width: 110, align: 'center' });
    doc.moveDown(0.4);
  }

  doc.fontSize(16).font('Helvetica-Bold').fillColor('#1a1a2e')
     .text('SANCTIONS SCREENING REPORT', { align: 'center' });
  doc.moveDown(0.25);
  doc.fontSize(9).font('Helvetica').fillColor('#555555')
     .text('Confidential – For Internal Use Only', { align: 'center' });
  doc.moveDown(0.5);
  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_W - MARGIN, doc.y)
     .strokeColor('#1a1a2e').lineWidth(1.5).stroke();
  doc.strokeColor('black').lineWidth(1).fillColor('black');
  doc.moveDown(0.9);

  // ── SEARCH DETAILS ────────────────────────────────────────────────────────
  const searchDate = searched_at ? new Date(searched_at) : new Date();
  const dateStr    = searchDate.toLocaleString('en-GB', { timeZone: 'Asia/Dubai' }) + ' (GST)';

  doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a1a2e').text('Search Details');
  doc.moveDown(0.35);

  const LABEL_W = 88;
  const VALUE_W = CONTENT_W - LABEL_W;
  for (const [label, value] of [
    ['Date / Time',  dateStr],
    ['Searched By',  req.user.email],
    ['Search Term',  query],
    ['Overall Risk', riskLabel(risk_level)],
  ]) {
    const y0 = doc.y;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#333333')
       .text(label, MARGIN, y0, { width: LABEL_W, lineBreak: false });
    doc.fontSize(9).font('Helvetica').fillColor('black')
       .text(value, MARGIN + LABEL_W, y0, { width: VALUE_W });
    doc.moveDown(0.1);
  }
  doc.moveDown(0.9);

  // ── RESULTS ───────────────────────────────────────────────────────────────
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a1a2e').text('Results');
  doc.moveDown(0.4);

  if (!results.length) {
    doc.fontSize(10).font('Helvetica').fillColor('#1a7a1a')
       .text('✓  No matches found — CLEAR', { align: 'center' });
    doc.fillColor('black');
  } else {

    // ── Table header ──────────────────────────────────────────────────────
    function drawTableHeader() {
      const hy  = doc.y;
      const hh  = 18;
      doc.rect(MARGIN, hy, CONTENT_W, hh).fill('#1a1a2e');

      const headers = [
        ['Risk',          COL.risk],
        ['Primary Name',  COL.name],
        ['Matched Alias', COL.alias],
        ['All Aliases',   COL.allAliases],
        ['Src',           COL.source],
        ['Nationality',   COL.nationality],
        ['DOB',           COL.dob],
      ];

      doc.fontSize(8).font('Helvetica-Bold').fillColor('white');
      let hx = MARGIN + 3;
      for (const [label, w] of headers) {
        doc.text(label, hx, hy + 5, { width: w - 6, lineBreak: false });
        hx += w;
      }
      doc.fillColor('black').font('Helvetica');
      doc.y = hy + hh;
    }

    drawTableHeader();

    // ── Table rows ────────────────────────────────────────────────────────
    let rowIdx = 0;
    for (const r of results) {
      const matchedText  = aliasesToText(r.matched_aliases || (r.matched_alias ? [r.matched_alias] : []));
      const allAliasText = aliasesToText(r.all_aliases    || (r.matched_alias ? [r.matched_alias] : []));

      // Pre-measure each cell to find the tallest
      doc.fontSize(8).font('Helvetica');
      const cells = [
        { text: riskLabel(r.risk_level),         w: COL.risk        - 6 },
        { text: cleanText(r.primary_name),        w: COL.name        - 6 },
        { text: matchedText,                      w: COL.alias       - 6 },
        { text: allAliasText,                     w: COL.allAliases  - 6 },
        { text: cleanText(r.source),              w: COL.source      - 6 },
        { text: cleanText(r.nationality),         w: COL.nationality - 6 },
        { text: cleanText(r.dob),                 w: COL.dob         - 6 },
      ];
      const contentH = Math.max(...cells.map(c => doc.heightOfString(c.text, { width: c.w })), 12);
      const rowH     = contentH + 8;

      if (needsNewPage(rowH)) {
        addPage();
        drawTableHeader();
      }

      const ry = doc.y;

      // Alternating row background
      doc.rect(MARGIN, ry, CONTENT_W, rowH)
         .fill(rowIdx % 2 === 0 ? '#f5f6f8' : '#ffffff');

      // Vertical grid lines
      doc.strokeColor('#d0d4da').lineWidth(0.4);
      let gx = MARGIN;
      for (const w of [COL.risk, COL.name, COL.alias, COL.allAliases, COL.source, COL.nationality]) {
        gx += w;
        doc.moveTo(gx, ry).lineTo(gx, ry + rowH).stroke();
      }
      // Bottom row border
      doc.moveTo(MARGIN, ry + rowH).lineTo(PAGE_W - MARGIN, ry + rowH).stroke();
      doc.strokeColor('black').lineWidth(1);

      // Cell text — render each cell at explicit (x, y)
      const ty = ry + 4;
      let cx   = MARGIN + 3;

      doc.fontSize(8).font('Helvetica-Bold').fillColor(riskColor(r.risk_level))
         .text(riskLabel(r.risk_level), cx, ty, { width: COL.risk - 6, lineBreak: true });
      cx += COL.risk;

      doc.font('Helvetica').fillColor('#111111');
      doc.text(cleanText(r.primary_name), cx, ty, { width: COL.name        - 6, lineBreak: true }); cx += COL.name;
      doc.text(matchedText,               cx, ty, { width: COL.alias       - 6, lineBreak: true }); cx += COL.alias;
      doc.text(allAliasText,              cx, ty, { width: COL.allAliases  - 6, lineBreak: true }); cx += COL.allAliases;
      doc.text(cleanText(r.source),       cx, ty, { width: COL.source      - 6, lineBreak: true }); cx += COL.source;
      doc.text(cleanText(r.nationality),  cx, ty, { width: COL.nationality - 6, lineBreak: true }); cx += COL.nationality;
      doc.text(cleanText(r.dob),          cx, ty, { width: COL.dob         - 6, lineBreak: true });

      doc.y = ry + rowH;
      rowIdx++;
    }
  }

  // Footer on the final page, then close
  drawFooter();
  doc.end();
});

module.exports = router;
