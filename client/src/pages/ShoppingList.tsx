import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';

export default function ShoppingList() {
  const { data, isLoading, error } = useQuery({ 
    queryKey: ['shopping-list'], 
    queryFn: () => fetch('/api/shopping-list').then(res => res.json())
  });
  
  const { groupedList, totalItems } = data || { groupedList: {}, totalItems: 0 };

  // CSV Export function
  const exportCSV = () => {
    let csv = 'Category,Item,Quantity\n';
    for (const cat in groupedList) {
      groupedList[cat].forEach((i: any) => csv += `${cat},${i.name},${i.qty}\n`);
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shopping-list.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {(error as Error).message}</div>;

  return (
    <div>
      <h1>Shopping List</h1>
      {Object.keys(groupedList).map(cat => (
        <div key={cat}>
          <h2>{cat}</h2>
          <table>
            <thead><tr><th>Item</th><th>Quantity</th></tr></thead>
            <tbody>
              {groupedList[cat].map((i: any) => (
                <tr key={i.name}><td>{i.name}</td><td>{i.qty}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <p>Total Items: {totalItems}</p>
      <Button onClick={exportCSV}>Export CSV</Button>
    </div>
  );
}