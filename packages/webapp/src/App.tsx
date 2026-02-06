import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import { PropertyDashboard } from './components/PropertyDashboard';

function App() {
  const handleQueueSuccess = () => {
    console.log('Queue operation completed successfully');
    // This callback can be used to trigger refreshes or navigation
  };

  return (
    <AppProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <h1 className="text-2xl font-bold text-gray-900">SCE2 Webapp</h1>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Routes>
              <Route
                path="/"
                element={<PropertyDashboard onQueueSuccess={handleQueueSuccess} />}
              />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
