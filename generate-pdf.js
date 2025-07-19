import fs from 'fs';

// Simple HTML to PDF conversion using system tools
async function generatePDF() {
  try {
    console.log('Converting documentation to PDF...');
    
    // Read the markdown file
    const markdownContent = fs.readFileSync('PROJECT_DOCUMENTATION.md', 'utf8');
    
    // Create a well-formatted HTML version
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Restaurant Management Dashboard Documentation</title>
        <style>
            @page {
                margin: 1in;
                size: A4;
            }
            body {
                font-family: 'Arial', sans-serif;
                line-height: 1.6;
                color: #333;
                font-size: 12px;
                background: white;
            }
            h1 {
                color: #2c3e50;
                border-bottom: 3px solid #3498db;
                padding-bottom: 10px;
                font-size: 24px;
                margin-bottom: 20px;
                page-break-after: avoid;
            }
            h2 {
                color: #34495e;
                border-bottom: 2px solid #ecf0f1;
                padding-bottom: 5px;
                margin-top: 30px;
                margin-bottom: 15px;
                font-size: 18px;
                page-break-after: avoid;
            }
            h3 {
                color: #2c3e50;
                margin-top: 20px;
                margin-bottom: 10px;
                font-size: 16px;
                page-break-after: avoid;
            }
            h4 {
                color: #34495e;
                margin-top: 15px;
                margin-bottom: 8px;
                font-size: 14px;
                page-break-after: avoid;
            }
            p {
                margin-bottom: 10px;
                text-align: justify;
            }
            ul, ol {
                margin-bottom: 10px;
                padding-left: 20px;
            }
            li {
                margin-bottom: 5px;
            }
            code {
                background-color: #f8f9fa;
                padding: 2px 4px;
                border-radius: 3px;
                font-family: 'Courier New', monospace;
                font-size: 11px;
            }
            pre {
                background-color: #f8f9fa;
                padding: 10px;
                border-radius: 5px;
                overflow-x: auto;
                border-left: 4px solid #3498db;
                margin: 15px 0;
                font-size: 11px;
            }
            .section-break {
                page-break-before: always;
            }
            strong {
                font-weight: bold;
                color: #2c3e50;
            }
            .toc {
                page-break-after: always;
                background-color: #f8f9fa;
                padding: 20px;
                border-radius: 5px;
                margin-bottom: 30px;
            }
        </style>
    </head>
    <body>
        <div class="header-info">
            <h1>Restaurant Management Dashboard</h1>
            <h2>Complete Operational Documentation</h2>
            <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>Version:</strong> 1.0</p>
            <p><strong>Restaurant:</strong> Smash Brothers Burgers</p>
        </div>
        
        <div class="toc">
            <h2>Table of Contents</h2>
            <ul>
                <li>Project Overview</li>
                <li>Technical Architecture</li>
                <li>Core System Components</li>
                <li>Database Schema</li>
                <li>External Integrations</li>
                <li>Environment Variables</li>
                <li>Automated Processes</li>
                <li>Key Operational Workflows</li>
                <li>Deployment Instructions</li>
                <li>Troubleshooting Guide</li>
                <li>Security Considerations</li>
                <li>Maintenance Procedures</li>
            </ul>
        </div>
        
        <div class="section-break"></div>
        
        ${markdownContent
          .replace(/^# (.+)$/gm, '<h1>$1</h1>')
          .replace(/^## (.+)$/gm, '<h2>$1</h2>')
          .replace(/^### (.+)$/gm, '<h3>$1</h3>')
          .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
          .replace(/^\*\*([^*]+)\*\*:/gm, '<strong>$1</strong>:')
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/\*([^*]+)\*/g, '<em>$1</em>')
          .replace(/\`([^`]+)\`/g, '<code>$1</code>')
          .replace(/^- (.+)$/gm, '<li>$1</li>')
          .replace(/\n\n/g, '</p><p>')
          .replace(/\n/g, '<br>')
          .split('<li>')
          .join('</ul><ul><li>')
          .replace(/<\/ul><ul>/g, '')
          .replace(/^<ul>/, '<ul>')
          .replace(/<li><\/p>/g, '<li>')
          .replace(/<br><li>/g, '<li>')
        }
        
        <div style="margin-top: 50px; text-align: center; font-size: 10px; color: #666;">
            <hr>
            <p>This documentation was generated automatically from the Restaurant Management Dashboard project.</p>
            <p>For technical support, refer to the project files in the Replit workspace.</p>
        </div>
    </body>
    </html>
    `;
    
    // Write the HTML file
    fs.writeFileSync('Restaurant_Management_Dashboard_Documentation.html', htmlContent);
    
    console.log('HTML documentation generated: Restaurant_Management_Dashboard_Documentation.html');
    console.log('You can open this file in a browser and use Print -> Save as PDF to convert it.');
    
    // Also create a simplified text version for easy reading
    const textContent = markdownContent
      .replace(/^#+\s/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1');
    
    fs.writeFileSync('Restaurant_Management_Dashboard_Documentation.txt', textContent);
    console.log('Text documentation generated: Restaurant_Management_Dashboard_Documentation.txt');
    
  } catch (error) {
    console.error('Error generating documentation:', error);
  }
}

generatePDF();