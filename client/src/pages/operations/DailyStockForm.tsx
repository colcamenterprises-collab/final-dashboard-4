import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { LanguageToggle } from '../../components/LanguageToggle';

const labels = {
  en: { 
    rollsEnd: 'Ending Rolls Count', 
    meatCount: 'Meat Count', 
    drinksEnd: 'Drinks Counts (JSON)',
    requisition: 'Requisition Items',
    submit: 'Submit Stock' 
  },
  th: { 
    rollsEnd: 'จำนวนม้วนสิ้นสุด', 
    meatCount: 'จำนวนเนื้อ', 
    drinksEnd: 'จำนวนเครื่องดื่ม (JSON)',
    requisition: 'รายการที่เบิก',
    submit: 'ส่งข้อมูลสต็อก' 
  }
};

const DailyStockForm = () => {
  const [lang, setLang] = useState('en');
  const [formData, setFormData] = useState({ 
    rollsEnd: '', 
    meatCount: '', 
    drinksEnd: [], 
    requisition: [] 
  });
  const [errors, setErrors] = useState([]);
  const mutation = useMutation({ 
    mutationFn: (data) => axios.post('/api/forms/daily-stock', data) 
  });

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = () => {
    const newErrors = [];
    // Fixed zero handling - zero should be valid (non-negative)
    if (formData.rollsEnd === '' || formData.rollsEnd == null || parseInt(formData.rollsEnd) < 0) newErrors.push('rollsEnd');
    if (formData.meatCount === '' || formData.meatCount == null || parseInt(formData.meatCount) < 0) newErrors.push('meatCount');
    if (formData.drinksEnd.length === 0) newErrors.push('drinksEnd');
    if (formData.requisition.length === 0) newErrors.push('requisition');
    setErrors(newErrors);
    if (newErrors.length) {
      return; // Prevent submit
    }
    mutation.mutate(formData);
  };

  return (
    <div className="p-4 space-y-4" data-testid="daily-stock-form">
      <LanguageToggle onChange={setLang} currentLang={lang} />
      
      <div>
        <label className="text-sm font-medium">{labels[lang].rollsEnd}</label>
        <input 
          type="number" 
          min="0" 
          value={formData.rollsEnd} 
          onChange={e => handleChange('rollsEnd', e.target.value)} 
          className={`border w-full p-2 ${errors.includes('rollsEnd') ? 'border-red-500' : ''}`} 
          placeholder="Enter non-negative number"
          data-testid="input-rollsEnd"
        />
        {errors.includes('rollsEnd') && (
          <p className="text-red-500 text-sm">Rolls count is required and must be non-negative for accurate stock tracking and theft prevention.</p>
        )}
      </div>
      
      <div>
        <label className="text-sm font-medium">{labels[lang].meatCount}</label>
        <input 
          type="number" 
          min="0" 
          value={formData.meatCount} 
          onChange={e => handleChange('meatCount', e.target.value)} 
          className={`border w-full p-2 ${errors.includes('meatCount') ? 'border-red-500' : ''}`} 
          placeholder="Enter non-negative number"
          data-testid="input-meatCount"
        />
        {errors.includes('meatCount') && (
          <p className="text-red-500 text-sm">Meat count is required and must be non-negative to ensure inventory accuracy.</p>
        )}
      </div>
      
      <div>
        <label className="text-sm font-medium">{labels[lang].drinksEnd}</label>
        <textarea 
          value={JSON.stringify(formData.drinksEnd)} 
          onChange={e => {
            try {
              handleChange('drinksEnd', JSON.parse(e.target.value || '[]'));
            } catch {
              handleChange('drinksEnd', []);
            }
          }}
          className={`border w-full p-2 ${errors.includes('drinksEnd') ? 'border-red-500' : ''}`} 
          placeholder='[{"drink":"Coke","qty":10}]'
          data-testid="input-drinksEnd"
        />
        {errors.includes('drinksEnd') && (
          <p className="text-red-500 text-sm">At least one drink count is required for complete stock reconciliation.</p>
        )}
      </div>
      
      <div>
        <label className="text-sm font-medium">{labels[lang].requisition}</label>
        <textarea 
          value={JSON.stringify(formData.requisition)} 
          onChange={e => {
            try {
              handleChange('requisition', JSON.parse(e.target.value || '[]'));
            } catch {
              handleChange('requisition', []);
            }
          }}
          className={`border w-full p-2 ${errors.includes('requisition') ? 'border-red-500' : ''}`} 
          placeholder='[{"id":"item1","qty":2}]'
          data-testid="input-requisition"
        />
        {errors.includes('requisition') && (
          <p className="text-red-500 text-sm">Requisition items are required for inventory tracking.</p>
        )}
      </div>
      
      <button 
        onClick={handleSubmit} 
        className="bg-blue-500 text-white p-2 w-full"
        data-testid="button-submit"
        disabled={mutation.isLoading}
      >
        {mutation.isLoading ? 'Submitting...' : labels[lang].submit}
      </button>
      
      {errors.length > 0 && (
        <p className="text-red-500">Form cannot submit due to missing/invalid fields. Please correct highlighted areas for data accuracy.</p>
      )}
      
      {mutation.isSuccess && (
        <p className="text-green-500">Stock data submitted successfully!</p>
      )}
      
      {mutation.isError && (
        <p className="text-red-500">Error: {mutation.error?.response?.data?.error || 'Submission failed'}</p>
      )}
    </div>
  );
};

export default DailyStockForm;