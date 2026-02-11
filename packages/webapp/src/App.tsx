import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Properties } from './pages/Properties';
import { Queue } from './pages/Queue';
import { Settings } from './pages/Settings';
import { FieldOpsReview } from './pages/FieldOpsReview';
import { MobileRoutePack } from './pages/MobileRoutePack';

const HashRouteBridge = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!window.location.hash.startsWith('#/')) {
      return;
    }

    const targetPath = window.location.hash.slice(1);
    navigate(targetPath, { replace: true });
  }, [navigate]);

  return null;
};

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <HashRouteBridge />
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/properties" element={<Properties />} />
            <Route path="/queue" element={<Queue />} />
            <Route path="/field-ops" element={<FieldOpsReview />} />
            <Route path="/mobile-pack" element={<MobileRoutePack />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
