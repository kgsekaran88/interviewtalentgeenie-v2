import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';
import { logger } from '@/lib/logger';

/**
 * Export documentation to PDF with proper formatting
 */
export async function exportToPDF(title: string, content: string, category: string) {
  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Set document properties
    pdf.setProperties({
      title: title,
      subject: `${category} Documentation`,
      author: 'TalentGeenie Platform',
      keywords: 'documentation, interview, ai',
      creator: 'TalentGeenie Documentation Center',
    });

    // Page margins
    const margin = 20;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - 2 * margin;
    let yPosition = margin;

    // Add title
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    const titleLines = pdf.splitTextToSize(title, contentWidth);
    pdf.text(titleLines, margin, yPosition);
    yPosition += titleLines.length * 10 + 10;

    // Add category badge
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Category: ${category}`, margin, yPosition);
    yPosition += 10;

    // Add horizontal line
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // Parse markdown and convert to plain text with formatting
    const plainText = stripMarkdown(content);
    
    // Add content
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);

    // Split content into lines and handle pagination
    const lines = plainText.split('\n');
    
    for (const line of lines) {
      // Check if we need a new page
      if (yPosition > pageHeight - margin - 10) {
        pdf.addPage();
        yPosition = margin;
      }

      // Handle different line types
      if (line.startsWith('# ')) {
        // Main heading
        pdf.setFontSize(18);
        pdf.setFont('helvetica', 'bold');
        const text = line.substring(2);
        const textLines = pdf.splitTextToSize(text, contentWidth);
        pdf.text(textLines, margin, yPosition);
        yPosition += textLines.length * 8 + 5;
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
      } else if (line.startsWith('## ')) {
        // Sub heading
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        const text = line.substring(3);
        const textLines = pdf.splitTextToSize(text, contentWidth);
        pdf.text(textLines, margin, yPosition);
        yPosition += textLines.length * 7 + 4;
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
      } else if (line.startsWith('### ')) {
        // Sub-sub heading
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        const text = line.substring(4);
        const textLines = pdf.splitTextToSize(text, contentWidth);
        pdf.text(textLines, margin, yPosition);
        yPosition += textLines.length * 6 + 3;
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        // Bullet points
        const text = '• ' + line.substring(2);
        const textLines = pdf.splitTextToSize(text, contentWidth - 5);
        pdf.text(textLines, margin + 5, yPosition);
        yPosition += textLines.length * 5 + 2;
      } else if (line.trim() === '') {
        // Empty line
        yPosition += 3;
      } else {
        // Regular paragraph
        const textLines = pdf.splitTextToSize(line, contentWidth);
        pdf.text(textLines, margin, yPosition);
        yPosition += textLines.length * 5 + 2;
      }
    }

    // Add footer with page numbers
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(9);
      pdf.setTextColor(150, 150, 150);
      pdf.text(
        `Page ${i} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    // Save the PDF
    const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    pdf.save(fileName);

    return { success: true, fileName };
  } catch (error) {
    logger.error('Error exporting to PDF:', error);
    throw new Error('Failed to export to PDF');
  }
}

/**
 * Export documentation to Word document with proper formatting
 */
export async function exportToWord(title: string, content: string, category: string) {
  try {
    // Parse markdown content and create Word document paragraphs
    const paragraphs: Paragraph[] = [];

    // Add title
    paragraphs.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.TITLE,
        spacing: { after: 200 },
      })
    );

    // Add category badge
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Category: ${category}`,
            bold: true,
            color: '4A90E2',
            size: 20,
          }),
        ],
        spacing: { after: 400 },
        border: {
          bottom: {
            color: 'E0E0E0',
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
      })
    );

    // Parse markdown line by line
    const lines = content.split('\n');
    let inCodeBlock = false;
    let codeBlockLines: string[] = [];

    for (const line of lines) {
      // Handle code blocks
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockLines = [];
        } else {
          // End code block - add accumulated lines
          if (codeBlockLines.length > 0) {
            paragraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: codeBlockLines.join('\n'),
                    font: 'Courier New',
                    size: 18,
                  }),
                ],
                shading: {
                  fill: 'F5F5F5',
                },
                spacing: { before: 100, after: 100 },
              })
            );
          }
          inCodeBlock = false;
          codeBlockLines = [];
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockLines.push(line);
        continue;
      }

      // H1 Headers
      if (line.startsWith('# ')) {
        paragraphs.push(
          new Paragraph({
            text: line.substring(2),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 150 },
          })
        );
      }
      // H2 Headers
      else if (line.startsWith('## ')) {
        paragraphs.push(
          new Paragraph({
            text: line.substring(3),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 250, after: 120 },
          })
        );
      }
      // H3 Headers
      else if (line.startsWith('### ')) {
        paragraphs.push(
          new Paragraph({
            text: line.substring(4),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 100 },
          })
        );
      }
      // Bullet lists
      else if (line.startsWith('- ') || line.startsWith('* ')) {
        paragraphs.push(
          new Paragraph({
            text: line.substring(2),
            bullet: { level: 0 },
            spacing: { before: 50, after: 50 },
          })
        );
      }
      // Numbered lists
      else if (/^\d+\./.test(line)) {
        paragraphs.push(
          new Paragraph({
            text: line.replace(/^\d+\.\s*/, ''),
            numbering: { reference: 'default-numbering', level: 0 },
            spacing: { before: 50, after: 50 },
          })
        );
      }
      // Blockquotes
      else if (line.startsWith('> ')) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line.substring(2),
                italics: true,
                color: '555555',
              }),
            ],
            spacing: { before: 100, after: 100 },
            indent: { left: 720 },
            border: {
              left: {
                color: 'E0E0E0',
                space: 8,
                style: BorderStyle.SINGLE,
                size: 24,
              },
            },
          })
        );
      }
      // Empty lines
      else if (line.trim() === '') {
        paragraphs.push(
          new Paragraph({
            text: '',
            spacing: { after: 100 },
          })
        );
      }
      // Regular paragraphs with inline formatting
      else if (line.trim() !== '') {
        const children: TextRun[] = [];
        
        // Handle bold text
        if (line.includes('**')) {
          const parts = line.split('**');
          parts.forEach((part, i) => {
            if (part) {
              children.push(
                new TextRun({
                  text: part,
                  bold: i % 2 === 1,
                })
              );
            }
          });
        } else {
          children.push(new TextRun({ text: line }));
        }

        paragraphs.push(
          new Paragraph({
            children,
            spacing: { after: 120 },
            alignment: AlignmentType.LEFT,
          })
        );
      }
    }

    // Create document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });

    // Generate and download
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true, fileName: link.download };
  } catch (error) {
    logger.error('Error exporting to Word:', error);
    throw new Error('Failed to export to Word document');
  }
}

/**
 * Strip markdown formatting to plain text while preserving structure
 */
function stripMarkdown(markdown: string): string {
  let text = markdown;

  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, '');

  // Remove images
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');

  // Remove links but keep text
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

  // Remove inline code backticks
  text = text.replace(/`([^`]*)`/g, '$1');

  // Remove code blocks but keep content
  text = text.replace(/```[\s\S]*?```/g, (match) => {
    return match.replace(/```\w*\n?/g, '').trim();
  });

  // Remove bold/italic
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');

  // Remove strikethrough
  text = text.replace(/~~(.*?)~~/g, '$1');

  // Keep heading markers for PDF formatting
  // (already handled in the markdown)

  return text;
}
