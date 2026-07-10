export default function Dashboard() {
    return (
      <div className="space-y-8">
  
        {/* Welcome Banner */}
  
        <section
          className="
            rounded-3xl
            bg-gradient-to-r
            from-blue-600
            via-indigo-600
            to-purple-600
            text-white
            p-8
            shadow-xl
            overflow-hidden
            relative
          "
        >
          <div
            className="
              absolute
              -right-16
              -top-16
              w-60
              h-60
              rounded-full
              bg-white/10
              blur-3xl
            "
          />
  
          <div className="relative z-10">
  
            <h1 className="text-4xl font-bold">
              Welcome back 👋
            </h1>
  
            <p className="mt-3 text-blue-100 max-w-2xl">
              Manage invoices, upload documents,
              analyze OCR results and download reports
              from one beautiful dashboard.
            </p>
  
            <div className="flex flex-wrap gap-3 mt-8">
  
              <button
                className="
                  px-6
                  py-3
                  rounded-xl
                  bg-white
                  text-blue-700
                  font-semibold
                  hover:shadow-xl
                  transition
                "
              >
                Upload Invoice
              </button>
  
              <button
                className="
                  px-6
                  py-3
                  rounded-xl
                  bg-white/10
                  border
                  border-white/20
                  hover:bg-white/20
                  transition
                "
              >
                View Reports
              </button>
  
            </div>
  
          </div>
  
        </section>
  
        {/* Dashboard Content */}
  
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
  
          <div className="xl:col-span-2 space-y-6">
  
            <div className="bg-white rounded-2xl shadow-sm border p-6">
              <h2 className="text-xl font-semibold mb-4">
                Recent Invoices
              </h2>
  
              <p className="text-slate-500">
                Invoice table will come here.
              </p>
            </div>
  
            <div className="bg-white rounded-2xl shadow-sm border p-6">
              <h2 className="text-xl font-semibold mb-4">
                Invoice Activity
              </h2>
  
              <p className="text-slate-500">
                Activity timeline...
              </p>
            </div>
  
          </div>
  
          <div className="space-y-6">
  
            <div className="bg-white rounded-2xl shadow-sm border p-6">
              <h2 className="text-xl font-semibold mb-4">
                Quick Upload
              </h2>
  
              <p className="text-slate-500">
                Upload widget...
              </p>
            </div>
  
            <div className="bg-white rounded-2xl shadow-sm border p-6">
              <h2 className="text-xl font-semibold mb-4">
                OCR Status
              </h2>
  
              <p className="text-slate-500">
                OCR statistics...
              </p>
            </div>
  
          </div>
  
        </div>
  
      </div>
    );
  }