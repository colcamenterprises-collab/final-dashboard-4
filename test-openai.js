import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function testOpenAI() {
  try {
    console.log('Testing OpenAI connection...');
    console.log('API Key present:', !!process.env.OPENAI_API_KEY);
    console.log('API Key length:', process.env.OPENAI_API_KEY?.length);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say "Hello" if you can read this.' }],
      temperature: 0.1,
    });

    console.log('OpenAI Response:', response.choices[0].message.content);
    console.log('✅ OpenAI connection successful!');
  } catch (error) {
    console.error('❌ OpenAI Error:', error.message);
    console.error('Error details:', error);
  }
}

testOpenAI();