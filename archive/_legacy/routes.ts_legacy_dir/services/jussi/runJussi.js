/**
 * Jussi worker - generate and send daily management reports
 */
import { generateDailySummary } from './summaryGenerator.js';

async function runJussi() {
  try {
    console.log('Starting Jussi daily summary generation...');
    
    // Generate summary for default restaurant (will use Smash Brothers Burgers)
    const result = await generateDailySummary();
    
    console.log('Jussi summary completed successfully:', {
      jobId: result.jobId,
      emailSent: !!result.emailResult,
      recipient: result.emailResult?.recipient
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Jussi summary failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runJussi();
}

export { runJussi };