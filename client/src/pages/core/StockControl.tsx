import { useEffect, useState } from 'react';
import VarianceTable from '@/components/core/VarianceTable';
export default function StockControl(){const [d,setD]=useState<any>(null);const date=new Date().toISOString().slice(0,10);useEffect(()=>{fetch('/api/core/stock-status/'+date,{credentials:'include'}).then(r=>r.json()).then(setD)},[date]);return <div className='space-y-3'><h1 className='text-2xl font-semibold'>Stock Control</h1>{d&&<VarianceTable data={d}/>}</div>}
