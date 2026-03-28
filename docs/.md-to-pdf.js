module.exports = {
  stylesheet: [],
  css: `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.6; color: #1a1a1a; max-width: 100%; }
    h1 { color: #1a365d; border-bottom: 3px solid #3b82f6; padding-bottom: 8px; font-size: 24px; }
    h2 { color: #1e40af; border-bottom: 1px solid #93c5fd; padding-bottom: 4px; font-size: 18px; page-break-before: auto; }
    h3 { color: #2563eb; font-size: 15px; }
    h4 { color: #3b82f6; font-size: 13px; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 11px; }
    th { background-color: #eff6ff; color: #1e40af; padding: 6px 8px; border: 1px solid #93c5fd; text-align: left; }
    td { padding: 5px 8px; border: 1px solid #dbeafe; }
    tr:nth-child(even) { background-color: #f8fafc; }
    code { background-color: #f1f5f9; padding: 1px 4px; border-radius: 3px; font-size: 11px; }
    pre { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; font-size: 10px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 4px solid #3b82f6; padding-left: 12px; color: #475569; }
    .mermaid { text-align: center; margin: 16px 0; }
    hr { border: none; border-top: 1px solid #e2e8f0; margin: 20px 0; }
  `,
  body_class: [],
  marked_options: {},
  pdf_options: {
    format: 'A4',
    margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div style="font-size:8px;color:#94a3b8;width:100%;text-align:center;padding:0 15mm;">TalentGeenie — Technical Documentation</div>',
    footerTemplate: '<div style="font-size:8px;color:#94a3b8;width:100%;text-align:center;padding:0 15mm;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
  },
  launch_options: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
  marked_extensions: [],
};
