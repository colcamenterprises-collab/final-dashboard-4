export const generateEmailTemplate = (subject: string, content: string) => {
  return `
    <html>
      <head><title>${subject}</title></head>
      <body style="font-family: Arial, sans-serif;">
        <h2>${subject}</h2>
        <p>${content}</p>
      </body>
    </html>
  `;
};
