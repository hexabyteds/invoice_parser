export default function Report() {
    return (
      <div className="space-y-6">
  
        <div>
          <h1 className="text-3xl font-bold text-slate-800">
            Reports
          </h1>
  
          <p className="text-slate-500 mt-2">
            Invoice analytics and exports.
          </p>
        </div>
  
        <div className="grid md:grid-cols-2 gap-6">
  
          <div className="bg-white rounded-2xl border shadow-sm p-8">
            <h2 className="text-xl font-semibold mb-4">
              Monthly Summary
            </h2>
  
            <p className="text-slate-500">
              Charts will be displayed here.
            </p>
          </div>
  
          <div className="bg-white rounded-2xl border shadow-sm p-8">
            <h2 className="text-xl font-semibold mb-4">
              Export Reports
            </h2>
  
            <button className="bg-blue-600 text-white px-5 py-2 rounded-xl hover:bg-blue-700">
              Download Excel
            </button>
          </div>
  
        </div>
  
      </div>
    );
  }