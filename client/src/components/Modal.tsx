export default function Modal({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-xl max-h-[80vh] overflow-y-auto max-w-2xl w-full mx-4">
        {children}
      </div>
    </div>
  );
}
